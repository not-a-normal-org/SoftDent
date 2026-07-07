"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProduct, type ProductFormState } from "@/lib/actions/inventory";

type P = { id: number; name: string; category: string | null; unit: string | null; quantity: number; reorderLevel: number; unitPrice: number; vendorId: number | null; note: string | null };
const initial: ProductFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function ProductForm({ product, categories, vendors }: { product?: P; categories: string[]; vendors: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(saveProduct, initial);
  const p = product;

  return (
    <form action={action} className="space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <datalist id="productCategories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Product <span className="text-rose-500">*</span></span>
          <input name="name" defaultValue={p?.name ?? ""} required className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
          <input name="category" list="productCategories" defaultValue={p?.category ?? ""} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Unit</span>
          <input name="unit" defaultValue={p?.unit ?? ""} placeholder="box / piece / ml" className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</span>
          <input type="number" name="quantity" defaultValue={p?.quantity ?? 0} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reorder level</span>
          <input type="number" name="reorderLevel" defaultValue={p?.reorderLevel ?? 0} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Unit price (৳)</span>
          <input type="number" name="unitPrice" defaultValue={p?.unitPrice ?? 0} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</span>
          <select name="vendorId" defaultValue={p?.vendorId ?? ""} className={inputCls}>
            <option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select></label>
        <label className="block sm:col-span-3"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</span>
          <input name="note" defaultValue={p?.note ?? ""} className={inputCls} /></label>
      </div>
      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : p ? "Save changes" : "+ Add product"}
        </button>
        {p && <Link href="/inventory" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>}
      </div>
    </form>
  );
}
