-- levenshtein() ranks near-miss drug names in the fuzzy fallback of searchDrugs()
-- (src/lib/prescriptions.ts). pg_trgm narrows the candidates; edit distance orders them.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
