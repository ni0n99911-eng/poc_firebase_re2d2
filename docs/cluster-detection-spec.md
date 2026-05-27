# RE² · BR-8 · Cluster Detection Spec
**Brain Thread · April 5, 2026**
**Status: SPEC — required before UX-5 (Pattern Logic) ships with live data**

This document defines the cluster detection logic, environmental halo system, concept-compatibility matrix, and building-facing detection that together power the Pattern Logic screen (UX-5). None of this logic exists in production yet. UX-5 is design-approved — it cannot ship with real user data until all three sections of this spec are implemented and verified.

---

## 1 · Why This Spec Exists

The UX-5 wireframe contains three categories of fabricated data that must be replaced:

1. **Named businesses** ("Brooklyn Roasting Co., Sey Coffee, 1 Dunkin within 400ft") — these are illustrative. Sey Coffee is ~0.3 miles away, not within 400ft. Brooklyn Roasting Co. may no longer have a Williamsburg location. No live cluster query has been run.

2. **Building facing** ("East-facing · high confidence · 3.1 hours AM sun") — parcel geometry logic does not exist in the codebase. This is an estimate based on NYC address conventions, not a computed value.

3. **Cluster mismatch flag** ("wine bar in a daily-ritual cluster") — the compatibility matrix referenced in the wireframe is proposed, not formalized. The flag cannot be trusted until the matrix is codified.

**Rule:** UX-5 demo data must be replaced with real computed values before any user sees the pattern logic screen in production. The wireframe is approved for design direction only.

---

## 2 · Cluster Types

Three cluster archetypes. Every block group is assigned one primary cluster type based on its business mix.

### 2.1 · Daily-Ritual Cluster

**Definition:** Block where the majority of food/beverage/service businesses serve recurring daily needs — morning coffee, lunch, errands. High repeat-visit frequency. Low destination draw.

**Signal pattern:**
- ≥ 3 of: coffee shop, bakery, bodega, pharmacy, dry cleaner, nail salon, laundromat within 300ft
- Transit access score ≥ 60 (commuters need these services)
- Lower evening foot traffic than morning
- Residential density within 0.25 miles ≥ 3,000 units

**Examples in NYC:** Most blocks in Park Slope, Astoria, Jackson Heights, Fordham Road corridor

### 2.2 · Evening-Destination Cluster

**Definition:** Block where the primary traffic is discretionary, evening-oriented. Restaurants, bars, wine shops, entertainment. Lower daytime activity, peak after 6pm.

**Signal pattern:**
- ≥ 2 of: full_service_restaurant, wine_bar, cocktail_bar, live music venue within 400ft
- Evening foot traffic ≥ 2× morning foot traffic (from segment-intel daypart data)
- Transit access ≥ 50 (people arrive from elsewhere)
- Lower morning business density

**Examples in NYC:** Restaurant Row (46th St), DeKalb Ave in Fort Greene, Graham Ave in Williamsburg (partially)

### 2.3 · Service-Errand Cluster

**Definition:** Block primarily composed of transactional, non-recurring services. Destination visits, not repeat-routine visits.

**Signal pattern:**
- ≥ 2 of: phone repair, alterations, tax prep, notary, auto-related, storage within 400ft
- Mixed commercial zoning (C1–C4)
- Lower pedestrian density than daily-ritual or evening-destination
- Lower food/beverage share of total businesses

**Examples in NYC:** Atlantic Ave in Brooklyn, White Plains Road in the Bronx

---

## 3 · Cluster Detection Query

**Data source:** `enriched_entities` table in Supabase (from Google Places + Foursquare enrichment) OR live Google Places Nearby query via `src/lib/intel/google-places.ts`.

**Input:** geoid of the block group containing the address being analyzed.

**Detection algorithm:**

```typescript
type ClusterType = 'daily-ritual' | 'evening-destination' | 'service-errand' | 'mixed';

interface ClusterResult {
  clusterType: ClusterType;
  confidence: 'high' | 'medium' | 'low';
  businessesWithin300ft: NearbyBusiness[];
  businessesWithin400ft: NearbyBusiness[];
  dailyRitualScore: number;  // 0–100
  eveningDestScore: number;  // 0–100
  serviceErrandScore: number; // 0–100
}

interface NearbyBusiness {
  name: string;
  category: string;  // canonical category from enriched_entities
  distanceFt: number;
  placeId: string;
}
```

