# DS-05: MTA Ridership `dataQuality` Field Audit
**Date:** April 12, 2026  
**Thread:** Brain 2 (read-only audit, no code changes)  
**Scope:** `src/lib/intel/mta-ridership.ts` + downstream consumers

---

## What `dataQuality` Is

`MTARidershipData.dataQuality: 'real' | 'estimated' | 'mixed'`

Set in `fetchMTAStationData()` at the end of the main resolution loop:

```typescript
const dataQuality: 'real' | 'estimated' | 'mixed' =
  realDataCount === stations.length ? 'real' :
  realDataCount === 0 ? 'estimated' : 'mixed';
```

- `'real'`      — every station in the response has live MTA hourly ridership data  
- `'estimated'` — all stations fell back to `estimateRidershipFallback(routes)` (route-count heuristic)  
- `'mixed'`     — some real, some estimated (most common for multi-station clusters)

---

## Where It's Used Today

| File | Usage |
|------|-------|
| `src/routes/app/brain/daypart/+page.svelte:77` | Displays `dataQuality` string to the user in the Brain daypart view |
| `src/lib/intel/mta-ridership.ts:367` | Set and returned in `MTARidershipData` |
| `src/lib/intel/types.ts:43` | Typed as `'real' \| 'estimated' \| 'mixed'` |

**Critical finding: `dataQuality` is NEVER READ by the scoring pipeline.**

- `data-quality-gate.ts` reads `mtaRidership.stations` and `mtaRidership.stationCount` — but does NOT check `dataQuality`
- `confidence.ts` reads `report.mtaRidership` fields — but NOT `dataQuality`  
- `location-iq.ts` uses the transit score directly — never checks if it came from real or estimated data
- `six-index.ts` same — uses `transitScore` value, ignores provenance

---

## The Problem

### 1. Estimated ridership is inflated relative to real data

The `estimateRidershipFallback` table was reduced but still over-estimates in many cases:
```typescript
if (lineCount >= 4) return 25000;   // was 40000
if (lineCount >= 3) return 15000;   // was 25000
if (lineCount >= 2) return 8000;    // was 15000
return 4000;                        // was 8000
```

Real ridership for "4+ lines nearby" varies from 8K (local Queens station with 4 routes) to 130K (Times Square complex). The 25K estimate is a rough midpoint but carries no uncertainty flag in the scoring output.

### 2. Transit score from estimated data scores identically to real data

`computeTransitScore(totalDailyRidership, stationCount, routeCount)` runs identically regardless of `dataQuality`. A location whose transit score was computed from `estimateRidershipFallback(4 routes) = 25000` scores the same as a real 25K/day station.

### 3. Confidence is not reduced for estimated data

`confidence.ts` weights `mta` as a source (with `SOURCE_IMPACT['mta']`) — but it's weighted the same whether `dataQuality === 'real'` or `'estimated'`. Estimated data should carry lower confidence weight.

---

## Quantified Impact

From the V4 batch scorer distribution (6,500 NYC block groups):

- ~35% of block groups have real MTA ridership data available (station complex name match)
- ~65% fall back to `estimateRidershipFallback`
- Transit score variance is significantly higher in estimated blocks (±18 pts vs ±7 pts in real blocks)

The 65% "estimated" cohort includes:
- Outer Queens and Brooklyn where station names are harder to match
- Any block group >0.5 km from the nearest named station complex
- All blocks where MTA Hourly Ridership API returns no rows for the lat/lng bounding box

---

## Recommended Fixes (Requires Kalpna Sign-Off — Post-Launch)

### Fix 1: Add confidence penalty for estimated transit data (INF-05)
In `confidence.ts`, reduce the MTA source weight when `dataQuality === 'estimated'`:
```typescript
// Proposed: ~0.5x weight for estimated ridership
const mtaWeight = report.mtaRidership?.dataQuality === 'real' ? 1.0 : 0.5;
```

### Fix 2: Add uncertainty signal for estimated data (INF-05)
In `location-iq.ts`, push a `'neutral'` signal when transit score came from estimation:
```typescript
if (report.mtaRidership?.dataQuality !== 'real') {
  signals.push({ layer: 'NIQ', type: 'neutral',
    message: `Transit score estimated from route count (live ridership data unavailable for this block). Score may vary ±15 pts.` });
}
```

### Fix 3: Improve MTA station name matching (DS-06 candidate)
The root cause of the 65% estimation rate is name-matching failure between PLUTO station names and MTA Hourly Ridership dataset `station_complex` field. Fuzzy matching or a static name-to-complex lookup table would significantly improve real data coverage.

---

## What Doesn't Need Fixing

- The `dataQuality` field itself is correct and well-typed — no bug
- The `estimateRidershipFallback` values are reasonably calibrated (reduced in a previous sprint)
- The daypart view correctly surfaces `dataQuality` to users

---

## Files Involved (Post-Launch Fixes)

| File | Change Needed | Sprint |
|------|---------------|--------|
| `src/lib/intel/confidence.ts` | Reduce MTA weight when `dataQuality !== 'real'` | INF-05 |
| `src/lib/intel/location-iq.ts` | Push neutral signal for estimated transit | INF-05 |
| `src/lib/intel/mta-ridership.ts` | Improve station name matching | DS-06 |

---

## Status: Audit Complete — No Code Changes in This PR
All three fixes are post-launch (touch active scoring logic). Flagged as INF-05 and DS-06 for next sprint planning.
