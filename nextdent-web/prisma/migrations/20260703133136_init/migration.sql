-- Required for the trigram (type-ahead) search indexes created later in this migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "HistoryKind" AS ENUM ('MEDICAL', 'DRUG', 'ALLERGY');

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickName" TEXT,
    "primaryPhone" TEXT,
    "secondaryPhone" TEXT,
    "address" TEXT,
    "email" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "nid" TEXT,
    "note" TEXT,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'RECEPTIONIST',
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "needsPasswordReset" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "degree" TEXT,
    "designation1" TEXT,
    "designation2" TEXT,
    "clinicName" TEXT,
    "institute" TEXT,
    "session" TEXT,
    "regNo" TEXT,
    "activeStatus" TEXT,
    "labBillReductionMethod" TEXT,
    "revenueShare" JSONB,
    "note" TEXT,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickName" TEXT,
    "email" TEXT,
    "primaryPhone" TEXT,
    "phoneDigits" TEXT,
    "foreignPhone" TEXT,
    "since" TIMESTAMP(3),
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "gender" TEXT,
    "maritalStatus" TEXT,
    "occupation" TEXT,
    "emergencyRelation" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "photoPath" TEXT,
    "photoUrl" TEXT,
    "lifetimeDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medicalHistory" TEXT,
    "drugHistory" TEXT,
    "note" TEXT,
    "consultantDoctorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPrice" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentCase" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentLine" (
    "id" SERIAL NOT NULL,
    "caseId" INTEGER NOT NULL,
    "operatingDoctorId" INTEGER,
    "treatmentDate" TIMESTAMP(3),
    "treatmentName" TEXT,
    "description" TEXT,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afterDiscountAmount" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "TreatmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "treatmentLineId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER,
    "patientId" INTEGER NOT NULL,
    "allocatedUnit" TEXT,
    "statusCode" INTEGER,
    "status" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "gcalId" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" SERIAL NOT NULL,
    "manufacturer" TEXT,
    "brandName" TEXT,
    "genericName" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER,
    "dentistId" INTEGER,
    "rxDate" TIMESTAMP(3),
    "complaints" TEXT,
    "medicalHistory" TEXT,
    "drugHistory" TEXT,
    "previousDentalHistory" TEXT,
    "findingsOnExamination" TEXT,
    "provisionalDiagnosis" TEXT,
    "differentialDiagnosis" TEXT,
    "investigationAdvised" TEXT,
    "investigationInterpretation" TEXT,
    "confirmatoryDiagnosis" TEXT,
    "treatmentPlan" TEXT,
    "procedurePerformed" TEXT,
    "advise" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpReason" TEXT,
    "randomName" TEXT,
    "randomAge" TEXT,
    "randomSex" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionDrug" (
    "id" SERIAL NOT NULL,
    "prescriptionId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "drug" TEXT,
    "dose" TEXT,
    "meal" TEXT,
    "duration" TEXT,

    CONSTRAINT "PrescriptionDrug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RxSnippet" (
    "id" SERIAL NOT NULL,
    "complaints" TEXT,
    "medicalHistory" TEXT,
    "previousDentalHistory" TEXT,
    "diagnosis" TEXT,
    "investigationAdvised" TEXT,
    "investigationInterpretation" TEXT,
    "treatment" TEXT,
    "adviseHeader" TEXT,
    "advise" TEXT,
    "drugDoseSortOrder" INTEGER,
    "drugDose" TEXT,
    "drugDurationSortOrder" INTEGER,
    "drugDuration" TEXT,
    "drugMealSortOrder" INTEGER,
    "drugMeal" TEXT,
    "followUpReason" TEXT,

    CONSTRAINT "RxSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RxTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "complaints" TEXT,
    "findingsOnExamination" TEXT,
    "provisionalDiagnosis" TEXT,
    "differentialDiagnosis" TEXT,
    "investigationAdvised" TEXT,
    "confirmatoryDiagnosis" TEXT,
    "treatmentPlan" TEXT,
    "procedurePerformed" TEXT,
    "advise" TEXT,
    "followUpDay" INTEGER,
    "followUpReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3),
    "editedBy" TEXT,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "RxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RxTemplateDrug" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "drug" TEXT,
    "dose" TEXT,
    "meal" TEXT,
    "duration" TEXT,

    CONSTRAINT "RxTemplateDrug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "heading" TEXT,
    "body1" TEXT,
    "body2" TEXT,
    "body3" TEXT,
    "body4" TEXT,
    "body5" TEXT,
    "body6" TEXT,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpire" TIMESTAMP(3),
    "refreshToken" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSetting" (
    "id" SERIAL NOT NULL,
    "defaultRxType" TEXT,
    "bodyRxReportName" TEXT,
    "fullRxReportName" TEXT,
    "autoAddAppointment" BOOLEAN NOT NULL DEFAULT false,
    "autoCompleteAppointment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClinicSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" SERIAL NOT NULL,
    "docName" TEXT NOT NULL,
    "heading1" TEXT,
    "heading2" TEXT,
    "heading3" TEXT,
    "heading4" TEXT,
    "heading5" TEXT,
    "heading6" TEXT,
    "heading7" TEXT,
    "heading8" TEXT,
    "heading9" TEXT,
    "footer" TEXT,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactPerson" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "specialization" TEXT,
    "agreementStartDate" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "businessPhone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "note" TEXT,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Occupation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionRelation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ConnectionRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressPreset" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AddressPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CaseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabShade" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "LabShade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SalaryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientHistoryVersion" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "kind" "HistoryKind" NOT NULL,
    "body" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER,

    CONSTRAINT "PatientHistoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothChartEntry" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "toothFdi" TEXT NOT NULL,
    "status" TEXT,
    "treatmentLineId" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToothChartEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentLineTooth" (
    "treatmentLineId" INTEGER NOT NULL,
    "toothFdi" TEXT NOT NULL,

    CONSTRAINT "TreatmentLineTooth_pkey" PRIMARY KEY ("treatmentLineId","toothFdi")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "caseId" INTEGER,
    "toothFdi" TEXT,
    "storageKey" TEXT NOT NULL,
    "kind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Recall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEvent" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "refId" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,

    CONSTRAINT "PatientEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_personId_key" ON "Doctor"("personId");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient" USING GIN ("fullName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_nickName_idx" ON "Patient" USING GIN ("nickName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Patient_phoneDigits_idx" ON "Patient"("phoneDigits");

-- CreateIndex
CREATE UNIQUE INDEX "Treatment_name_key" ON "Treatment"("name");

-- CreateIndex
CREATE INDEX "Treatment_name_idx" ON "Treatment" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Drug_brandName_idx" ON "Drug" USING GIN ("brandName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Drug_genericName_idx" ON "Drug" USING GIN ("genericName" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Occupation_name_key" ON "Occupation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Relation_name_key" ON "Relation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRelation_name_key" ON "ConnectionRelation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AddressPreset_value_key" ON "AddressPreset"("value");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlot_label_key" ON "ScheduleSlot"("label");

-- CreateIndex
CREATE UNIQUE INDEX "CaseType_name_key" ON "CaseType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LabShade_code_key" ON "LabShade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryType_name_key" ON "SalaryType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ClinicalNote_patientId_idx" ON "ClinicalNote"("patientId");

-- CreateIndex
CREATE INDEX "PatientHistoryVersion_patientId_kind_idx" ON "PatientHistoryVersion"("patientId", "kind");

-- CreateIndex
CREATE INDEX "ToothChartEntry_patientId_idx" ON "ToothChartEntry"("patientId");

-- CreateIndex
CREATE INDEX "Attachment_patientId_idx" ON "Attachment"("patientId");

-- CreateIndex
CREATE INDEX "Recall_dueDate_idx" ON "Recall"("dueDate");

-- CreateIndex
CREATE INDEX "PatientEvent_patientId_occurredAt_idx" ON "PatientEvent"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_consultantDoctorId_fkey" FOREIGN KEY ("consultantDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCase" ADD CONSTRAINT "TreatmentCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLine" ADD CONSTRAINT "TreatmentLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TreatmentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLine" ADD CONSTRAINT "TreatmentLine_operatingDoctorId_fkey" FOREIGN KEY ("operatingDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_treatmentLineId_fkey" FOREIGN KEY ("treatmentLineId") REFERENCES "TreatmentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDrug" ADD CONSTRAINT "PrescriptionDrug_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RxTemplateDrug" ADD CONSTRAINT "RxTemplateDrug_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RxTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientHistoryVersion" ADD CONSTRAINT "PatientHistoryVersion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothChartEntry" ADD CONSTRAINT "ToothChartEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLineTooth" ADD CONSTRAINT "TreatmentLineTooth_treatmentLineId_fkey" FOREIGN KEY ("treatmentLineId") REFERENCES "TreatmentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvent" ADD CONSTRAINT "PatientEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