**Classification logic:**
```
dailyRitualScore  = Σ (signalWeight[category] × distanceDecay[distanceFt]) for daily-ritual categories
eveningDestScore  = Σ (signalWeight[category] × distanceDecay[distanceFt] × dayPartBoost) for evening-dest categories
serviceErrandScore = Σ (signalWeight[category] × distanceDecay[distanceFt]) for service-errand categories

primaryCluster = argmax(dailyRitualScore, eveningDestScore, serviceErrandScore)
confidence = 'high' if primaryScore > 2× secondaryScore, else 'medium' if primaryScore > 1.3× secondary, else 'low'
clusterType = 'mixed' if confidence = 'low' AND top two scores are within 10% of each other
```

**3.1 · Signal weights by category**

Each business category contributes a fixed signal weight to one cluster bucket. Weights reflect how diagnostic that category is of the cluster archetype.

| Category | Cluster bucket | Signal weight |
|---|---|---|
| coffee_shop | daily-ritual | 10 |
| bakery | daily-ritual | 8 |
| bodega / deli | daily-ritual | 8 |
| pharmacy | daily-ritual | 7 |
| dry_cleaner | daily-ritual | 6 |
| laundromat | daily-ritual | 6 |
| nail_salon | daily-ritual | 5 |
| juice_bar | daily-ritual | 5 |
| full_service_restaurant | evening-destination | 10 |
| cocktail_bar | evening-destination | 10 |
| wine_bar | evening-destination | 10 |
| live_music_venue | evening-destination | 9 |
| specialty_food (evening hours) | evening-destination | 6 |
| dessert / late_night | evening-destination | 5 |
| phone_repair | service-errand | 8 |
| alterations / tailor | service-errand | 7 |
| tax_prep / notary | service-errand | 7 |
| auto_service | service-errand | 7 |
| storage | service-errand | 6 |
| shipping / mailbox | service-errand | 6 |

Categories not listed contribute 0 — they are neutral to cluster detection.

**3.2 · Distance decay function**

Closer businesses are stronger signals. Step function (simple, tunable):

```
distanceDecay(distanceFt) =
  1.0   if distanceFt ≤ 150
  0.7   if distanceFt ≤ 300
  0.4   if distanceFt ≤ 400
  0.0   if distanceFt > 400
```

**Rationale:** 150ft = same blockface. 300ft = same block. 400ft = adjacent block. Beyond 400ft, the signal is too weak to define *this block's* cluster.

**3.3 · Daypart boost (evening-destination only)**

Evening-destination businesses get amplified if the block has evening-heavy foot traffic:

```
dayPartBoost =
  1.3   if eveningFootTraffic ≥ 2.0 × morningFootTraffic
  1.1   if eveningFootTraffic ≥ 1.5 × morningFootTraffic
  1.0   otherwise
```

Data source: `segment-intel` daypart arrays. If daypart data is unavailable, `dayPartBoost = 1.0`.

**3.4 · Worked example**

89 Graham Ave, Williamsburg. Within 400ft: 2 coffee shops (100ft, 280ft), 1 bakery (220ft), 1 wine_bar (180ft), 1 restaurant (350ft), 1 dry_cleaner (90ft). Evening traffic = 1.8× morning.

- dailyRitualScore = (10 × 1.0) + (10 × 0.7) + (8 × 0.7) + (6 × 1.0) = 10 + 7 + 5.6 + 6 = **28.6**
- eveningDestScore = (10 × 0.7 × 1.1) + (10 × 0.4 × 1.1) = 7.7 + 4.4 = **12.1**
- serviceErrandScore = **0**
- primaryCluster = daily-ritual, primary/secondary ratio = 2.36 → **confidence: high**

**Named businesses output:** The `businessesWithin300ft` and `businessesWithin400ft` arrays replace all hardcoded business names in the UX-5 Pattern Logic cards. UX reads from the live data — no static names in the component.

