"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveLab, type LabFormState } from "@/lib/actions/labs";

type L = {
  id: number; name: string; contactPerson: string | null; contactNumber: string | null;
  address: string | null; email: string | null; specialization: string | null;
  paymentTerms: string | null; isActive: boolean; notes: string | null;
};

const initial: LabFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function LabProviderForm({ lab }: { lab?: L }) {
  const [state, action, pending] = useActionState(saveLab, initial);
  const l = lab;

  return (
    <form action={action} className="space-y-4">
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Lab name <span className="text-rose-500">*</span></span>
          <input name="name" defaultValue={l?.name ?? ""} required className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact person</span>
          <input name="contactPerson" defaultValue={l?.contactPerson ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
          <input name="contactNumber" defaultValue={l?.contactNumber ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Address</span>
          <input name="address" defaultValue={l?.address ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Specialization</span>
          <input name="specialization" defaultValue={l?.specialization ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment terms</span>
          <input name="paymentTerms" defaultValue={l?.paymentTerms ?? ""} placeholder="After Cap Delivery" className={inputCls} /></label>
        <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
          <input name="notes" defaultValue={l?.notes ?? ""} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-7 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="isActive" defaultChecked={l ? l.isActive : true} /> Active
        </label>
      </div>
      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : l ? "Save changes" : "+ Add lab"}
        </button>
        {l && <Link href="/labs/providers" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>}
      </div>
    </form>
  );
}
