"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveAppointment, type ApptFormState } from "@/lib/actions/appointments";
import { toDateInput, toTimeInput, clock12 } from "@/lib/format";
import { STATUSES } from "@/lib/appointment-constants";
import PatientPicker from "@/components/PatientPicker";
import Combo from "@/components/Combo";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AppointmentForm({
  appt, initialPatient, doctors, units, defaultDate, schedule,
}: {
  appt?: ApptLike;
  initialPatient?: { id: number; name: string } | null;
  doctors: { id: number; name: string }[];
  units: string[];
  defaultDate?: string;
  schedule?: { workingDays: number[]; slotMinutes: number; slots: string[] };
}) {
  const [state, action, pending] = useActionState(saveAppointment, initial);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(initialPatient ?? null);
  const editing = !!appt;

  const slots = schedule?.slots ?? [];
  const [date, setDate] = useState<string>(toDateInput(appt?.appointmentDate) || defaultDate || toDateInput(new Date()));
  const [start, setStart] = useState<string>(toTimeInput(appt?.startsAt) || slots[0] || "");

  const addMinutes = (hhmm: string, mins: number) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
    const t = h * 60 + m + mins;
    // The old `% 24` wrapped a 23:45 start to an end of "00:15", which the action
    // then paired with the SAME date — storing an end ~23.5 hours before the start.
    // The form has one date field, so an end on the next calendar day cannot be
    // expressed here: clamp to the last minute of the day, which still reads as an
    // odd end the clinician can correct, and never inverts the pair.
    if (t >= 24 * 60) return "23:59";
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  // The end used to be derived and read-only, which made a double-length appointment
  // impossible to book. It still defaults to one slot after the start — that is right
  // nearly always — but it can now be changed, and goes back to following the start
  // as soon as the start moves.
  const [endOverride, setEndOverride] = useState<string | null>(toTimeInput(appt?.endsAt) || null);
  const derivedEnd = start ? addMinutes(start, schedule?.slotMinutes ?? 30) : toTimeInput(appt?.endsAt);
  const end = endOverride ?? derivedEnd;

  function onStartChange(v: string) {
    setStart(v);
    setEndOverride(null); // the end follows the start again
  }

  /** Slot labels in AM/PM; the submitted value stays 24-hour. */
  const asOptions = (list: string[]) => list.map((t) => ({ value: t, label: clock12(t) }));
  const startOptions = asOptions(start && !slots.includes(start) ? [start, ...slots] : slots);
  // ends are the slots after the start, plus one slot beyond the last so the final
  // appointment of the day can be closed off
  const endCandidates = (() => {
    const after = slots.filter((t) => !start || t > start);
    const tail = slots.length ? addMinutes(slots[slots.length - 1], schedule?.slotMinutes ?? 30) : "";
    const all = [...after, tail].filter(Boolean) as string[];
    if (end && !all.includes(end)) all.unshift(end);
    return asOptions([...new Set(all)]);
  })();
  const dow = date ? new Date(`${date}T00:00`).getDay() : -1;
  const closedDay = schedule && dow >= 0 && !schedule.workingDays.includes(dow);

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
            <Combo name="doctorId"
              options={doctors.map((d) => ({ value: String(d.id), label: d.name }))}
              defaultValue={String(appt?.doctorId ?? doctors[0]?.id ?? "")}
              placeholder="Choose a doctor…" emptyLabel="—" aria-label="Doctor" className={inputCls} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chair / unit</span>
            <Combo name="allocatedUnit" options={units} defaultValue={appt?.allocatedUnit ?? units[0] ?? ""}
              placeholder="Choose a chair…" emptyLabel="—" aria-label="Chair / unit" className={inputCls} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date <span className="text-rose-500">*</span></span>
            <input type="date" name="appointmentDate" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            {closedDay && <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">⚠ The clinic is normally closed on {DAY_NAMES[dow]}.</span>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
            <Combo name="status"
              options={STATUSES.map((s) => ({ value: s.key, label: s.label }))}
              defaultValue={appt?.status ?? "PENDING"} aria-label="Status" className={inputCls} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Start time</span>
            {slots.length > 0 ? (
              <Combo name="startTime"
                options={startOptions}
                value={start} onChange={onStartChange}
                placeholder="Pick a slot…" aria-label="Start time" className={inputCls} />
            ) : (
              <input type="time" name="startTime" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">End time</span>
            {slots.length > 0 ? (
              <Combo name="endTime" options={endCandidates} value={end} onChange={setEndOverride}
                placeholder="Pick a slot…" aria-label="End time" className={inputCls} />
            ) : (
              <input type="time" name="endTime" value={end} onChange={(e) => setEndOverride(e.target.value)} className={inputCls} />
            )}
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
