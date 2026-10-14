-- Popularity weight for the Rx type-ahead: a drug the clinic prescribes often
-- should outrank an alphabetically-similar one the doctor has never used.
ALTER TABLE "Drug" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Drug" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- Seed from prescriptions already written, so the ranking is useful on day one.
-- Rx lines store free text ("Tab. Flamex 400 mg"), not a Drug id, so match brand +
-- strength inside that text. Brands under 3 chars are too ambiguous to match safely.
WITH matched AS (
  SELECT pd.id AS line_id, dr.id AS drug_id,
         length(dr."brandName") AS brand_len,
         -- "Tab. Flamex 400 mg" names its form, so prefer the row whose form it is
         (dr."dosageForm" IS NOT NULL AND pd.drug ILIKE '%' || dr."dosageForm" || '%') AS form_hit
  FROM "PrescriptionDrug" pd
  JOIN "Drug" dr
    ON pd.drug ILIKE '%' || dr."brandName" || '%'
   AND (dr."strength" IS NULL OR pd.drug ILIKE '%' || dr."strength" || '%')
  WHERE pd.drug IS NOT NULL
    AND length(COALESCE(dr."brandName", '')) >= 3
),
-- keep only the longest brand that fits each line, so "Tab. Flamex 400 mg" credits
-- Flamex rather than also Flam, and "Cefotil" is not read as "Til"
best AS (
  SELECT line_id, max(brand_len) AS brand_len, bool_or(form_hit) AS form_hit
  FROM matched GROUP BY line_id
),
seed AS (
  SELECT m.drug_id, count(*)::int AS n
  FROM matched m
  JOIN best b
    ON b.line_id = m.line_id
   AND m.brand_len = b.brand_len
   AND m.form_hit = b.form_hit
  GROUP BY m.drug_id
)
UPDATE "Drug" d SET "usageCount" = seed.n FROM seed WHERE d.id = seed.drug_id;

-- ordering column for the type-ahead
CREATE INDEX "Drug_usageCount_idx" ON "Drug" ("usageCount" DESC);
