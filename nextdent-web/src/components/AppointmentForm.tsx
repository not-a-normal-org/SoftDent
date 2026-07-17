"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveAppointment, type ApptFormState } from "@/lib/actions/appointments";
import { toDateInput, toTimeInput } from "@/lib/format";
import { STATUSES } from "@/lib/appointment-constants";
import PatientPicker from "@/components/PatientPicker";

type ApptLike = {
  id: number;
  doctorId: number | null;
  allocatedUnit: string | null;
  appointmentDate: Date | string | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  status: string | null;
  note: string | null;
};

const initial: ApptFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function AppointmentForm({
  appt, initialPatient, doctors, units, defaultDate,
}: {
  appt?: ApptLike;
  initialPatient?: { id: number; name: string } | null;
  doctors: { id: number; name: string }[];
  units: string[];
  defaultDate?: string;
}) {
  const [state, action, pending] = useActionState(saveAppointment, initial);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(initialPatient ?? null);
  const editing = !!appt;

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={appt!.id} />}
      <input type="hidden" name="patientId" value={patient?.id ?? ""} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Patient <span className="text-rose-500">*</span></span>
            {patient ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <span className="font-medium text-slate-800 dark:text-slate-200">{patient.name} <span className="text-slate-400">#{patient.id}</span></span>
                <button type="button" onClick={() => setPatient(null)} className="text-xs text-teal-700 hover:underline dark:text-teal-400">change</button>
              </div>
            ) : (
              <div className="mt-1"><PatientPicker onPick={setPatient} /></div>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Doctor</span>
            <select name="doctorId" defaultValue={appt?.doctorId ?? doctors[0]?.id ?? ""} className={inputCls}>
              <option value="">—</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chair / unit</span>
            <select name="allocatedUnit" defaultValue={appt?.allocatedUnit ?? units[0] ?? ""} className={inputCls}>
              <option value="">—</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date <span className="text-rose-500">*</span></span>
            <input type="date" name="appointmentDate" required defaultValue={toDateInput(appt?.appointmentDate) || defaultDate || toDateInput(new Date())} className={inputCls} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <select name="status" defaultValue={appt?.status ?? "PENDING"} className={inputCls}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Start time</span>
            <input type="time" name="startTime" defaultValue={toTimeInput(appt?.startsAt)} className={inputCls} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">End time</span>
            <input type="time" name="endTime" defaultValue={toTimeInput(appt?.endsAt)} className={inputCls} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</span>
            <textarea name="note" defaultValue={appt?.note ?? ""} rows={2} className={inputCls} />
          </label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" role="alert">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : editing ? "Save changes" : "Book appointment"}
        </button>
        <Link href="/appointments" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Link>
      </div>
    </form>
  );
}
