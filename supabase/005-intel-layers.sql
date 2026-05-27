-- ============================================================
-- 005: Intel Processing Layers
-- ============================================================
-- Stores the output of each processing layer so every
-- extrapolation and AI insight is auditable back to raw data.
--
-- Layer 1: Raw API responses     → intel_cache (already exists)
-- Layer 2: Reconciled entities   → enriched_entities
-- Layer 3: Extrapolations        → intel_extrapolations
-- Layer 4: AI narratives         → ai_insights (already exists from 003)
--
-- Each row links back to the layer(s) it was derived from via
-- derivation_chain JSONB, which records exactly which source
-- data points fed into the result.
-- ============================================================

-- ─────────────────────────────────────────────────
-- Layer 2: Enriched Entities
-- ─────────────────────────────────────────────────
-- Cross-source reconciled view of what's actually at a location.
-- Deduplicates POIs across Google/Foursquare/Yelp/Overpass,
-- resolves conflicting classifications, assigns confidence.

CREATE TABLE IF NOT EXISTS enriched_entities (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_key    TEXT NOT NULL,           -- "40.7891,-73.9748" (lat,lng to 4dp)
    business_type   TEXT NOT NULL,           -- user's concept type

    -- Reconciled entity data
    entity_type     TEXT NOT NULL,           -- 'poi', 'transit_node', 'demand_generator', 'risk_signal', 'demographic_profile'
    entity_category TEXT NOT NULL,           -- 'cafe', 'gym', 'subway_station', 'office_building', 'crime_cluster', etc.
    entity_name     TEXT,                    -- "Equinox Upper West Side" (null for aggregates)
    entity_data     JSONB NOT NULL,          -- full reconciled entity payload

    -- Multi-source validation
    source_count    INTEGER NOT NULL DEFAULT 1,  -- how many sources confirmed this entity
    sources         TEXT[] NOT NULL,              -- ['google-places', 'foursquare', 'yelp']
    confidence      REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),  -- 0.0-1.0

    -- Conflict resolution log
    conflicts       JSONB,                   -- e.g. {"classification": {"google": "health", "foursquare": "gym", "resolved": "gym", "reason": "majority vote + brand lookup"}}

    -- Lineage
    derivation_chain JSONB NOT NULL,         -- which intel_cache keys fed into this entity
    processing_version TEXT NOT NULL DEFAULT 'v1.0',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enriched_entities_location ON enriched_entities (location_key);
CREATE INDEX IF NOT EXISTS idx_enriched_entities_type ON enriched_entities (entity_type, entity_category);
CREATE INDEX IF NOT EXISTS idx_enriched_entities_name ON enriched_entities (entity_name) WHERE entity_name IS NOT NULL;

ALTER TABLE enriched_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enriched_entities_public_read" ON enriched_entities FOR SELECT USING (true);

-- ─────────────────────────────────────────────────
-- Layer 3: Extrapolations
-- ─────────────────────────────────────────────────
-- Business-specific inferences that no single API provides.
-- Each extrapolation is tagged with its method, confidence,
-- and the exact data points that produced it.

