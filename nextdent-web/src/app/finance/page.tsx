import { requireRole } from "@/lib/auth";
import { getFinanceOverview } from "@/lib/finance";
import { deleteExpense, deleteIncome } from "@/lib/actions/finance";
import { taka, fmtDate } from "@/lib/format";
import { clinicToday, parseRange, rangeDates, rangeLabel } from "@/lib/date-range";
import BarChart from "@/components/BarChart";
import DateRangePicker from "@/components/DateRangePicker";
import ExpenseForm from "@/components/ExpenseForm";
import IncomeForm from "@/components/IncomeForm";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireRole("OWNER");
  const today = clinicToday();
  const range = parseRange(await searchParams, today);
  const label = rangeLabel(range, today);
  const { series, period, categories, recent, entryCount } = await getFinanceOverview(range, 6);

  const kpis = [
    {
      label: "Income",
      value: taka(period.income),
      // the split matters: collections are patient money, "other" is booked by hand
      note: `${taka(period.collected)} collected · ${taka(period.other)} other`,
      tone: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    },
    {
      label: "Expense",
      value: taka(period.expense),
      note: null,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      label: "Net",
      value: taka(period.profit),
      note: "income − expense",
      tone: period.profit >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The dates set the totals and the entries listed. The chart always shows the last six months.
          </p>
        </div>
        <DateRangePicker value={range} today={today} label="Accounts dates" />
        {/* three abreast leave ~65px a tile on a phone; net goes full width beneath */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((k, i) => (
            <div key={k.label} className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone} ${i === kpis.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}>
              <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label} <span className="normal-case tracking-normal">· {label}</span></div>
              <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</div>
              {k.note && <div className="mt-0.5 text-[11px] tabular-nums opacity-70">{k.note}</div>}
            </div>
          ))}
        </div>
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
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Entries <span className="font-normal text-slate-400 dark:text-slate-500">· {label === rangeDates(range) ? label : `${label}, ${rangeDates(range)}`}</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {entryCount > recent.length ? `latest ${recent.length} of ${entryCount.toLocaleString()}` : entryCount.toLocaleString()}
            </span>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing recorded in these dates.</p>
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
