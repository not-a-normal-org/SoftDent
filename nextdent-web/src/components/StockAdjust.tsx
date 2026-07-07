"use client";

import { useState } from "react";
import { adjustStock } from "@/lib/actions/inventory";

// Inline stock in/out adjustment for a product row.
export default function StockAdjust({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        Adjust
      </button>
    );
  }

  return (
    <form action={adjustStock.bind(null, productId)} className="flex items-center gap-1.5">
      <input name="delta" type="number" placeholder="+/-" className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      <input name="reason" placeholder="reason" className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      <button className="rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700">Apply</button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
    </form>
  );
}
