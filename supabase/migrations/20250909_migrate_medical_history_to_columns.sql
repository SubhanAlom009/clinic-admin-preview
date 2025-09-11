-- Data migration: try to populate new patient columns from medical_history JSON (if keys exist)
-- Review and run in a non-production environment first.

BEGIN;

-- medications -> text[]
UPDATE patients
SET medications = (
  SELECT COALESCE(ARRAY_AGG(elem), ARRAY[]::text[]) FROM (
    SELECT jsonb_array_elements_text(medical_history -> 'medications') AS elem
  ) AS t
)
WHERE medical_history ? 'medications';

-- previous_surgeries -> text[]
UPDATE patients
SET previous_surgeries = (
  SELECT COALESCE(ARRAY_AGG(elem), ARRAY[]::text[]) FROM (
    SELECT jsonb_array_elements_text(medical_history -> 'previous_surgeries') AS elem
  ) AS t
)
WHERE medical_history ? 'previous_surgeries';

-- family_history -> text
UPDATE patients
SET family_history = (medical_history ->> 'family_history')
WHERE medical_history ? 'family_history' AND (medical_history ->> 'family_history') IS NOT NULL;

-- additional_notes -> text
UPDATE patients
SET additional_notes = (medical_history ->> 'additional_notes')
WHERE medical_history ? 'additional_notes' AND (medical_history ->> 'additional_notes') IS NOT NULL;

COMMIT;
