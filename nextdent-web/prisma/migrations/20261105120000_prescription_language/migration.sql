-- Prescriptions can be printed with Bangla or English labels; chosen per prescription.
ALTER TABLE "Prescription" ADD COLUMN "language" TEXT;
