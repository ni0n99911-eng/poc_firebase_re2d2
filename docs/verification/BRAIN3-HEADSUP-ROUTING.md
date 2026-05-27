# Brain 3 — Heads-Up Generator Routing Verification

**Task:** B3-NEW-2 (reassigned from Brain 1)
**Branch:** feat/brain3-headsup-all-concepts
**Date:** 2026-04-14

## What Was Fixed

`normalizePersonaKey()` in `heads-up-engine.ts` previously only recognized old v3 persona
strings (`coffee_shop`, `restaurant`, `fitness`, etc.) and a handful of short aliases.
All canonical concept keys from `normalizeConceptKey()` — `specialty_coffee`,
`full_service_restaurant`, `bar_nightlife`, etc. — fell through to `something_else`,
meaning 8 of 9 generators never fired in production.

Added full canonical key mapping so every concept routes correctly.

## Routing Table (Post-Fix)

| Canonical Concept Key | → Persona | Generator |
|---|---|---|
| `specialty_coffee` | `coffee_shop` | `generateCoffeeShopWarnings` |
| `full_service_restaurant` | `restaurant` | `generateRestaurantWarnings` |
| `fast_casual` | `restaurant` | `generateRestaurantWarnings` |
| `qsr` | `restaurant` | `generateRestaurantWarnings` |
| `fine_dining` | `restaurant` | `generateRestaurantWarnings` |
| `bakery` | `restaurant` | `generateRestaurantWarnings` |
| `fitness_studio` | `fitness` | `generateFitnessWarnings` |
| `medical_office` | `medical_dental` | `generateMedicalDentalWarnings` |
| `florist` | `florist` | `generateFloristWarnings` |
| `wellness_spa` | `spa_wellness` | `generateSpaWellnessWarnings` |
| `personal_services` | `barbershop` | `generateBarbershopWarnings` |
| `retail` | `retail` | `generateRetailWarnings` |
| `ethnic_market` | `retail` | `generateRetailWarnings` |
| `bar_nightlife` | `something_else` | `generateSomethingElseWarnings` |
| `wellness_beverage` | `something_else` | `generateSomethingElseWarnings` |
| `juice_bar` | `something_else` | `generateSomethingElseWarnings` |
| `coworking` | `something_else` | `generateSomethingElseWarnings` |
| `generic` | `something_else` | `generateSomethingElseWarnings` |
| `pharmacy` | `something_else` | `generateSomethingElseWarnings` |
| `doggie_daycare` | `something_else` | `generateSomethingElseWarnings` |
| `tutoring` | `something_else` | `generateSomethingElseWarnings` |

## Notes

- `bar_nightlife` routes to `something_else` — no dedicated bar generator exists yet.
  If/when one is added, update the map entry to `bar`.
- `bakery` routes to `restaurant` — closest semantic match for buildout/lease warnings.
- `personal_services` routes to `barbershop` — covers salon/nail/lash personas.
- Universal scoring-data rules (safety, transit, competition, vibrancy, momentum flags)
  fire for **every** concept regardless of routing — no concept gets zero warnings.

## Acceptance Criteria

- [ ] specialty_coffee → at least 1 coffee-specific warning (C1–C5 build-out warnings)
- [ ] full_service_restaurant → at least 1 restaurant-specific warning
- [ ] fitness_studio → at least 1 fitness-specific warning
- [ ] medical_office → at least 1 medical/dental-specific warning
- [ ] florist → at least 1 florist-specific warning
- [ ] wellness_spa → at least 1 spa/wellness-specific warning
- [ ] personal_services → at least 1 barbershop-specific warning
- [ ] retail → at least 1 retail-specific warning
- [ ] generic/something_else → at least 1 something_else warning

Verify by scoring test addresses with each concept and checking the `headsUp` array in
the `/api/location-iq` GET response.
