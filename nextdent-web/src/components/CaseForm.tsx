"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCase, type CaseFormState } from "@/lib/actions/billing";
import Combo from "@/components/Combo";

type CaseLike = { id: number; name: string | null; description: string | null; status: string | null; notes: string | null };
const initial: CaseFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function CaseForm({ patientId, treatmentCase, cancelHref }: { patientId: number; treatmentCase?: CaseLike; cancelHref: string }) {
  const [state, action, pending] = useActionState(saveCase, initial);
  const c = treatmentCase;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="patientId" value={patientId} />
      {c && <input type="hidden" name="id" value={c.id} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Case name</span>
            <input name="name" defaultValue={c?.name ?? ""} placeholder="e.g. RCT on 36" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <Combo name="status" options={["Active", "Completed", "On-hold"]}
              defaultValue={c?.status ?? "Active"} aria-label="Case status" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Short description</span>
            <input name="description" defaultValue={c?.description ?? ""} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
            <textarea name="notes" defaultValue={c?.notes ?? ""} rows={2} className={inputCls} />
          </label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : c ? "Save changes" : "Create case"}
        </button>
        <Link href={cancelHref} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Link>
      </div>
    </form>
  );
}
