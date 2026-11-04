"use client";

import { useActionState } from "react";
import { addExpense, type ExpenseFormState } from "@/lib/actions/finance";
import { toDateInput } from "@/lib/format";
import Combo from "@/components/Combo";

const initial: ExpenseFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function ExpenseForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState(addExpense, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
          <input type="date" name="date" defaultValue={toDateInput(new Date())} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (৳)</span>
          <input type="number" name="amount" min="1" required className={inputCls} /></label>
      </div>
      <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
        <Combo name="category" options={categories} allowCustom
          placeholder="e.g. House Rent" emptyLabel="—" aria-label="Category" className={inputCls} /></label>
      <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
        <input name="description" className={inputCls} /></label>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
        {pending ? "Saving…" : "+ Add expense"}
      </button>
    </form>
  );
}
