-- AlterTable
ALTER TABLE "SmsTemplate" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "body" TEXT,
ADD COLUMN     "key" TEXT,
ADD COLUMN     "statusKey" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateKey" TEXT,
    "status" TEXT NOT NULL,
    "gatewayCode" TEXT,
    "error" TEXT,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_patientId_idx" ON "SmsLog"("patientId");

-- CreateIndex
CREATE INDEX "SmsLog_sentAt_idx" ON "SmsLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_key_key" ON "SmsTemplate"("key");

-- CreateIndex
CREATE INDEX "SmsTemplate_statusKey_idx" ON "SmsTemplate"("statusKey");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Map the legacy rows onto stable keys so code can reference them. The Access table
-- doubled as the appointment status list, which is why SmsID 6-14 line up exactly with
-- the StatusKey values already in src/lib/appointment-constants.ts.
UPDATE "SmsTemplate" SET "key" = v.k, "statusKey" = v.sk FROM (VALUES
  (2,  'PAYMENT_REGULAR',    NULL),
  (3,  'WELCOME',            NULL),
  (4,  'PAYMENT_NO_DUE',     NULL),
  (5,  'MEMBER_WELCOME',     NULL),
  (6,  'APPT_CONFIRMED',     'CONFIRMED'),
  (7,  'APPT_REMINDED',      'REMINDED'),
  (8,  'APPT_RESCHEDULED',   'RESCHEDULED'),
  (9,  'APPT_CANCELLED',     'CANCELLED'),
  (10, 'APPT_WAITLISTED',    'WAITLISTED'),
  (11, 'APPT_LATE',          'LATE'),
  (12, 'APPT_OVERDUE',       'OVERDUE'),
  (13, 'APPT_PENDING',       'PENDING'),
  (14, 'APPT_COMPLETED',     'COMPLETED'),
  (15, 'PAYMENT_DUE',        NULL)
) AS v(id, k, sk) WHERE "SmsTemplate".id = v.id;

-- The blank placeholder row (SmsID 1) is not a template.
UPDATE "SmsTemplate" SET "active" = false WHERE id = 1;
