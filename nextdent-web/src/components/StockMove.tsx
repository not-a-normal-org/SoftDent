"use client";

import { useActionState, useState } from "react";
import { moveStock, type StockFormState } from "@/lib/actions/inventory";

const initial: StockFormState = {};
const fieldCls =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

/**
 * Receive / issue stock for one product.
 *
 * Two submit buttons on one form rather than two forms: the direction rides in as the
 * submitter's own name/value, so the quantity and reason are typed once and there is
 * no way to fill one form and submit the other.
 */
export default function StockMove({ productId, defaultOpen = false }: { productId: number; defaultOpen?: boolean }) {
  const [state, action, pending] = useActionState(moveStock.bind(null, productId), initial);
  // Open/closed is React state rather than <details open>, which the server action's
  // revalidation would reset — collapsing the row and hiding the result just typed.
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        Move stock
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input name="qty" type="number" min="1" step="1" placeholder="qty" aria-label="Quantity" className={`w-16 ${fieldCls}`} />
      <input name="reason" placeholder="reason" aria-label="Reason" className={`w-28 ${fieldCls}`} />
      <button name="direction" value="in" disabled={pending}
        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        + Receive
      </button>
      <button name="direction" value="out" disabled={pending}
        className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60">
        − Issue
      </button>
      {!defaultOpen && (
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
      )}
      {state.error && <span className="text-xs text-rose-600 dark:text-rose-400">{state.error}</span>}
      {state.ok && !state.error && <span className="text-xs text-emerald-600 dark:text-emerald-400">{state.ok}</span>}
    </form>
  );
}
