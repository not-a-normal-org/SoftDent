"use client";

import { useRef } from "react";
import Combo from "@/components/Combo";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

/**
 * Search / category / low-stock filter for the product list.
 *
 * A plain GET form, so the filter lives in the URL and a staff member can bookmark
 * "everything low on stock" or send it to the owner. The category and the toggle
 * submit themselves — a dropdown that needs a second click to take effect reads as
 * broken — while the text box waits for Enter so it does not navigate per keystroke.
 */
export default function InventoryFilters({
  categories, q, category, low,
}: { categories: string[]; q?: string; category?: string; low: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  // Combo reports the new value through state, so its hidden input still holds the old
  // one during the onChange call. Submitting a tick later picks up the committed value.
  const submitLater = () => setTimeout(submit, 0);

  return (
    <form ref={form} action="/inventory" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
      <label className="block">
        <span className="sr-only">Search products</span>
        <input name="q" defaultValue={q ?? ""} placeholder="Search products…" className={inputCls} />
      </label>
      <label className="block">
        <span className="sr-only">Category</span>
        <Combo name="category" options={categories} defaultValue={category ?? ""} onChange={submitLater}
          placeholder="All categories" emptyLabel="All categories" aria-label="Category" className={inputCls} />
      </label>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="low" value="1" defaultChecked={low} onChange={submit}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800" />
        Low stock only
      </label>
      <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        Filter
      </button>
    </form>
  );
}
