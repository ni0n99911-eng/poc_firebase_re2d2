# RE² Threshold Audit — BL-B3 (April 12, 2026)

Comprehensive checklist of every hardcoded numeric threshold in the scoring pipeline.
Format: `[ ] file:line | value | what it controls`

Produced by Brain 2. Last updated: 2026-04-12.
To mark reviewed: change `[ ]` to `[x]`. To flag for recalibration: change to `[!]`.

---

## 1. Concept Archetype Weights (`location-iq.ts`)

These weights sum to 1.0 per concept type. Changing any row requires recalibration against
the V4 batch scorer output distributions.

- [x] `location-iq.ts:125` | `niq:0.30, siq:0.40, tiq:0.20, liq:0.10` | `specialty_coffee` NIQ/SIQ/TIQ/LIQ weights
- [x] `location-iq.ts:130` | `niq:0.30, siq:0.35, tiq:0.25, liq:0.10` | `qsr` weights
- [x] `location-iq.ts:135` | `niq:0.30, siq:0.20, tiq:0.35, liq:0.15` | `full_service_restaurant` weights
- [x] `location-iq.ts:140` | `niq:0.25, siq:0.35, tiq:0.20, liq:0.20` | `fitness_studio` weights
- [x] `location-iq.ts:145` | `niq:0.30, siq:0.40, tiq:0.20, liq:0.10` | `retail / boutique` weights
- [x] `location-iq.ts:150` | `niq:0.25, siq:0.20, tiq:0.35, liq:0.20` | `personal_services / salon` weights
- [x] `location-iq.ts:155` | `niq:0.25, siq:0.30, tiq:0.20, liq:0.25` | `medical_office` weights
- [x] `location-iq.ts:160` | `niq:0.30, siq:0.25, tiq:0.25, liq:0.20` | `coworking` weights
- [x] `location-iq.ts:165` | `niq:0.30, siq:0.25, tiq:0.20, liq:0.25` | `grocery` weights

### Archetype-level fallback weights
- [x] `location-iq.ts:171` | `niq:0.30, siq:0.40, tiq:0.20, liq:0.10` | impulse archetype default
- [x] `location-iq.ts:172` | `niq:0.30, siq:0.20, tiq:0.35, liq:0.15` | planned archetype default
- [x] `location-iq.ts:173` | `niq:0.25, siq:0.30, tiq:0.20, liq:0.25` | destination archetype default

---

## 2. NIQ Sub-Score Weights (`location-iq.ts:302-306`)

- [x] `location-iq.ts:302` | `0.25` | NIQ: population/demographics sub-weight
- [x] `location-iq.ts:303` | `0.20` | NIQ: lifecycle/momentum sub-weight
- [x] `location-iq.ts:304` | `0.30` | NIQ: business ecosystem sub-weight
- [x] `location-iq.ts:305` | `0.15` | NIQ: disruption/vibrancy sub-weight
- [x] `location-iq.ts:306` | `0.10` | NIQ: transit sub-weight

## 3. SIQ Sub-Score Weights (`location-iq.ts:313-316`)

- [x] `location-iq.ts:313` | `0.30` | SIQ: walkability sub-weight
- [x] `location-iq.ts:314` | `0.30` | SIQ: competitors sub-weight
- [x] `location-iq.ts:315` | `0.20` | SIQ: building risk sub-weight
- [x] `location-iq.ts:316` | `0.20` | SIQ: landmarks sub-weight (no concept modifier)

## 4. TIQ Sub-Score Weights (`location-iq.ts:323-325`)

- [x] `location-iq.ts:323` | `0.40` | TIQ: cuisine diversity sub-weight
- [x] `location-iq.ts:324` | `0.30` | TIQ: quality gap sub-weight
- [x] `location-iq.ts:325` | `0.30` | TIQ: market gap sub-weight

---

## 5. Walk Score Multipliers (`location-iq.ts`)

Applied as a post-hoc SIQ multiplier — affects final locationIQ.

