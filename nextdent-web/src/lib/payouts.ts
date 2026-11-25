import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CLINIC_TZ } from "./format";
import { type DayRange, type Granularity, clinicToday } from "./payout-period";

// Revenue split driven by each doctor's per-contract percentages (see data-model §7.2).
// Consultant = patient.consultantDoctor; operator = line.operatingDoctor; chamber keeps the rest.
// Split is applied to *collected* revenue (amountPaid).
//
// All-time and line-based. The payouts pages now use the payment-based figures below;
// this stays as the reference they are reconciled against (scripts/verify-payouts.ts).
// It skips lines whose amountPaid is negative (legacy refunds), which the payment-based
// figures count.
export async function getPayouts() {
  const lines = await prisma.treatmentLine.findMany({
    where: { amountPaid: { gt: 0 } },
    include: {
      case: { include: { patient: { include: { consultantDoctor: { include: { person: true } } } } } },
      operatingDoctor: { include: { person: true } },
    },
  });

  const byDoctor = new Map<number, { name: string; consultant: number; operator: number }>();
  const bump = (id: number, name: string, role: "consultant" | "operator", amt: number) => {
    const e = byDoctor.get(id) ?? { name, consultant: 0, operator: 0 };
    e[role] += amt;
    byDoctor.set(id, e);
  };

  let chamber = 0;
  let collected = 0;
  for (const l of lines) {
    const base = l.amountPaid; // lab cost isn't modelled per-line yet; deductLabBeforeSplit reserved for later
    collected += base;
    let allocated = 0;
    const cons = l.case.patient.consultantDoctor;
    const op = l.operatingDoctor;
    if (cons) { const share = Math.round((base * cons.consultantSharePct) / 100); bump(cons.id, cons.person.fullName, "consultant", share); allocated += share; }
    if (op) { const share = Math.round((base * op.operatorSharePct) / 100); bump(op.id, op.person.fullName, "operator", share); allocated += share; }
    chamber += base - allocated;
  }

  const doctors = [...byDoctor.entries()]
    .map(([id, v]) => ({ id, ...v, total: v.consultant + v.operator }))
    .sort((a, b) => b.total - a.total);

  return { doctors, chamber, collected };
}

// ── payment-based payouts: by date, per member, down to each payment ─────────────────
//
// A treatment line is paid in instalments, so its money arrives on several days. Each
// Payment row is split on its own, by the same rule as above, and dated by when it was
// paid. Every figure on the payouts pages and in the export is a sum over one CTE that
// holds one row per payment and its three parts, with chamber = amount − consultant −
// operator on every row. So for any range, doctors + chamber = collected, and days add
// up to their month and months to their year: they are the same rows, grouped coarser.
//
// Shares are rounded per payment, half away from zero, so a refund (a negative payment)
// takes back exactly the share its payment gave.

/** A doctor's id, the chamber, or everyone. */
export type PayoutMember = number | "chamber" | "all";

export function parseMember(s: string | null | undefined): PayoutMember | null {
  if (s === "chamber" || s === "all") return s;
  return /^[1-9]\d{0,8}$/.test(s ?? "") ? Number(s) : null;
}

/**
 * The clinic day a payment arrived on. `paidAt` is a `timestamp without time zone`
 * holding UTC (Prisma's convention), so it is first marked as UTC and then read in
 * the clinic's zone. The shorter `"paidAt" AT TIME ZONE 'Asia/Dhaka'` would do the
 * opposite on this column type, treating the UTC value as Dhaka wall time; every
 * legacy payment, stored at clinic midnight (18:00 UTC), would land on the day before.
 */
const CLINIC_DAY = Prisma.sql`((p."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${CLINIC_TZ}::text)::date`;

function rangeWhere(r: DayRange): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (r.from) parts.push(Prisma.sql`b.day >= ${r.from}::date`);
  if (r.to) parts.push(Prisma.sql`b.day <= ${r.to}::date`);
  return parts.length ? Prisma.join(parts, " AND ") : Prisma.sql`TRUE`;
}

