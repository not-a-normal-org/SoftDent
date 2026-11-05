"use client";

import { useActionState } from "react";
import { addIncome, type FinanceFormState } from "@/lib/actions/finance";
import { toDateInput } from "@/lib/format";
import { INCOME_CATEGORIES, DEFAULT_INCOME_CATEGORY } from "@/lib/income-constants";
import Combo from "@/components/Combo";

const initial: FinanceFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function IncomeForm() {
  const [state, action, pending] = useActionState(addIncome, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
          <input type="date" name="date" defaultValue={toDateInput(new Date())} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (৳)</span>
          <input type="number" name="amount" min="1" required className={inputCls} /></label>
      </div>
      {/* closed list: no allowCustom and no emptyLabel, so the two categories stay the two categories */}
      <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
        <Combo name="category" options={INCOME_CATEGORIES} defaultValue={DEFAULT_INCOME_CATEGORY}
          required aria-label="Income category" className={inputCls} /></label>
      <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
        <input name="description" className={inputCls} /></label>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
        {pending ? "Saving…" : "+ Add income"}
      </button>
    </form>
  );
}