- [x] `location-iq.ts:398` | `>= 90 → 1.10` | Walk Score ≥90 boosts composite +10%
- [x] `location-iq.ts:399` | `>= 70 → 1.00` | Walk Score 70-89: neutral
- [x] `location-iq.ts:400` | `>= 50 → 0.90` | Walk Score 50-69: -10% composite penalty
- [ ] `location-iq.ts:400` | `< 50 (implied)` | Walk Score <50: confirm penalty value — no explicit branch

---

## 6. Competitor Density Signals (`location-iq.ts`)

- [x] `location-iq.ts:469` | `nearby >= 3` | COMPARISON_CONCEPTS: minimum to trigger competitor density signal
- [x] `location-iq.ts:474` | `>= 2 && <= 5` | "validated but uncrowded" sweet spot
- [x] `location-iq.ts:477` | `> 8` | "saturated" — differentiation critical signal
- [x] `location-iq.ts:483` | `nearby >= 5` | services/fitness/medical: "high service density"

---

## 7. Income Alignment (`location-iq.ts`)

- [x] `location-iq.ts:444` | `target.min * 0.7` | income below 70% of concept minimum → negative signal
- [x] `location-iq.ts:448` | `divergence > 0.30` | 30%+ income mismatch → "income-concept tension"
- [x] `location-iq.ts:770` | `medIncome < 60000` | bar/nightlife: below $60K median → cost sensitivity signal
- [x] `location-iq.ts:913` | `medIncome < 80000` | grocery: below $80K → price sensitivity signal

---

## 8. Gentrification & Lifecycle Signals (`location-iq.ts`)

- [x] `location-iq.ts:502` | `incomeChange5yr > 25, newBizRate > 20, newBuildings > 3` | rapid gentrification
- [x] `location-iq.ts:504` | `incomeChange5yr >= 10 && <= 25, newBizRate >= 15` | active transition
- [x] `location-iq.ts:506` | `incomeChange5yr > 25, newBizRate < 15` | luxury repositioning signal
- [x] `location-iq.ts:508` | `incomeChange5yr > 0 && < 10, newBizRate >= 10` | early momentum signal

---

## 9. Office/Residential Context (`location-iq.ts`)

- [x] `location-iq.ts:530` | `daytimeRatio > 2.0 && borough == 'Manhattan'` | office-dependent corridor
- [x] `location-iq.ts:531` | `daytimeRatio < 1.3 && ['Brooklyn','Queens']` | residential/recreational
- [x] `location-iq.ts:864` | `daytimeRatio > 2.0` | "office district" foot traffic pattern signal
- [x] `location-iq.ts:971` | `daytimeRatio > 1.3` | daytime-skewed foot traffic (positive for lunch concepts)

---

## 10. Commercial Vitality (`location-iq.ts`)

- [x] `location-iq.ts:551` | `commercialVitality > 80 && totalBiz > 100` | anchor corridor
- [x] `location-iq.ts:553` | `totalBiz < 20 && commercialVitality < 30` | isolated / pioneer risk

---

## 11. Neighborhood Health / Signals (`location-iq.ts`)

- [x] `location-iq.ts:609` | `activeCount > 5` | sidewalk cafes: "activated streetscape" signal
- [x] `location-iq.ts:648` | `onPremise >= 8` | nightlife: "dense nightlife — foot traffic evenings"
- [x] `location-iq.ts:657` | `onPremise >= 5` | nightlife: "rising nightlife" signal
- [x] `location-iq.ts:820` | `noiseCount > 15` | 311 noise: "noise-dominant complaints" signal
- [x] `location-iq.ts:886` | `pop > 10000` | population density — "dense residential catchment"
- [x] `location-iq.ts:899` | `nearby >= 1` | grocery: at least 1 competitor needed for validation
- [x] `location-iq.ts:1002` | `pop > 15000` | high-density population signal
- [x] `location-iq.ts:1013` | `pop > 8000 && pop <= 10000` | moderate-density signal
- [x] `location-iq.ts:1065` | `(currentYear - yearBuilt) > 30` | building age risk flag
- [x] `location-iq.ts:1147` | `pillars.score >= 65` | "strong" pillar threshold
- [x] `location-iq.ts:1148` | `pillars.score < 40` | "weak" pillar threshold
- [x] `location-iq.ts:1150` | `strong.length >= 3` | "well-rounded" composite signal
- [x] `location-iq.ts:1154` | `weak.length >= 3` | "multi-pillar weakness" warning

