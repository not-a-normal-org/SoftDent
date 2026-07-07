import { taka } from "@/lib/format";
import type { MonthBucket } from "@/lib/finance";

// Dependency-free grouped bar chart (income vs expense per month). Theme-aware.
export default function BarChart({ series }: { series: MonthBucket[] }) {
  const max = Math.max(1, ...series.map((m) => Math.max(m.income, m.expense)));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Income vs expense</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />Income</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Expense</span>
        </div>
      </div>

      <div className="flex h-48 items-end gap-3">
        {series.map((m) => (
          <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center gap-1.5">
              <div
                title={`Income ${taka(m.income)}`}
                style={{ height: `${(m.income / max) * 100}%` }}
                className="w-5 min-h-[2px] rounded-t bg-teal-500 transition-all"
              />
              <div
                title={`Expense ${taka(m.expense)}`}
                style={{ height: `${(m.expense / max) * 100}%` }}
                className="w-5 min-h-[2px] rounded-t bg-amber-500 transition-all"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
