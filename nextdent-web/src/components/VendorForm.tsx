"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveVendor, type VendorFormState } from "@/lib/actions/inventory";

type V = { id: number; name: string; businessPhone: string | null; address: string | null; website: string | null; note: string | null };
const initial: VendorFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function VendorForm({ vendor }: { vendor?: V }) {
  const [state, action, pending] = useActionState(saveVendor, initial);
  const v = vendor;

  return (
    <form action={action} className="space-y-4">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendor name <span className="text-rose-500">*</span></span>
          <input name="name" defaultValue={v?.name ?? ""} required className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
          <input name="businessPhone" defaultValue={v?.businessPhone ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Address</span>
          <input name="address" defaultValue={v?.address ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Website</span>
          <input name="website" defaultValue={v?.website ?? ""} className={inputCls} /></label>
        <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</span>
          <input name="note" defaultValue={v?.note ?? ""} className={inputCls} /></label>
      </div>
      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : v ? "Save changes" : "+ Add vendor"}
        </button>
        {v && <Link href="/inventory/vendors" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>}
      </div>
    </form>
  );
}