/** `split`: one row per payment in the range, with the clinic day and the three parts of it. */
function splitCte(r: DayRange): Prisma.Sql {
  return Prisma.sql`
    base AS (
      SELECT p.id, p.amount, p."treatmentLineId" AS "lineId", ${CLINIC_DAY} AS day,
             l."caseId", l."treatmentName" AS procedure, c."patientId", pt."fullName" AS patient,
             cd.id AS "consId", cdp."fullName" AS "consName", cd."consultantSharePct" AS "consPct",
             od.id AS "opId", odp."fullName" AS "opName", od."operatorSharePct" AS "opPct"
      FROM "Payment" p
      JOIN "TreatmentLine" l ON l.id = p."treatmentLineId"
      JOIN "TreatmentCase" c ON c.id = l."caseId"
      JOIN "Patient" pt ON pt.id = c."patientId"
      LEFT JOIN "Doctor" cd ON cd.id = pt."consultantDoctorId"
      LEFT JOIN "Person" cdp ON cdp.id = cd."personId"
      LEFT JOIN "Doctor" od ON od.id = l."operatingDoctorId"
      LEFT JOIN "Person" odp ON odp.id = od."personId"
    ),
    split AS (
      SELECT b.*,
             COALESCE(ROUND(b.amount * b."consPct"::numeric / 100), 0)::int AS "consShare",
             COALESCE(ROUND(b.amount * b."opPct"::numeric / 100), 0)::int   AS "opShare"
      FROM base b
      WHERE ${rangeWhere(r)}
    )`;
}

/** What a member's part of a payment is, and which payments they have a part in. */
function memberSql(m: PayoutMember) {
  if (typeof m === "number") {
    const cons = Prisma.sql`(CASE WHEN s."consId" = ${m} THEN s."consShare" ELSE 0 END)`;
    const op = Prisma.sql`(CASE WHEN s."opId" = ${m} THEN s."opShare" ELSE 0 END)`;
    return { where: Prisma.sql`(s."consId" = ${m} OR s."opId" = ${m})`, cons, op, share: Prisma.sql`(${cons} + ${op})` };
  }
  const cons = Prisma.sql`s."consShare"`, op = Prisma.sql`s."opShare"`;
  const share = m === "chamber" ? Prisma.sql`(s.amount - s."consShare" - s."opShare")` : Prisma.sql`s.amount`;
  return { where: Prisma.sql`TRUE`, cons, op, share };
}

// Fixed fragments, picked by key: nothing from the URL reaches the SQL as text.
const BUCKET_SQL: Record<Granularity, Prisma.Sql> = {
  year: Prisma.sql`date_trunc('year', s.day::timestamp)::date`,
  month: Prisma.sql`date_trunc('month', s.day::timestamp)::date`,
  day: Prisma.sql`s.day`,
};
export const PAYMENT_SORTS = ["date", "patient", "amount", "share"] as const;
export type PaymentSort = (typeof PAYMENT_SORTS)[number];
const PAYMENT_SORT_SQL: Record<PaymentSort, Prisma.Sql> = {
  date: Prisma.sql`s.day`,
  patient: Prisma.sql`lower(s.patient)`,
  amount: Prisma.sql`s.amount`,
  share: Prisma.sql`share`,
};
const DIR_SQL = { asc: Prisma.sql`ASC`, desc: Prisma.sql`DESC` } as const;
export type SortDir = keyof typeof DIR_SQL;

// ── who the member is ──

export type PayoutMemberInfo =
  | { kind: "doctor"; id: number; personId: number; name: string; consultantSharePct: number; operatorSharePct: number; deductLabBeforeSplit: boolean }
  | { kind: "chamber"; name: string }
  | { kind: "all"; name: string };

export const CHAMBER_NAME = "Chamber (clinic)";

export async function getPayoutMember(m: PayoutMember): Promise<PayoutMemberInfo | null> {
  if (m === "chamber") return { kind: "chamber", name: CHAMBER_NAME };
  if (m === "all") return { kind: "all", name: "Everyone" };
  const d = await prisma.doctor.findUnique({ where: { id: m }, include: { person: true } });
  if (!d) return null;
  return {
    kind: "doctor", id: d.id, personId: d.personId, name: d.person.fullName,
    consultantSharePct: d.consultantSharePct, operatorSharePct: d.operatorSharePct, deductLabBeforeSplit: d.deductLabBeforeSplit,
  };
}