---

## 12. Signal Interpretation Thresholds (`location-iq.ts`)

- [x] `location-iq.ts:1218` | `incomeScore > 70` | positive income signal trigger
- [x] `location-iq.ts:1219` | `incomeScore < 40` | negative income signal trigger
- [x] `location-iq.ts:1220` | `educScore > 70` | "receptive to specialty concepts" signal
- [x] `location-iq.ts:1226` | `rentBurdenedPct > 50` | housing stress signal
- [x] `location-iq.ts:1231` | `vacancyRate > 15` | high vacancy warning
- [x] `location-iq.ts:1234` | `vacancyRate < 5` | tight supply / landlord power signal
- [x] `location-iq.ts:1245` | `newRate >= 10 && <= 25` | healthy business lifecycle score = 80
- [x] `location-iq.ts:1252` | `newRate > 25` | volatile market warning
- [x] `location-iq.ts:1265` | `cafes.activeCount > 3` | sidewalk cafe ecosystem signal
- [x] `location-iq.ts:1274` | `liq.totalCount > 10` | liquor density signal
- [x] `location-iq.ts:1278` | `liq.nightlifeDensity > 70` | high nightlife signal
- [x] `location-iq.ts:1289` | `dob.newBuildingCount > 2` | construction signal
- [x] `location-iq.ts:1292` | `dob.activeViolationCount > 5` | building violation warning
- [x] `location-iq.ts:1301` | `noiseCount > 20` | neighborhood noise floor signal
- [x] `location-iq.ts:1312` | `transit > 70` | positive transit signal
- [x] `location-iq.ts:1318` | `pedScore > 70` | high foot traffic signal
- [x] `location-iq.ts:1343` | `transitScore > 70` | Walk Score transit overlay signal
- [x] `location-iq.ts:1346` | `walkability > 80` | "highly walkable" positive signal
- [x] `location-iq.ts:1364` | `total > 8` | "saturated" competitor warning
- [x] `location-iq.ts:1372` | `avgPopularity > 0.6` | Foursquare high venue popularity
- [x] `location-iq.ts:1377` | `categoryDiversity > 15` | category diversity signal
- [x] `location-iq.ts:1384` | `chainPct > 60` | chain-dominant corridor warning
- [x] `location-iq.ts:1394` | `riskScore > 50` | building risk warning
- [x] `location-iq.ts:1401` | `commercialFriendly > 50` | favorable zoning signal
- [x] `location-iq.ts:1404` | `commercialFriendly < 20` | hostile zoning warning
- [x] `location-iq.ts:1409` | `totalRetailSqFt > 50000` | high retail density
- [x] `location-iq.ts:1413` | `developmentPotential > 70` | development pressure warning
- [x] `location-iq.ts:1417` | `avgYearBuilt < 1940` | pre-war building signal
- [x] `location-iq.ts:1468` | `cuisines > 10` | diverse food scene signal
- [x] `location-iq.ts:1477` | `avgGrade < 60` | quality gap opportunity signal

---

## 13. Six-Index Concept Scan Radii (`six-index.ts:29-35`)

These control the competitor detection radius per concept. Calibrated against actual
NYC block densities (March 2026).

- [x] `six-index.ts:29` | `250m` | coffee / specialty_coffee scan radius
- [x] `six-index.ts:30` | `350m` | bakery, deli scan radius
- [x] `six-index.ts:30` | `400m` | fast-casual, qsr scan radius
- [x] `six-index.ts:31` | `500m` | restaurant, full_service_restaurant, florist, personal_services, salon, retail, boutique
- [x] `six-index.ts:32` | `600m` | fitness, fitness_studio, bar, bar_nightlife, medical, medical_office, coworking
- [x] `six-index.ts:33` | `800m` | grocery

---

## 14. Six-Index Concept Weights (`six-index.ts:129-180`)

Per-concept weights across 8 indices: transit, demographics, competition, vibrancy,
safety, momentum, neighborhoodHealth, survivalRate. All rows sum to 1.0.