CREATE TABLE IF NOT EXISTS intel_extrapolations (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_key    TEXT NOT NULL,
    business_type   TEXT NOT NULL,

    -- What was extrapolated
    extrapolation_type TEXT NOT NULL,        -- see EXTRAPOLATION_TYPES below
    category        TEXT NOT NULL,           -- grouping: 'force_multiplier', 'time_viability', 'demand_signal', 'competitive_position', 'risk_assessment'

    -- The extrapolation itself
    title           TEXT NOT NULL,           -- "Equinox gym is a force multiplier for morning coffee"
    value           REAL,                    -- numeric score/estimate if applicable
    unit            TEXT,                    -- 'people/hr', 'score', 'pct', 'count'
    interpretation  TEXT NOT NULL,           -- plain-English explanation
    sentiment       TEXT NOT NULL CHECK (sentiment IN ('great', 'good', 'neutral', 'caution', 'warning')),

    -- Confidence & transparency
    confidence      REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    confidence_label TEXT NOT NULL CHECK (confidence_label IN ('verified', 'high', 'moderate', 'estimated', 'speculative')),

    -- How it was derived (THE MOST IMPORTANT PART)
    method          TEXT NOT NULL,           -- 'cross_reference', 'statistical_model', 'rule_based', 'time_series', 'ai_inference'
    derivation_chain JSONB NOT NULL,         -- exactly which data points fed in
    -- Example derivation_chain:
    -- {
    --   "inputs": [
    --     {"source": "google-places", "field": "gym.name", "value": "Equinox", "cache_key": "market-density:40.7891,-73.9748"},
    --     {"source": "mta-ridership", "field": "daily_riders", "value": 12400, "cache_key": "mta-ridership:40.7891,-73.9748"},
    --     {"source": "census", "field": "median_income", "value": 124000, "cache_key": "census:40.7891,-73.9748"}
    --   ],
    --   "logic": "Equinox membership ($200+/mo) confirms high-income demographic. MTA station 150m away with 12.4K daily riders provides steady flow. Cross-reference: 15% of gym members buy coffee post-workout (industry benchmark).",
    --   "assumptions": ["15% post-workout coffee purchase rate", "60% of Equinox traffic is morning"],
    --   "model_version": "force_multiplier_v1.0"
    -- }

    processing_version TEXT NOT NULL DEFAULT 'v1.0',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extrapolations_location ON intel_extrapolations (location_key, business_type);
CREATE INDEX IF NOT EXISTS idx_extrapolations_type ON intel_extrapolations (extrapolation_type);
CREATE INDEX IF NOT EXISTS idx_extrapolations_category ON intel_extrapolations (category);
CREATE INDEX IF NOT EXISTS idx_extrapolations_confidence ON intel_extrapolations (confidence DESC);

ALTER TABLE intel_extrapolations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extrapolations_public_read" ON intel_extrapolations FOR SELECT USING (true);

-- ─────────────────────────────────────────────────
-- Layer 4: AI Narratives (extends existing ai_insights)
-- ─────────────────────────────────────────────────
-- Add columns to ai_insights for derivation tracking.
-- ai_insights was created in migration 003.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'derivation_chain') THEN
        ALTER TABLE ai_insights ADD COLUMN derivation_chain JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'extrapolation_ids') THEN
        ALTER TABLE ai_insights ADD COLUMN extrapolation_ids BIGINT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'entity_ids') THEN
        ALTER TABLE ai_insights ADD COLUMN entity_ids BIGINT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'disclosure') THEN
        ALTER TABLE ai_insights ADD COLUMN disclosure TEXT;
    END IF;
END $$;

-- ─────────────────────────────────────────────────
-- Processing Runs (audit trail for each pipeline execution)
-- ─────────────────────────────────────────────────
-- Every time the pipeline processes a location, a run is logged.

CREATE TABLE IF NOT EXISTS intel_processing_runs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_key    TEXT NOT NULL,
    business_type   TEXT NOT NULL,
    user_id         TEXT,

    -- Pipeline execution metadata
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,

    -- Layer results summary
    layer1_sources  INTEGER,            -- how many raw sources returned data
    layer1_total    INTEGER DEFAULT 20,
    layer2_entities INTEGER,            -- how many reconciled entities produced
    layer2_conflicts INTEGER,           -- how many cross-source conflicts resolved
    layer3_extrapolations INTEGER,      -- how many extrapolations generated
    layer4_insights INTEGER,            -- how many AI narratives generated

    -- Data quality
    overall_confidence REAL,            -- weighted average confidence across all layers
    data_gaps       TEXT[],             -- which sources were missing
    assumptions_used TEXT[],            -- which assumptions were applied

    -- Version tracking
    pipeline_version TEXT NOT NULL DEFAULT 'v1.0',

    -- Error tracking
    errors          JSONB,
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_processing_runs_location ON intel_processing_runs (location_key, business_type);
CREATE INDEX IF NOT EXISTS idx_processing_runs_status ON intel_processing_runs (status, started_at DESC);

ALTER TABLE intel_processing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "processing_runs_public_read" ON intel_processing_runs FOR SELECT USING (true);

-- ─────────────────────────────────────────────────
-- Force Multiplier Matrix (reference data)
-- ─────────────────────────────────────────────────
-- Defines how nearby business categories relate to each
-- concept type. Tunable without code changes.

CREATE TABLE IF NOT EXISTS force_multiplier_matrix (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    concept_type    TEXT NOT NULL,           -- 'cafe', 'restaurant', 'gym', 'bar', 'retail'
    nearby_category TEXT NOT NULL,           -- 'gym', 'office', 'subway', 'school', etc.

    -- Relationship
    relationship    TEXT NOT NULL CHECK (relationship IN ('force_multiplier', 'competitor', 'neutral', 'negative')),
    multiplier_score REAL NOT NULL DEFAULT 0, -- -1.0 (strong negative) to +1.0 (strong positive)

    -- Context
    reasoning       TEXT NOT NULL,           -- "Gym members buy post-workout coffee"
    time_of_day     TEXT,                    -- 'morning', 'afternoon', 'evening', 'all_day' (null = all)
    conditions      JSONB,                   -- {"min_income": 80000, "min_distance_m": 50, "max_distance_m": 500}

    -- Metadata
    source          TEXT DEFAULT 'expert',   -- 'expert', 'data_derived', 'user_feedback'
    version         TEXT NOT NULL DEFAULT 'v1.0',
    updated_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_multiplier UNIQUE (concept_type, nearby_category, time_of_day)
);

