"use client";

import { useActionState } from "react";
import { saveClinicConfig, type ClinicFormState } from "@/lib/actions/settings";

type Settings = { defaultRxType: string | null; autoAddAppointment: boolean; autoCompleteAppointment: boolean } | null;
type Doc = { heading1: string | null; heading8: string | null; heading9: string | null; footer: string | null } | null;

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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prescription letterhead</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Clinic name</span>
            <input name="clinicName" defaultValue={rxDoc?.heading1 ?? ""} className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Appointment line</span>
            <input name="appointmentLine" defaultValue={rxDoc?.heading8 ?? ""} placeholder="For Appointment: 01…" className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Visit time</span>
            <input name="visitTime" defaultValue={rxDoc?.heading9 ?? ""} placeholder="Visit Time: 3–7 PM" className={inputCls} /></label>
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
