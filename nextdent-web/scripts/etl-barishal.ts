/**
 * ETL: replace the database contents with the Barishal clinic's real data.
 *
 * This is NOT scripts/etl.ts with a different path. The Barishal backend is an older
 * revision of the SoftDent Access schema and differs where it matters:
 *
 *   - Prescriptions store up to ten drugs INLINE (Drug1…Drug10 + Dose/Duration/Meal)
 *     instead of in a child tbl_PrescriptionDrug table, which does not exist there.
 *   - The clinical fields are named for the paper form — C/C, H/O, O/E, Diagnosis,
 *     Investigation, TreatmentDone, Advice, Note — not the longer Dhaka names.
 *   - Rx templates carry only a name plus inline drugs; no clinical fields at all.
 *   - There is no tbl_UserSetting, so clinic settings are kept, not imported.
 *
 * What is preserved (the "current User and setup"):
 *   User rows          — username, password hash, role, carried across the wipe and
 *                        re-attached to the matching Barishal person by name.
 *   ClinicSetting      — schedule, Rx print margins, automation flags.
 *   SmsTemplate        — the 14 Bangla templates, including the helpline edit.
 *   IntegrationSetting — live API tokens; the legacy tbl_API is deliberately ignored.
 *   CalendarConnection — restored against the surviving user.
 *
 * TIME. Access stores a date as a bare double with no timezone, and this clinic runs
 * on Bangladesh time. Every timestamp is therefore parsed as an explicit +06:00 wall
 * clock rather than being handed to `new Date(...)` to interpret in whatever zone the
 * machine running the import happens to be in. That is the difference between an
 * appointment reading 10:00 and reading 04:00. Time-only columns come out of Access
 * dated 1899-12-30 (its epoch), so they are recombined with their own date column.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { LEGACY_STATUS_BY_CODE } from "../src/lib/appointment-constants";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const DATA = process.env.BARISHAL_CSV;
if (!DATA) throw new Error("Set BARISHAL_CSV to the directory holding the dumped CSVs.");

// ── helpers ───────────────────────────────────────────────
const rows = (t: string): Record<string, string>[] => {
  const f = join(DATA, `${t}.csv`);
  if (!existsSync(f)) return [];
  return parse(readFileSync(f), { columns: true, skip_empty_lines: true, bom: true });
};

const s = (v?: string) => { const x = (v ?? "").trim(); return x === "" ? null : x; };
const n = (v?: string) => { const x = s(v); return x == null ? null : Number.parseInt(x, 10) || null; };
const f = (v?: string) => { const x = s(v); return x == null ? null : Number.parseFloat(x) || 0; };
const b = (v?: string) => (s(v) ?? "").toLowerCase() === "true";
const digits = (v?: string) => { const x = s(v); return x ? x.replace(/\D/g, "") || null : null; };

/**
 * Legacy discounts are stored as a FRACTION, not a percentage: 0.1 means 10% and
 * 1.0 means the whole thing was waived. Checked against all 8,500 treatment lines —
 * 4,316 reconcile with AfterDiscountAmount only under this reading, and none under
 * the percentage reading. Importing the raw figure would render "0.1%" and, worse,
 * recompute the payable from 0.1% the first time anyone edited the line.
 *
 * Rounded to two decimals so a third from the legacy data reads 33.33% rather than
 * 33.33333333333333%. The money is unaffected: AfterDiscountAmount is carried over
 * as stored and stays authoritative.
 */
const pct = (v?: string) => Math.round((f(v) ?? 0) * 10000) / 100;

const TZ = "Asia/Dhaka";
const TS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

const zoneFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
/** How far ahead of UTC the clinic's clock was at this instant, in milliseconds. */
function zoneOffset(at: Date): number {
  const p = Object.fromEntries(zoneFmt.formatToParts(at).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at.getTime();
}

/**
 * "2026-09-22 14:30:00" → the instant at which the clinic's own clock read that.
 *
 * The offset is resolved through the Asia/Dhaka zone rather than hardcoded to +06:00,
 * because it has not always been +06:00: Dhaka ran on **+06:30 until 1951**. Patients
 * born before then — 22 of them here — would otherwise be stored half an hour out and
 * read back wrong. Two passes, because the offset itself depends on the instant.
 */
const d = (v?: string): Date | null => {
  const x = s(v);
  if (!x) return null;
  const m = TS.exec(x);
  if (!m) { const dt = new Date(x); return isNaN(+dt) ? null : dt; }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  let ts = wall - zoneOffset(new Date(wall));
  const settled = wall - zoneOffset(new Date(ts));
  if (settled !== ts) ts = settled;
  return new Date(ts);
};

/**
 * Access keeps a time-of-day in its own column dated 1899-12-30. Take the calendar
 * day from one column and the clock from the other; a plain parse of the time column
 * would land every appointment in 1899.
 */
const combine = (dateStr?: string, timeStr?: string): Date | null => {
  const ds = s(dateStr);
  if (!ds) return null;
  const dm = /^(\d{4}-\d{2}-\d{2})/.exec(ds);
  if (!dm) return null;
  const tm = s(timeStr);
  const t = tm ? /(\d{2}):(\d{2}):(\d{2})$/.exec(tm) : null;
  const clock = t ? `${t[1]}:${t[2]}:${t[3]}` : "00:00:00";
  return d(`${dm[1]} ${clock}`);
};

const chunk = <T>(a: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(a.length / size) }, (_, i) => a.slice(i * size, i * size + size));

const report: string[] = [];
const log = (m: string) => { console.log(m); report.push(m); };

/**
 * Name comparison across the two records of the same person. Honorifics stack in
 * Bangladeshi names — "Dr. Md. Nazmul Alam Nayeem" against "Dr. Nazmul Alam Nayeem"
 * is the same doctor — so they are stripped repeatedly, not once.
 */
const normName = (v: string) => {
  let x = v.toLowerCase().trim();
  let prev = "";
  while (x !== prev) { prev = x; x = x.replace(/^(dr|md|mr|mrs|ms|prof|mohammad|mohammed)\.?\s+/, ""); }
  return x.replace(/[^a-z]/g, "");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- one call shape across a dozen unrelated delegates
async function loadLookup(ci: Record<string, string>[], col: string, model: any, field: string) {
  const vals = [...new Set(ci.map((r) => s(r[col])).filter(Boolean) as string[])];
  if (!vals.length) return;
  await model.createMany({ data: vals.map((v) => ({ [field]: v })), skipDuplicates: true });
  log(`  lookup ${col.padEnd(26)} → ${vals.length}`);
}

async function bumpSeq(table: string) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"','id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1))`
  );
}

