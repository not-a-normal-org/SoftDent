"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveLabOrder, type LabOrderFormState } from "@/lib/actions/labs";
import { toDateInput } from "@/lib/format";
import { LAB_STATUSES, WORK_TYPES } from "@/lib/lab-constants";
import PatientPicker from "@/components/PatientPicker";
import Combo from "@/components/Combo";

type Order = {
  id: number; labId: number; workType: string | null; toothFdi: string | null; shade: string | null;
  sentAt: Date | string | null; expectedAt: Date | string | null; receivedAt: Date | string | null;
  status: string; cost: number; note: string | null;
};

const initial: LabOrderFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function LabOrderForm({
  order, initialPatient, labs, shades,
}: {
  order?: Order;
  initialPatient?: { id: number; name: string } | null;
  labs: { id: number; name: string }[];
  shades: string[];
}) {
  const [state, action, pending] = useActionState(saveLabOrder, initial);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(initialPatient ?? null);
  const o = order;

  return (
    <form action={action} className="space-y-4">
      {o && <input type="hidden" name="id" value={o.id} />}
      <input type="hidden" name="patientId" value={patient?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Patient <span className="text-rose-500">*</span></span>
          {patient ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <span className="font-medium text-slate-800 dark:text-slate-200">{patient.name} <span className="text-slate-400">#{patient.id}</span></span>
              <button type="button" onClick={() => setPatient(null)} className="text-xs text-teal-700 hover:underline dark:text-teal-400">change</button>
            </div>
          ) : <div className="mt-1"><PatientPicker onPick={setPatient} /></div>}
        </div>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Lab <span className="text-rose-500">*</span></span>
          <Combo name="labId"
            options={labs.map((l) => ({ value: String(l.id), label: l.name }))}
            defaultValue={String(o?.labId ?? labs[0]?.id ?? "")}
            placeholder="Choose a lab…" aria-label="Lab" className={inputCls} /></label>

        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Work type</span>
          <Combo name="workType" options={WORK_TYPES} defaultValue={o?.workType ?? ""}
            allowCustom placeholder="Search or type…" emptyLabel="—" aria-label="Work type" className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tooth (FDI)</span>
          <input name="toothFdi" defaultValue={o?.toothFdi ?? ""} placeholder="e.g. 36" className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Shade</span>
          <Combo name="shade" options={shades} defaultValue={o?.shade ?? ""}
            allowCustom placeholder="A2" emptyLabel="—" aria-label="Shade" className={inputCls} /></label>

        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sent</span>
          <input type="date" name="sentAt" defaultValue={toDateInput(o?.sentAt) || toDateInput(new Date())} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected back</span>
          <input type="date" name="expectedAt" defaultValue={toDateInput(o?.expectedAt)} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Received</span>
          <input type="date" name="receivedAt" defaultValue={toDateInput(o?.receivedAt)} className={inputCls} /></label>

        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <Combo name="status"
            options={LAB_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
            defaultValue={o?.status ?? "SENT"} aria-label="Status" className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Lab cost (৳)</span>
          <input type="number" name="cost" min="0" defaultValue={o?.cost ?? 0} className={inputCls} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</span>
          <input name="note" defaultValue={o?.note ?? ""} className={inputCls} /></label>
      </div>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : o ? "Save changes" : "+ Send to lab"}
        </button>
        {o && <Link href="/labs" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>}
      </div>
    </form>
  );
}