/** Every doctor, for the export dialog's member list. */
export const listPayoutDoctors = () =>
  prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } })
    .then((ds) => ds.map((d) => ({ id: d.id, name: d.person.fullName })));

// ── one range, every member ──

export type DoctorPayout = {
  id: number; name: string; consultantSharePct: number; operatorSharePct: number;
  consultant: number; operator: number; total: number; payments: number;
};

export type PayoutTotals = {
  payments: number; collected: number; doctors: number; chamber: number;
  refunds: number; refundAmount: number;
  /** dated after today on the clinic's calendar: almost certainly a typo in the date */
  future: number; futureAmount: number;
};

export async function getPayoutSummary(range: DayRange): Promise<{ doctors: DoctorPayout[]; totals: PayoutTotals }> {
  const today = clinicToday();
  const [doctors, [totals]] = await Promise.all([
    prisma.$queryRaw<DoctorPayout[]>`
      WITH ${splitCte(range)},
      ledger AS (
        SELECT s.id, s."consId" AS "doctorId", 'consultant' AS role, s."consShare" AS share FROM split s WHERE s."consId" IS NOT NULL
        UNION ALL
        SELECT s.id, s."opId", 'operator', s."opShare" FROM split s WHERE s."opId" IS NOT NULL
      )
      SELECT d.id, pr."fullName" AS name, d."consultantSharePct", d."operatorSharePct",
             COALESCE(SUM(l.share) FILTER (WHERE l.role = 'consultant'), 0)::int AS consultant,
             COALESCE(SUM(l.share) FILTER (WHERE l.role = 'operator'), 0)::int   AS operator,
             SUM(l.share)::int                                                   AS total,
             COUNT(DISTINCT l.id)::int                                           AS payments
      FROM ledger l
      JOIN "Doctor" d ON d.id = l."doctorId"
      JOIN "Person" pr ON pr.id = d."personId"
      GROUP BY d.id, pr."fullName"
      ORDER BY total DESC, d.id ASC`,
    prisma.$queryRaw<PayoutTotals[]>`
      WITH ${splitCte(range)}
      SELECT COUNT(*)::int                                                         AS payments,
             COALESCE(SUM(s.amount), 0)::int                                       AS collected,
             COALESCE(SUM(s."consShare" + s."opShare"), 0)::int                    AS doctors,
             COALESCE(SUM(s.amount - s."consShare" - s."opShare"), 0)::int         AS chamber,
             COUNT(*) FILTER (WHERE s.amount < 0)::int                             AS refunds,
             COALESCE(SUM(s.amount) FILTER (WHERE s.amount < 0), 0)::int           AS "refundAmount",
             COUNT(*) FILTER (WHERE s.day > ${today}::date)::int                   AS future,
             COALESCE(SUM(s.amount) FILTER (WHERE s.day > ${today}::date), 0)::int AS "futureAmount"
      FROM split s`,
  ]);
  return { doctors, totals };
}

// ── one member, period by period ──

export type PayoutBucket = {
  /** first day of the period: "2026-03-01" for March 2026 */
  key: string;
  payments: number;
  /** the payments this member has a part in */
  collected: number;
  consultant: number;
  operator: number;
  /** the chamber's part of the same payments */
  chamber: number;
  /** this member's part: consultant + operator for a doctor, the chamber's for the chamber, everything for everyone */
  share: number;
  future: boolean;
};