- [x] `six-index.ts:129` | specialty_coffee | transit:0.08, demo:0.02, comp:0.08, vib:0.03, safe:0.01, mom:0.02, nh:0.28, sr:0.48
- [x] `six-index.ts:134` | qsr | transit:0.08, demo:0.02, comp:0.10, vib:0.02, safe:0.01, mom:0.02, nh:0.27, sr:0.48
- [x] `six-index.ts:139` | full_service_restaurant | transit:0.06, demo:0.03, comp:0.08, vib:0.03, safe:0.01, mom:0.03, nh:0.28, sr:0.48
- [x] `six-index.ts:144` | fitness_studio | transit:0.06, demo:0.03, comp:0.10, vib:0.02, safe:0.01, mom:0.03, nh:0.27, sr:0.48
- [x] `six-index.ts:149` | retail / boutique | transit:0.08, demo:0.02, comp:0.07, vib:0.04, safe:0.01, mom:0.02, nh:0.28, sr:0.48
- [x] `six-index.ts:154` | personal_services / salon | transit:0.05, demo:0.02, comp:0.07, vib:0.04, safe:0.01, mom:0.04, nh:0.28, sr:0.49
- [x] `six-index.ts:159` | medical_office | transit:0.07, demo:0.02, comp:0.08, vib:0.02, safe:0.01, mom:0.04, nh:0.28, sr:0.48
- [x] `six-index.ts:164` | coworking | transit:0.06, demo:0.03, comp:0.08, vib:0.03, safe:0.01, mom:0.03, nh:0.28, sr:0.48
- [x] `six-index.ts:169` | grocery | transit:0.06, demo:0.03, comp:0.07, vib:0.02, safe:0.01, mom:0.05, nh:0.28, sr:0.48
- [x] `six-index.ts:175` | bar / bar_nightlife | transit:0.08, demo:0.02, comp:0.10, vib:0.02, safe:0.01, mom:0.02, nh:0.27, sr:0.48

---

## 15. Six-Index Internal Score Thresholds (`six-index.ts`)

