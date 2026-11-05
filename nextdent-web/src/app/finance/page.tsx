import { requireRole } from "@/lib/auth";
import { getFinanceOverview } from "@/lib/finance";
import { deleteExpense, deleteIncome } from "@/lib/actions/finance";
import { taka, fmtDate } from "@/lib/format";
import BarChart from "@/components/BarChart";
import ExpenseForm from "@/components/ExpenseForm";
import IncomeForm from "@/components/IncomeForm";

export default async function AccountsPage() {
  await requireRole("OWNER");
  const { series, current, categories, recent } = await getFinanceOverview(6);

  const kpis = [
    {
      label: `Income (${current.label})`,
      value: taka(current.income),
      // the split matters: collections are patient money, "other" is booked by hand
      note: `${taka(current.collected)} collected · ${taka(current.other)} other`,
      tone: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    },
    {
      label: `Expense (${current.label})`,
      value: taka(current.expense),
      note: null,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      label: `Net (${current.label})`,
      value: taka(current.profit),
      note: "income − expense",
      tone: current.profit >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Accounts</h1>

      <section className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</div>
            {k.note && <div className="mt-0.5 text-[11px] tabular-nums opacity-70">{k.note}</div>}
          </div>
        ))}
      </section>

      <BarChart series={series} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add expense</h2>
            <ExpenseForm categories={categories} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add income</h2>
            <IncomeForm />
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Recent entries</h2>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((e) => {
                const income = e.kind === "income";
                return (
                  <li key={`${e.kind}-${e.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="text-slate-800 dark:text-slate-200">{e.category ?? (income ? "Income" : "Expense")}</span>
                      {e.description ? <span className="text-slate-400"> · {e.description}</span> : null}
                      <span className="block text-xs text-slate-400">{fmtDate(e.date)} · {income ? "income" : "expense"}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`font-medium tabular-nums ${income ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {income ? "+" : "−"}{taka(e.amount)}
                      </span>
                      <form action={(income ? deleteIncome : deleteExpense).bind(null, e.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
