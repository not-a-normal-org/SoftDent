import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { afterDiscountClient } from "./billing-math";
import { patientSearchSql } from "./patients";
import { sqlInstant } from "./sql";
import { rangeBounds, type DateRange } from "./date-range";

export const afterDiscount = afterDiscountClient;

export function getCase(id: number) {
  return prisma.treatmentCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, fullName: true } },
      lines: {
        orderBy: [{ treatmentDate: "asc" }, { id: "asc" }],
        include: {
          operatingDoctor: { include: { person: true } },
          payments: { orderBy: { paidAt: "desc" } },
        },
      },
    },
  });
}

export function getLine(id: number) {
  return prisma.treatmentLine.findUnique({ where: { id }, include: { case: true } });
}

/** Clinic letterhead for the printed invoice (legacy tbl_PrintDoc → "Invoice"). */
export const getInvoiceDoc = () => prisma.documentTemplate.findFirst({ where: { docName: "Invoice" } });

/** A case with everything needed to render its invoice. */
export function getCaseForInvoice(id: number) {
  return prisma.treatmentCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, fullName: true, primaryPhone: true, address: true } },
      lines: { orderBy: [{ treatmentDate: "asc" }, { id: "asc" }], include: { operatingDoctor: { include: { person: true } } } },
    },
  });
}

export async function getBillingEditorData() {
  const [treatments, doctors] = await Promise.all([
    prisma.treatment.findMany({ orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
  ]);
  return {
    treatments: treatments.map((t) => ({ name: t.name, price: t.defaultPrice })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
  };
}

export const PAYMENTS_PAGE_SIZE = 50;

/**
 * The billing tab's headline figures, split by what a date range can mean for them.
 *
 * Billed and collected are activity — treatment done and money received on given
 * days — so they follow the range. Outstanding is a debt that builds up across visits;
 * "outstanding today" would show only what today's visits left unpaid and hide every
 * older debt, so it stays all-time, like the patient-balances table.
 *
 * Collected is summed from Payment rows by `paidAt`, the same source /finance uses.
 * The import reconciles exactly (every line's `amountPaid` equals the sum of its
 * payments), so over all time this agrees with the per-line totals.
 */
export async function getBillingOverview(range: DateRange, paymentsPage = 1) {
  const { start, end } = rangeBounds(range);
  const paidIn = { paidAt: { gte: start, lt: end } };
  const [billedIn, collectedIn, allTime] = await Promise.all([
    prisma.treatmentLine.aggregate({ where: { treatmentDate: { gte: start, lt: end } }, _sum: { afterDiscountAmount: true } }),
    prisma.payment.aggregate({ where: paidIn, _sum: { amount: true }, _count: true }),
    prisma.treatmentLine.aggregate({ _sum: { afterDiscountAmount: true, amountPaid: true } }),
  ]);
  // counted first so a page past the end (a bookmark from a busier range) lands on the last page
  const total = collectedIn._count;
  const pages = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, paymentsPage), pages);
  const rows = await prisma.payment.findMany({
    where: paidIn,
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAYMENTS_PAGE_SIZE,
    take: PAYMENTS_PAGE_SIZE,
    include: { treatmentLine: { include: { case: { include: { patient: { select: { id: true, fullName: true } } } } } } },
  });
  return {
    billed: billedIn._sum.afterDiscountAmount ?? 0,
    collected: collectedIn._sum.amount ?? 0,
    due: (allTime._sum.afterDiscountAmount ?? 0) - (allTime._sum.amountPaid ?? 0),
    payments: { rows, total, page, pages },
  };
}

// ── patient balances: the billing tab's full, paged list ──────────────────────
// Every patient with anything billed, one row each, with what they were billed, what
// they paid, what they owe, and when they were last treated. It replaces a list that
// stopped at the 50 largest dues, which hid everyone below the fiftieth.

export const BALANCE_SORTS = ["due", "billed", "paid", "lastVisit", "name", "id"] as const;
export type BalanceSort = (typeof BALANCE_SORTS)[number];
export const BALANCE_STATUSES = ["dues", "all", "paid", "credit"] as const;
export type BalanceStatus = (typeof BALANCE_STATUSES)[number];
export const BALANCE_PERIODS = ["any", "30d", "90d", "1y", "older"] as const;
export type BalancePeriod = (typeof BALANCE_PERIODS)[number];
export const BALANCE_PAGE_SIZE = 50;

export type BalanceRow = {
  id: number; fullName: string; primaryPhone: string | null;
  billed: number; paid: number; due: number; lastVisit: Date | null;
};

// Column names cannot be bound as parameters, so the sort comes from this fixed map
// and nothing the visitor typed ever reaches the ORDER BY as text.
const SORT_SQL: Record<BalanceSort, Prisma.Sql> = {
  due: Prisma.sql`due`,
  billed: Prisma.sql`billed`,
  paid: Prisma.sql`paid`,
  lastVisit: Prisma.sql`"lastVisit"`,
  name: Prisma.sql`lower("fullName")`,
  id: Prisma.sql`id`,
};

const STATUS_SQL: Record<BalanceStatus, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  dues: Prisma.sql`due > 0`,
  paid: Prisma.sql`due = 0`,
  // paid more than was billed: money the clinic is holding for the patient
  credit: Prisma.sql`due < 0`,
};