/** A member's whole range in one row: the same sums as the breakdown, ungrouped. */
export async function getPayoutMemberTotals(range: DayRange, member: PayoutMember): Promise<Omit<PayoutBucket, "key">> {
  const m = memberSql(member);
  const today = clinicToday();
  const [row] = await prisma.$queryRaw<Omit<PayoutBucket, "key">[]>`
    WITH ${splitCte(range)}
    SELECT COUNT(*)::int                                                   AS payments,
           COALESCE(SUM(s.amount), 0)::int                                 AS collected,
           COALESCE(SUM(${m.cons}), 0)::int                                AS consultant,
           COALESCE(SUM(${m.op}), 0)::int                                  AS operator,
           COALESCE(SUM(s.amount - s."consShare" - s."opShare"), 0)::int   AS chamber,
           COALESCE(SUM(${m.share}), 0)::int                               AS share,
           COALESCE(bool_or(s.day > ${today}::date), false)                AS future
    FROM split s
    WHERE ${m.where}`;
  return row;
}

export const DAY_PAGE_SIZE = 62;

/**
 * A member's payout per year, month or day of the range. Years and months come whole;
 * days are paged on screen, as all-time by day runs to thousands of rows (`unpaged`
 * is for the export and the checks).
 */
export async function getPayoutBreakdown(
  range: DayRange, member: PayoutMember, by: Granularity,
  opts: { dir?: SortDir; page?: number; unpaged?: boolean } = {},
) {
  const m = memberSql(member);
  const today = clinicToday();
  const dir = DIR_SQL[opts.dir ?? "desc"];
  const bucket = BUCKET_SQL[by];
  const paged = by === "day" && !opts.unpaged;

  let page = 1, pages = 1, count: number | null = null;
  if (paged) {
    const [c] = await prisma.$queryRaw<{ n: number }[]>`
      WITH ${splitCte(range)} SELECT COUNT(DISTINCT s.day)::int AS n FROM split s WHERE ${m.where}`;
    count = c.n;
    pages = Math.max(1, Math.ceil(count / DAY_PAGE_SIZE));
    page = Math.min(Math.max(1, opts.page ?? 1), pages);
  }
  const limit = paged ? Prisma.sql`LIMIT ${DAY_PAGE_SIZE} OFFSET ${(page - 1) * DAY_PAGE_SIZE}` : Prisma.empty;

  const rows = await prisma.$queryRaw<PayoutBucket[]>`
    WITH ${splitCte(range)}
    SELECT to_char(${bucket}, 'YYYY-MM-DD')                       AS key,
           COUNT(*)::int                                          AS payments,
           SUM(s.amount)::int                                     AS collected,
           SUM(${m.cons})::int                                    AS consultant,
           SUM(${m.op})::int                                      AS operator,
           SUM(s.amount - s."consShare" - s."opShare")::int       AS chamber,
           SUM(${m.share})::int                                   AS share,
           bool_or(s.day > ${today}::date)                        AS future
    FROM split s
    WHERE ${m.where}
    GROUP BY 1
    ORDER BY 1 ${dir}
    ${limit}`;
  return { rows, page, pages, count: count ?? rows.length };
}

// ── the payments behind a figure ──

export type PayoutPaymentRow = {
  id: number; day: string; amount: number;
  patientId: number; patient: string; caseId: number; lineId: number; procedure: string | null; teeth: string | null;
  consId: number | null; consName: string | null; consPct: number | null; consShare: number;
  opId: number | null; opName: string | null; opPct: number | null; opShare: number;
  chamber: number;
  /** the member's part of this payment */
  share: number;
};

export const PAYMENT_PAGE_SIZE = 50;

const paymentSelect = (m: ReturnType<typeof memberSql>) => Prisma.sql`
  SELECT s.id, to_char(s.day, 'YYYY-MM-DD') AS day, s.amount,
         s."patientId", s.patient, s."caseId", s."lineId", s.procedure,
         (SELECT string_agg(t."toothFdi", ' ' ORDER BY t."toothFdi") FROM "TreatmentLineTooth" t WHERE t."treatmentLineId" = s."lineId") AS teeth,
         s."consId", s."consName", s."consPct", s."consShare",
         s."opId", s."opName", s."opPct", s."opShare",
         (s.amount - s."consShare" - s."opShare")::int AS chamber,
         (${m.share})::int AS share
  FROM split s
  WHERE ${m.where}`;

