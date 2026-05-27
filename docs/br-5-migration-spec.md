# BR-5 Migration Spec — Score Writeback + Drift Events

**Thread:** Brain (spec only — backend thread implements)
**Status:** READY — backend can run as-is
**Depends on:** BR-5 Option A decision (`docs/location-iq-threshold-spec.md` § 5)
**Fastest-path backend task combo — ~1.5 hours total.**

This spec defines the exact SQL migration and the `inputs_hash` computation required to unblock the Option A snapshot model. Backend thread implements — Brain does not run migrations.

---

## 1 · Migration 017 — Score Writeback Fields

Add three columns to `shortlisted_locations` to carry snapshot metadata.

```sql
-- Migration 017: BR-5 score writeback fields
-- Adds scored_at (if not already present), scorer_version, inputs_hash

ALTER TABLE shortlisted_locations
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS scorer_version TEXT,
  ADD COLUMN IF NOT EXISTS inputs_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_shortlisted_locations_scored_at
  ON shortlisted_locations(scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_shortlisted_locations_scorer_version
  ON shortlisted_locations(scorer_version);

-- Backfill legacy rows
UPDATE shortlisted_locations
SET
  scorer_version = COALESCE(scorer_version, 'v4.legacy'),
  inputs_hash    = COALESCE(inputs_hash, 'legacy'),
  scored_at      = COALESCE(scored_at, created_at, NOW())
WHERE scorer_version IS NULL OR inputs_hash IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE shortlisted_locations
  ALTER COLUMN scored_at SET NOT NULL,
  ALTER COLUMN scorer_version SET NOT NULL,
  ALTER COLUMN inputs_hash SET NOT NULL;
```

---

## 2 · Migration 018 — Score Drift Events Table

Log every drift > 3 points for future model learning.

```sql
-- Migration 018: BR-5 score drift event log
-- Records every score change > 3 points after Re-score action

CREATE TABLE IF NOT EXISTS score_drift_events (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT NOT NULL,
  address             TEXT NOT NULL,
  geoid               TEXT,
  old_score           NUMERIC NOT NULL,
  new_score           NUMERIC NOT NULL,
  delta               NUMERIC GENERATED ALWAYS AS (new_score - old_score) STORED,
  sub_scores_moved    JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_scorer_version  TEXT NOT NULL,
  new_scorer_version  TEXT NOT NULL,
  old_inputs_hash     TEXT NOT NULL,
  new_inputs_hash     TEXT NOT NULL,
  logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_drift_user
  ON score_drift_events(user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_drift_delta
  ON score_drift_events(ABS(delta) DESC);

CREATE INDEX IF NOT EXISTS idx_score_drift_address
  ON score_drift_events(address);

-- RLS: users can only read their own drift events
ALTER TABLE score_drift_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own drift events"
  ON score_drift_events FOR SELECT
  USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Service role writes drift events"
  ON score_drift_events FOR INSERT
  WITH CHECK (true);  -- writes come from server-side scoring API only
```

**`sub_scores_moved` JSONB shape:**
```json
[
  { "name": "foot_traffic", "oldValue": 72, "newValue": 78, "delta": 6 },
  { "name": "competition_density", "oldValue": 65, "newValue": 60, "delta": -5 }
]
```

Only sub-scores that moved ≥ 3 points are logged in this array (to keep the payload small and signal-to-noise high).

---

## 3 · `inputs_hash` Computation Spec

This hash detects input drift between scoring runs. Same inputs → same hash → score should be identical (or close).

### 3.1 · What goes into the hash

Hash these fields in fixed order, JSON-serialized, SHA-256:

```typescript
interface ScoringInputs {
  // Address
  address: string;              // canonicalized (trimmed, lowercase)
  lat: number;                  // rounded to 5 decimal places
  lng: number;                  // rounded to 5 decimal places

  // Concept
  concept: string;              // e.g. "specialty_coffee"

  // User-adjustable levers that affect score
  dailyTransactions: number | null;
  avgTicket: number | null;
  monthlyRentBudget: number | null;
  fundingCapital: number | null;
  buildoutBudget: number | null;
  creditScoreBand: string | null;  // "800+" | "740-799" | "670-739" | "580-669" | "below-580"

  // Vision IQ state
  visionIQCompletionPct: number;  // 0-100

  // Scorer version (ties hash to algo version)
  scorerVersion: string;
}
```

### 3.2 · Canonicalization rules (critical for stable hashes)

1. **Keys sorted alphabetically** before JSON.stringify
2. **Null values included explicitly** (do not omit)
3. **Numbers rounded** to their stated precision
4. **Strings lowercased and trimmed**
5. **No trailing whitespace** in serialized string

### 3.3 · Reference implementation (TypeScript)

