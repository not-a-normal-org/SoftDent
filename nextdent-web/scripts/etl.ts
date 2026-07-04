/**
 * ETL: load the extracted Access CSVs into Postgres via Prisma.
 * Idempotent-ish: run against a freshly-migrated DB (it truncates first).
 * Migrated entities keep their legacy integer ids; sequences are bumped after load.
 * Loose/orphan foreign keys (predicted in data-model.md §6) are filtered and reported.
 */
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const DATA = join(__dirname, "..", "..", "extraction", "data");

// ── helpers ───────────────────────────────────────────────
const rows = (t: string): Record<string, string>[] =>
  parse(readFileSync(join(DATA, `${t}.csv`)), { columns: true, skip_empty_lines: true, bom: true });

const s = (v?: string) => { const x = (v ?? "").trim(); return x === "" ? null : x; };
const n = (v?: string) => { const x = s(v); return x == null ? null : Number.parseInt(x, 10) || null; };
const f = (v?: string) => { const x = s(v); return x == null ? null : Number.parseFloat(x) || 0; };
const b = (v?: string) => (s(v) ?? "").toLowerCase() === "true";
const d = (v?: string) => { const x = s(v); if (!x) return null; const dt = new Date(x); return isNaN(+dt) ? null : dt; };
const digits = (v?: string) => { const x = s(v); return x ? x.replace(/\D/g, "") || null : null; };
const combine = (dateStr?: string, timeStr?: string) => {
  const day = d(dateStr); const tm = d(timeStr);
  if (!day) return null;
  if (!tm) return day;
  const r = new Date(day); r.setHours(tm.getHours(), tm.getMinutes(), tm.getSeconds(), 0); return r;
};
const chunk = <T>(a: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(a.length / size) }, (_, i) => a.slice(i * size, i * size + size));

const report: string[] = [];
function log(msg: string) { console.log(msg); report.push(msg); }

// distinct non-empty values of one CommonInfo column → lookup rows
async function loadLookup(ci: Record<string, string>[], col: string, model: any, field: string) {
  const vals = [...new Set(ci.map((r) => s(r[col])).filter(Boolean) as string[])];
  if (!vals.length) return;
  await model.createMany({ data: vals.map((v) => ({ [field]: v })), skipDuplicates: true });
  log(`  lookup ${col.padEnd(24)} → ${vals.length}`);
}

async function bumpSeq(table: string) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"','id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
  );
}