export async function listPayoutPayments(
  range: DayRange, member: PayoutMember,
  opts: { sort?: PaymentSort; dir?: SortDir; page?: number } = {},
) {
  const m = memberSql(member);
  const [totals] = await prisma.$queryRaw<{ count: number; amount: number; share: number }[]>`
    WITH ${splitCte(range)}
    SELECT COUNT(*)::int AS count, COALESCE(SUM(s.amount), 0)::int AS amount, COALESCE(SUM(${m.share}), 0)::int AS share
    FROM split s WHERE ${m.where}`;
  const pages = Math.max(1, Math.ceil(totals.count / PAYMENT_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pages);
  const dir = DIR_SQL[opts.dir ?? "desc"];
  const rows = await prisma.$queryRaw<PayoutPaymentRow[]>`
    WITH ${splitCte(range)}
    SELECT * FROM (${paymentSelect(m)}) s
    ORDER BY ${PAYMENT_SORT_SQL[opts.sort ?? "date"]} ${dir} NULLS LAST, s.id ${dir}
    LIMIT ${PAYMENT_PAGE_SIZE} OFFSET ${(page - 1) * PAYMENT_PAGE_SIZE}`;
  return { rows, totals, page, pages };
}

/** Every payment in the range for the line-item export, oldest first. */
export async function allPayoutPayments(range: DayRange, member: PayoutMember) {
  const m = memberSql(member);
  return prisma.$queryRaw<PayoutPaymentRow[]>`
    WITH ${splitCte(range)}
    SELECT * FROM (${paymentSelect(m)}) s
    ORDER BY s.day ASC, s.id ASC`;
}

/** Each period's total per doctor, for the summary export's one-column-per-doctor layout. */
export async function getDoctorBuckets(range: DayRange, by: Granularity) {
  return prisma.$queryRaw<{ key: string; doctorId: number; share: number }[]>`
    WITH ${splitCte(range)},
    ledger AS (
      SELECT s.day, s."consId" AS "doctorId", s."consShare" AS share FROM split s WHERE s."consId" IS NOT NULL
      UNION ALL
      SELECT s.day, s."opId", s."opShare" FROM split s WHERE s."opId" IS NOT NULL
    )
    SELECT to_char(${BUCKET_SQL[by]}, 'YYYY-MM-DD') AS key, s."doctorId", SUM(s.share)::int AS share
    FROM ledger s
    GROUP BY 1, 2
    ORDER BY 1, 2`;
}

// ── data that needs a human ──

export type FuturePayment = { id: number; day: string; amount: number; patientId: number; patient: string; caseId: number; procedure: string | null };
export type LineMismatch = { lineId: number; caseId: number; patientId: number; patient: string; amountPaid: number; payments: number };

/**
 * Rows the payouts cannot place honestly, whatever range is on screen:
 * - payments dated after today (a mistyped year, like a 2029 that should be 2024);
 *   they are counted under the date they carry and flagged wherever they show;
 * - lines whose running `amountPaid` disagrees with the sum of their payments, so a
 *   line-based and a payment-based payout would differ for them.
 */
export async function getPayoutDataIssues() {
  const today = clinicToday();
  const [future, mismatches] = await Promise.all([
    prisma.$queryRaw<FuturePayment[]>`
      WITH ${splitCte({ from: null, to: null })}
      SELECT s.id, to_char(s.day, 'YYYY-MM-DD') AS day, s.amount, s."patientId", s.patient, s."caseId", s.procedure
      FROM split s WHERE s.day > ${today}::date
      ORDER BY s.day DESC, s.id DESC`,
    prisma.$queryRaw<LineMismatch[]>`
      SELECT l.id AS "lineId", l."caseId", c."patientId", pt."fullName" AS patient,
             l."amountPaid", COALESCE(SUM(p.amount), 0)::int AS payments
      FROM "TreatmentLine" l
      JOIN "TreatmentCase" c ON c.id = l."caseId"
      JOIN "Patient" pt ON pt.id = c."patientId"
      LEFT JOIN "Payment" p ON p."treatmentLineId" = l.id
      GROUP BY l.id, c."patientId", pt."fullName"
      HAVING l."amountPaid" <> COALESCE(SUM(p.amount), 0)
      ORDER BY l.id`,
  ]);
  return { future, mismatches };
}
