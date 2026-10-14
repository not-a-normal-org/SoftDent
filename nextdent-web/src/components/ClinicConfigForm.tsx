"use client";

import { useActionState } from "react";
import { saveClinicConfig, type ClinicFormState } from "@/lib/actions/settings";

type Settings = {
  defaultRxType: string | null; autoAddAppointment: boolean; autoCompleteAppointment: boolean;
  workingDays: number[]; openTime: string; closeTime: string; slotMinutes: number;
  rxBodyTopMm: number; rxBodyBottomMm: number;
} | null;
type Doc = { heading1: string | null; heading2: string | null; heading7: string | null; heading8: string | null; heading9: string | null; footer: string | null } | null;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const initial: ClinicFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function ClinicConfigForm({ settings, rxDoc }: { settings: Settings; rxDoc: Doc }) {
  const [state, action, pending] = useActionState(saveClinicConfig, initial);

  return (
    <form action={action} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prescription defaults</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Rx format</span>
            <select name="defaultRxType" defaultValue={settings?.defaultRxType ?? "Body"} className={inputCls}>
              <option value="Body">Body / Short</option>
              <option value="Full">Full</option>
            </select></label>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="autoAddAppointment" defaultChecked={settings?.autoAddAppointment ?? false} /> Auto-add appointment on treatment
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="autoCompleteAppointment" defaultChecked={settings?.autoCompleteAppointment ?? false} /> Auto-complete it
          </label>
        </div>

        {/* Only meaningful for "Body" prints, where the paper already carries the letterhead. */}
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Space left blank on a <strong>Body / Short</strong> print so the prescription clears the
            letterhead already on the paper. Measure your stationery, print one, and adjust.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Top space (mm)</span>
              <input type="number" name="rxBodyTopMm" min="0" max="150" step="1"
                defaultValue={settings?.rxBodyTopMm ?? 45} className={inputCls} /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bottom space (mm)</span>
              <input type="number" name="rxBodyBottomMm" min="0" max="150" step="1"
                defaultValue={settings?.rxBodyBottomMm ?? 20} className={inputCls} /></label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Schedule</h2>
        <p className="mt-0.5 text-xs text-slate-400">Working days and hours drive the appointment time slots.</p>
        <div className="mt-3 space-y-4">
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Working days</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAYS.map((d, idx) => (
                <label key={idx} className="cursor-pointer">
                  <input type="checkbox" name={`day-${idx}`} defaultChecked={settings?.workingDays?.includes(idx) ?? [6, 0, 1, 2, 3].includes(idx)} className="peer sr-only" />
                  <span className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 peer-checked:border-teal-500 peer-checked:bg-teal-50 peer-checked:text-teal-700 dark:border-slate-700 dark:text-slate-300 dark:peer-checked:border-teal-500 dark:peer-checked:bg-teal-500/15 dark:peer-checked:text-teal-300">{d}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Opens</span>
              <input type="time" name="openTime" defaultValue={settings?.openTime ?? "15:00"} className={inputCls} /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Closes</span>
              <input type="time" name="closeTime" defaultValue={settings?.closeTime ?? "19:00"} className={inputCls} /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Slot length (min)</span>
              <input type="number" name="slotMinutes" min="5" step="5" defaultValue={settings?.slotMinutes ?? 30} className={inputCls} /></label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prescription letterhead</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Clinic name</span>
            <input name="clinicName" defaultValue={rxDoc?.heading1 ?? ""} className={inputCls} /></label>
          {/* printed under the clinic name, top-left, one line per line */}
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Clinic address</span>
            <textarea name="clinicAddress" rows={5} defaultValue={rxDoc?.heading2 ?? ""}
              placeholder={"1st Floor, Stone Assurance\nKazi's Den\nBeside Press Club\nAgarpur Road,\nSadar Road, Barishal"}
              className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Appointment line</span>
            <input name="appointmentLine" defaultValue={rxDoc?.heading8 ?? ""} placeholder="For Appointment: 01…" className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Visit time</span>
            <input name="visitTime" defaultValue={rxDoc?.heading9 ?? ""} placeholder="Visit Time: 3–7 PM" className={inputCls} /></label>
          {/* label only — the number itself lives on each doctor, under Team */}
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Registration label</span>
            <input name="regLabel" defaultValue={rxDoc?.heading7 ?? ""} placeholder="BMDC Reg No:" className={inputCls} /></label>
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Footer</span>
            <input name="footer" defaultValue={rxDoc?.footer ?? ""} className={inputCls} /></label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