- [x] `six-index.ts:307` | `> 70` | neighborhoodHealth "strong" threshold → +15 bonus
- [x] `six-index.ts:309` | `< 40` | neighborhoodHealth "weak" threshold → -10 penalty
- [x] `six-index.ts:313` | `> 65` | survivalRate "strong" threshold → +10 bonus
- [x] `six-index.ts:315` | `< 40` | survivalRate "weak" threshold → -10 penalty
- [x] `six-index.ts:442` | `> 70` | transit score "excellent" signal
- [x] `six-index.ts:456` | `> 70` | pedestrian score "high foot traffic" signal
- [x] `six-index.ts:470` | `> 85` | Walk Score "walker's paradise" boosts vibrancy
- [x] `six-index.ts:508` | `> 50` | rent burden warning threshold
- [x] `six-index.ts:512` | `> 15` | vacancy rate — high vacancy warning
- [x] `six-index.ts:515` | `< 5` | vacancy rate — tight supply signal
- [x] `six-index.ts:534` | `<= 3 → 85` | competition score: low competition (validated uncrowded)
- [x] `six-index.ts:535` | `<= 8 → 65` | competition score: moderate competition
- [x] `six-index.ts:542` | `avgRating < 4.0` | Google Places: low average rating → quality gap opportunity
- [x] `six-index.ts:561` | `categoryDiversity > 15` | Foursquare: diverse category ecosystem
- [x] `six-index.ts:566` | `avgRating < 7.0` | Foursquare: below-average rating → quality gap opportunity
- [x] `six-index.ts:582` | `>= 80 → 'Buzzing'` | Vibrancy score label
- [x] `six-index.ts:583` | `>= 65 → 'Busy'` | Vibrancy score label
- [x] `six-index.ts:584` | `>= 50 → 'Steady'` | Vibrancy score label
- [x] `six-index.ts:585` | `>= 35 → 'Quiet'` | Vibrancy score label (< 35 = 'Dead')
- [x] `six-index.ts:654` | `ecoScore > 50` | DCA ecosystem "active" signal
- [x] `six-index.ts:658` | `ecoScore > 70` | DCA ecosystem "thriving" signal
- [x] `six-index.ts:662` | `rate >= 10 && <= 25` | healthy DCA business lifecycle
- [x] `six-index.ts:671` | `activeCount > 3` | sidewalk cafe "activated street" signal
- [x] `six-index.ts:683` | `nightlifeDensity > 50` | liquor: moderate nightlife signal
- [x] `six-index.ts:687` | `nightlifeDensity > 70` | liquor: "vibrant nightlife" strong signal
- [x] `six-index.ts:695` | `vitality > 50` | commercial vitality "active corridor"
- [x] `six-index.ts:699` | `vitality > 70` | commercial vitality "strong corridor"
- [x] `six-index.ts:714` | `nearbyAvgPop > 0.3` | Foursquare nearby popularity > 0.3 signal
- [x] `six-index.ts:718` | `nearbyAvgPop > 0.5` | Foursquare nearby popularity > 0.5 strong signal
- [x] `six-index.ts:727` | `farAvgPop > 0.5` | Foursquare far ring popularity signal
- [x] `six-index.ts:737` | `traffic > 50` | Foursquare traffic flow positive signal
- [x] `six-index.ts:741` | `avgPopularity > 0.5` | Foursquare: moderate area popularity
- [x] `six-index.ts:788` | `crimeScore < 50` | safety: below midpoint → safety concern
- [x] `six-index.ts:790` | `crimeScore > 80` | safety: strong safety signal
- [x] `six-index.ts:798` | `noiseCount > 20` | 311: noise dominant warning
- [x] `six-index.ts:801` | `qualityScore > 75` | 311: strong quality of life signal
- [x] `six-index.ts:810` | `activeViolationCount > 5` | DOB: active violations warning
- [x] `six-index.ts:862` | `newBuildingCount > 3` | DOB: heavy construction signal
- [x] `six-index.ts:865` | `newBuildingCount > 0` | DOB: any new construction signal
- [x] `six-index.ts:870` | `permitCount > 10` | DOB: high permit activity signal
- [x] `six-index.ts:881` | `developmentPotential > 70` | PLUTO: development pressure
- [x] `six-index.ts:883` | `developmentPotential < 30` | PLUTO: stable built-out area
- [x] `six-index.ts:892` | `rate >= 15 && <= 25 → 80` | DCA momentum strong
- [x] `six-index.ts:893` | `rate >= 10 → 65` | DCA momentum moderate
- [x] `six-index.ts:894` | `rate < 5 → 30` | DCA momentum stagnant
- [x] `six-index.ts:895` | `rate > 30 → 50` | DCA momentum volatile (too fast)

---

## 16. Six-Index neighborhoodHealth / survivalRate Split (`six-index.ts:981-982`)

Critical: these two constants control how much of the remaining index weight goes to
neighborhood health vs survival rate.

- [x] `six-index.ts:981` | `nhW = remainingW * 0.37` | neighborhood health gets 37% of remaining weight
- [x] `six-index.ts:982` | `srW = remainingW * 0.63` | survival rate gets 63% of remaining weight

---

## 17. Grade Scale (`six-index.ts:1051-1060`)

- [x] `six-index.ts:1051` | `>= 93 → 'A+'` | composite grade threshold
- [x] `six-index.ts:1052` | `>= 87 → 'A'` | composite grade threshold
- [x] `six-index.ts:1053` | `>= 80 → 'A-'` | composite grade threshold
- [x] `six-index.ts:1054` | `>= 73 → 'B+'` | composite grade threshold
- [x] `six-index.ts:1055` | `>= 67 → 'B'` | composite grade threshold
- [x] `six-index.ts:1056` | `>= 60 → 'B-'` | composite grade threshold
- [x] `six-index.ts:1057` | `>= 53 → 'C+'` | composite grade threshold
- [x] `six-index.ts:1058` | `>= 47 → 'C'` | composite grade threshold
- [x] `six-index.ts:1059` | `>= 40 → 'C-'` | composite grade threshold
- [x] `six-index.ts:1060` | `>= 30 → 'D'` | composite grade threshold (< 30 = 'F')

---

## 18. Borough Scoring Floors (`borough-bounds.ts` — C-10 canonical)

