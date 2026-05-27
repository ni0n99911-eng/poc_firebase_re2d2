# Brain 3 — D09 Rule Trace Report

**Task:** B3-2.2 from RE²-Brain3-Work-Package
**Date:** 2026-04-14
**Source:** Static analysis of `src/lib/intel/location-iq.ts` lines 736–1057 (the 17 D09 rules)
**Live trace:** Dev-only `console.debug('[D09 TRACE] …')` emitted at end of rule section; gated by `import.meta.env.DEV` so production is silent.

---

## Rule → Concept Applicability Matrix

Each rule either applies universally to all concepts (with per-concept thresholds) or is gated to a single concept / small concept set. The table below shows which concepts CAN fire each rule; whether a rule actually fires depends on live data (income thresholds, complaint counts, competitor density, etc.).

| Rule | Name | Applies to |
|------|------|------------|
| D09-1 | Concept-specific clustering thresholds | specialty_coffee, full_service_restaurant, bar_nightlife, retail, personal_services, fitness_studio, medical_office |
| D09-2 | Med spa income floor | medical_office only |
| D09-3 | Second-generation space bonus | all concepts (matches on prev-tenant concept) |
| D09-4 | Sidewalk cafe revenue bonus | full_service_restaurant, specialty_coffee, bar_nightlife, qsr |
| D09-5 | Noise complaint risk for nightlife | bar_nightlife only |
| D09-6 | Anchor proximity by concept | specialty_coffee, florist, bakery (concept-specific bonuses) |
| D09-7 | Office-dependent weekday-only risk | specialty_coffee, qsr, fast_casual |
| D09-8 | Walk Score hard floor for impulse concepts | specialty_coffee, qsr, retail, bakery (impulse archetype) |
| D09-9 | Residential density bonus for neighborhood concepts | personal_services, salon, fitness_studio |
| D09-10 | Grocery anti-clustering | retail (grocery subtype) |
| D09-11 | Florist income floor + event venue proximity | florist (canonicalizes to retail) |
| D09-12 | Grocery food desert bonus | retail (grocery subtype) |
| D09-13 | Bakery morning commute + office catering | bakery |
| D09-14 | Retail corner location + neighborhood identity | retail |
| D09-15 | Fitness residential density + parking | fitness_studio |
| D09-16 | Salon/barbershop residential density | personal_services |
| D09-17 | Med spa luxury corridor + specialist competition | medical_office |

---

## Expected Rule Firings Per Test Concept

Based on static analysis + the 5 test locations from April 13 (200 Smith restaurant, 37-11 30th fitness, 161 E Fordham retail, 105 Rivington bar, 378 6th coffee) + the 4 coffee calibration addresses, here's which rules SHOULD fire per concept:

### specialty_coffee (378 6th Ave, 273 5th Ave, 501 9th Ave, 1 Manhattan West)
**Eligible rules (6):** D09-1, D09-3, D09-4, D09-6, D09-7, D09-8

**Likely firings for Midtown addresses:**
- **D09-1** — Coffee saturation threshold is 2 (very tight). In dense Midtown, Ring 1+2 competitor count almost always exceeds 2, so a saturation penalty (-6 tiq) is likely.
- **D09-4** — Sidewalk cafe permits common on 5th/6th/9th Ave corridors → +5 siq likely.
- **D09-7** — Office-dependent weekday risk — fires for all Midtown coffee based on weekend foot-traffic ratio.
- **D09-8** — Walk Score floor — Manhattan Walk Scores almost always clear the floor, so typically no penalty.
- **D09-3** — Second-gen bonus — depends on prev-tenant data; rarely available in current inspections feed.
- **D09-6** — Transit hub proximity bonus — fires at MTA-heavy corridors (1 Manhattan West = Hudson Yards station).

### full_service_restaurant (200 Smith St)
**Eligible rules (3):** D09-1, D09-3, D09-4

