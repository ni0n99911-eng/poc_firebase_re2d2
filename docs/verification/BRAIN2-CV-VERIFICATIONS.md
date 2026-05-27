# Brain 2 — CV Count Verifications (B2-3.1 / B2-3.2 / B2-3.3)

**Date:** April 14, 2026
**Author:** Brain 2
**Scope:** Resolve the rule/item counts V5 vs Orch 2 disagree on.

---

## CV-11 — Heads-Up rule count

**Question:** V5 says 57 (8 universal + 49 concept-specific). Orch 2 says ~56.

**Verification** — `src/lib/intel/heads-up-engine.ts`:

| Category | Function | Rule count |
|----------|----------|-----------:|
| Universal | inline block in `generateHeadsUpWarnings` | 8 |
| Coffee shop | `generateCoffeeShopWarnings` | 5 |
| Restaurant | `generateRestaurantWarnings` | 6 |
| Fitness | `generateFitnessWarnings` | 6 |
| Medical / dental | `generateMedicalDentalWarnings` | 6 |
| Florist | `generateFloristWarnings` | 5 |
| Spa / wellness | `generateSpaWellnessWarnings` | 6 |
| Barbershop | `generateBarbershopWarnings` | 5 |
| Retail | `generateRetailWarnings` | 6 |
| "Something else" fallback | `generateSomethingElseWarnings` | 4 |

**Total concept-specific:** 5 + 6 + 6 + 6 + 5 + 6 + 5 + 6 + 4 = **49**
**Total:** 8 + 49 = **57**

**Conclusion:** ✅ V5 is correct (57). Orch 2's ~56 appears to miscount by one
(most likely the "Something else" fallback which is easy to skip because it's
the no-persona generic path).

**Action for project_vital_rules_status.md:** no change — V5's 57 stands.

---

## CV-12 — Checklist item count

**Question:** V5 says 51. Orch 2 says 60–80.

**Verification** — `src/lib/data/checklist-data.ts`:

| Phase      | Items |
|------------|------:|
| entity     | 7 |
| lease      | 4 |
| permits    | 16 |
| design     | 22 |
| finance    | 7 |
| ops        | 16 |
| marketing  | 4 |
| opening    | 4 |

**Total checklist items:** **80**

Migration `supabase/migrations/026-checklist-schema.sql` defines the table
schema; the canonical item set is the TypeScript array above
(`export const CHECKLIST_ITEMS` in checklist-data.ts).

**Conclusion:** ✅ Orch 2's upper bound is correct (80). V5's 51 is stale
— likely the pre-"design" + pre-"ops" expansion count. The "design" phase
(22 items) and "ops" phase (16 items) together account for nearly half
the current list.

**Action for project_vital_rules_status.md:** update CV-12 count from 51 to 80.

---

## CV-13 — Revenue Model coverage

**Question:** For all 16 concepts in the concept registry, confirm each has
an assigned `revenueModel`.

**Verification** — `src/lib/constants/conceptKPIs.ts`:

| Concept                 | revenueModel    |
|-------------------------|-----------------|
| specialty_coffee        | volume          |
| bakery                  | volume          |
| fast_casual             | volume          |
| full_service_restaurant | volume          |
| qsr                     | volume          |
| bar_nightlife           | peak_weighted   |
| juice_bar               | volume          |
| wellness_beverage       | volume          |
| retail                  | sqft            |
| fitness_studio          | mrr             |
| personal_services       | utilization     |
| wellness_spa            | utilization     |
| medical_office          | event_plus      |
| florist                 | utilization     |
| coworking               | mrr             |
| **grocery**             | **❌ MISSING**  |

**Total:** 16 concepts registered. **15** have `revenueModel`. **grocery** does not.

**Recommendation:** `grocery` should be `'volume'` (ticket-based, high-throughput
— matches its cost structure: 70% COGS, 1–3% net margin, foot-traffic-driven).
Cross-check: the `RAMP_FACTORS` table in conceptKPIs.ts at line 1217 includes a
'volume' row that would be used as the default fallback via `getRevenueModel()`
— so grocery currently ramps correctly in practice, but the explicit field is
missing.

**Action for project_vital_rules_status.md:** flag CV-13 as **15 / 16** (not
16/16). File owner for fix: **Brain 3** (conceptKPIs.ts is not on the Brain 2
exclusion list today, but the Work Package routes concept-weight changes
through Brain 3 to keep scoring in a single owner's branch).

**Suggested one-line patch** (for Brain 3):

```ts
// src/lib/constants/conceptKPIs.ts — inside the `grocery: { ... }` block,
// add after `label: 'Independent Grocery',`:
    revenueModel: 'volume',
    revenueParams: { /* copy from a similar volume concept like qsr */ },
```

---

## Summary for project_vital_rules_status.md

- **CV-11:** ✅ 57 (8 universal + 49 concept-specific) — V5 was correct
- **CV-12:** ⚠️ 80 (not 51) — update memory to match actual checklist-data.ts
- **CV-13:** ⚠️ 15 / 16 — `grocery` missing explicit `revenueModel`; handoff
  to Brain 3

No code changes in this verification doc. File owners and exclusion rules
respected: Brain 2 only read the registries.