- [x] `borough-bounds.ts:63` | `transitFloor: 72` | Manhattan transit floor (no MTA data fallback)
- [x] `borough-bounds.ts:64` | `qualityFloor: 55` | Manhattan 311 quality floor
- [x] `borough-bounds.ts:65` | `safetyFloor: 43` | Manhattan crime safety floor
- [x] `borough-bounds.ts:69` | `transitFloor: 55` | Bronx transit floor
- [x] `borough-bounds.ts:70` | `qualityFloor: 52` | Bronx 311 quality floor
- [x] `borough-bounds.ts:71` | `safetyFloor: 29` | Bronx crime safety floor
- [x] `borough-bounds.ts:75` | `transitFloor: 52` | Brooklyn transit floor
- [x] `borough-bounds.ts:76` | `qualityFloor: 60` | Brooklyn 311 quality floor
- [x] `borough-bounds.ts:77` | `safetyFloor: 47` | Brooklyn crime safety floor
- [x] `borough-bounds.ts:81` | `transitFloor: 50` | Queens transit floor
- [x] `borough-bounds.ts:82` | `qualityFloor: 63` | Queens 311 quality floor
- [x] `borough-bounds.ts:83` | `safetyFloor: 53` | Queens crime safety floor
- [x] `borough-bounds.ts:87` | `transitFloor: 30` | Staten Island transit floor
- [x] `borough-bounds.ts:88` | `qualityFloor: 68` | Staten Island 311 quality floor
- [x] `borough-bounds.ts:89` | `safetyFloor: 57` | Staten Island crime safety floor

---

## 19. Crime Score (`nyc-crime.ts`)

- [x] `nyc-crime.ts:74` | `300m` | crime query default radius
- [x] `nyc-crime.ts:217` | `areaSqMi == 0 → 50` | fallback when area computation fails
- [x] `nyc-crime.ts:236` | `violentRatio > 0.3 → score -= 15` | high violent crime ratio penalty
- [x] `nyc-crime.ts:237` | `violentRatio > 0.15 → score -= 8` | moderate violent crime ratio penalty

---

## 20. 311 Complaints Score (`nyc-311.ts`)

- [x] `nyc-311.ts:65` | `500m` | 311 query default radius
- [x] `nyc-311.ts:171` | `areaSqMi == 0 → 50` | fallback when area computation fails
- [x] `nyc-311.ts:192` | `noiseRatio > 0.4 → score -= 10` | high noise ratio penalty
- [x] `nyc-311.ts:193` | `noiseRatio > 0.2 → score -= 5` | moderate noise ratio penalty
- [x] `nyc-311.ts:196` | `sanitationRatio > 0.3 → score -= 10` | high sanitation complaint penalty
- [x] `nyc-311.ts:197` | `sanitationRatio > 0.15 → score -= 5` | moderate sanitation complaint penalty

---

## 21. DCA Licenses Score (`dca-licenses.ts`)

- [x] `dca-licenses.ts:46` | `500m` | DCA query default radius
- [x] `dca-licenses.ts:145` | `density / 50 * 25` | base score from business density (50 biz/sqmi = 25 pts)
- [x] `dca-licenses.ts:148` | `industryCount >= 8 → +10` | high industry diversity bonus
- [x] `dca-licenses.ts:149` | `industryCount >= 5 → +5` | moderate industry diversity bonus
- [x] `dca-licenses.ts:152` | `newBizRate >= 10 && <= 30 → +5` | healthy turnover bonus

---

## 22. MTA Ridership Score (`mta-ridership.ts`)

