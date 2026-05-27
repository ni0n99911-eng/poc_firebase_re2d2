#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════
RE² Thread 5 — Block Group Vision Narrative Generator
═══════════════════════════════════════════════════════

Generates Opus-quality location vision narratives for all NYC census
block groups. Reads from block_group_intel (multi-source rows) +
block_group_scores (multi-type rows), calls OpenRouter (Claude Opus),
writes structured visions to block_group_visions.

ACTUAL SCHEMA:
  block_group_intel: { geoid, source, data (jsonb), record_count, fetched_at }
    - source: "census_demographics", "census_housing", "walkscore", etc.
    - Multiple rows per geoid (one per source)

  block_group_scores: { geoid, score_type, score (float), components (jsonb) }
    - score_type: "location_iq", "transit", "demographics", etc.
    - Multiple rows per geoid (one per score type)

USAGE:
  python3 generate-visions.py                    # Full run (all ~6,800)
  python3 generate-visions.py --limit 10         # Test with 10 block groups
  python3 generate-visions.py --borough Manhattan --limit 50
  python3 generate-visions.py --qa               # Print 5 sample visions for QA
  python3 generate-visions.py --stats            # Print generation stats
  python3 generate-visions.py --dry-run --limit 5  # Test prompt assembly without API calls
  python3 generate-visions.py --intel-only       # Generate from intel data even without scores

RESUMABLE: Skips any geoid that already has a vision in block_group_visions.
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional

# ── Configuration ──
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jtunulrrnhekljzirynu.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-opus-4-6"

# Rate limiting
DELAY_BETWEEN_CALLS = 2.0  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds

# Borough mapping
COUNTY_TO_BOROUGH = {
    "005": "Bronx", "047": "Brooklyn", "061": "Manhattan",
    "081": "Queens", "085": "Staten Island",
}


# ═══ Supabase helpers ═══

