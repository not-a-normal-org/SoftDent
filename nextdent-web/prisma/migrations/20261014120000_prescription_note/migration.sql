-- Barishal's legacy prescriptions carry a free-text Note column that the Dhaka
-- database (which this schema was derived from) did not have.
ALTER TABLE "Prescription" ADD COLUMN "note" TEXT;