- [x] `mta-ridership.ts:155` | `800m` | MTA station search radius
- [x] `mta-ridership.ts:201` | `peakHourRatio: 0.40` | assumed peak hour share when actual unavailable
- [x] `mta-ridership.ts:307` | `weekdayAvg * 0.95` | Friday ridership estimate (95% of weekday avg)
- [x] `mta-ridership.ts:309` | `weekendAvg * 0.85` | Sunday ridership estimate (85% of weekend avg)
- [x] `mta-ridership.ts:324` | `estimated * 1.1` | Friday ridership estimate (fallback path)
- [x] `mta-ridership.ts:325` | `estimated * 0.7` | Saturday ridership estimate (fallback path)
- [x] `mta-ridership.ts:326` | `estimated * 0.5` | Sunday ridership estimate (fallback path)
- [x] `mta-ridership.ts:391` | `stationCount == 0 → 10` | no-station fallback transit score
- [x] `mta-ridership.ts:395` | `>= 100,000 riders → 92` | major hub transit score anchor point
- [x] `mta-ridership.ts:403` | `stationCount >= 4 → +5` | multi-station bonus
- [x] `mta-ridership.ts:404` | `stationCount >= 2 → +3` | dual-station bonus
- [x] `mta-ridership.ts:407` | `routeCount >= 6 → +5` | multi-line bonus
- [x] `mta-ridership.ts:408` | `routeCount >= 3 → +3` | moderate multi-line bonus

---

## 23. Foursquare (`foursquare.ts`)

- [x] `foursquare.ts:155` | `radius capped at 2000m` | Foursquare venue search max radius
- [x] `foursquare.ts:196` | `competitor radius capped at 1000m` | Foursquare competitor search max
- [x] `foursquare.ts:247` | `popularity > 0.7` | "high traffic" venue threshold
- [x] `foursquare.ts:251` | `highTrafficVenues > 5 → 90` | peak traffic score: many high-traffic venues
- [x] `foursquare.ts:252` | `highTrafficVenues > 2 → 75` | peak traffic score: some high-traffic venues
- [x] `foursquare.ts:253` | `highTrafficVenues > 0 → 60` | peak traffic score: one high-traffic venue
- [x] `foursquare.ts:254` | `avgPopularity > 0.5 → 55` | peak traffic score: moderate popularity
- [x] `foursquare.ts:255` | `venues.length < 5 → 30` | peak traffic score: sparse venue data

---

## 24. Momentum (`momentum.ts`)

- [x] `momentum.ts:67` | `changePct > 10 → 'up'` | slope classification: > 10% growth = uptrend
- [x] `momentum.ts:218` | `DOB trend * 0.40` | momentum composite: DOB weight
- [x] `momentum.ts:219` | `DCA trend * 0.35` | momentum composite: DCA weight
- [x] `momentum.ts:220` | `complaints trend * 0.25` | momentum composite: 311 complaints weight
- [x] `momentum.ts:214` | `'up' → 70, 'flat' → 50, 'down' → 30` | slope-to-score mapping
- [x] `momentum.ts:225` | `compositeScore > 58 → 'growing'` | momentum direction threshold
- [x] `momentum.ts:226` | `compositeScore < 42 → 'declining'` | momentum direction threshold

---

## 25. Sidewalk Cafes (`sidewalk-cafes.ts`)

- [x] `sidewalk-cafes.ts:128` | `activeCount == 0 → 10` | no sidewalk cafes → minimal vibrancy
- [x] `sidewalk-cafes.ts:129` | `activeCount <= 2 → 35` | 1-2 cafes → low vibrancy
- [x] `sidewalk-cafes.ts:130` | `activeCount <= 5 → 60` | 3-5 cafes → moderate vibrancy
- [x] `sidewalk-cafes.ts:131` | `activeCount <= 10 → 80` | 6-10 cafes → high vibrancy
- [x] `sidewalk-cafes.ts:132` | `activeCount > 10 → 90` | 10+ cafes → very high vibrancy

---

## 26. Liquor Licenses (`liquor-licenses.ts`)

- [x] `liquor-licenses.ts:127` | `onPremiseCount <= 3 → 30` | nightlife density: sparse
- [x] `liquor-licenses.ts:128` | `onPremiseCount <= 10 → 55` | nightlife density: moderate
- [x] `liquor-licenses.ts:129` | `onPremiseCount <= 20 → 75` | nightlife density: strong
- [x] `liquor-licenses.ts:130` | `onPremiseCount > 20 → 90` | nightlife density: very high
- [x] `liquor-licenses.ts:136` | `total <= 5 → 30` | vibrancy signal: sparse liquor presence
- [x] `liquor-licenses.ts:137` | `total <= 15 → 55` | vibrancy signal: moderate
- [x] `liquor-licenses.ts:138` | `total <= 30 → 75` | vibrancy signal: strong
- [x] `liquor-licenses.ts:139` | `total > 30 → 90` | vibrancy signal: very high