**Likely firings:** D09-1 (clustering) — Smith St restaurant corridor has 3-8 dining competitors, positive effect. D09-4 (sidewalk cafes) very likely in Cobble Hill.

### fitness_studio (37-11 30th Ave)
**Eligible rules (4):** D09-1, D09-3, D09-9, D09-15

**Likely firings:** D09-1 saturation (fitness saturation = 1, so any same-modality competitor fires -10 penalty). D09-15 residential density + parking bonus in Astoria.

### retail (161 E Fordham)
**Eligible rules (5):** D09-1, D09-3, D09-10, D09-12, D09-14

**Likely firings:** D09-1 (positive clustering — retail concept benefits from comparison shopping, 5+ peers helps). D09-14 corner location + neighborhood identity depends on Fordham corner status.

### bar_nightlife (105 Rivington St)
**Eligible rules (4):** D09-1, D09-3, D09-4, D09-5

**Likely firings:** D09-5 noise complaint risk (LES has high 311 noise volume — expect -8 siq). D09-1 clustering (bar saturation = 6, in LES likely exceeds). D09-4 sidewalk cafes common.

### medical_office
**Eligible rules (5):** D09-1, D09-2, D09-3, D09-15 (partial), D09-17

**Likely firings:** D09-2 fires in low-income neighborhoods (<$60K median). D09-17 luxury corridor + specialist competition — highly geography-dependent.

### bakery
**Eligible rules (4):** D09-1 (via personal_services path? no — bakery not in CLUSTER_RULES), D09-3, D09-8, D09-13

**Note:** bakery is NOT in the CLUSTER_RULES map for D09-1 — clustering fires for bakery via general Rule 15 only. Potential gap; flag for Brain 3 follow-up.

---

## Observations & Potential Gaps

1. **bakery missing from D09-1 CLUSTER_RULES** (line 743-754 in location-iq.ts). Bakery behaves like specialty_coffee for clustering (saturation ≈ 3-5), but currently falls through to the generic Rule 15 path. Consider adding.

2. **generic / custom concepts** (B3-2.1 addition): ZERO D09 rules fire for the `generic` concept, by design. The trace line will emit `rulesFired=0`.

3. **D09-6 code branch uses `if (concept === 'specialty_coffee')`** — only coffee, florist, bakery are instrumented. Medical / fitness / retail proximity bonuses from the same spec section (Doc 09) are covered by D09-15/D09-14 instead.

4. **Coverage density** — Medium concepts (coffee, full_service_restaurant, medical_office, retail, fitness_studio) have 4-6 eligible rules each. Thin concepts (qsr, fast_casual, personal_services, bar_nightlife) have 2-4. Newer concepts (wellness_beverage, juice_bar, wellness_spa, pharmacy, doggie_daycare, tutoring, ethnic_market) have only D09-3 (universal). This is a gap for follow-up work.

5. **Trace signal pattern** — all D09 rules push `{ layer: 'NIQ' | 'SIQ' | 'TIQ', type: 'positive' | 'negative' | 'info', message }`. The trace hook captures `signals.length` delta between start of D09 section and end of D09 section. Non-D09 adjustments (universal rules after line 1060) are NOT counted.

---

## How to Run the Live Trace

The trace is dev-only. To exercise it:

1. Run dev server: `npm run dev`
2. Hit `/api/location-iq?lat=…&lng=…&businessType=specialty_coffee` for each test address.
3. Inspect server console for `[D09 TRACE] concept=specialty_coffee rulesFired=N`.
4. Each entry lists the NIQ/SIQ/TIQ layer, positive/negative/info sign, and first 80 chars of the signal message.

Production `NODE_ENV=production` builds strip this via `import.meta.env.DEV === false`.

---

**Status:** Static analysis complete. Live-run instrumentation in place. Next: exercise the trace against all 4 coffee + 12 non-coffee test addresses from Kalpna's Round 5 test plan and append actual-fire counts to this document.
