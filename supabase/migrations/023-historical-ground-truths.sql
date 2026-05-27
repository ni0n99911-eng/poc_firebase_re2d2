-- Migration 023: Historical Ground Truths (Power Broker Dataset)
-- BRAIN-PB-01: Supabase table for 15 Power Broker reference entries
-- Source: RE2_Power_Broker_Architecture_Spec.md + power_broker_reference_dataset.json
-- Run: copy-paste into Supabase SQL editor

CREATE TABLE IF NOT EXISTS historical_ground_truths (
  id              TEXT PRIMARY KEY,
  neighborhood    TEXT NOT NULL,
  geohash_prefix  TEXT[] NOT NULL,       -- 5-char geohash prefixes for spatial lookup
  infrastructure  TEXT NOT NULL,          -- The infrastructure event name
  year_range      INT4RANGE,              -- e.g. '[1948,1963]'::int4range
  impact_type     TEXT NOT NULL,          -- e.g. 'destroyed_commercial_corridor'
  description     TEXT,
  current_relevance TEXT,
  scoring_notes   JSONB,                  -- Sub-score implications by index
  source          TEXT DEFAULT 'power_broker',
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial GIN index on geohash array for fast prefix lookup
CREATE INDEX IF NOT EXISTS idx_hgt_geohash
  ON historical_ground_truths USING GIN (geohash_prefix);

CREATE INDEX IF NOT EXISTS idx_hgt_impact_type
  ON historical_ground_truths (impact_type);

CREATE INDEX IF NOT EXISTS idx_hgt_active
  ON historical_ground_truths (active)
  WHERE active = true;

-- RLS: read-only for all authenticated users
ALTER TABLE historical_ground_truths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historical_ground_truths_read"
  ON historical_ground_truths
  FOR SELECT
  USING (true);

-- Seed: 15 Power Broker reference entries
-- PB-001: East Tremont — Cross-Bronx Expressway
INSERT INTO historical_ground_truths VALUES (
  'PB-001', 'East Tremont', ARRAY['dr72g','dr72e','dr72f'], 'Cross-Bronx Expressway',
  '[1948,1963]'::int4range, 'destroyed_commercial_corridor',
  'Robert Moses routed the Cross-Bronx Expressway through East Tremont in 1948, displacing 60,000 residents and destroying the commercial corridor along 174th-177th Streets. The expressway severed neighborhood connectivity permanently.',
  'Vibrancy scores below 40 reflect structural severance, not temporary decline. Subway access survived Moses but street-level commerce did not recover.',
  '{"vibrancy_weight": 0.6, "transit_weight": 1.1, "momentum_weight": 0.8, "flags": ["FOOT_TRAFFIC_GATE expected for impulse concepts", "TRANSIT_DESERT unlikely — IRT survived"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-002', 'Morningside Heights', ARRAY['dr5rv','dr5rw'], 'Columbia University Campus Expansion',
  '[1968,1985]'::int4range, 'institutional_anchor',
  'Columbia University''s westward expansion and gym controversy (1968) displaced community uses and reduced commercial density in favor of institutional uses. The neighborhood shifted from mixed commercial to university-serving retail.',
  'Demographics skew young (students) with low discretionary spend. Retail survives on captive audience not organic foot traffic.',
  '{"demographics_note": "student population inflates density metrics, deflates income", "vibrancy_note": "academic calendar creates seasonal dead zones", "flags": ["HIGH_STUDENT_SHARE may distort income scoring"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-003', 'Hell''s Kitchen / Clinton', ARRAY['dr5rs','dr5rr'], 'Port Authority Bus Terminal Redevelopment',
  '[1950,1980]'::int4range, 'transit_hub_effect',
  'Hell''s Kitchen transitioned from working-class industrial to transit hub periphery after PA Bus Terminal expansion. High pedestrian count but transient traffic — bus passengers, not neighborhood residents.',
  'Foot traffic numbers are misleading — bus terminal generates 200K+ daily but most are in-transit. Retail serving locals vs. commuters requires different concept fit.',
  '{"vibrancy_note": "high pedestrian counts are transit-transient, not neighborhood", "concept_fit": "food/grab-and-go performs better than destination retail", "flags": ["TRANSIT_HUB_TRANSIENT: verify pedestrian quality vs quantity"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-004', 'Red Hook', ARRAY['dr5qb','dr5q8'], 'Brooklyn-Queens Expressway Isolation',
  '[1954,1965]'::int4range, 'isolated_neighborhood',
  'The BQE effectively cut Red Hook off from the rest of Brooklyn. Industrial waterfront character persisted longer than surrounding neighborhoods. IKEA (2008) introduced destination retail but not daily commerce.',
  'Transit score is structurally low (no subway access). High vibrancy from destination businesses (Fairway, IKEA, art galleries) masks absence of daily foot traffic generators.',
  '{"transit_weight": 1.4, "vibrancy_note": "destination vibrancy ≠ daily foot traffic", "accessibility_floor": 20, "flags": ["TRANSIT_DESERT for specialty_coffee/juice/bakery — no subway within 1km"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-005', 'East New York', ARRAY['dr5qp','dr5qq'], 'Urban Renewal Displacement 1960s',
  '[1960,1980]'::int4range, 'destroyed_organic_commercial_fabric',
  'Federal urban renewal programs cleared 15+ blocks of mixed commercial/residential in East New York. Replacement public housing eliminated the street-level commerce that had sustained the neighborhood economy.',
  'Demographics show lower income quartile. Scoring should weight neighborhood loyalty over foot traffic. Value concepts (QSR, personal services) outperform premium concepts here.',
  '{"income_note": "incomeMin screening critical — eliminate premium concepts early", "concept_fit": "QSR and personal_services > specialty_coffee and wellness_beverage", "flags": ["INCOME_CLIFF likely for high-incomeMin concepts"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-006', 'Long Island City (pre-2010)', ARRAY['dr5r0','dr5r1'], 'Industrial to Mixed-Use Rezoning',
  '[1990,2010]'::int4range, 'commercial_district_emergence',
  'LIC''s 2001 rezoning began the industrial-to-residential conversion. By 2015, residential units doubled but retail lagged 3-5 years behind. Amazon HQ2 announcement (2018) and cancellation created boom-bust confidence cycle.',
  'Momentum sub-score may be high due to new construction, but vibrancy is trailing. Retail concepts need to bet on the lagging indicator resolving.',
  '{"momentum_weight": 1.1, "vibrancy_note": "retail lags residential by 3-5 years in newly rezoned areas", "flags": ["RETAIL_LAG: new residential without established street retail"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-007', 'SoHo', ARRAY['dr5r5','dr5r4'], 'Artist Loft to Luxury Retail Conversion',
  '[1970,1990]'::int4range, 'commercial_district_maturation',
  'SoHo transformed from industrial wasteland to artist haven (1970s) to luxury retail destination (1990s). Cast-iron district designation created LPC restrictions. High rents displaced the independent retail that made it desirable.',
  'Current vacancy rate 5.2%. High chain penetration. LPC restrictions on signage affect impulse-purchase archetypes significantly.',
  '{"landmark_flag": "LANDMARK_DISTRICT: SoHo-Cast Iron. LPC signage restrictions apply.", "impulse_penalty": -3, "chain_saturation": "high", "flags": ["LANDMARK_DISTRICT active", "MARKET_SATURATION_FOOD_DRINK likely"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-008', 'Flushing', ARRAY['dr5x6','dr5x7'], 'Asian Commercial Corridor Self-Sustaining Economy',
  '[1980,2000]'::int4range, 'ethnic_commercial_corridor',
  'Flushing became the second-largest Chinatown in the US through community self-investment, not city planning. Korean and Chinese commercial anchors created a self-sustaining economy independent of mainstream retail trends.',
  'High F&D density (25%+) is structural, not over-saturation — it reflects the ethnic commercial model. Concepts that serve the community do well; luxury/premium concepts that ignore it fail.',
  '{"fd_saturation_note": "25%+ F&D is structural for ethnic corridor, not over-saturation", "demographic_weight": 1.2, "flags": ["MARKET_SATURATION_FOOD_DRINK flag expected but not meaningful here"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-009', 'Williamsburg', ARRAY['dr5qd','dr5qf'], 'Gentrification Wave 2003-2015',
  '[2003,2015]'::int4range, 'rapid_gentrification',
  'L-train proximity and 2003 North Side rezoning triggered the fastest gentrification in NYC history. Independent retail and F&D density grew 40% 2005-2012. By 2016, rents plateaued and concept mix stabilized at premium-casual.',
  'Now mature. Vacancy rate 3.6% (tied lowest). Competition is intense. New entrants face landlord leverage and premium rents. Differentiation is critical.',
  '{"vacancy_rate": 0.036, "rent_pressure": "high", "competition_note": "mature market, high differentiation required", "flags": ["TIGHT_MARKET: 3.6% vacancy"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-010', 'Jamaica, Queens', ARRAY['dr5xf','dr5xg'], 'AirTrain Hub Effect',
  '[2003,2010]'::int4range, 'transit_hub_effect',
  'AirTrain connection to JFK (2003) transformed Jamaica into a major transit interchange. High foot traffic from commuters and airport travelers but demographic split between transit users and local residents.',
  'Similar to Hell''s Kitchen transit-transient pattern. Food/grab-and-go performs. Medical offices benefit from transit accessibility.',
  '{"transit_note": "airport + commuter transit inflates accessibility but creates transient foot traffic", "concept_fit": "QSR, fast_casual, medical_office perform well", "flags": ["TRANSIT_HUB_TRANSIENT"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-011', 'Long Island City (post-2015)', ARRAY['dr5r0','dr5r2'], 'Rapid Residential Buildout',
  '[2015,2024]'::int4range, 'residential_overbuild',
  'Post-2015 LIC saw 20,000+ new residential units added in 8 years. Retail infrastructure lagged significantly. High momentum scores from construction activity but vibrancy sub-scores reflect absent street retail.',
  'Momentum > 70 expected from construction pipeline. Vibrancy < 60 expected as retail infrastructure is still catching up to residential density.',
  '{"momentum_floor": 70, "vibrancy_ceiling": 60, "vibrancy_note": "retail lags residential by 3-5 years", "flags": ["RETAIL_LAG: rapid residential buildout without retail infrastructure"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-012', 'Harlem (125th Street)', ARRAY['dr5rv','dr5ru'], 'Commercial Corridor Revival',
  '[1990,2010]'::int4range, 'commercial_district_revival',
  'Apollo Theater anchor + BRT investment + WeWork/retail chains created 125th St revival after 30 years of disinvestment post-1970s. Now has national retailers and restaurants that previously avoided Harlem.',
  'Above 96th St — no CRT. Rent pressure moderate. Demographics shifted significantly toward middle income. Coffee shops and wellness concepts viable now.',
  '{"crt_note": "above 96th St — no CRT applies", "rent_pressure": "moderate", "income_shift": "median HHI rose 40% 2000-2020", "flags": ["CRT_ZONE does NOT apply (above 96th)"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-013', 'Meatpacking District', ARRAY['dr5r3','dr5r2'], 'Industrial to Luxury Conversion',
  '[1995,2010]'::int4range, 'commercial_district_maturation',
  'Meatpacking District transitioned from active meatpacking to nightlife destination (1990s) to luxury retail/hotel hub (2000s). High Line (2009) cemented the transformation. Now among highest rents in Manhattan.',
  'Extreme rent pressure. High foot traffic but landlord leverage maximum. Concepts need strong margin profile to survive occupancy costs.',
  '{"rent_pressure": "extreme", "landmark_note": "partial LPC coverage at northern edge", "flags": ["OCCUPANCY_COST_WARNING likely", "CRT_ZONE applies"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-014', 'Staten Island (Bay Ridge Ave Area)', ARRAY['dr5p8','dr5p9'], 'Suburban Commercial Strip',
  '[1970,2000]'::int4range, 'suburban_pattern',
  'Staten Island retail follows auto-dependent suburban pattern distinct from other boroughs. Walkability low, transit limited. Commercial viability depends on car access and parking.',
  'Walk score metrics from other boroughs are not predictive here. Transit dependency low for all concepts. Parking availability is a key differentiator not captured in current scoring.',
  '{"transit_note": "transit dependency overweighted for SI — auto-dependent market", "walkability_note": "low walkscore is structural, not a negative signal on SI", "flags": ["SI_SUBURBAN_PATTERN: auto-dependent market, transit metrics less predictive"]}'::jsonb,
  'power_broker', true, NOW()
),
(
  'PB-015', 'Citywide', ARRAY['dr5','dr7','dr4'], 'Pre-1940 Subway Proximity Pattern',
  '[1904,1940]'::int4range, 'systemic_pattern',
  'NYC''s pre-1940 subway network created the walkable commercial density that defines viable retail corridors today. Block groups within 400m of pre-1940 stations have 40% higher commercial viability than equivalent blocks without transit access.',
  'Transit score is the single strongest predictor of walkable commercial viability. Pre-1940 station proximity is especially predictive — these stations created dense pedestrian catchment areas that persist 80 years later.',
  '{"transit_confidence": 1.3, "pre1940_premium": "strongest single predictor of walkable commercial viability", "flags": ["Citywide: subway proximity (especially pre-1940) is primary foot traffic predictor"]}'::jsonb,
  'power_broker', true, NOW()
);

-- Verify
-- SELECT count(*) FROM historical_ground_truths WHERE active = true;
-- Expected: 15
