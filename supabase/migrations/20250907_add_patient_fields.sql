-- Add missing patient fields used by AddPatientModal
-- Date: 2025-09-07
-- Adds medications, previous_surgeries, family_history and additional_notes to patients

ALTER TABLE IF EXISTS patients
  ADD COLUMN IF NOT EXISTS medications text[],
  ADD COLUMN IF NOT EXISTS previous_surgeries text[],
  ADD COLUMN IF NOT EXISTS family_history text,
  ADD COLUMN IF NOT EXISTS additional_notes text;

-- Note: existing application stores some structured data in the medical_history JSONB column.
-- This migration only adds explicit columns. If you want to migrate existing values from
-- medical_history into these columns, run an additional update script tailored to your
-- existing data shape.