ALTER TABLE force_multiplier_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "multiplier_matrix_public_read" ON force_multiplier_matrix FOR SELECT USING (true);

-- ─────────────────────────────────────────────────
-- Seed the force multiplier matrix with initial data
-- ─────────────────────────────────────────────────

INSERT INTO force_multiplier_matrix (concept_type, nearby_category, relationship, multiplier_score, reasoning, time_of_day) VALUES
-- CAFE force multipliers
('cafe', 'gym',             'force_multiplier', 0.8, 'Post-workout smoothies, protein bowls, coffee. Equinox/boutique gym crowds are high-spend.', 'morning'),
('cafe', 'gym',             'force_multiplier', 0.5, 'Afternoon gym crowd smaller but still buys beverages.', 'afternoon'),
('cafe', 'office',          'force_multiplier', 0.9, 'Office workers are the #1 weekday coffee customer. 500-person office = ~75 daily coffees.', 'morning'),
('cafe', 'office',          'force_multiplier', 0.6, 'Afternoon coffee run, smaller but reliable.', 'afternoon'),
('cafe', 'coworking',       'force_multiplier', 0.85, 'Freelancers and remote workers need coffee shops as second offices.', 'all_day'),
('cafe', 'subway_station',  'force_multiplier', 0.7, 'Commuter grab-and-go traffic. Strongest at morning rush.', 'morning'),
('cafe', 'subway_station',  'force_multiplier', 0.3, 'Evening commuters less likely to buy coffee.', 'evening'),
('cafe', 'school',          'force_multiplier', 0.5, 'Parent drop-off traffic, after-school snacks.', 'morning'),
('cafe', 'park',            'force_multiplier', 0.6, 'Dog walkers, joggers, weekend strollers want coffee.', 'morning'),
('cafe', 'hotel',           'force_multiplier', 0.5, 'Tourists and business travelers seek local coffee.', 'morning'),
('cafe', 'cafe',            'competitor',      -0.3, 'Direct competition, but coffee cluster effect can increase overall foot traffic.', NULL),
('cafe', 'restaurant',      'neutral',          0.1, 'Minimal overlap — different daypart.', NULL),
('cafe', 'bar',             'neutral',          0.0, 'No overlap — opposite dayparts.', NULL),

-- RESTAURANT force multipliers
('restaurant', 'office',          'force_multiplier', 0.85, 'Lunch traffic from offices is the backbone of weekday revenue.', 'afternoon'),
('restaurant', 'hotel',           'force_multiplier', 0.7, 'Hotel guests seek nearby dining, especially dinner.', 'evening'),
('restaurant', 'theater',         'force_multiplier', 0.8, 'Pre-theater and post-theater dining is a major revenue driver.', 'evening'),
('restaurant', 'subway_station',  'force_multiplier', 0.5, 'Transit access increases catchment area for destination dining.', NULL),
('restaurant', 'bar',             'force_multiplier', 0.4, 'Bar-hopping crowd spills into restaurants for food.', 'evening'),
('restaurant', 'restaurant',      'competitor',      -0.2, 'Competition, but restaurant rows create destination dining clusters.', NULL),
('restaurant', 'gym',             'neutral',          0.2, 'Health-conscious diners from nearby gyms.', NULL),

-- BAR force multipliers
('bar', 'restaurant',       'force_multiplier', 0.7, 'Post-dinner drinks. Restaurant row = bar opportunity.', 'evening'),
('bar', 'office',           'force_multiplier', 0.6, 'After-work happy hour crowd.', 'evening'),
('bar', 'subway_station',   'force_multiplier', 0.5, 'Late-night transit access is critical for bars.', 'evening'),
('bar', 'hotel',            'force_multiplier', 0.6, 'Hotel guests seek nightlife.', 'evening'),
('bar', 'bar',              'competitor',      -0.2, 'Competition, but bar districts create destination nightlife.', NULL),
('bar', 'school',           'negative',        -0.5, 'Schools nearby can block liquor license approval.', NULL),

-- GYM / FITNESS force multipliers
('gym', 'office',           'force_multiplier', 0.7, 'Before/after work gym sessions.', NULL),
('gym', 'subway_station',   'force_multiplier', 0.6, 'Transit access expands membership catchment.', NULL),
('gym', 'cafe',             'force_multiplier', 0.3, 'Post-workout coffee/smoothie nearby is a perk.', NULL),
('gym', 'gym',              'competitor',      -0.6, 'Direct competition — fitness is more zero-sum than food.', NULL),
('gym', 'park',             'force_multiplier', 0.4, 'Outdoor fitness complement. Park runners convert to gym members in winter.', NULL)

ON CONFLICT (concept_type, nearby_category, time_of_day) DO NOTHING;