const DAY = 86_400_000;
function periodSql(period: BalancePeriod): Prisma.Sql {
  const now = Date.now();
  switch (period) {
    case "30d": return Prisma.sql`"lastVisit" >= ${sqlInstant(new Date(now - 30 * DAY))}`;
    case "90d": return Prisma.sql`"lastVisit" >= ${sqlInstant(new Date(now - 90 * DAY))}`;
    case "1y": return Prisma.sql`"lastVisit" >= ${sqlInstant(new Date(now - 365 * DAY))}`;
    // not seen for a year — the dues least likely to be collected without a call
    case "older": return Prisma.sql`("lastVisit" < ${sqlInstant(new Date(now - 365 * DAY))} OR "lastVisit" IS NULL)`;
    default: return Prisma.sql`TRUE`;
  }
}

type BalanceCounts = { [K in BalanceStatus]: number } & { [K in `${BalanceStatus}Due`]: number };

export async function listPatientBalances(opts: {
  q: string; status: BalanceStatus; period: BalancePeriod; sort: BalanceSort; dir: "asc" | "desc"; page: number;
}) {
  const agg = Prisma.sql`
    SELECT p.id, p."fullName", p."primaryPhone",
           SUM(l."afterDiscountAmount")::int                  AS billed,
           SUM(l."amountPaid")::int                           AS paid,
           SUM(l."afterDiscountAmount" - l."amountPaid")::int AS due,
           MAX(l."treatmentDate")                             AS "lastVisit"
    FROM "Patient" p
    JOIN "TreatmentCase" c ON c."patientId" = p.id
    JOIN "TreatmentLine" l ON l."caseId" = c.id
    WHERE ${patientSearchSql(opts.q)}
    GROUP BY p.id, p."fullName", p."primaryPhone"`;
  const period = periodSql(opts.period);
  const dir = opts.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  // Each status tab's count and outstanding sum, under the same search and period: the
  // tabs show the counts and the selected tab's sum heads the table. Fetched before
  // the rows because they fix how many pages exist, so a page past the end — a
  // bookmark kept after dues were paid off — lands on the last page, not an empty one.
  const [counts] = await prisma.$queryRaw<BalanceCounts[]>`
      WITH agg AS (${agg})
      SELECT COUNT(*)::int                                          AS "all",
             COUNT(*) FILTER (WHERE due > 0)::int                   AS dues,
             COUNT(*) FILTER (WHERE due = 0)::int                   AS paid,
             COUNT(*) FILTER (WHERE due < 0)::int                   AS credit,
             COALESCE(SUM(due), 0)::int                             AS "allDue",
             COALESCE(SUM(due) FILTER (WHERE due > 0), 0)::int      AS "duesDue",
             0                                                      AS "paidDue",
             COALESCE(SUM(due) FILTER (WHERE due < 0), 0)::int      AS "creditDue"
      FROM agg WHERE ${period}`;
  const pages = Math.max(1, Math.ceil(counts[opts.status] / BALANCE_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);

  const rows = await prisma.$queryRaw<BalanceRow[]>`
      WITH agg AS (${agg})
      SELECT * FROM agg
      WHERE ${STATUS_SQL[opts.status]} AND ${period}
      ORDER BY ${SORT_SQL[opts.sort]} ${dir} NULLS LAST, id ASC
      LIMIT ${BALANCE_PAGE_SIZE} OFFSET ${(page - 1) * BALANCE_PAGE_SIZE}`;

  const total = counts[opts.status];
  return {
    rows,
    total,
    totalDue: counts[`${opts.status}Due`],
    counts: { all: counts.all, dues: counts.dues, paid: counts.paid, credit: counts.credit },
    page,
    pages,
  };
}
