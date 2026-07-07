import { requireRole } from "@/lib/auth";
import { getFinanceOverview } from "@/lib/finance";
import { deleteExpense } from "@/lib/actions/finance";
import { taka, fmtDate } from "@/lib/format";
import BarChart from "@/components/BarChart";
import ExpenseForm from "@/components/ExpenseForm";

export default async function FinancePage() {
  await requireRole("OWNER");
  const { series, current, categories, recentExpenses } = await getFinanceOverview(6);

  const kpis = [
    { label: `Income (${current.label})`, value: taka(current.income), tone: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
    { label: `Expense (${current.label})`, value: taka(current.expense), tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    { label: `Profit (${current.label})`, value: taka(current.profit), tone: current.profit >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Finance</h1>

      <section className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</div>
          </div>
        ))}
      </section>

      <BarChart series={series} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add expense</h2>
          <ExpenseForm categories={categories} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Recent expenses</h2>
          {recentExpenses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No expenses recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-slate-800 dark:text-slate-200">{e.category ?? "Expense"}</span>
                    {e.description ? <span className="text-slate-400"> · {e.description}</span> : null}
                    <span className="block text-xs text-slate-400">{fmtDate(e.date)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{taka(e.amount)}</span>
                    <form action={deleteExpense.bind(null, e.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
