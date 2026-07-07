"use client";

import { useState } from "react";
import { recordPayment } from "@/lib/actions/billing";
import { toDateInput } from "@/lib/format";

// Inline "record payment" affordance for a treatment line.
export default function PayLine({ lineId, due }: { lineId: number; due: number }) {
  const [open, setOpen] = useState(false);
  if (due <= 0) return <span className="text-xs text-emerald-600 dark:text-emerald-400">Paid</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
        Pay
      </button>
    );
  }

  return (
    <form action={recordPayment.bind(null, lineId)} className="flex items-center gap-1.5">
      <input name="amount" type="number" min="1" max={due} defaultValue={due} className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      <input name="method" placeholder="method" className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      <input name="paidAt" type="date" defaultValue={toDateInput(new Date())} className="rounded-md border border-slate-300 bg-white px-1 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      <button className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">Save</button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
    </form>
  );
}
