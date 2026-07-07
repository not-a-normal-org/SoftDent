import "server-only";
import { prisma } from "./prisma";

export type MonthBucket = { key: string; label: string; income: number; expense: number; profit: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getFinanceOverview(months = 6) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [payments, expenses, categories, recentExpenses] = await Promise.all([
    prisma.payment.findMany({ where: { paidAt: { gte: start } }, select: { paidAt: true, amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: start } }, select: { date: true, amount: true } }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.expense.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 20 }),
  ]);

  const buckets: MonthBucket[] = [];
  for (let m = 0; m < months; m++) {
    const dt = new Date(start.getFullYear(), start.getMonth() + m, 1);
    buckets.push({ key: `${dt.getFullYear()}-${dt.getMonth()}`, label: MONTHS[dt.getMonth()], income: 0, expense: 0, profit: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  for (const p of payments) { const b = map.get(key(p.paidAt)); if (b) b.income += p.amount; }
  for (const e of expenses) { const b = map.get(key(e.date)); if (b) b.expense += e.amount; }
  for (const b of buckets) b.profit = b.income - b.expense;

  return {
    series: buckets,
    current: buckets[buckets.length - 1],
    categories: categories.map((c) => c.name),
    recentExpenses,
  };
}
