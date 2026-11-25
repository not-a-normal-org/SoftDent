import "server-only";
import { toCsv, type CsvCell } from "./csv";
import { fmtDateTime } from "./format";
import {
  type DayRange, type Granularity, bucketLabel, bucketRange, clinicToday, rangeLabel,
} from "./payout-period";
import {
  type PayoutMember, CHAMBER_NAME, allPayoutPayments, getDoctorBuckets, getPayoutBreakdown,
  getPayoutMember, getPayoutSummary,
} from "./payouts";

export type PayoutExportKind = "summary" | "detail";

const CAVEAT = "Shares are worked out with each doctor's contract as it is now. Changing a contract changes the figures for past payments too.";
const TZ_NOTE = "Dates are the day the money was paid, on the clinic's calendar (Asia/Dhaka).";

const fileRange = (r: DayRange) => (!r.from && !r.to ? "all-time" : `${r.from ?? "start"}-to-${r.to ?? "latest"}`);

/**
 * The payouts export, as the CSV text and a file name.
 *
 * - summary: one row per year, month or day, with a column for each doctor and the
 *   chamber, so a row reads across as "who got what that month". Each row's doctors
 *   plus chamber equal its collected; a total row closes the table.
 * - detail: one row per payment with all three parts of it (consultant, operator,
 *   chamber: name, %, amount), so any figure on the page can be rebuilt from it.
 *   Paid = consultant share + operator share + chamber share on every row.
 */
export async function buildPayoutCsv(opts: {
  range: DayRange; kind: PayoutExportKind; by: Granularity; member: PayoutMember;
}): Promise<{ filename: string; csv: string; rows: number }> {
  const { range, kind, by } = opts;
  const today = clinicToday();
  const notes: CsvCell[][] = [
    [],
    [`Range: ${rangeLabel(range)}`],
    [TZ_NOTE],
    [CAVEAT],
    ["Lab costs are not deducted before the split (no per-treatment lab cost is recorded yet)."],
    [`Generated ${fmtDateTime(new Date())}`],
  ];

  if (kind === "summary") {
    const [{ doctors, totals }, buckets, perDoctor] = await Promise.all([
      getPayoutSummary(range),
      getPayoutBreakdown(range, "all", by, { dir: "asc", unpaged: true }),
      getDoctorBuckets(range, by),
    ]);
    const share = new Map(perDoctor.map((r) => [`${r.key}|${r.doctorId}`, r.share]));
    const header = ["Period", "From", "To", "Payments", "Collected", ...doctors.map((d) => d.name), "Doctors total", CHAMBER_NAME, "Note"];
    const body = buckets.rows.map((b) => {
      const r = bucketRange(b.key, by);
      return [
        bucketLabel(b.key, by), r.from, r.to, b.payments, b.collected,
        ...doctors.map((d) => share.get(`${b.key}|${d.id}`) ?? 0),
        b.consultant + b.operator, b.chamber,
        b.future ? "Future-dated payment: check the date" : "",
      ];
    });
    const first = buckets.rows[0], last = buckets.rows[buckets.rows.length - 1];
    const total = [
      "Total", range.from ?? (first ? bucketRange(first.key, by).from : ""), range.to ?? (last ? bucketRange(last.key, by).to : ""),
      totals.payments, totals.collected,
      ...doctors.map((d) => d.total), totals.doctors, totals.chamber,
      totals.future ? `Includes ${totals.future} future-dated payment(s)` : "",
    ];
    return {
      filename: `payouts-summary-by-${by}-${fileRange(range)}.csv`,
      csv: toCsv([header, ...body, total, ...notes]),
      rows: body.length,
    };
  }

  const member = opts.member === "chamber" ? "all" : opts.member;
  const info = typeof member === "number" ? await getPayoutMember(member) : null;
  const rows = await allPayoutPayments(range, member);
  const pct = (n: number | null) => (n === null ? "" : n);
  // two decimals, so 100 − 33.3 − 40 prints as 26.7 and not 26.700000000000003
  const rest = (a: number | null, b: number | null) => Math.round((100 - (a ?? 0) - (b ?? 0)) * 100) / 100;
  const header = [
    "Date paid", "Payment #", "Patient #", "Patient", "Procedure", "Teeth", "Paid",
    "Consultant", "Consultant %", "Consultant share",
    "Operator", "Operator %", "Operator share",
    "Chamber %", "Chamber share",
    ...(info ? [`${info.name} share`] : []),
    "Flag",
  ];
  const body = rows.map((p) => [
    p.day, p.id, p.patientId, p.patient, p.procedure, p.teeth, p.amount,
    p.consName, pct(p.consPct), p.consId ? p.consShare : "",
    p.opName, pct(p.opPct), p.opId ? p.opShare : "",
    rest(p.consPct, p.opPct), p.chamber,
    ...(info ? [p.share] : []),
    [p.amount < 0 ? "Refund" : "", p.day > today ? "Future-dated: check the date" : ""].filter(Boolean).join("; "),
  ]);
  const sum = (f: (p: (typeof rows)[number]) => number) => rows.reduce((s, p) => s + f(p), 0);
  const total = [
    "Total", "", "", `${rows.length} payments`, "", "", sum((p) => p.amount),
    "", "", sum((p) => p.consShare), "", "", sum((p) => p.opShare), "", sum((p) => p.chamber),
    ...(info ? [sum((p) => p.share)] : []),
    "",
  ];
  const who = info ? `-doctor-${info.kind === "doctor" ? info.id : ""}` : "";
  return {
    filename: `payouts-line-items${who}-${fileRange(range)}.csv`,
    csv: toCsv([header, ...body, total, ...notes]),
    rows: body.length,
  };
}
