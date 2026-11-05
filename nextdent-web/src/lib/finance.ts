import "server-only";
import { prisma } from "./prisma";
import { CLINIC_TZ, fromDateInput } from "./format";

export type MonthBucket = {
  key: string;
  label: string;
  /** patient payments */
  collected: number;
  /** booked non-patient income */
  other: number;
  income: number;
  expense: number;
  profit: number;
};

/** One row of the ledger, whichever table it came from — `kind` says which. */
export type LedgerEntry = {
  kind: "income" | "expense";
  id: number;
  date: Date;
  category: string | null;
  description: string | null;
  amount: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RECENT = 20;

// Local to this file (format.ts exports no cached formatter): bucketing runs over every
// payment in the window, and building an Intl formatter per row is far slower than one.
const YM = new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TZ, year: "numeric", month: "2-digit" });

/**
 * Which month an instant belongs to, counted in the clinic's calendar — not the
 * host's. Expressed as a single number so month arithmetic never carries a year.
 *
 * The host is UTC (Cloud Run, the container, CI) while every date on the page is
 * rendered in Asia/Dhaka. `getMonth()` here would put a payment made at 2am on the
 * 1st in Dhaka (= 8pm on the last of the previous month, UTC) in the wrong bucket,
 * and an expense — stored by `fromDateInput` at clinic midnight, 18:00Z the day
 * before — in the wrong bucket in the other direction. Same KPI, two answers.
 */
const clinicMonthIndex = (d: Date) => {
  const parts = YM.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get("year") * 12 + (get("month") - 1);
};

/** A clinic month index back to the `{ year, month }` of a bucket key. */
const ym = (index: number) => ({ y: Math.floor(index / 12), m: index % 12 });
const monthKey = (index: number) => {
  const { y, m } = ym(index);
  return `${y}-${String(m + 1).padStart(2, "0")}`;
};

export async function getFinanceOverview(months = 6) {
  const firstMonth = clinicMonthIndex(new Date()) - (months - 1);
  // Clinic midnight on the 1st, i.e. 18:00Z the previous day — not UTC midnight, which
  // is 6am in Dhaka and would drop that day's earlier entries. (`fromDateInput` only
  // returns null for a malformed string, and this one is built here.)
  const start = fromDateInput(`${monthKey(firstMonth)}-01`) ?? new Date(0);

  const [payments, expenses, incomes, categories, recentExpenses, recentIncomes] = await Promise.all([
    prisma.payment.findMany({ where: { paidAt: { gte: start } }, select: { paidAt: true, amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: start } }, select: { date: true, amount: true } }),
    prisma.income.findMany({ where: { date: { gte: start } }, select: { date: true, amount: true } }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.expense.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: RECENT }),
    prisma.income.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: RECENT }),
  ]);

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < months; i++) {
    const index = firstMonth + i;
    buckets.push({ key: monthKey(index), label: MONTHS[ym(index).m], collected: 0, other: 0, income: 0, expense: 0, profit: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  const key = (d: Date) => monthKey(clinicMonthIndex(d));
  for (const p of payments) { const b = map.get(key(p.paidAt)); if (b) b.collected += p.amount; }
  for (const i of incomes) { const b = map.get(key(i.date)); if (b) b.other += i.amount; }
  for (const e of expenses) { const b = map.get(key(e.date)); if (b) b.expense += e.amount; }
  for (const b of buckets) { b.income = b.collected + b.other; b.profit = b.income - b.expense; }

  const recent: LedgerEntry[] = [
    ...recentIncomes.map((i) => ({ kind: "income" as const, id: i.id, date: i.date, category: i.category, description: i.description, amount: i.amount })),
    ...recentExpenses.map((e) => ({ kind: "expense" as const, id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount })),
  ]
    .sort((a, b) => +b.date - +a.date || b.id - a.id)
    .slice(0, RECENT);

  return {
    series: buckets,
    current: buckets[buckets.length - 1],
    categories: categories.map((c) => c.name),
    recent,
  };
}
