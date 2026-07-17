-- CreateTable
CREATE TABLE "PatientConnection" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "relatedPatientId" INTEGER,
    "relatedName" TEXT,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodPressure" TEXT,
    "pulse" TEXT,
    "weightKg" TEXT,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "conditions" TEXT,
    "note" TEXT,
    "recordedById" INTEGER,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientConnection_patientId_idx" ON "PatientConnection"("patientId");

-- CreateIndex
CREATE INDEX "HealthRecord_patientId_idx" ON "HealthRecord"("patientId");

-- AddForeignKey
ALTER TABLE "PatientConnection" ADD CONSTRAINT "PatientConnection_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConnection" ADD CONSTRAINT "PatientConnection_relatedPatientId_fkey" FOREIGN KEY ("relatedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