```typescript
import { createHash } from 'crypto';

export function computeInputsHash(inputs: ScoringInputs): string {
  // Canonicalize
  const canonical = {
    address: inputs.address.trim().toLowerCase(),
    avg_ticket: inputs.avgTicket,
    buildout_budget: inputs.buildoutBudget,
    concept: inputs.concept.toLowerCase(),
    credit_score_band: inputs.creditScoreBand,
    daily_transactions: inputs.dailyTransactions,
    funding_capital: inputs.fundingCapital,
    lat: Math.round(inputs.lat * 100000) / 100000,
    lng: Math.round(inputs.lng * 100000) / 100000,
    monthly_rent_budget: inputs.monthlyRentBudget,
    scorer_version: inputs.scorerVersion,
    vision_iq_completion_pct: Math.round(inputs.visionIQCompletionPct),
  };

  // Sorted keys, stable JSON
  const serialized = JSON.stringify(canonical, Object.keys(canonical).sort());

  // SHA-256 hex
  return createHash('sha256').update(serialized).digest('hex');
}
```

### 3.4 · What's NOT in the hash (intentionally)

- External data that the scorer *pulls* (census, foot traffic, POI data) — these can drift independently of user inputs, that's what Re-score is for
- User-facing UI state (current tab, sort order, filters)
- Session metadata (JWT, browser, device)
- Business Case numbers (revenue projections, costs) — these don't feed the Location IQ scorer

---

## 4 · Drift Event Write Logic

Server-side, inside the Re-score API handler, after writing the new score:

```typescript
async function writeDriftEventIfApplicable(
  userId: string,
  address: string,
  geoid: string | null,
  oldRecord: ShortlistedLocation | null,
  newRecord: ShortlistedLocation,
  oldSubScores: Record<string, number> | null,
  newSubScores: Record<string, number>
): Promise<void> {
  if (!oldRecord) return;  // first-ever score, nothing to compare

  const delta = newRecord.location_iq - oldRecord.location_iq;
  if (Math.abs(delta) <= 3) return;  // below threshold, skip

  // Compute which sub-scores moved ≥ 3 points
  const subScoresMoved = Object.keys(newSubScores)
    .map(name => {
      const oldValue = oldSubScores?.[name] ?? 0;
      const newValue = newSubScores[name];
      const subDelta = newValue - oldValue;
      return { name, oldValue, newValue, delta: subDelta };
    })
    .filter(s => Math.abs(s.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  await supabase.from('score_drift_events').insert({
    user_id: userId,
    address,
    geoid,
    old_score: oldRecord.location_iq,
    new_score: newRecord.location_iq,
    sub_scores_moved: subScoresMoved,
    old_scorer_version: oldRecord.scorer_version,
    new_scorer_version: newRecord.scorer_version,
    old_inputs_hash: oldRecord.inputs_hash,
    new_inputs_hash: newRecord.inputs_hash,
  });
}
```

---

## 5 · User-Facing Drift Explanation

When drift > 3 points is detected AND event is logged, return a `driftExplanation` object in the Re-score API response. Front-end renders as inline note under score ring per BR-5 § 5.4.

```typescript
interface DriftExplanation {
  delta: number;              // +4 or -3
  direction: 'up' | 'down';
  topMovers: Array<{
    name: string;             // e.g. "foot_traffic"
    friendlyName: string;     // e.g. "foot traffic"
    delta: number;
    plainLanguage: string;    // e.g. "new weekend data"
  }>;
}
```

**Plain-language templates** (by sub-score name):

| Sub-score | Plain-language template |
|---|---|
| foot_traffic | "updated foot traffic data" |
| transit_access | "transit data refreshed" |
| demographics | "new census release" |
| competition_density | "[N] new businesses within 300ft" or "[N] businesses closed nearby" |
| vibrancy | "new neighborhood signals" |
| neighborhood_health | "updated health indicators" |
| concept_fit | "concept details refined" |
| vision_iq_completion | "Vision IQ completion changed" |

Backend picks the template matching the top mover, substitutes values where applicable.

---

## 6 · Rollout Order

1. Run migration 017 (adds fields + backfills legacy)
2. Run migration 018 (creates drift events table + RLS)
3. Update `/api/score` handler to write `scored_at`, `scorer_version`, `inputs_hash` on every score
4. Update `/api/re-score` handler to diff old vs new and call `writeDriftEventIfApplicable()`
5. Update front-end to display meta-line `Scored [date] · Re-score ↻` (reads `scored_at` from record)
6. Update front-end to display drift explanation inline note (reads `driftExplanation` from Re-score response)

Steps 1–2 are independent and can ship together as one PR. Steps 3–4 depend on 1–2. Steps 5–6 depend on 3–4.

---

*Brain has written this spec. Backend thread implements. Brain does not run migrations.*