---

## 4 · Concept-Compatibility Matrix

This matrix is the source of truth for halo weights and mismatch flags. UX-5 derives all "cluster mismatch" labels from this table — not from hand-written copy.

| Cluster type | Compatible concepts | Neutral concepts | Mismatch concepts |
|---|---|---|---|
| daily-ritual | specialty_coffee, bakery, fast_casual, juice_bar, pharmacy | fitness_studio, nail_salon, co_working | wine_bar, full_service_restaurant, cocktail_bar |
| evening-destination | wine_bar, full_service_restaurant, cocktail_bar | specialty_coffee (if extended hours), specialty_retail | dry_cleaning, pharmacy, bakery (no evening hours) |
| service-errand | nail_salon, specialty_retail | specialty_coffee, fast_casual | wine_bar, full_service_restaurant, cocktail_bar |

**Halo weight modifiers:**

| Compatibility | Effect on Fit IQ halo | UX display |
|---|---|---|
| Compatible | +halo_weight to cluster sub-score | Positive signal shown in Pattern Logic card |
| Neutral | No adjustment | Not mentioned |
| Mismatch | Shown as flag (no score deduction) | "Cluster mismatch" chip on Pattern Logic card |

**Important:** A mismatch is a flag, not a score deduction. The flag surfaces information — the user might have a compelling reason to open a wine bar in a daily-ritual cluster (first-mover advantage, underserved). RE² does not disqualify concepts, it flags patterns.

**Mismatch chip copy format:**
```
"[Concept] vs [Cluster type] mismatch — this block runs on [cluster rhythm], not [concept rhythm]."
```

Example: "Wine bar vs daily-ritual cluster mismatch — this block runs on morning routines, not evening destination visits."

---

## 5 · Environmental Halos

Environmental halos are location-level physical attributes that affect certain concepts independently of the business cluster. They are layered on top of the cluster type.

### 5.1 · Building Facing

**What it is:** The cardinal direction the storefront faces. East-facing gets AM sun. West-facing gets PM sun. North-facing is shaded. South-facing is bright year-round.

**Why it matters:**
- Specialty coffee: east-facing = morning sun on tables = strong tailwind. West-facing = afternoon light, weaker for morning trade.
- Wine bar: west-facing = golden hour visibility = premium for evening service
- Bakery: east or south-facing preferred (morning visibility)

**Detection method (not yet implemented):**

```
Facing = f(street_geometry, parcel_position)

Data sources:
  - NYC LION street segment centerline (from DoITT) — provides street bearing
  - NYC MapPLUTO parcel data — provides parcel centroid and address number
  - NYC address parity convention: even numbers = north/west side, odd numbers = south/east side
    (this is the approximate convention; actual facing requires parcel centroid comparison)

Algorithm:
  1. Get street bearing from LION for the street segment containing the address
  2. Compute perpendicular facing directions (left-of-street-travel vs right-of-street-travel)
  3. Determine which side the parcel is on: odd address → south/east side (for typical NYC grid)
  4. Confirm with parcel centroid relative to street centerline (more accurate)
  5. Output: primary_facing (N/S/E/W) + confidence ('high' if both methods agree, 'medium' if address-only)
```

**Sun exposure formula:**

```
Approximate sun hours = f(latitude, season, facing)

For NYC (latitude 40.7° N), annual average:
  East-facing:  3.0–4.5 hrs direct AM sun (7am–12pm window)
  West-facing:  3.0–4.5 hrs direct PM sun (12pm–6pm window)
  South-facing: 5.0–7.0 hrs year-round (peak mid-day)
  North-facing: 0–1.5 hrs (indirect/ambient only)

The "3.1 hours AM sun" in the wireframe was an estimate. Use the above ranges by facing direction.
Do not show a precise decimal (3.1 hrs) — show a range ("3–4 hrs AM sun") until the seasonal model is built.
```

**Output schema:**
```typescript
interface BuildingFacing {
  primaryFacing: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
  confidence: 'high' | 'medium' | 'low';
  sunExposureHrs: string;  // e.g. "3–4 hrs AM sun" or "5–7 hrs daily"
  sunPeriod: 'AM' | 'PM' | 'all-day' | 'minimal';
}
```

