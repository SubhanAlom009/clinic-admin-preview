-- Migration: ensure patient medical-history columns exist
-- Date: 2025-09-11
-- This migration is idempotent and safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS patients
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS chronic_conditions text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS medications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS previous_surgeries text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS family_history text DEFAULT '',
  ADD COLUMN IF NOT EXISTS additional_notes text DEFAULT '';

COMMIT;

-- Notes:
-- 1) This only alters the schema; to populate values from an existing
--    medical_history JSONB column, run the data-migration script
--    `20250909_migrate_medical_history_to_columns.sql` (already present in repo).
-- 2) Run this on a development/staging environment first and back up your DB.