async function main() {
  log(`=== NextDent — Barishal import ===`);
  log(`source: ${DATA}`);

  // ── 0. keep what the clinic already set up ────────────────
  const keptUsers = await prisma.user.findMany({ include: { person: true } });
  const keptCalendars = await prisma.calendarConnection.findMany();
  log(`\n[0] Preserving ${keptUsers.length} user(s): ${keptUsers.map((u) => u.username).join(", ")}`);

  // Everything else goes. ClinicSetting, SmsTemplate and IntegrationSetting are
  // absent from this list on purpose — they are the clinic's own configuration.
  const wipe = [
    "PatientEvent", "Payment", "TreatmentLineTooth", "PrescriptionDrug", "RxTemplateDrug",
    "SmsLog", "StockMovement", "LabOrder", "Expense", "Recall", "Attachment",
    "ToothChartEntry", "PatientHistoryVersion", "ClinicalNote", "HealthRecord",
    "PatientConnection", "TreatmentLine", "TreatmentCase", "Appointment", "Prescription",
    "Patient", "Doctor", "Session", "CalendarConnection", "User", "Person", "Drug",
    "Treatment", "RxSnippet", "RxTemplate", "DocumentTemplate", "Lab", "Vendor", "Product",
    "Occupation", "Relation", "ConnectionRelation", "AddressPreset", "ScheduleSlot",
    "CaseType", "LabShade", "Unit", "SalaryType", "ProductCategory", "ExpenseCategory",
    "AuditLog",
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${wipe.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
  log(`    wiped ${wipe.length} tables (sessions included — everyone signs in again)`);

  // ── 1. lookups + treatment catalog ────────────────────────
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
  const treatMap = new Map<string, number>();
  for (const r of ci) { const name = s(r.TreatmentName); if (name && !treatMap.has(name)) treatMap.set(name, n(r.TreatmentPrice) ?? 0); }
  await prisma.treatment.createMany({ data: [...treatMap].map(([name, defaultPrice]) => ({ name, defaultPrice })), skipDuplicates: true });
  log(`  treatments                       → ${treatMap.size}`);

  // ── 2. drug catalog ───────────────────────────────────────
  log("\n[2] Drug catalog");
  const drugData = rows("tbl_Drugs").map((r) => ({
    id: n(r.DrugID)!, manufacturer: s(r.Manufacturer), brandName: s(r.BrandName),
    genericName: s(r.GenericName), strength: s(r.Strength), dosageForm: s(r.DosagesForm),
  })).filter((x) => x.id);
  for (const part of chunk(drugData, 5000)) await prisma.drug.createMany({ data: part, skipDuplicates: true });
  log(`  drugs                            → ${drugData.length}`);

  // ── 3. persons, doctors, and the preserved users ──────────
  log("\n[3] Staff");
  const personRows = rows("tbl_Persons");
  await prisma.person.createMany({ data: personRows.map((r) => ({
    id: n(r.PersonID)!, fullName: s(r.PersonFullName) ?? "(unknown)", nickName: s(r.PersonNickName),
    primaryPhone: s(r.PersonPrimaryPhone), secondaryPhone: s(r.PersonSecondaryPhone),
    address: s(r.PersonAddress), email: s(r.PersonEmailAddress),
    dob: d(r.PersonDOB) ?? d(r.DateOfBirth), gender: s(r.PersonGender),
    maritalStatus: s(r.PersonMaritalStatus), nid: s(r.PersonNID), note: s(r.Note),
    activeStatus: true,
  })) });

  const doctorRows = rows("tbl_Doctors");
  const pctKeys = Object.keys(doctorRows[0] ?? {}).filter((k) => /Percent$/.test(k));
  await prisma.doctor.createMany({ data: doctorRows.map((r) => ({
    id: n(r.DoctorID)!, personId: n(r.PersonID)!, isOwner: b(r.IsOwner),
    degree: s(r.Degree), designation1: s(r.Designation1st), designation2: s(r.Designation2nd),
    clinicName: s(r.ClinicName), institute: s(r.Inistitute), session: s(r.Session),
    // legacy RegNo arrives as a float string ("5800.0"); it is a registration number
    regNo: s(r.RegNo)?.replace(/\.0+$/, "") ?? null,
    activeStatus: s(r.ActiveStatus), labBillReductionMethod: s(r.LabBillReductionMethods),
    revenueShare: Object.fromEntries(pctKeys.map((k) => [k, f(r[k])])) as Prisma.InputJsonValue,
    note: s(r.Note),
  })) });
  const doctorIds = new Set(doctorRows.map((r) => n(r.DoctorID)!));
  log(`  persons=${personRows.length} doctors=${doctorIds.size}`);

  // Re-attach each preserved user to the Barishal person of the same name. A user
  // with no counterpart (someone added in the app, not in the legacy file) keeps a
  // person record of their own so the login still resolves.
  const byName = new Map(personRows.map((r) => [normName(s(r.PersonFullName) ?? ""), n(r.PersonID)!]));
  let nextPersonId = Math.max(0, ...personRows.map((r) => n(r.PersonID) ?? 0)) + 1;
  for (const u of keptUsers) {
    let personId = byName.get(normName(u.person.fullName));
    // Fall back to the username itself: "nayeem" identifies the person whose name
    // ends in Nayeem, which is how these accounts were named in the first place.
    if (!personId) {
      const uname = normName(u.username);
      const hits = personRows.filter((r) => normName(s(r.PersonFullName) ?? "").includes(uname));
      if (uname.length >= 4 && hits.length === 1) personId = n(hits[0].PersonID)!;
    }
    if (!personId) {
      personId = nextPersonId++;
      await prisma.person.create({ data: {
        id: personId, fullName: u.person.fullName, nickName: u.person.nickName,
        primaryPhone: u.person.primaryPhone, email: u.person.email, activeStatus: true,
      } });
      log(`  ! "${u.username}" (${u.person.fullName}) has no Barishal record — person ${personId} kept`);
    }
    await prisma.user.create({ data: {
      id: u.id, personId, username: u.username, passwordHash: u.passwordHash,
      role: u.role, activeStatus: u.activeStatus, needsPasswordReset: u.needsPasswordReset,
      createdAt: u.createdAt,
    } });
    log(`  user "${u.username}" → person ${personId} (${personRows.find((r) => n(r.PersonID) === personId)?.PersonFullName ?? u.person.fullName})`);
  }
  for (const c of keptCalendars) {
    if (keptUsers.some((u) => u.id === c.userId)) {
      await prisma.calendarConnection.create({ data: { ...c } });
    }
  }

  // ── 4. patients ───────────────────────────────────────────
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
      photoPath: s(r.PatientPhotoPath), photoUrl: s(r.PatientPhotoURL), lifetimeDiscount: pct(r.PatientLifeTimeDiscount),
      medicalHistory: s(r.PatientMedicalHistory), drugHistory: s(r.PatientDrugHistory), note: s(r.PatientNote),
      consultantDoctorId: resolved,
    };
  }).filter((x) => x.id);
  for (const part of chunk(patientData, 2000)) await prisma.patient.createMany({ data: part });
  const patientIds = new Set(patientData.map((p) => p.id));
  log(`  patients                         → ${patientData.length} (${orphanConsultant} consultant refs unresolved → null)`);

  // ── 5. treatment cases → lines → payments ─────────────────
  log("\n[5] Treatment cases, lines, payments");
  const caseRows = rows("tbl_PatientTreatmentCases").filter((r) => patientIds.has(n(r.PatientID)!));
  await prisma.treatmentCase.createMany({ data: caseRows.map((r) => ({
    id: n(r.TreatmentCaseID)!, patientId: n(r.PatientID)!, name: s(r.CaseName),
    description: s(r.CaseDescription), status: s(r.CaseStatus), notes: s(r.Notes),
  })) });
  const caseIds = new Set(caseRows.map((r) => n(r.TreatmentCaseID)!));
  const lineRows = rows("tbl_PatientTreatmentDetails").filter((r) => caseIds.has(n(r.TreatmentCaseID)!));
  for (const part of chunk(lineRows, 2000)) {
    await prisma.treatmentLine.createMany({ data: part.map((r) => ({
      id: n(r.TreatmentDetailID)!, caseId: n(r.TreatmentCaseID)!,
      operatingDoctorId: doctorIds.has(n(r.OTDrID)!) ? n(r.OTDrID) : null,
      treatmentDate: d(r.TreatmentDate), treatmentName: s(r.TreatmentName), description: s(r.TreatmentDescription),
      totalAmount: n(r.TotalAmount) ?? 0, discountPercent: pct(r.DiscountPercent),
      afterDiscountAmount: n(r.AfterDiscountAmount) ?? 0, amountPaid: n(r.AmountPaid) ?? 0, note: s(r.Note),
    })) });
  }
  // The legacy file records only a running total per line, not individual receipts,
  // so each paid line becomes one payment dated to the treatment. A negative total is
  // a refund and gets a row too — skipping it would leave the payments ledger ৳2,000
  // adrift from the line totals it is supposed to explain.
  const payData = lineRows.filter((r) => (n(r.AmountPaid) ?? 0) !== 0).map((r) => ({
    treatmentLineId: n(r.TreatmentDetailID)!, amount: n(r.AmountPaid)!,
    paidAt: d(r.TreatmentDate) ?? new Date(0), method: "migrated",
  }));
  for (const part of chunk(payData, 2000)) await prisma.payment.createMany({ data: part });
  log(`  cases=${caseRows.length} lines=${lineRows.length} payments=${payData.length}`);

  // ── 6. appointments ───────────────────────────────────────
  log("\n[6] Appointments");
  const apptRows = rows("tbl_Appointments").filter((r) => patientIds.has(n(r.PatientID)!));
  for (const part of chunk(apptRows, 2000)) {
    await prisma.appointment.createMany({ data: part.map((r) => ({
      id: n(r.AppointmentID)!, patientId: n(r.PatientID)!,
      doctorId: doctorIds.has(n(r.DrID)!) ? n(r.DrID) : null,
      allocatedUnit: s(r.AllocatedUnit), statusCode: n(r.AppointmentStatusID),
      status: LEGACY_STATUS_BY_CODE[n(r.AppointmentStatusID) ?? -1] ?? null,
      appointmentDate: d(r.AppointmentDate),
      startsAt: combine(r.AppointmentDate, r.AppointmentStartTime),
      endsAt: combine(r.AppointmentDate, r.AppointmentEndTime),
      smsSent: b(r.IsAppointSmsSend), note: s(r.Note), gcalId: s(r.GCalendarID),
    })) });
  }
  log(`  appointments                     → ${apptRows.length}`);

  // ── 7. prescriptions (inline drugs unpivoted) ─────────────
  log("\n[7] Prescriptions & Rx library");
  const rxRows = rows("tbl_Prescriptions");
  for (const part of chunk(rxRows, 1000)) {
    await prisma.prescription.createMany({ data: part.map((r) => ({
      id: n(r.PrescriptionID)!,
      patientId: patientIds.has(n(r.PatientID)!) ? n(r.PatientID) : null,
      dentistId: doctorIds.has(n(r.RxDentistID)!) ? n(r.RxDentistID) : null,
      rxDate: d(r.RxDate),
      // Barishal's paper-form field names → the model's clinical fields
      complaints: s(r["C/C"]),
      medicalHistory: s(r["H/O"]),
      findingsOnExamination: s(r["O/E"]),
      provisionalDiagnosis: s(r.Diagnosis),
      investigationAdvised: s(r.Investigation),
      treatmentPlan: s(r.TreatmentPlan),
      procedurePerformed: s(r.TreatmentDone),
      advise: s(r.Advice),
      note: s(r.Note),
      randomName: s(r.RandomName), randomAge: s(r.RandomAge), randomSex: s(r.RandomSex),
    })) });
  }
  // Ten fixed slots per prescription become ordered child rows. A gap in the middle
  // (Drug1 and Drug3 filled, Drug2 blank) must not shift the ones after it, so the
  // slot number drives sortOrder rather than a running counter.
  const rxIds = new Set(rxRows.map((r) => n(r.PrescriptionID)!));
  const rxDrugs: Prisma.PrescriptionDrugCreateManyInput[] = [];
  for (const r of rxRows) {
    const pid = n(r.PrescriptionID)!;
    if (!rxIds.has(pid)) continue;
    for (let i = 1; i <= 10; i++) {
      const drug = s(r[`Drug${i}`]);
      if (!drug) continue;
      rxDrugs.push({
        prescriptionId: pid, sortOrder: i, drug,
        dose: s(r[`Drug${i}Dose`]), duration: s(r[`Drug${i}Duration`]), meal: s(r[`Drug${i}Meal`]),
      });
    }
  }
  for (const part of chunk(rxDrugs, 2000)) await prisma.prescriptionDrug.createMany({ data: part });

  await prisma.rxSnippet.createMany({ data: rows("tbl_PrescriptionSider").map((r) => ({
    id: n(r.PrescriptionSiderID)!, complaints: s(r["C/C"]), medicalHistory: s(r.MedicalHistory),
    previousDentalHistory: s(r["H/O"]), diagnosis: s(r.Diagnosis),
    investigationAdvised: s(r.Investigation), treatment: s(r.TreatmentPlan),
    adviseHeader: s(r.AdviceHeader), advise: s(r.Advice),
    drugDoseSortOrder: n(r.DrugDoseSortOrder), drugDose: s(r.DrugDose),
    drugDurationSortOrder: n(r.DrugDurationSortOrder), drugDuration: s(r.DrugDuration),
    drugMealSortOrder: n(r.DrugMealSortOrder), drugMeal: s(r.DrugMeal),
  })) });

  // Barishal templates are a name plus the same ten inline drug slots.
  const tplRows = rows("tbl_PrescriptionTemplates");
  await prisma.rxTemplate.createMany({ data: tplRows.map((r) => ({
    id: n(r.PrescriptionTemplateID)!, name: s(r.PrescriptionTemplateName) ?? "(template)",
  })) });
  const tplDrugs: Prisma.RxTemplateDrugCreateManyInput[] = [];
  for (const r of tplRows) {
    const tid = n(r.PrescriptionTemplateID)!;
    for (let i = 1; i <= 10; i++) {
      const drug = s(r[`Drug${i}`]);
      if (!drug) continue;
      tplDrugs.push({
        templateId: tid, sortOrder: i, drug,
        dose: s(r[`Drug${i}Dose`]), duration: s(r[`Drug${i}Duration`]), meal: s(r[`Drug${i}Meal`]),
      });
    }
  }
  if (tplDrugs.length) await prisma.rxTemplateDrug.createMany({ data: tplDrugs });
  log(`  prescriptions=${rxRows.length} rxDrugs=${rxDrugs.length} snippets=${rows("tbl_PrescriptionSider").length} templates=${tplRows.length} templateDrugs=${tplDrugs.length}`);

  // ── 8. letterhead, labs, vendors, products ────────────────
  log("\n[8] Letterhead & directories");
  await prisma.documentTemplate.createMany({ data: rows("tbl_PrintDoc").map((r) => ({
    id: n(r.PrintDocID)!, docName: s(r.DocName) ?? "(doc)", heading1: s(r.DocHeading1),
    heading2: s(r.DocHeading2), heading3: s(r.DocHeading3), heading4: s(r.DocHeading4),
    heading5: s(r.DocHeading5), heading6: s(r.DocHeading6), heading7: s(r.DocHeading7),
    heading8: s(r.DocHeading8), heading9: s(r.DocHeading9), footer: s(r.DocFooter),
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
  await prisma.product.createMany({ data: rows("tbl_Products").map((r) => ({
    id: n(r.ProductID)!, name: s(r.ProductName) ?? "(product)", category: s(r.ProductCategory),
    reorderLevel: n(r.MinReqQty) ?? 0, note: s(r.ProductDescription) ?? s(r.Note),
  })) });
  log(`  letterhead=${rows("tbl_PrintDoc").length} labs=${rows("tbl_LabDetails").length} vendors=${rows("tbl_Vendors").length} products=${rows("tbl_Products").length}`);

  // ── 9. stock, lab work, expenses, connections, sms history ─
  log("\n[9] Operational history");
  const poRows = rows("tbl_PurchaseOrders");
  const poDate = new Map(poRows.map((r) => [n(r.PurchaseOrderID)!, d(r.ReceivedDate) ?? d(r.SubmittedDate)]));
  const productIds = new Set(rows("tbl_Products").map((r) => n(r.ProductID)!));
  // There is no purchase-order model, so each received line is kept as the stock
  // movement it caused — the quantities survive even though the order header cannot.
  const moves = rows("tbl_PurchaseOrderDetails")
    .filter((r) => productIds.has(n(r.ProductID)!) && (n(r.Quantity) ?? 0) > 0)
    .map((r) => ({
      productId: n(r.ProductID)!, delta: n(r.Quantity)!,
      reason: `Purchase order #${s(r.PurchaseOrderID) ?? "?"}`,
      at: poDate.get(n(r.PurchaseOrderID)!) ?? new Date(0),
    }));
  if (moves.length) await prisma.stockMovement.createMany({ data: moves });
  for (const [productId, delta] of moves.reduce((m, x) => m.set(x.productId, (m.get(x.productId) ?? 0) + x.delta), new Map<number, number>())) {
    await prisma.product.update({ where: { id: productId }, data: { quantity: delta } });
  }

  const labIds = new Set(rows("tbl_LabDetails").map((r) => n(r.LabID)!));
  const casePatient = new Map(caseRows.map((r) => [n(r.TreatmentCaseID)!, n(r.PatientID)!]));
  const labWork = rows("tbl_LabWork")
    .filter((r) => labIds.has(n(r.LabID)!) && casePatient.has(n(r.TreatmentCaseID)!))
    .map((r) => ({
      id: n(r.LabWorkID)!, patientId: casePatient.get(n(r.TreatmentCaseID)!)!, labId: n(r.LabID)!,
      workType: s(r.CrownType), toothFdi: s(r.CrownNumber), shade: s(r.ColorShade),
      sentAt: d(r.WorkDate), status: s(r.WorkStatus) ?? "SENT", cost: n(r.TotalAmount) ?? 0, note: s(r.Notes),
    }));
  if (labWork.length) await prisma.labOrder.createMany({ data: labWork });

  const expenses = [...rows("tbl_ExpenseDaily"), ...rows("tbl_ExpenseMonthly")]
    .map((r) => ({ date: d(r.ExpenseDate), category: s(r.ExpenseName), amount: n(r.ExpenseAmount) ?? 0, description: s(r.Note) }))
    .filter((x): x is { date: Date; category: string | null; amount: number; description: string | null } => x.date !== null);
  if (expenses.length) await prisma.expense.createMany({ data: expenses });

  const conns = rows("tbl_PatientConnections")
    .filter((r) => patientIds.has(n(r.Patient1ID)!))
    .map((r) => ({
      id: n(r.ConnectionID)!, patientId: n(r.Patient1ID)!,
      relatedPatientId: patientIds.has(n(r.Patient2ID)!) ? n(r.Patient2ID) : null,
      relation: s(r.RelationshipType),
    }));
  if (conns.length) await prisma.patientConnection.createMany({ data: conns });

  // Legacy SMS history: these were all sent, so they are logged as SENT with the
  // gateway's success code. Segment counts are recomputed from the text.
  const unicodeSeg = (t: string) => {
    const chars = [...t].length;
    const single = /[^\u0000-\u007F]/.test(t) ? 70 : 160;
    const multi = /[^\u0000-\u007F]/.test(t) ? 67 : 153;
    return chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  };
  const smsLogs = rows("tbl_PatientSmsLogs")
    .filter((r) => s(r.SmsMessage))
    .map((r) => ({
      patientId: patientIds.has(n(r.PatientID)!) ? n(r.PatientID) : null,
      phone: s(r.SmsPhone) ?? "", body: s(r.SmsMessage)!, templateKey: s(r.SmsType),
      status: "SENT", gatewayCode: "202", segments: unicodeSeg(s(r.SmsMessage)!),
      sentAt: d(r.SmsDate) ?? new Date(0),
    }));
  for (const part of chunk(smsLogs, 2000)) await prisma.smsLog.createMany({ data: part });
  log(`  stock=${moves.length} labOrders=${labWork.length} expenses=${expenses.length} connections=${conns.length} smsHistory=${smsLogs.length}`);
  if (poRows.length) log(`  ! ${poRows.length} purchase-order headers have no model — only their stock movements were kept`);

  // ── 10. patient timeline ──────────────────────────────────
  log("\n[10] Patient timeline");
  const events: Prisma.PatientEventCreateManyInput[] = [];
  for (const a of await prisma.appointment.findMany())
    events.push({ patientId: a.patientId, eventType: "appointment", refId: a.id, occurredAt: a.startsAt ?? a.appointmentDate ?? new Date(0), summary: `Appointment (${a.allocatedUnit ?? "unit"})` });
  for (const l of await prisma.treatmentLine.findMany({ include: { case: true } }))
    events.push({ patientId: l.case.patientId, eventType: "treatment", refId: l.id, occurredAt: l.treatmentDate ?? new Date(0), summary: `${l.treatmentName ?? "Treatment"} — ৳${l.afterDiscountAmount} (paid ৳${l.amountPaid})` });
  for (const p of await prisma.prescription.findMany({ where: { patientId: { not: null } } }))
    events.push({ patientId: p.patientId!, eventType: "prescription", refId: p.id, occurredAt: p.rxDate ?? new Date(0), summary: "Prescription issued" });
  for (const part of chunk(events, 5000)) await prisma.patientEvent.createMany({ data: part });
  log(`  timeline events                  → ${events.length}`);

  // ── 11. sequences + stats ─────────────────────────────────
  for (const t of ["Person", "Doctor", "User", "Patient", "Drug", "TreatmentCase", "TreatmentLine",
    "Payment", "Appointment", "Prescription", "PrescriptionDrug", "RxSnippet", "RxTemplate",
    "RxTemplateDrug", "DocumentTemplate", "Lab", "LabOrder", "Vendor", "Product", "StockMovement",
    "Expense", "PatientConnection", "PatientEvent", "SmsLog"]) await bumpSeq(t);
  await prisma.$executeRawUnsafe("ANALYZE");
  log("\nSequences bumped, stats refreshed. Import complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