def supabase_request(path: str, method: str = "GET", body: dict = None, extra_headers: dict = None) -> tuple:
    """Make a Supabase REST API request. Returns (status_code, response_data)."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        content = resp.read().decode()
        return resp.status, json.loads(content) if content else []
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        return e.code, err_body


def supabase_get(path: str) -> list:
    status, data = supabase_request(path)
    return data if isinstance(data, list) else []


def supabase_get_all(path: str, page_size: int = 1000) -> list:
    """Paginated fetch — retrieves ALL rows, not just the first 1000."""
    all_rows = []
    offset = 0
    while True:
        sep = "&" if "?" in path else "?"
        paginated = f"{path}{sep}limit={page_size}&offset={offset}"
        rows = supabase_get(paginated)
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


def supabase_count(table: str, filter_str: str = "") -> int:
    url = f"{table}?select=*&limit=1{('&' + filter_str) if filter_str else ''}"
    full_url = f"{SUPABASE_URL}/rest/v1/{url}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "count=exact",
    }
    req = urllib.request.Request(full_url, headers=headers, method="HEAD")
    try:
        resp = urllib.request.urlopen(req)
        cr = resp.headers.get("content-range", "*/0")
        return int(cr.split("/")[-1])
    except urllib.error.HTTPError:
        return -1


def supabase_upsert(table: str, data: dict) -> bool:
    status, resp = supabase_request(
        table, method="POST", body=data,
        extra_headers={"Prefer": "resolution=merge-duplicates"}
    )
    return status in (200, 201)


# ═══ Data assembly ═══

def get_borough(geoid: str) -> str:
    if len(geoid) >= 5:
        return COUNTY_TO_BOROUGH.get(geoid[2:5], "NYC")
    return "NYC"


def get_all_intel_for_geoid(geoid: str) -> dict:
    """Fetch all source rows for a geoid and merge into one dict."""
    rows = supabase_get(f"block_group_intel?select=source,data&geoid=eq.{geoid}")
    merged = {}
    for row in rows:
        source = row.get("source", "")
        data = row.get("data", {})
        merged[source] = data
    return merged


def get_scores_for_geoid(geoid: str) -> dict:
    """Fetch all score rows for a geoid and merge into one dict."""
    rows = supabase_get(f"block_group_scores?select=score_type,score,components&geoid=eq.{geoid}")
    scores = {}
    for row in rows:
        score_type = row.get("score_type", "")
        scores[score_type] = {
            "score": row.get("score", 0),
            "components": row.get("components", {}),
        }
    return scores


def assemble_context(intel: dict, scores: dict) -> str:
    """Build a human-readable data context from multi-source intel + scores."""
    lines = []

    # Census demographics
    demo = intel.get("census_demographics", {})
    if demo:
        lines.append("DEMOGRAPHICS (Census ACS):")
        pop = demo.get("total_population", 0)
        lines.append(f"  Total population: {int(pop):,}" if pop else "  Total population: N/A")
        income = demo.get("median_household_income")
        lines.append(f"  Median household income: ${int(income):,}" if income else "  Median household income: N/A")
        lines.append(f"  Median age: {demo.get('median_age', 'N/A')}")

        # Education
        bachelors = demo.get("bachelors_degree", 0) or 0
        masters = demo.get("masters_degree", 0) or 0
        doctorate = demo.get("doctorate_degree", 0) or 0
        total_college = bachelors + masters + doctorate
        if pop and pop > 0:
            college_pct = round(total_college / pop * 100, 1)
            lines.append(f"  College-educated: {college_pct}% ({int(total_college):,} of {int(pop):,})")

        # Race/ethnicity
        white = demo.get("white_population", 0) or 0
        black = demo.get("black_population", 0) or 0
        asian = demo.get("asian_population", 0) or 0
        hispanic = demo.get("hispanic_latino_population", 0) or 0
        if pop and pop > 0:
            lines.append(f"  Racial mix: White {round(white/pop*100)}%, Black {round(black/pop*100)}%, Asian {round(asian/pop*100)}%")

        # Employment / commuters
        labor = demo.get("in_labor_force", 0) or 0
        commuters = demo.get("total_commuters", 0) or 0
        transit = demo.get("public_transit_commuters", 0) or 0
        if commuters > 0:
            transit_pct = round(transit / commuters * 100, 1)
            lines.append(f"  Commuters: {int(commuters):,} total, {transit_pct}% use public transit")

    # Census housing
    housing = intel.get("census_housing", {})
    if housing:
        lines.append("HOUSING:")
        units = housing.get("total_housing_units", 0)
        occupied = housing.get("occupied_housing_units", 0)
        owner = housing.get("owner_occupied", 0) or 0
        renter = housing.get("renter_occupied", 0) or 0
        lines.append(f"  Housing units: {int(units):,}" if units else "  Housing units: N/A")
        if occupied and occupied > 0:
            owner_pct = round(owner / occupied * 100, 1)
            lines.append(f"  Owner vs renter: {owner_pct}% owner / {round(renter / occupied * 100, 1)}% renter")
        rent = housing.get("median_gross_rent")
        lines.append(f"  Median rent: ${int(rent):,}" if rent else "  Median rent: N/A")
        home_val = housing.get("median_home_value")
        lines.append(f"  Median home value: ${int(home_val):,}" if home_val else "  Median home value: N/A")
        burden = housing.get("median_rent_burden_pct")
        if burden:
            lines.append(f"  Rent burden: {burden}% of income")
        built = housing.get("median_year_built")
        if built:
            lines.append(f"  Median year built: {int(built)}")

        # Building types
        big_buildings = (housing.get("units_20_49", 0) or 0) + (housing.get("units_50_plus", 0) or 0)
        small = (housing.get("units_1_detached", 0) or 0) + (housing.get("units_1_attached", 0) or 0)
        if units and units > 0:
            if big_buildings > units * 0.3:
                lines.append(f"  Dense apartment area ({round(big_buildings/units*100)}% in 20+ unit buildings)")
            elif small > units * 0.5:
                lines.append(f"  Residential area ({round(small/units*100)}% single-family homes)")

    # WalkScore
    ws = intel.get("walkscore", {})
    if ws:
        lines.append("WALKABILITY:")
        for key in ["walk_score", "transit_score", "bike_score"]:
            val = ws.get(key)
            if val is not None:
                label = key.replace("_", " ").title()
                lines.append(f"  {label}: {val}/100")

    # Crime (if Thread 4 added it)
    crime = intel.get("crime", intel.get("nypd_crime", {}))
    if crime:
        lines.append("CRIME:")
        for k, v in sorted(crime.items()):
            if v is not None:
                lines.append(f"  {k}: {v}")

    # Business licenses
    for src_key in ["dca_licenses", "business_licenses"]:
        biz = intel.get(src_key, {})
        if biz:
            lines.append("BUSINESS LICENSES:")
            for k, v in sorted(biz.items()):
                if v is not None:
                    lines.append(f"  {k}: {v}")

    # Any other sources Thread 4 may have added
    known_sources = {"census_demographics", "census_housing", "walkscore", "crime", "nypd_crime", "dca_licenses", "business_licenses"}
    for src, data in intel.items():
        if src not in known_sources and isinstance(data, dict) and data:
            lines.append(f"{src.upper().replace('_', ' ')}:")
            for k, v in sorted(data.items()):
                if v is not None:
                    lines.append(f"  {k}: {v}")

    return "\n".join(lines) if lines else "Limited data available."


def assemble_scores_context(scores: dict) -> str:
    """Format score rows into readable context."""
    if not scores:
        return "No pre-computed scores available."

    lines = []
    # Location IQ first
    if "location_iq" in scores:
        lines.append(f"Location IQ: {scores['location_iq']['score']}/100")

    # Six-Index scores
    for idx_name in ["transit", "demographics", "competition", "vibrancy", "safety", "momentum"]:
        if idx_name in scores:
            s = scores[idx_name]
            lines.append(f"  {idx_name.title()}: {s['score']}/100")

    # NIQ/SIQ/TIQ/LIQ
    for iq_name in ["niq", "siq", "tiq", "liq"]:
        if iq_name in scores:
            lines.append(f"  {iq_name.upper()}: {scores[iq_name]['score']}")

    # Archetype baselines
    for arch in ["routine_interceptor", "destination_pull", "need_filler"]:
        if arch in scores:
            lines.append(f"  {arch.replace('_', ' ').title()}: {scores[arch]['score']}")

    return "\n".join(lines) if lines else "No pre-computed scores available."


# ═══ Vision prompt ═══

VISION_PROMPT = """You are a location intelligence analyst for RE², a platform that helps entrepreneurs find the perfect location for their business in NYC.