**Confidence rules:**
- "high" = LION street bearing + parcel centroid agree on facing → use in UX with no caveat
- "medium" = address parity convention only, no parcel centroid confirmation → show "est." suffix
- "low" = diagonal street or ambiguous bearing → do not show facing data at all

### 5.2 · Concept-Facing Compatibility

| Concept | Preferred facing | Negative facing | Halo effect |
|---|---|---|---|
| specialty_coffee | E, SE | N | +8 to cluster score if E-facing |
| bakery | E, S | N | +6 to cluster score if E/S-facing |
| wine_bar | W, SW | N | +8 to cluster score if W-facing |
| cocktail_bar | W, S | — | +6 if W-facing |
| full_service_restaurant | S, SE | — | +4 if S-facing (high visibility) |
| fitness_studio | S | — | +4 if S-facing (visibility + energy) |
| specialty_retail | S, E | N | +5 if S/E-facing |

**No facing data** = no halo adjustment applied. Never penalize for unknown facing.

---

## 6 · Pattern Output Schema

This is what the Brain thread produces and the UX thread consumes. UX-5 is built against this schema.

```typescript
interface PatternLogicOutput {
  // Cluster
  clusterType: 'daily-ritual' | 'evening-destination' | 'service-errand' | 'mixed';
  clusterConfidence: 'high' | 'medium' | 'low';
  clusterCompatibility: 'compatible' | 'neutral' | 'mismatch';
  clusterMismatchCopy?: string;  // present only if mismatch

  // Named businesses (real data — not hardcoded)
  anchorBusinesses: NearbyBusiness[];       // top 3 by relevance within 400ft
  morningRhythmBusinesses: NearbyBusiness[]; // daily-ritual signal businesses within 200ft

  // Building facing
  facing: BuildingFacing | null;  // null = detection failed or low confidence

  // Lightbulb aside
  lightbulbAside: {
    neighborhood: string;   // e.g. "Williamsburg"
    tradeoff: string;       // one tradeoff observation (not a reversal)
    pathway: string;        // one concrete action
  };

  // Halo scores
  clusterHaloScore: number;    // 0–20 additive to Fit IQ
  facingHaloScore: number;     // 0–10 additive to Fit IQ
}
```

---

## 7 · Lightbulb Aside Rules (Pattern Logic)

The lightbulb aside (💡) appears below the cluster cards. Rules (confirmed from BR-1 and Gate 2 review):

1. **Always neighborhood-scoped** — never user-scoped. "Williamsburg is changing fast" not "Your concept faces a challenge."
2. **Always a tradeoff** — never pure validation. The aside identifies something real that cuts both ways.
3. **Always a pathway** — closes with one concrete, time-bound action the user can take.
4. **No reversal framing** — never "Actually..." or "But..." or "Myth: X. Reality: Y."
5. **No concept-shaming** — never says the concept is wrong for the location.

**Template:**
```
[Neighborhood observation — factual, specific, recent].
[The tradeoff: what this means for the concept in both directions].
[The pathway: one action with a time horizon].
```

**Approved example (FIX-5.1 from Gate 2):**
> "The cafe culture in Williamsburg is real — 23 specialty coffee and food concepts have opened in this block group since 2021, and fewer than 4 have closed. And so is the change: new residential construction on Graham is adding 340+ units by 2026. If you're committing to this address, lock rent before the next lease cycle — the window before that demand lift is reflected in asking rates is narrow."

---

## 8 · Named Business Verification Pipeline

This is the pipeline that replaces hardcoded business names (Brooklyn Roasting Co., Sey Coffee, etc.) with live, verified data. UX-5 reads from this pipeline's output — no static names in the component.

### 8.1 · Data sources in priority order

1. **`enriched_entities` table (Supabase)** — pre-enriched Google Places + Foursquare data. Used first if fresh (< 30 days old).
2. **Google Places Nearby Search (live)** — `src/lib/intel/google-places.ts`. Fallback when enriched data is stale or missing. Subject to $32/1K request cost, no budget cap.
3. **Foursquare Places API (live)** — secondary cross-reference for name/category validation.

