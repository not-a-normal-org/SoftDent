-- Every address already typed on a patient joins the clinic's address list, the same
-- rule savePatient applies to new ones from now on. Data only: no schema change.
-- Case and surrounding space are ignored when matching, so "kuriana" is not added
-- beside an existing "Kuriana"; of several spellings that differ only in case, the
-- first alphabetically is kept. Safe to re-run: existing values are skipped.
INSERT INTO "AddressPreset" (value)
SELECT DISTINCT ON (lower(trim(p.address))) trim(p.address)
FROM "Patient" p
WHERE p.address IS NOT NULL
  AND trim(p.address) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "AddressPreset" ap WHERE lower(trim(ap.value)) = lower(trim(p.address))
  )
ORDER BY lower(trim(p.address)), trim(p.address)
ON CONFLICT (value) DO NOTHING;
