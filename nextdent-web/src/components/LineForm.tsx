"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveLine, type LineFormState } from "@/lib/actions/billing";
import { toDateInput, taka } from "@/lib/format";
import Combo from "@/components/Combo";

type LineLike = {
  id: number; treatmentName: string | null; treatmentDate: Date | string | null;
  operatingDoctorId: number | null; totalAmount: number; discountPercent: number; note: string | null;
};
type Treatment = { name: string; price: number };
type Doctor = { id: number; name: string };

const initial: LineFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function LineForm({
  caseId, line, treatments, doctors, compact = false,
}: {
  caseId: number; line?: LineLike; treatments: Treatment[]; doctors: Doctor[]; compact?: boolean;
}) {
  const [state, action, pending] = useActionState(saveLine, initial);
  const [name, setName] = useState(line?.treatmentName ?? "");
  const [total, setTotal] = useState<number>(line?.totalAmount ?? 0);
  const [discount, setDiscount] = useState<number>(line?.discountPercent ?? 0);
  const priceMap = new Map(treatments.map((t) => [t.name, t.price]));
  const afterDiscount = Math.max(0, Math.round(total * (1 - (discount || 0) / 100)));

  function onName(v: string) {
    setName(v);
    const p = priceMap.get(v);
    if (p != null && (!total || line == null)) setTotal(p); // auto-fill catalog price
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="caseId" value={caseId} />
      {line && <input type="hidden" name="id" value={line.id} />}

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-6" : "sm:grid-cols-3"}`}>
        <label className={compact ? "sm:col-span-2" : ""}>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Procedure</span>
          <Combo name="treatmentName"
            options={treatments.map((t) => ({ value: t.name, label: t.name, hint: taka(t.price) }))}
            value={name} onChange={onName} allowCustom
            placeholder="Search catalog…" aria-label="Procedure" className={inputCls} />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
          <input type="date" name="treatmentDate" defaultValue={toDateInput(line?.treatmentDate) || toDateInput(new Date())} className={inputCls} />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Doctor</span>
          <Combo name="operatingDoctorId"
            options={doctors.map((d) => ({ value: String(d.id), label: d.name }))}
            defaultValue={String(line?.operatingDoctorId ?? "")}
            placeholder="Choose a doctor…" emptyLabel="—" aria-label="Doctor" className={inputCls} />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (৳)</span>
          <input type="number" name="totalAmount" min="0" value={total} onChange={(e) => setTotal(parseInt(e.target.value || "0", 10))} className={inputCls} />
        </label>
        <label>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Discount %</span>
          <input type="number" name="discountPercent" min="0" max="100" step="0.5" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value || "0"))} className={inputCls} />
        </label>
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Payable</span>
          <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{taka(afterDiscount)}</div>
        </div>
        {!compact && (
          <label className="sm:col-span-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</span>
            <input name="note" defaultValue={line?.note ?? ""} className={inputCls} />
          </label>
        )}
        {compact && <input type="hidden" name="note" value="" />}
      </div>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : line ? "Save procedure" : "+ Add procedure"}
        </button>
        {line && <Link href={`/cases/${caseId}`} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Link>}
      </div>
    </form>
  );
}
