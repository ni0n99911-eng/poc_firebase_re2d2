#!/usr/bin/env python3
"""
RE² Thread 2 — Bulk loader: pre-processed Socrata data → block_group_intel
Reads JSON data files produced by the spatial-join pipeline and upserts to
Supabase via PostgREST.  Resumable: skips geoids already loaded per source.

Usage:
    python scripts/load-socrata.py                  # load all sources
    python scripts/load-socrata.py nypd_crime       # load one source
    python scripts/load-socrata.py --dry-run        # preview without writing
    python scripts/load-socrata.py --status         # show current DB counts

Requires:  pip install requests python-dotenv
Env vars:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (reads from .env)
"""

import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# -- Config ---------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "socrata-data"

load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    sys.exit(1)

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

BATCH_SIZE = 200

SOURCES = [
    "nypd_crime",
    "311_complaints",
    "dob_permits",
    "dca_licenses",
    "lpc_landmarks",
    "sidewalk_cafes",
    "dohmh_inspections",
]


# -- Helpers ---------------------------------------------------------------

def api_get(path, params=None):
    """GET from Supabase REST API with retries."""
    url = f"{REST}/{path}"
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                raise
            print(f"  Retry {attempt+1}/3: {e}")
            time.sleep(2 ** attempt)


def api_post(path, payload):
    """POST to Supabase REST API with retries."""
    url = f"{REST}/{path}"
    for attempt in range(3):
        try:
            r = requests.post(url, headers=HEADERS, json=payload, timeout=60)
            if r.status_code in (200, 201):
                return True
            if r.status_code == 409:
                return True
            print(f"  HTTP {r.status_code}: {r.text[:200]}")
            if attempt == 2:
                return False
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                print(f"  FAILED after 3 attempts: {e}")
                return False
            print(f"  Retry {attempt+1}/3: {e}")
        time.sleep(2 ** attempt)
    return False


def get_existing_geoids(source):
    """Fetch all geoids already loaded for this source (for resume)."""
    geoids = set()
    offset = 0
    while True:
        params = {
            "select": "geoid",
            "source": f"eq.{source}",
            "limit": 1000,
            "offset": offset,
        }
        data = api_get("block_group_intel", params)
        if not data:
            break
        for row in data:
            geoids.add(row["geoid"])
        if len(data) < 1000:
            break
        offset += 1000
    return geoids


def load_data_file(source):
    """Load pre-processed JSON data for a source."""
    path = DATA_DIR / f"data-{source}.json"
    if not path.exists():
        print(f"  ERROR: data file not found: {path}")
        return None
    with open(path) as f:
        return json.load(f)


# -- Commands --------------------------------------------------------------

def show_status():
    """Show current block_group_intel counts per source."""
    print("Current block_group_intel status:")
    print("-" * 50)
    for source in SOURCES:
        existing = get_existing_geoids(source)
        print(f"  {source:25s} {len(existing):>6,} block groups")
    print("-" * 50)


def load_source(source, dry_run=False):
    """Load one source into block_group_intel, skipping existing geoids."""
    print(f"\n{'='*60}")
    print(f"  {source}")
    print(f"{'='*60}")

    rows = load_data_file(source)
    if rows is None:
        return False
    print(f"  Data file: {len(rows):,} block groups")

    print(f"  Checking existing rows...")
    existing = get_existing_geoids(source)
    print(f"  Already loaded: {len(existing):,} block groups")

    new_rows = [r for r in rows if r["geoid"] not in existing]
    print(f"  New to load: {len(new_rows):,} block groups")

    if not new_rows:
        print(f"  SKIP: all rows already loaded")
        return True

    if dry_run:
        print(f"  DRY RUN: would upsert {len(new_rows):,} rows")
        return True

    total = len(new_rows)
    loaded = 0
    failed = 0
    t0 = time.time()

    for i in range(0, total, BATCH_SIZE):
        batch = new_rows[i : i + BATCH_SIZE]

        payload = []
        for row in batch:
            payload.append({
                "geoid": row["geoid"],
                "source": row["source"],
                "data": row["data"],
                "record_count": row["record_count"],
                "ttl_hours": row["ttl_hours"],
                "fetched_at": row["fetched_at"],
            })

        ok = api_post("block_group_intel", payload)
        if ok:
            loaded += len(batch)
        else:
            failed += len(batch)
            print(f"  Batch failed, trying individual rows...")
            for row in batch:
                ok2 = api_post("block_group_intel", [{
                    "geoid": row["geoid"],
                    "source": row["source"],
                    "data": row["data"],
                    "record_count": row["record_count"],
                    "ttl_hours": row["ttl_hours"],
                    "fetched_at": row["fetched_at"],
                }])
                if ok2:
                    loaded += 1
                    failed -= 1

        elapsed = time.time() - t0
        pct = (i + len(batch)) / total * 100
        rate = loaded / elapsed if elapsed > 0 else 0
        print(f"  [{pct:5.1f}%] {loaded:,}/{total:,} loaded ({rate:.0f} rows/s)", end="\r")

    elapsed = time.time() - t0
    print(f"\n  DONE: {loaded:,} loaded, {failed:,} failed ({elapsed:.1f}s)")
    return failed == 0


# -- Main ------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    if "--status" in args:
        show_status()
        return

    dry_run = "--dry-run" in args
    sources_to_run = [a for a in args if not a.startswith("--")]

    if not sources_to_run:
        sources_to_run = SOURCES

    for s in sources_to_run:
        if s not in SOURCES:
            print(f"Unknown source: {s}")
            print(f"Available: {', '.join(SOURCES)}")
            sys.exit(1)

    if not DATA_DIR.exists():
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        print(f"Expected JSON files at: {DATA_DIR}/data-<source>.json")
        sys.exit(1)

    print(f"RE2 Thread 2 -- Socrata -> block_group_intel loader")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Data dir: {DATA_DIR}")
    print(f"Sources:  {', '.join(sources_to_run)}")
    if dry_run:
        print("MODE: DRY RUN (no writes)")
    print()

    results = {}
    for source in sources_to_run:
        ok = load_source(source, dry_run=dry_run)
        results[source] = "OK" if ok else "FAILED"

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for source, status in results.items():
        print(f"  {source:25s} {status}")

    if any(v == "FAILED" for v in results.values()):
        print("\nSome sources failed. Re-run to resume (already-loaded rows are skipped).")
        sys.exit(1)
    else:
        print("\nAll sources loaded successfully.")


if __name__ == "__main__":
    main()
