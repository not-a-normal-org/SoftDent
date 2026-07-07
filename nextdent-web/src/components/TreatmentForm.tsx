"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveTreatment, type TreatmentFormState } from "@/lib/actions/settings";

type T = { id: number; name: string; defaultPrice: number };
const initial: TreatmentFormState = {};
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function TreatmentForm({ treatment, inline = false }: { treatment?: T; inline?: boolean }) {
  const [state, action, pending] = useActionState(saveTreatment, initial);

  return (
    <form action={action} className={inline ? "flex flex-wrap items-end gap-2" : "space-y-4"}>
      {treatment && <input type="hidden" name="id" value={treatment.id} />}
      <div className={inline ? "flex-1 min-w-40" : ""}>
        {!inline && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Procedure name</span>}
        <input name="name" defaultValue={treatment?.name ?? ""} placeholder="Procedure name" required className={`${inline ? "" : "mt-1 "}${inputCls}`} />
      </div>
      <div className={inline ? "w-32" : ""}>
        {!inline && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default price (৳)</span>}
        <input type="number" name="defaultPrice" min="0" defaultValue={treatment?.defaultPrice ?? 0} placeholder="Price" className={`${inline ? "" : "mt-1 "}${inputCls}`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
        {pending ? "Saving…" : treatment ? "Save" : "+ Add"}
      </button>
      {treatment && !inline && <Link href="/settings/treatments" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>}
      {state.error && <p className="w-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
    </form>
  );
}