async function main() {
  log("=== NextDent ETL ===");

  // wipe (child→parent order); CASCADE handles the rest
  const truncatable = [
    "PatientEvent","Payment","TreatmentLineTooth","PrescriptionDrug","RxTemplateDrug",
    "TreatmentLine","TreatmentCase","Appointment","Prescription","Patient",
    "Doctor","User","Person","Drug","Treatment","RxSnippet","RxTemplate",
    "SmsTemplate","IntegrationSetting","ClinicSetting","DocumentTemplate","Lab","Vendor",
    "Occupation","Relation","ConnectionRelation","AddressPreset","ScheduleSlot",
    "CaseType","LabShade","Unit","SalaryType","ProductCategory","ExpenseCategory",
    "ClinicalNote","PatientHistoryVersion","ToothChartEntry","Attachment","Recall","AuditLog",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${truncatable.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

  // ── 1. lookups + treatment catalog (from tbl_CommonInfo) ──
  log("\n[1] Lookups + treatment catalog");
  const ci = rows("tbl_CommonInfo");
  await loadLookup(ci, "Occupation", prisma.occupation, "name");
  await loadLookup(ci, "Relationship", prisma.relation, "name");
  await loadLookup(ci, "ConnectionRelation", prisma.connectionRelation, "name");
  await loadLookup(ci, "Address", prisma.addressPreset, "value");
  await loadLookup(ci, "ScheduleTime", prisma.scheduleSlot, "label");
  await loadLookup(ci, "TreatmentCase", prisma.caseType, "name");
  await loadLookup(ci, "LabColorShade", prisma.labShade, "code");
  await loadLookup(ci, "UnitName", prisma.unit, "name");
  await loadLookup(ci, "EmployeeSalaryType", prisma.salaryType, "name");
  await loadLookup(ci, "InventoryProductCategory", prisma.productCategory, "name");
  await loadLookup(ci, "ExpenseName", prisma.expenseCategory, "name");
  // treatments: name + price (first price wins)
  const treatMap = new Map<string, number>();
  for (const r of ci) { const name = s(r.TreatmentName); if (name && !treatMap.has(name)) treatMap.set(name, n(r.TreatmentPrice) ?? 0); }
  await prisma.treatment.createMany({ data: [...treatMap].map(([name, defaultPrice]) => ({ name, defaultPrice })), skipDuplicates: true });
  log(`  treatments               → ${treatMap.size}`);

  // ── 2. drug reference (46k) ──
  log("\n[2] Drug catalog");
  const drugData = rows("tbl_Drugs").map((r) => ({
    id: n(r.DrugID)!, manufacturer: s(r.Manufacturer), brandName: s(r.BrandName),
    genericName: s(r.GenericName), strength: s(r.Strength), dosageForm: s(r.DosagesForm),
  }));
  for (const part of chunk(drugData, 5000)) await prisma.drug.createMany({ data: part, skipDuplicates: true });
  log(`  drugs                    → ${drugData.length}`);

  // ── 3. persons → doctors → users ──
  log("\n[3] Staff, doctors, users");
  await prisma.person.createMany({ data: rows("tbl_Persons").map((r) => ({
    id: n(r.PersonID)!, fullName: s(r.PersonFullName) ?? "(unknown)", nickName: s(r.PersonNickName),
    primaryPhone: s(r.PersonPrimaryPhone), secondaryPhone: s(r.PersonSecondaryPhone),
    address: s(r.PersonAddress), email: s(r.PersonEmailAddress),
    dob: d(r.PersonDOB) ?? d(r.DateOfBirth), gender: s(r.PersonGender),
    maritalStatus: s(r.PersonMaritalStatus), nid: s(r.PersonNID), note: s(r.Note),
    activeStatus: b(r.ActiveStatus) || true,
  })) });

  const doctorRows = rows("tbl_Doctors");
  const pctKeys = Object.keys(doctorRows[0] ?? {}).filter((k) => /Percent$/.test(k));
  await prisma.doctor.createMany({ data: doctorRows.map((r) => ({
    id: n(r.DoctorID)!, personId: n(r.PersonID)!, isOwner: b(r.IsOwner),
    degree: s(r.Degree), designation1: s(r.Designation1st), designation2: s(r.Designation2nd),
    clinicName: s(r.ClinicName), institute: s(r.Inistitute), session: s(r.Session),
    regNo: s(r.RegNo), activeStatus: s(r.ActiveStatus), labBillReductionMethod: s(r.LabBillReductionMethods),
    revenueShare: Object.fromEntries(pctKeys.map((k) => [k, f(r[k])])),
    note: s(r.Note),
  })) });
  const doctorIds = new Set((await prisma.doctor.findMany({ select: { id: true } })).map((x) => x.id));
  const ownerPersonIds = new Set(doctorRows.filter((r) => b(r.IsOwner)).map((r) => n(r.PersonID)));

  await prisma.user.createMany({ data: rows("tbl_PersonSecurity").map((r) => ({
    id: n(r.PersonSecurityID)!, personId: n(r.PersonID)!, username: s(r.PersonUserName) ?? `user${r.PersonSecurityID}`,
    role: ownerPersonIds.has(n(r.PersonID)) ? "OWNER" as const : "DOCTOR" as const,
    activeStatus: (s(r.ActiveStatus) ?? "").toLowerCase() === "active",
    needsPasswordReset: true,
  })) });
  log(`  persons=${rows("tbl_Persons").length} doctors=${doctorIds.size} users=${rows("tbl_PersonSecurity").length} (passwords require reset)`);

  // ── 4. patients ──
  log("\n[4] Patients");
  let orphanConsultant = 0;
  const patientData = rows("tbl_Patients").map((r) => {
    const cd = n(r.PatientConsultantDrID);
    const resolved = cd && doctorIds.has(cd) ? cd : null;
    if (cd && !resolved) orphanConsultant++;
    return {
      id: n(r.PatientID)!, fullName: s(r.PatientFullName) ?? "(unnamed)", nickName: s(r.PatientNickName),
      email: s(r.PatientEmailAddress), primaryPhone: s(r.PatientPrimaryPhone), phoneDigits: digits(r.PatientPrimaryPhone),
      foreignPhone: s(r.PatientForeignPhone), since: d(r.PatientSince), dob: d(r.PatientDOB),
      address: s(r.PatientAddress), gender: s(r.PatientGender), maritalStatus: s(r.PatientMaritalStatus),
      occupation: s(r.PatientOccupation), emergencyRelation: s(r.PatientEmergencyRelation),
      emergencyName: s(r.PatientEmergencyRelativeName), emergencyPhone: s(r.PatientEmergencyRelativePhone),
      photoPath: s(r.PatientPhotoPath), photoUrl: s(r.PatientPhotoURL), lifetimeDiscount: f(r.PatientLifeTimeDiscount) ?? 0,
      medicalHistory: s(r.PatientMedicalHistory), drugHistory: s(r.PatientDrugHistory), note: s(r.PatientNote),
      consultantDoctorId: resolved,
    };
  });
  for (const part of chunk(patientData, 2000)) await prisma.patient.createMany({ data: part, skipDuplicates: true });
  const patientIds = new Set(patientData.map((p) => p.id));
  log(`  patients                 → ${patientData.length} (${orphanConsultant} consultant refs unresolved → null)`);

  // ── 5. treatment cases → lines → payments ──
  log("\n[5] Treatment cases, lines, payments");
  const caseRows = rows("tbl_PatientTreatmentCases");
  const okCases = caseRows.filter((r) => patientIds.has(n(r.PatientID)!));
  await prisma.treatmentCase.createMany({ data: okCases.map((r) => ({
    id: n(r.TreatmentCaseID)!, patientId: n(r.PatientID)!, name: s(r.CaseName),
    description: s(r.CaseDescription), status: s(r.CaseStatus), notes: s(r.Notes),
  })) });
  const caseIds = new Set(okCases.map((r) => n(r.TreatmentCaseID)!));
  const lineRows = rows("tbl_PatientTreatmentDetails").filter((r) => caseIds.has(n(r.TreatmentCaseID)!));
  await prisma.treatmentLine.createMany({ data: lineRows.map((r) => ({
    id: n(r.TreatmentDetailID)!, caseId: n(r.TreatmentCaseID)!,
    operatingDoctorId: doctorIds.has(n(r.OTDrID)!) ? n(r.OTDrID) : null,
    treatmentDate: d(r.TreatmentDate), treatmentName: s(r.TreatmentName), description: s(r.TreatmentDescription),
    totalAmount: n(r.TotalAmount) ?? 0, discountPercent: f(r.DiscountPercent) ?? 0,
    afterDiscountAmount: n(r.AfterDiscountAmount) ?? 0, amountPaid: n(r.AmountPaid) ?? 0, note: s(r.Note),
  })) });
  // seed a payment per line with amountPaid > 0
  const payData = lineRows.filter((r) => (n(r.AmountPaid) ?? 0) > 0).map((r) => ({
    treatmentLineId: n(r.TreatmentDetailID)!, amount: n(r.AmountPaid)!, paidAt: d(r.TreatmentDate) ?? new Date(0), method: "migrated",
  }));
  if (payData.length) await prisma.payment.createMany({ data: payData });
  log(`  cases=${okCases.length}/${caseRows.length}  lines=${lineRows.length}  payments=${payData.length}`);

  // ── 6. appointments ──
  log("\n[6] Appointments");
  const apptRows = rows("tbl_Appointments").filter((r) => patientIds.has(n(r.PatientID)!));
  await prisma.appointment.createMany({ data: apptRows.map((r) => ({
    id: n(r.AppointmentID)!, patientId: n(r.PatientID)!,
    doctorId: doctorIds.has(n(r.DrID)!) ? n(r.DrID) : null,
    allocatedUnit: s(r.AllocatedUnit), statusCode: n(r.AppointmentStatusID),
    appointmentDate: d(r.AppointmentDate),
    startsAt: combine(r.AppointmentDate, r.AppointmentStartTime),
    endsAt: combine(r.AppointmentDate, r.AppointmentEndTime),
    smsSent: b(r.IsAppointSmsSend), note: s(r.Note), gcalId: s(r.GCalendarID),
  })) });
  log(`  appointments             → ${apptRows.length}`);

  // ── 7. prescriptions + drugs, snippets, templates ──
  log("\n[7] Prescriptions & Rx library");
  await prisma.prescription.createMany({ data: rows("tbl_Prescriptions").map((r) => ({
    id: n(r.PrescriptionID)!, patientId: patientIds.has(n(r.PatientID)!) ? n(r.PatientID) : null,
    dentistId: doctorIds.has(n(r.RxDentistID)!) ? n(r.RxDentistID) : null, rxDate: d(r.RxDate),
    complaints: s(r.Complaints), medicalHistory: s(r.MedicalHistory), drugHistory: s(r.DrugHistory),
    previousDentalHistory: s(r.PreviousDentalHistory), findingsOnExamination: s(r.FindingsOnExamination),
    provisionalDiagnosis: s(r.ProvisionalDiagnosis), differentialDiagnosis: s(r.DifferentialDiagnosis),
    investigationAdvised: s(r.InvestigationAdvised), investigationInterpretation: s(r.InvestigationInterpretation),
    confirmatoryDiagnosis: s(r.ConfirmatoryDiagnosis), treatmentPlan: s(r.TreatmentPlan),
    procedurePerformed: s(r.ProcedurePerformed), advise: s(r.Advise), followUpDate: d(r.FollowUpDate),
    followUpReason: s(r.FollowUpReason), randomName: s(r.RandomName), randomAge: s(r.RandomAge),
    randomSex: s(r.RandomSex), deletedAt: d(r.DeleteAt), deletedBy: s(r.DeleteBy),
  })) });
  const rxIds = new Set((await prisma.prescription.findMany({ select: { id: true } })).map((x) => x.id));
  await prisma.prescriptionDrug.createMany({ data: rows("tbl_PrescriptionDrug").filter((r) => rxIds.has(n(r.PrescriptionID)!)).map((r) => ({
    id: n(r.RxDrugID)!, prescriptionId: n(r.PrescriptionID)!, sortOrder: n(r.SortOrder) ?? 0,
    drug: s(r.Drug), dose: s(r.Dose), meal: s(r.Meal), duration: s(r.Duration),
  })) });
  await prisma.rxSnippet.createMany({ data: rows("tbl_PrescriptionSider").map((r) => ({
    id: n(r.PrescriptionSiderID)!, complaints: s(r.Complaints), medicalHistory: s(r.MedicalHistory),
    previousDentalHistory: s(r.PreviousDentalHistory), diagnosis: s(r.Diagnosis),
    investigationAdvised: s(r.InvestigationAdvised), investigationInterpretation: s(r.InvestigationInterpretation),
    treatment: s(r.Treatment), adviseHeader: s(r.AdviseHeader), advise: s(r.Advise),
    drugDoseSortOrder: n(r.DrugDoseSortOrder), drugDose: s(r.DrugDose),
    drugDurationSortOrder: n(r.DrugDurationSortOrder), drugDuration: s(r.DrugDuration),
    drugMealSortOrder: n(r.DrugMealSortOrder), drugMeal: s(r.DrugMeal), followUpReason: s(r.FollowUpReason),
  })) });
  await prisma.rxTemplate.createMany({ data: rows("tbl_PrescriptionTemplates").map((r) => ({
    id: n(r.PrescriptionTemplateID)!, name: s(r.TemplateName) ?? "(template)", complaints: s(r.Complaints),
    findingsOnExamination: s(r.FindingsOnExamination), provisionalDiagnosis: s(r.ProvisionalDiagnosis),
    differentialDiagnosis: s(r.DifferentialDiagnosis), investigationAdvised: s(r.InvestigationAdvised),
    confirmatoryDiagnosis: s(r.ConfirmatoryDiagnosis), treatmentPlan: s(r.TreatmentPlan),
    procedurePerformed: s(r.ProcedurePerformed), advise: s(r.Advise), followUpDay: n(r.FollowUPDay),
    followUpReason: s(r.FollowUpReason), createdBy: s(r.CreatedBy), createdAt: d(r.CreatedAt),
    editedBy: s(r.EditedBy), editedAt: d(r.EditedAt),
  })) });
  const tplIds = new Set((await prisma.rxTemplate.findMany({ select: { id: true } })).map((x) => x.id));
  await prisma.rxTemplateDrug.createMany({ data: rows("tbl_PrescriptionTemplateDrug").filter((r) => tplIds.has(n(r.PrescriptionTemplateID)!)).map((r) => ({
    id: n(r.TemplateDrugID)!, templateId: n(r.PrescriptionTemplateID)!, sortOrder: n(r.SortOrder) ?? 0,
    drug: s(r.Drug), dose: s(r.Dose), meal: s(r.Meal), duration: s(r.Duration),
  })) });
  log(`  prescriptions=${rxIds.size} rxDrugs=${rows("tbl_PrescriptionDrug").length} snippets=${rows("tbl_PrescriptionSider").length} templates=${tplIds.size}`);

  // ── 8. comms & config ──
  log("\n[8] Comms & config");
  await prisma.smsTemplate.createMany({ data: rows("tbl_Sms").map((r) => ({
    id: n(r.SmsID)!, name: s(r.SmsName) ?? "(sms)", heading: s(r.SmsHeading),
    body1: s(r.SmsBody1), body2: s(r.SmsBody2), body3: s(r.SmsBody3),
    body4: s(r.SmsBody4), body5: s(r.SmsBody5), body6: s(r.SmsBody6),
  })) });
  await prisma.integrationSetting.createMany({ data: rows("tbl_API").map((r) => ({
    id: n(r.APIID)!, name: s(r.APIName) ?? "(api)", accessToken: s(r.AccessToken),
    accessTokenExpire: d(r.AccessTokenExpire), refreshToken: s(r.RefreshToken),
    clientId: s(r.ClientID), clientSecret: s(r.ClientSecret),
  })) });
  await prisma.clinicSetting.createMany({ data: rows("tbl_UserSetting").map((r) => ({
    id: n(r.UserSettingID)!, defaultRxType: s(r.DefaultRxType), bodyRxReportName: s(r.BodyRxReportName),
    fullRxReportName: s(r.FullRxReportName), autoAddAppointment: b(r.AutoAddAppointmentWhenAddingTreatmentDetails),
    autoCompleteAppointment: b(r.AutoCompleteAppointmentWhenAddingTreatmentDetails),
  })) });
  await prisma.documentTemplate.createMany({ data: rows("tbl_PrintDoc").map((r) => ({
    id: n(r.PrintDocID)!, docName: s(r.DocName) ?? "(doc)", heading1: s(r.DocHeading1), heading2: s(r.DocHeading2),
    heading3: s(r.DocHeading3), heading4: s(r.DocHeading4), heading5: s(r.DocHeading5), heading6: s(r.DocHeading6),
    heading7: s(r.DocHeading7), heading8: s(r.DocHeading8), heading9: s(r.DocHeading9), footer: s(r.DocFooter),
  })) });
  await prisma.lab.createMany({ data: rows("tbl_LabDetails").map((r) => ({
    id: n(r.LabID)!, name: s(r.LabName) ?? "(lab)", address: s(r.LabAddress), contactPerson: s(r.ContactPerson),
    contactNumber: s(r.ContactNumber), email: s(r.LabEmail), specialization: s(r.LabSpecialization),
    agreementStartDate: d(r.AgreementStartDate), paymentTerms: s(r.PaymentTerms), isActive: b(r.IsActive), notes: s(r.Notes),
  })) });
  await prisma.vendor.createMany({ data: rows("tbl_Vendors").map((r) => ({
    id: n(r.VendorID)!, name: s(r.VendorName) ?? "(vendor)", businessPhone: s(r.BusinessPhone),
    address: s(r.Address), website: s(r.Website), note: s(r.Note),
  })) });
  log("  sms/api/settings/printdoc/labs/vendors loaded");

  // ── 9. seed patient timeline (PatientEvent) ──
  log("\n[9] Seeding patient timeline");
  const events: { patientId: number; eventType: string; refId: number; occurredAt: Date; summary: string }[] = [];
  for (const a of await prisma.appointment.findMany())
    events.push({ patientId: a.patientId, eventType: "appointment", refId: a.id, occurredAt: a.startsAt ?? a.appointmentDate ?? new Date(0), summary: `Appointment (${a.allocatedUnit ?? "unit"})` });
  const linesWithCase = await prisma.treatmentLine.findMany({ include: { case: true } });
  for (const l of linesWithCase)
    events.push({ patientId: l.case.patientId, eventType: "treatment", refId: l.id, occurredAt: l.treatmentDate ?? new Date(0), summary: `${l.treatmentName ?? "Treatment"} — ৳${l.afterDiscountAmount} (paid ৳${l.amountPaid})` });
  for (const p of await prisma.prescription.findMany({ where: { patientId: { not: null } } }))
    events.push({ patientId: p.patientId!, eventType: "prescription", refId: p.id, occurredAt: p.rxDate ?? new Date(0), summary: "Prescription issued" });
  if (events.length) await prisma.patientEvent.createMany({ data: events });
  log(`  timeline events          → ${events.length}`);

  // ── 10. bump sequences for explicit-id tables ──
  for (const t of ["Person","Doctor","User","Patient","Drug","TreatmentCase","TreatmentLine",
    "Appointment","Prescription","PrescriptionDrug","RxSnippet","RxTemplate","RxTemplateDrug",
    "SmsTemplate","IntegrationSetting","ClinicSetting","DocumentTemplate","Lab","Vendor"]) await bumpSeq(t);
  log("Sequences bumped.");

  // refresh planner stats so trigram search indexes are used immediately
  await prisma.$executeRawUnsafe(`ANALYZE`);
  log("Stats refreshed (ANALYZE). ETL complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
