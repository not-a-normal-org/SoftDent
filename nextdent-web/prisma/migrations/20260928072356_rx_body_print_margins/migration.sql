-- DropIndex
DROP INDEX "Drug_usageCount_idx";

-- AlterTable
ALTER TABLE "ClinicSetting" ADD COLUMN     "rxBodyBottomMm" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "rxBodyTopMm" INTEGER NOT NULL DEFAULT 45;