### 8.2 · Verification query (Supabase)

```sql
-- Find all businesses within 400ft of the target address
-- Target: 40.713XXX, -73.944XXX (89 Graham Ave example)

WITH target AS (
  SELECT ST_SetSRID(ST_MakePoint(-73.944XXX, 40.713XXX), 4326) AS geom
)
SELECT
  e.name,
  e.category,
  e.lat,
  e.lng,
  ST_Distance(
    e.geom::geography,
    (SELECT geom::geography FROM target)
  ) * 3.28084 AS distance_ft,
  e.place_id,
  e.last_verified_at,
  EXTRACT(DAY FROM NOW() - e.last_verified_at) AS days_since_verified
FROM enriched_entities e
WHERE ST_DWithin(
  e.geom::geography,
  (SELECT geom::geography FROM target),
  121.92  -- 400 feet in meters
)
  AND e.status = 'operational'
ORDER BY distance_ft ASC;
```

### 8.3 · Freshness & verification rules

| Signal | Rule |
|---|---|
| `last_verified_at` < 30 days | Use enriched_entities row as-is |
| `last_verified_at` 30–90 days | Use but flag for re-verify |
| `last_verified_at` > 90 days | Trigger live Google Places re-query, update row |
| `status ≠ 'operational'` | Exclude from cluster detection |
| `last_verified_at` missing | Trigger live re-query |

### 8.4 · Cross-verification (name + category match)

For each business returned from `enriched_entities`:

1. Query Google Places Nearby for same lat/lng ±10m radius
2. Fuzzy-match name (Levenshtein distance ≤ 3, case-insensitive) against Google result
3. If no match: mark row `status = 'closed'`, `closed_detected_at = NOW()`, exclude from output
4. If match but category differs: update `enriched_entities.category` to Google's canonical category

### 8.5 · Output contract

```typescript
interface VerifiedBusiness {
  name: string;
  category: string;              // canonical RE² category (mapped from Google/Foursquare)
  distanceFt: number;            // from target address
  placeId: string;               // Google place_id or Foursquare fsq_id
  lastVerifiedAt: string;        // ISO date
  source: 'enriched_entities' | 'google_places_live' | 'foursquare_live';
  confidence: 'verified' | 'stale' | 'unverified';
}
```

`confidence: 'verified'` = re-checked within 30 days AND name+category matched across two sources
`confidence: 'stale'` = last verified 30–90 days, not yet re-checked this session
`confidence: 'unverified'` = Google-only or Foursquare-only, no cross-match

### 8.6 · UX-5 card display rules

- Only `confidence: 'verified'` businesses appear as named anchors in Pattern Logic cards
- `stale` businesses appear in counts ("3 coffee shops within 400ft") but not by name
- `unverified` businesses do not appear in UI
- If zero verified businesses within 400ft: show "No anchor businesses within 400ft" — do not fall back to fabricated names

### 8.7 · Scheduled refresh

- Daily cron: re-verify all enriched_entities rows with `last_verified_at > 60 days` (rolling window)
- Per-address: when a user scores a new address, trigger verification for all businesses in that address's 400ft radius as part of the scoring run
- Log cost per run to track Google Places budget burn

---

## 9 · Implementation Sequence

This spec cannot be implemented until data exists. The sequence is:

1. **Run cluster detection query** against `enriched_entities` for test addresses (89 Graham, 5 others). Validate that real business names within 400ft are returned and are current.

2. **Implement building facing detection** using LION + MapPLUTO data. Test on 10 known addresses with verified facings. Confirm confidence thresholds.

3. **Formalize the compatibility matrix** in `src/lib/constants/clusterMatrix.ts` as a typed lookup table. UX reads from this, not from spec doc prose.

4. **Replace UX-5 demo data** with live output from steps 1–3. Brain reviews before merge.

5. **Kalpna reviews UX-5 wireframe update** with real data before implementation in Svelte.

---

*Deliverable for UX-5 (Pattern Logic). None of the logic in this spec exists in production yet. UX-5 wireframe is approved for design direction; all data claims must come from this pipeline before production ship.*
