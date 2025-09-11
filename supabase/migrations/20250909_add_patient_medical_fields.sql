-- Migration: add missing patient medical-history columns
-- Date: 2025-09-09

BEGIN;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS medications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS previous_surgeries text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS family_history text DEFAULT '',
  ADD COLUMN IF NOT EXISTS additional_notes text DEFAULT '';

COMMIT;