---

## 27. PLUTO (`pluto.ts`)

- [x] `pluto.ts:105` | `300m` | PLUTO query default radius
- [x] `pluto.ts:278` | `avgUtilization < 0.3 → +20` | FAR utilization: lots of room to develop
- [x] `pluto.ts:279` | `avgUtilization < 0.5 → +15` | FAR utilization: moderate room
- [x] `pluto.ts:280` | `avgUtilization < 0.7 → +8` | FAR utilization: some room
- [x] `pluto.ts:286` | `vacantCount >= 3 → +15` | 3+ vacant lots → development opportunity
- [x] `pluto.ts:287` | `vacantCount >= 1 → +8` | 1-2 vacant lots → minor opportunity
- [x] `pluto.ts:293` | `altRate > 0.2 → +10` | 20%+ alteration rate → active renovation
- [x] `pluto.ts:294` | `altRate > 0.1 → +5` | 10-20% alteration rate → moderate renovation

---

## 28. Pedestrian Counts (`nyc-pedestrian.ts`)

- [x] `nyc-pedestrian.ts:55` | `500m` | pedestrian query default radius
- [x] `nyc-pedestrian.ts:73` | `$limit=2000` | Socrata fetch limit for pedestrian records
- [x] `nyc-pedestrian.ts:201` | `15 + (avgPerLocation / 200) * 20` | base score formula
- [x] `nyc-pedestrian.ts:204` | `locationCount >= 3 → +5` | multi-point count bonus
- [x] `nyc-pedestrian.ts:205` | `locationCount >= 2 → +3` | dual-point count bonus

---

## 29. LPC Landmarks (`nyc-lpc.ts`)

- [x] `nyc-lpc.ts:151` | `distance < 100m` | landmark is "on the block" (high proximity weight)
- [x] `nyc-lpc.ts:156` | `distance < 10m` | landmark is "immediate" (direct adjacency)
- [x] `nyc-lpc.ts:165` | `distance < 50m` | landmark is "very close"

---

## 30. Walk Score Labels (`walkscore.ts`)

Purely presentational — not used in scoring math.

- [x] `walkscore.ts:191` | `>= 90 → "Walker's Paradise"` | Walk Score label
- [x] `walkscore.ts:192` | `>= 70 → "Very Walkable"` | Walk Score label
- [x] `walkscore.ts:193` | `>= 50 → "Somewhat Walkable"` | Walk Score label
- [x] `walkscore.ts:194` | `>= 25 → "Car-Dependent"` | Walk Score label
- [x] `walkscore.ts:199` | `>= 90 → "Rider's Paradise"` | Transit Score label
- [x] `walkscore.ts:200` | `>= 70 → "Excellent Transit"` | Transit Score label
- [x] `walkscore.ts:201` | `>= 50 → "Good Transit"` | Transit Score label
- [x] `walkscore.ts:202` | `>= 25 → "Some Transit"` | Transit Score label
- [x] `walkscore.ts:207` | `>= 90 → "Biker's Paradise"` | Bike Score label
- [x] `walkscore.ts:208` | `>= 70 → "Very Bikeable"` | Bike Score label
- [x] `walkscore.ts:209` | `>= 50 → "Bikeable"` | Bike Score label

---

## Open Questions / Flags for Recalibration

> Change `[ ]` to `[!]` when a threshold needs recalibration, with a note.

- [ ] `location-iq.ts:400` | Walk Score < 50 penalty value — no explicit branch found; confirm `< 50` case is handled
- [ ] `mta-ridership.ts:201` | `peakHourRatio: 0.40` — is this grounded in MTA data or assumed?
- [ ] `momentum.ts:067` | `changePct > 10 → 'up'` — is 10% the right slope threshold? lower may catch earlier signals
- [ ] `six-index.ts:981-982` | `0.37 / 0.63` neighborhoodHealth / survivalRate split — source of calibration?
- [ ] `nyc-pedestrian.ts:201` | `avgPerLocation / 200 * 20` formula — is 200 pedestrians = 1 score point the right sensitivity?

---

_Brain 2 | BL-B3 | April 12, 2026_