You are analyzing Census Block Group {geoid} in {borough}, New York City.

Here is everything we know about this block group:

{assembled_data}

{scores_section}

Generate a location intelligence vision with these four sections:

1. **CHARACTER** — What defines this block group right now? Describe the neighborhood feel, who lives and works here, what the streetscape looks like based on the data. Be specific — use the actual numbers to paint the picture. 2-3 sentences.

2. **GAPS** — What's missing or underserved? Look at the population demographics vs the business mix. Are there unmet needs? High residential population with no grocery? Young professionals with no fitness? Families with no childcare? Be specific about what the data shows. 2-3 sentences.

3. **OPPORTUNITIES** — What specific business concepts could thrive here and why? Connect the demographics, foot traffic, competition gaps, and transit data to concrete business ideas. Don't just say "restaurant" — say "fast-casual lunch spot targeting the 12,000 daily commuters passing through, competing against only 3 existing options within 400m." 2-4 sentences.

4. **MOMENTUM** — What's changing? New building permits, shifting demographics, rising or falling business activity. Is this area on the way up, stable, or declining? What does the trend data suggest for the next 1-2 years? 1-2 sentences.

IMPORTANT:
- Be direct. No fluff. Use actual numbers from the data.
- Write for a business owner, not an academic.
- If data is sparse for a section, say so honestly — don't fabricate.
- Return ONLY a JSON object with this exact structure, no markdown fences:
{{"character": "...", "gaps": "...", "opportunities": "...", "momentum": "..."}}"""


# ═══ OpenRouter API ═══

def call_openrouter(geoid: str, borough: str, assembled_data: str, scores_context: str) -> Optional[dict]:
    scores_section = f"Scores:\n{scores_context}" if "No pre-computed" not in scores_context else ""
    prompt = VISION_PROMPT.format(
        geoid=geoid, borough=borough,
        assembled_data=assembled_data,
        scores_section=scores_section,
    )

    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "temperature": 0.7,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "HTTP-Referer": "https://resquared.io",
        "X-Title": "RE² Vision Generator",
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(OPENROUTER_URL, data=body, headers=headers, method="POST")

    for attempt in range(MAX_RETRIES):
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            data = json.loads(resp.read().decode())
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            structured = json.loads(content)
            narrative = (
                f"CHARACTER: {structured.get('character', '')}\n\n"
                f"GAPS: {structured.get('gaps', '')}\n\n"
                f"OPPORTUNITIES: {structured.get('opportunities', '')}\n\n"
                f"MOMENTUM: {structured.get('momentum', '')}"
            )
            return {
                "narrative": narrative,
                "structured": structured,
                "tokens": usage.get("total_tokens", 0),
                "model": data.get("model", MODEL),
            }

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            if e.code in (429, 502, 503):
                wait = RETRY_DELAY * (attempt + 1)
                print(f"  [{e.code}] Retry {attempt+1}/{MAX_RETRIES} in {wait}s...")
                time.sleep(wait)
                continue
            print(f"  [API ERROR] {e.code}: {error_body[:200]}")
            return None
        except json.JSONDecodeError:
            # Try fallback section parsing
            try:
                structured = parse_sections_fallback(content)
                narrative = (
                    f"CHARACTER: {structured.get('character', '')}\n\n"
                    f"GAPS: {structured.get('gaps', '')}\n\n"
                    f"OPPORTUNITIES: {structured.get('opportunities', '')}\n\n"
                    f"MOMENTUM: {structured.get('momentum', '')}"
                )
                return {"narrative": narrative, "structured": structured, "tokens": 0, "model": MODEL}
            except:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                return None
        except Exception as e:
            print(f"  [ERROR] {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            return None
    return None


def parse_sections_fallback(text: str) -> dict:
    sections = {}
    current = None
    buffer = []
    for line in text.split("\n"):
        ll = line.strip().lower()
        for key in ["character", "gaps", "opportunities", "momentum"]:
            if ll.startswith(key) or ll.startswith(f"**{key}"):
                if current and buffer:
                    sections[current] = " ".join(buffer).strip()
                current = key
                rest = line.split(":", 1)[-1].strip() if ":" in line else ""
                rest = rest.strip("* ")
                buffer = [rest] if rest else []
                break
        else:
            if current:
                buffer.append(line.strip())
    if current and buffer:
        sections[current] = " ".join(buffer).strip()
    if not sections:
        raise ValueError("Could not parse sections")
    return sections


# ═══ Existing visions lookup ═══

def get_existing_vision_geoids() -> set:
    existing = set()
    offset = 0
    while True:
        rows = supabase_get(f"block_group_visions?select=geoid&vision_type=eq.location&offset={offset}&limit=1000")
        if not rows:
            break
        for r in rows:
            existing.add(r["geoid"])
        if len(rows) < 1000:
            break
        offset += 1000
    return existing


# ═══ Get all geoids to process ═══

def get_geoids_from_intel(borough: Optional[str] = None, limit: Optional[int] = None) -> list:
    """Get geoids from the block_groups master table (canonical source).
    Falls back to block_group_intel if block_groups doesn't exist.
    Uses paginated fetch to get ALL rows (not just 1000)."""
    params = "select=geoid"
    if borough:
        # Use borough column directly on block_groups table
        params += f"&borough=eq.{borough}"
    params += "&order=geoid.asc"

    if limit:
        rows = supabase_get(f"block_groups?{params}&limit={limit}")
    else:
        rows = supabase_get_all(f"block_groups?{params}")
    if rows:
        return [r["geoid"] for r in rows]

    # Fallback to block_group_intel
    params2 = "select=geoid&source=eq.census_demographics"
    if borough:
        fips_map = {"manhattan": "061", "bronx": "005", "brooklyn": "047", "queens": "081", "staten island": "085"}
        fips = fips_map.get(borough.lower().replace(" ", ""))
        if fips:
            params2 += f"&geoid=like.36{fips}*"
    params2 += "&order=geoid.asc"

    if limit:
        rows2 = supabase_get(f"block_group_intel?{params2}&limit={limit}")
    else:
        rows2 = supabase_get_all(f"block_group_intel?{params2}")
    return [r["geoid"] for r in rows2]


def get_geoids_from_scores(borough: Optional[str] = None, limit: Optional[int] = None) -> list:
    """Get distinct geoids from block_group_scores.
    Uses paginated fetch to get ALL rows (not just 1000)."""
    params = "select=geoid&score_type=eq.location_iq"
    if borough:
        fips_map = {"manhattan": "061", "bronx": "005", "brooklyn": "047", "queens": "081", "staten island": "085"}
        fips = fips_map.get(borough.lower().replace(" ", ""))
        if fips:
            params += f"&geoid=like.36{fips}*"
    params += "&order=geoid.asc"

    if limit:
        rows = supabase_get(f"block_group_scores?{params}&limit={limit}")
    else:
        rows = supabase_get_all(f"block_group_scores?{params}")
    return [r["geoid"] for r in rows]


# ═══ QA ═══

def run_qa():
    print("\n═══ VISION QA REPORT ═══\n")
    total = supabase_count("block_group_visions")
    print(f"Total visions: {total}")
    if total <= 0:
        print("No visions generated yet.")
        return

    for fips, name in COUNTY_TO_BOROUGH.items():
        rows = supabase_get(
            f"block_group_visions?select=geoid,narrative,structured,model,generated_at&geoid=like.36{fips}*&vision_type=eq.location&limit=1"
        )
        if rows:
            r = rows[0]
            print(f"\n{'─'*60}")
            print(f"📍 {name} — Block Group {r['geoid']}")
            print(f"   Model: {r['model']} | Generated: {r['generated_at']}")
            print(f"{'─'*60}")
            print(r["narrative"])
        else:
            print(f"\n⚠️  No visions for {name} yet")

    # Short vision check
    print(f"\n{'─'*60}\nSHORT VISION CHECK:")
    all_v = []
    offset = 0
    while True:
        batch = supabase_get(f"block_group_visions?select=geoid,narrative&vision_type=eq.location&offset={offset}&limit=1000")
        if not batch: break
        all_v.extend(batch)
        if len(batch) < 1000: break
        offset += 1000
    short = [v for v in all_v if len(v.get("narrative", "")) < 200]
    if short:
        print(f"⚠️  {len(short)} visions shorter than 200 chars:")
        for s in short[:10]:
            print(f"   - {s['geoid']}: {len(s['narrative'])} chars")
    else:
        print(f"✅ All {len(all_v)} visions are 200+ characters")


def run_stats():
    total_visions = supabase_count("block_group_visions")
    total_scores = supabase_count("block_group_scores", "score_type=eq.location_iq")
    total_intel = supabase_count("block_group_intel", "source=eq.census_demographics")

    print(f"\n═══ GENERATION STATS ═══")
    print(f"Block groups with intel: {total_intel}")
    print(f"Block groups with scores: {total_scores}")
    print(f"Block groups with visions: {total_visions}")
    source = max(total_scores, total_intel)
    if source > 0:
        pct = (total_visions / source) * 100
        remaining = source - total_visions
        est_hours = (remaining * DELAY_BETWEEN_CALLS) / 3600
        print(f"Coverage: {pct:.1f}%")
        print(f"Remaining: {remaining} (~{est_hours:.1f} hours at {DELAY_BETWEEN_CALLS}s/call)")


# ═══ Main ═══

def main():
    parser = argparse.ArgumentParser(description="RE² Vision Narrative Generator")
    parser.add_argument("--limit", type=int, help="Max block groups to process")
    parser.add_argument("--borough", type=str, help="Filter by borough name")
    parser.add_argument("--qa", action="store_true", help="Print QA report")
    parser.add_argument("--stats", action="store_true", help="Print generation stats")
    parser.add_argument("--dry-run", action="store_true", help="Assemble prompts without API calls")
    parser.add_argument("--intel-only", action="store_true", help="Generate from intel data even without scores")
    parser.add_argument("--delay", type=float, default=DELAY_BETWEEN_CALLS, help="Seconds between API calls")
    args = parser.parse_args()

    if args.qa:
        run_qa()
        return
    if args.stats:
        run_stats()
        return

    print("═══ RE² Thread 5 — Vision Generator ═══")
    print(f"Model: {MODEL}")
    print(f"Delay: {args.delay}s between calls\n")

    # Pre-flight
    visions_count = supabase_count("block_group_visions")
    if visions_count == -1:
        print("❌ block_group_visions table does not exist! Run the migration first.")
        sys.exit(1)
    print(f"✅ block_group_visions: {visions_count} existing")

    scores_count = supabase_count("block_group_scores", "score_type=eq.location_iq")
    intel_count = supabase_count("block_group_intel", "source=eq.census_demographics")
    print(f"{'✅' if scores_count > 0 else '⚠️ '} block_group_scores: {scores_count} scored geoids")
    print(f"✅ block_group_intel: {intel_count} geoids with census data")

    if scores_count == 0 and not args.intel_only:
        print("\n⚠️  No scores yet! Thread 4 hasn't finished scoring.")
        print("   Use --intel-only to generate from census/housing data without scores.")
        print("   Or wait for Thread 4 to populate block_group_scores.")
        sys.exit(1)

    # Get geoids to process
    if scores_count > 0:
        geoids = get_geoids_from_scores(borough=args.borough, limit=args.limit)
        print(f"\n📊 Using scored block groups ({len(geoids)} geoids)")
    else:
        geoids = get_geoids_from_intel(borough=args.borough, limit=args.limit)
        print(f"\n📊 Using intel-only block groups ({len(geoids)} geoids)")

    # Skip already-generated
    existing = get_existing_vision_geoids()
    to_process = [g for g in geoids if g not in existing]
    print(f"   To process: {len(to_process)} (skipping {len(geoids) - len(to_process)} already done)")

    if not to_process:
        print("✅ All block groups already have visions!")
        return

    est_time = (len(to_process) * args.delay) / 3600
    print(f"   Estimated time: {est_time:.1f} hours\n")

    # Process
    success = 0
    failed = 0
    skipped_empty = 0
    start_time = time.time()

    for i, geoid in enumerate(to_process):
        borough = get_borough(geoid)
        print(f"[{i+1}/{len(to_process)}] {geoid} ({borough})...", end=" ", flush=True)

        # Fetch data
        intel = get_all_intel_for_geoid(geoid)
        scores = get_scores_for_geoid(geoid) if scores_count > 0 else {}

        # Skip empty block groups (no population)
        demo = intel.get("census_demographics", {})
        pop = demo.get("total_population", 0)
        if not pop or pop < 10:
            print(f"⏭️  Skipped (population: {pop})")
            skipped_empty += 1
            continue

        assembled_data = assemble_context(intel, scores)
        scores_context = assemble_scores_context(scores)

        if args.dry_run:
            print(f"DRY RUN — {len(assembled_data)} chars context, pop={int(pop)}")
            if i < 2:
                print(f"\n--- SAMPLE PROMPT ---")
                print(assembled_data[:600])
                if scores_context:
                    print(f"\n{scores_context}")
                print(f"--- END ---\n")
            continue

        # Call OpenRouter
        call_start = time.time()
        result = call_openrouter(geoid, borough, assembled_data, scores_context)
        call_ms = int((time.time() - call_start) * 1000)

        if result:
            row = {
                "geoid": geoid,
                "vision_type": "location",
                "narrative": result["narrative"],
                "structured": result["structured"],
                "model": result["model"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            if supabase_upsert("block_group_visions", row):
                success += 1
                print(f"✅ ({call_ms}ms, {result['tokens']} tok)")
            else:
                failed += 1
                print(f"⚠️  Generated but save failed")
        else:
            failed += 1
            print(f"❌ Failed")

        if i < len(to_process) - 1:
            time.sleep(args.delay)

    # Summary
    elapsed = time.time() - start_time
    print(f"\n{'═'*60}")
    print(f"COMPLETE — {success} generated, {failed} failed, {skipped_empty} skipped (empty)")
    print(f"Time: {elapsed/60:.1f} minutes")
    if success > 0:
        print(f"Avg: {elapsed/success:.1f}s per vision")
    print(f"Total visions in DB: {supabase_count('block_group_visions')}")


if __name__ == "__main__":
    main()
