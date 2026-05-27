# Re-score API Spec — BR-5 § 5.3
**Brain Thread · April 5, 2026**
**Route:** `POST /api/re-score`
**Status:** SPEC — ready for implementation

---

## 1 · Purpose

Replaces the existing auto-recalc on TTL expiry. User-initiated only. Runs the full scorer, writes a new snapshot record, detects drift, returns updated scores + drift explanation.

---

## 2 · Request

```typescript
// POST /api/re-score
interface RescoreRequest {
  address: string;       // canonical address string
  lat: number;
  lng: number;
  concept: string;       // e.g. "specialty_coffee"
  locationId?: string;   // Supabase shortlisted_locations.id if known (faster lookup)

  // Current user inputs (for inputs_hash computation)
  dailyTransactions?: number | null;
  avgTicket?: number | null;
  monthlyRentBudget?: number | null;
  fundingCapital?: number | null;
  buildoutBudget?: number | null;
  creditScoreBand?: string | null;
  visionIQCompletionPct?: number;
  conceptAnswers?: Record<string, string>;
}
```

**Auth:** Clerk JWT — same as all other `/api/*` routes via `authedFetch`.

---

## 3 · Response

```typescript
interface RescoreResponse {
  // New scores
  locationIQ: number;
  fitIQ: number;
  visionIQ: number;
  sixScores: Record<string, number>;
  scoredAt: string;          // ISO timestamp of new snapshot
  scorerVersion: string;     // e.g. "v4.3"
  inputsHash: string;        // SHA-256 of inputs

  // Drift (only present if |delta| > 3)
  drift?: {
    delta: number;           // new - old (positive = improved)
    direction: 'up' | 'down';
    topMovers: Array<{
      name: string;          // sub-score key e.g. "foot_traffic"
      friendlyName: string;  // plain language e.g. "foot traffic"
      delta: number;
      plainLanguage: string; // e.g. "updated foot traffic data"
    }>;
  };
}
```

---

## 4 · Handler Logic (step by step)

```
1. Authenticate — verify Clerk JWT, extract userId
2. Load previous record — query shortlisted_locations WHERE addr = request.address AND user_id = userId
   → if no record: treat as first-ever score (no drift comparison)
3. Run scorer — call existing scoring pipeline (same as /api/location-iq full run)
   → returns locationIQ, fitIQ, visionIQ, sixScores, geoid
4. Compute inputsHash — use computeInputsHash() from br-5-migration-spec.md § 3
5. Write new snapshot to shortlisted_locations:
   UPDATE shortlisted_locations SET
     location_iq = newScore,
     fit_iq = newFitIQ,
     vision_iq = newVisionIQ,
     six_scores = newSixScores,
     scored_at = NOW(),
     scorer_version = SCORER_VERSION,
     inputs_hash = newInputsHash
   WHERE addr = request.address AND user_id = userId
   (INSERT if no existing row)
6. Compute drift — if previous record exists:
   delta = newLocationIQ - oldLocationIQ
   if |delta| > 3:
     a. Compute subScoresMoved (per br-5-migration-spec § 4)
     b. Write score_drift_event (per br-5-migration-spec § 4)
     c. Build drift explanation object for response
7. Return RescoreResponse
```

---

## 5 · Error Cases

| Condition | HTTP | Response body |
|---|---|---|
| Invalid/expired JWT | 401 | `{ error: 'Unauthorized' }` |
| Missing required fields (address, lat, lng, concept) | 400 | `{ error: 'Missing required fields', missing: [...] }` |
| Scorer pipeline failure | 500 | `{ error: 'Scoring failed', detail: '...' }` |
| Supabase write failure | 500 | `{ error: 'Failed to save score' }` |
| Rate limit (>5 re-scores per address per hour) | 429 | `{ error: 'Too many re-score requests' }` |

---

## 6 · Rate Limit Rule

Max 5 Re-score calls per address per user per hour. Prevents accidental spam loops. Check `score_drift_events` or a simple in-memory rate limiter. Return 429 if exceeded.

---

## 7 · Front-end Integration

After Re-score response:

```typescript
// 1. Update localStorage session with new scores
sess.locationIQ = response.locationIQ;
sess.fitScore   = response.fitIQ;
sess.sixScores  = response.sixScores;
sess.scoredAt   = Date.parse(response.scoredAt);
sess.scorer_version = response.scorerVersion;
sess.inputs_hash    = response.inputsHash;
localStorage.setItem('re2_session', JSON.stringify(sess));

// 2. Re-render score rings (reactive — $state updates trigger automatically)
storedLocationIQ = response.locationIQ;
sixScores        = response.sixScores;

// 3. Show drift explanation if present
if (response.drift && Math.abs(response.drift.delta) > 3) {
  driftExplanation = response.drift;
  // render: "Score shifted +N since last run. What changed: [topMovers[0].plainLanguage]..."
}

// 4. Update meta-line: "Scored just now · Re-score ↻"
// scoredAt reactive variable updates automatically from sess.scoredAt
```

---

## 8 · File to create

`src/routes/api/re-score/+server.ts`

Follows existing pattern from `src/routes/api/location-iq/+server.ts` — same auth middleware, same Supabase client setup.

---

*Spec complete. Backend implements `src/routes/api/re-score/+server.ts` against this spec.*
