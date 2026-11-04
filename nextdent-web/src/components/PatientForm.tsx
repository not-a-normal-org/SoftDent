"use client";

import Link from "next/link";
import { useActionState } from "react";
import { savePatient, type PatientFormState } from "@/lib/actions/patients";
import { toDateInput } from "@/lib/format";
import { GENDERS, MARITAL, type PatientFormLists } from "@/lib/patient-constants";
import Combo from "@/components/Combo";

type PatientLike = {
  id: number;
  fullName: string;
  nickName: string | null;
  gender: string | null;
  maritalStatus: string | null;
  dob: Date | null;
  since: Date | null;
  occupation: string | null;
  primaryPhone: string | null;
  foreignPhone: string | null;
  email: string | null;
  address: string | null;
  consultantDoctorId: number | null;
  lifetimeDiscount: number;
  emergencyRelation: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  medicalHistory: string | null;
  drugHistory: string | null;
  note: string | null;
};

const initial: PatientFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

export default function PatientForm({ patient, lists }: { patient?: PatientLike; lists: PatientFormLists }) {
  const [state, action, pending] = useActionState(savePatient, initial);
  const p = patient;
  const editing = !!p;

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={p!.id} />}

      <Section title="Identity">
        <Field label="Full name" error={state.fieldErrors?.fullName} required className="sm:col-span-2">
          <input name="fullName" defaultValue={p?.fullName ?? ""} required className={inputCls} />
        </Field>
        <Field label="Nickname">
          <input name="nickName" defaultValue={p?.nickName ?? ""} className={inputCls} />
        </Field>
        <Field label="Gender">
          <Combo name="gender" options={GENDERS} defaultValue={p?.gender ?? ""}
            placeholder="Select…" emptyLabel="—" aria-label="Gender" className={inputCls} />
        </Field>
        <Field label="Date of birth">
          <input type="date" name="dob" defaultValue={toDateInput(p?.dob)} className={inputCls} />
        </Field>
        <Field label="Marital status">
          <Combo name="maritalStatus" options={MARITAL} defaultValue={p?.maritalStatus ?? ""}
            placeholder="Select…" emptyLabel="—" aria-label="Marital status" className={inputCls} />
        </Field>
        <Field label="Occupation">
          <Combo name="occupation" options={lists.occupations} defaultValue={p?.occupation ?? ""}
            allowCustom placeholder="Search or type…" emptyLabel="—" aria-label="Occupation" className={inputCls} />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Primary phone">
          <input name="primaryPhone" defaultValue={p?.primaryPhone ?? ""} className={inputCls} placeholder="01XXX-XXXXXX" />
        </Field>
        <Field label="Foreign / alt phone">
          <input name="foreignPhone" defaultValue={p?.foreignPhone ?? ""} className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" name="email" defaultValue={p?.email ?? ""} className={inputCls} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <input name="address" defaultValue={p?.address ?? ""} className={inputCls} />
        </Field>
      </Section>

      <Section title="Care & billing">
        <Field label="Consultant doctor">
          <Combo name="consultantDoctorId"
            options={lists.doctors.map((d) => ({ value: String(d.id), label: d.name }))}
            defaultValue={String(p?.consultantDoctorId ?? "")}
            placeholder="Unassigned" emptyLabel="Unassigned" aria-label="Consultant doctor" className={inputCls} />
        </Field>
        <Field label="Registered since">
          <input type="date" name="since" defaultValue={toDateInput(p?.since)} className={inputCls} />
        </Field>
        <Field label="Lifetime discount (%)">
          <input type="number" step="0.1" min="0" max="100" name="lifetimeDiscount" defaultValue={p?.lifetimeDiscount ?? 0} className={inputCls} />
        </Field>
      </Section>

      <Section title="Emergency contact">
        <Field label="Relation">
          <Combo name="emergencyRelation" options={lists.relations} defaultValue={p?.emergencyRelation ?? ""}
            allowCustom placeholder="Search or type…" emptyLabel="—" aria-label="Emergency relation" className={inputCls} />
        </Field>
        <Field label="Name">
          <input name="emergencyName" defaultValue={p?.emergencyName ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="emergencyPhone" defaultValue={p?.emergencyPhone ?? ""} className={inputCls} />
        </Field>
      </Section>

      <Section title="Clinical history">
        <Field label="Medical history" className="sm:col-span-3">
          <textarea name="medicalHistory" defaultValue={p?.medicalHistory ?? ""} rows={2} className={inputCls} />
        </Field>
        <Field label="Drug history" className="sm:col-span-3">
          <textarea name="drugHistory" defaultValue={p?.drugHistory ?? ""} rows={2} className={inputCls} />
        </Field>
        <Field label="Note" className="sm:col-span-3">
          <textarea name="note" defaultValue={p?.note ?? ""} rows={2} className={inputCls} />
        </Field>
      </Section>

      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" role="alert">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : editing ? "Save changes" : "Create patient"}
        </button>
        <Link href={editing ? `/patients/${p!.id}` : "/patients"} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, error, required, className = "" }: {
  label: string; children: React.ReactNode; error?: string; required?: boolean; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span>}
    </label>
  );
}
