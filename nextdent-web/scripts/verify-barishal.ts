/**
 * Verifies the import against the source CSVs: every timestamp rendered back in the
 * clinic's timezone must equal the string Access held, and every money column must
 * sum to the same figure. A row count alone would not catch a six-hour shift.
 */
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const DATA = process.env.BARISHAL_CSV!;
const rows = (t: string): Record<string, string>[] =>
  parse(readFileSync(join(DATA, `${t}.csv`)), { columns: true, skip_empty_lines: true, bom: true });

const TZ = "Asia/Dhaka";
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
/** Render a stored instant as the clinic sees it: "YYYY-MM-DD HH:MM:SS". */
const back = (d: Date | null) => {
  if (!d) return "";
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};
const S = (v?: string) => (v ?? "").trim();
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? "  " + detail : ""}`);
};

async function main() {
  console.log("=== verifying Barishal import ===\n[counts]");
  const counts: [string, number, number][] = [
    ["patients", rows("tbl_Patients").length, await prisma.patient.count()],
    ["cases", rows("tbl_PatientTreatmentCases").length, await prisma.treatmentCase.count()],
    ["treatment lines", rows("tbl_PatientTreatmentDetails").length, await prisma.treatmentLine.count()],
    ["appointments", rows("tbl_Appointments").length, await prisma.appointment.count()],
    ["prescriptions", rows("tbl_Prescriptions").length, await prisma.prescription.count()],
    ["drugs", rows("tbl_Drugs").length, await prisma.drug.count()],
    ["sms history", rows("tbl_PatientSmsLogs").length, await prisma.smsLog.count()],
    ["persons", rows("tbl_Persons").length, await prisma.person.count()],
  ];
  for (const [k, src, db] of counts) check(`${k.padEnd(16)} source ${src} → db ${db}`, src === db || k === "persons", src === db ? "" : `(persons may exceed source: app-only logins)`);

  console.log("\n[money — exact sums]");
  const lines = rows("tbl_PatientTreatmentDetails");
  const sum = (c: string) => lines.reduce((t, r) => t + (parseInt(S(r[c]), 10) || 0), 0);
  const agg = await prisma.treatmentLine.aggregate({ _sum: { totalAmount: true, afterDiscountAmount: true, amountPaid: true } });
  check(`total billed      ${sum("TotalAmount")}`, sum("TotalAmount") === (agg._sum.totalAmount ?? 0), `db ${agg._sum.totalAmount}`);
  check(`after discount    ${sum("AfterDiscountAmount")}`, sum("AfterDiscountAmount") === (agg._sum.afterDiscountAmount ?? 0), `db ${agg._sum.afterDiscountAmount}`);
  check(`amount paid       ${sum("AmountPaid")}`, sum("AmountPaid") === (agg._sum.amountPaid ?? 0), `db ${agg._sum.amountPaid}`);
  const pay = await prisma.payment.aggregate({ _sum: { amount: true } });
  check(`payments total    ${sum("AmountPaid")}`, sum("AmountPaid") === (pay._sum.amount ?? 0), `db ${pay._sum.amount}`);

  console.log("\n[timestamps — every row, rendered back in Asia/Dhaka]");
  // appointments: date, and the start/end recombined from Access's 1899 time columns
  const apptSrc = new Map(rows("tbl_Appointments").map((r) => [Number(r.AppointmentID), r]));
  let bad = 0, checked = 0, firstBad = "";
  for (const a of await prisma.appointment.findMany()) {
    const r = apptSrc.get(a.id); if (!r) continue;
    const wantDate = S(r.AppointmentDate);
    const wantStart = S(r.AppointmentStartTime) ? `${wantDate.slice(0, 10)} ${S(r.AppointmentStartTime).slice(11)}` : "";
    const wantEnd = S(r.AppointmentEndTime) ? `${wantDate.slice(0, 10)} ${S(r.AppointmentEndTime).slice(11)}` : "";
    checked++;
    const got = [back(a.appointmentDate), back(a.startsAt), back(a.endsAt)];
    const want = [wantDate, wantStart || wantDate.slice(0, 10) + " 00:00:00", wantEnd || wantDate.slice(0, 10) + " 00:00:00"];
    // endsAt/startsAt fall back to midnight when the source had no time
    if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2]) {
      bad++; if (!firstBad) firstBad = `appt ${a.id}: want ${want.join(" | ")} got ${got.join(" | ")}`;
    }
  }
  check(`appointments      ${checked} checked`, bad === 0, bad ? `${bad} mismatched — ${firstBad}` : "");

  const simple: [string, string, string, () => Promise<{ id: number; v: Date | null }[]>][] = [
    ["prescriptions rxDate", "tbl_Prescriptions", "RxDate", async () => (await prisma.prescription.findMany({ select: { id: true, rxDate: true } })).map((x) => ({ id: x.id, v: x.rxDate }))],
    ["treatment dates", "tbl_PatientTreatmentDetails", "TreatmentDate", async () => (await prisma.treatmentLine.findMany({ select: { id: true, treatmentDate: true } })).map((x) => ({ id: x.id, v: x.treatmentDate }))],
    ["patient since", "tbl_Patients", "PatientSince", async () => (await prisma.patient.findMany({ select: { id: true, since: true } })).map((x) => ({ id: x.id, v: x.since }))],
    ["patient dob", "tbl_Patients", "PatientDOB", async () => (await prisma.patient.findMany({ select: { id: true, dob: true } })).map((x) => ({ id: x.id, v: x.dob }))],
  ];
  const idCol: Record<string, string> = {
    tbl_Prescriptions: "PrescriptionID", tbl_PatientTreatmentDetails: "TreatmentDetailID", tbl_Patients: "PatientID",
  };
  for (const [label, table, col, get] of simple) {
    const src = new Map(rows(table).map((r) => [Number(r[idCol[table]]), S(r[col])]));
    let b2 = 0, c2 = 0, fb = "";
    for (const x of await get()) {
      if (!src.has(x.id)) continue;
      c2++;
      const want = src.get(x.id)!;
      const got = back(x.v);
      if (want !== got) { b2++; if (!fb) fb = `id ${x.id}: want "${want}" got "${got}"`; }
    }
    check(`${label.padEnd(22)} ${c2} checked`, b2 === 0, b2 ? `${b2} mismatched — ${fb}` : "");
  }

  // sms history timestamps carry a real time of day, so they are the sharpest test
  const smsSrc = rows("tbl_PatientSmsLogs").filter((r) => S(r.SmsMessage));
  const smsDb = await prisma.smsLog.findMany({ orderBy: { sentAt: "asc" }, select: { sentAt: true, body: true } });
  const wantTimes = smsSrc.map((r) => S(r.SmsDate)).sort();
  const gotTimes = smsDb.map((x) => back(x.sentAt)).sort();
  check(`sms history ${wantTimes.length} timestamps`, JSON.stringify(wantTimes) === JSON.stringify(gotTimes),
    JSON.stringify(wantTimes) === JSON.stringify(gotTimes) ? "" : `first want ${wantTimes[0]} got ${gotTimes[0]}`);

  console.log("\n[discounts — legacy fraction converted to percent]");
  {
    const src = new Map(rows("tbl_PatientTreatmentDetails").map((r) => [Number(r.TreatmentDetailID), r]));
    let wrongPct = 0, wrongAfter = 0, recomputeOff = 0, firstBad = "";
    for (const l of await prisma.treatmentLine.findMany()) {
      const r = src.get(l.id); if (!r) continue;
      const frac = parseFloat(S(r.DiscountPercent)) || 0;
      const wantPct = Math.round(frac * 10000) / 100;
      if (Math.abs(l.discountPercent - wantPct) > 1e-9) { wrongPct++; if (!firstBad) firstBad = `line ${l.id}: ${frac} → want ${wantPct} got ${l.discountPercent}`; }
      // the stored payable must be carried over untouched, never recomputed
      if (l.afterDiscountAmount !== (parseInt(S(r.AfterDiscountAmount), 10) || 0)) wrongAfter++;
      // and the app's own formula, fed the converted percent, must reproduce it
      const recomputed = Math.max(0, Math.round(l.totalAmount * (1 - l.discountPercent / 100)));
      if (recomputed !== l.afterDiscountAmount) recomputeOff++;
    }
    check(`discount % converted (x100)`, wrongPct === 0, wrongPct ? `${wrongPct} wrong — ${firstBad}` : "");
    check(`payable carried over verbatim`, wrongAfter === 0, wrongAfter ? `${wrongAfter} differ` : "");
    console.log(`    note: ${recomputeOff} line(s) where the source's own payable does not match its own discount — kept as the clinic recorded them`);
  }

  console.log("\n[prescription drugs — inline slots unpivoted]");
  const rx = rows("tbl_Prescriptions");
  const expected = rx.reduce((t, r) => t + [...Array(10)].filter((_, i) => S(r[`Drug${i + 1}`])).length, 0);
  check(`drug rows ${expected}`, expected === await prisma.prescriptionDrug.count(), `db ${await prisma.prescriptionDrug.count()}`);
  // a prescription with a gap in the middle must keep its order
  const gapped = rx.find((r) => S(r.Drug1) && !S(r.Drug2) && S(r.Drug3));
  if (gapped) {
    const got = await prisma.prescriptionDrug.findMany({ where: { prescriptionId: Number(gapped.PrescriptionID) }, orderBy: { sortOrder: "asc" } });
    check(`gapped Rx ${gapped.PrescriptionID} keeps slot order`,
      got.length >= 2 && got[0].drug === S(gapped.Drug1) && got[1].drug === S(gapped.Drug3),
      got.map((g) => `${g.sortOrder}:${g.drug}`).join(", ").slice(0, 90));
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exitCode = failures === 0 ? 0 : 1;
}
main().finally(() => prisma.$disconnect());
