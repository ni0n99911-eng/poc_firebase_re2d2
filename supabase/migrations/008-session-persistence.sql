-- ═══════════════════════════════════════════════════════
-- RE² Migration 008: Session Persistence Fixes
-- ═══════════════════════════════════════════════════════
-- Fixes column name mismatch (data → full_data) and adds
-- proper indexes for the L2 persistence layer.
--
-- The original 004 migration created a `data` column, but the
-- application code references `full_data`. This migration adds
-- the column with the correct name and migrates existing data.

-- Add full_data column if it doesn't exist (may already exist from manual fix)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'full_data'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN full_data jsonb DEFAULT '{}';
    END IF;
END $$;

-- Migrate any existing data from `data` column to `full_data`
UPDATE founder_sessions
SET full_data = data
WHERE full_data IS NULL OR full_data = '{}'::jsonb;

-- Add columns that may be missing from the original schema
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'persona_type'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN persona_type text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'concept_description'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN concept_description text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'priority_ranking'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN priority_ranking jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'address'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN address text;
    END IF;
END $$;

-- Make user_id have a unique constraint (needed for upsert on user_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'founder_sessions_user_id_unique'
    ) THEN
        -- Only add if there are no duplicates
        ALTER TABLE founder_sessions ADD CONSTRAINT founder_sessions_user_id_unique UNIQUE (user_id);
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        -- Duplicates exist — skip constraint (will need manual cleanup)
        RAISE NOTICE 'Duplicate user_ids found, skipping unique constraint. Clean up duplicates manually.';
END $$;

-- Index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_founder_sessions_user_id ON founder_sessions(user_id);
