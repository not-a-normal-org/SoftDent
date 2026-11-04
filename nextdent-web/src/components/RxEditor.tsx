"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveRx, type RxFormState } from "@/lib/actions/prescriptions";
import { toDateInput } from "@/lib/format";
import DrugPicker, { type Drug } from "@/components/DrugPicker";
import PatientPicker from "@/components/PatientPicker";
import Combo from "@/components/Combo";
import { GENDERS } from "@/lib/patient-constants";

type Line = { drug: string; dose: string; meal: string; duration: string };
type Doctor = { id: number; name: string };
type Template = {
  name: string;
  complaints: string | null; findingsOnExamination: string | null; provisionalDiagnosis: string | null;
  differentialDiagnosis: string | null; investigationAdvised: string | null; confirmatoryDiagnosis: string | null;
  treatmentPlan: string | null; procedurePerformed: string | null; advise: string | null; followUpReason: string | null;
  drugs: { drug: string | null; dose: string | null; meal: string | null; duration: string | null }[];
};
type RxLike = {
  id: number; dentistId: number | null; rxDate: Date | string | null;
  followUpDate: Date | string | null; followUpReason: string | null;
  randomName: string | null; randomAge: string | null; randomSex: string | null;
  drugs: { drug: string | null; dose: string | null; meal: string | null; duration: string | null }[];
} & Record<string, unknown>;

const CLINICAL: { key: string; label: string; full?: boolean }[] = [
  { key: "complaints", label: "Chief complaints", full: true },
  { key: "findingsOnExamination", label: "Findings on examination" },
  { key: "provisionalDiagnosis", label: "Provisional diagnosis" },
  { key: "differentialDiagnosis", label: "Differential diagnosis" },
  { key: "confirmatoryDiagnosis", label: "Confirmatory diagnosis" },
  { key: "investigationAdvised", label: "Investigation advised" },
  { key: "treatmentPlan", label: "Treatment plan" },
  { key: "procedurePerformed", label: "Procedure performed" },
  { key: "medicalHistory", label: "Medical history" },
  { key: "drugHistory", label: "Drug history" },
  { key: "advise", label: "Advice", full: true },
];

// Advice is split out of the clinical-notes block: the notes are recorded *before*
// prescribing (they justify it), while advice is written last, after the medicines.
const ADVICE_KEY = "advise";
const NOTES = CLINICAL.filter((c) => c.key !== ADVICE_KEY);
const ADVICE = CLINICAL.find((c) => c.key === ADVICE_KEY)!;

const DOSE_PRESETS = ["১+০+১", "১+১+১", "০+০+১", "১+০+০", "½+০+½"];
const MEAL_PRESETS = ["খাবার পর খাবেন", "খাবার আগে খাবেন", "খাবার সাথে খাবেন"];
const DURATION_PRESETS = ["৩ দিন", "৫ দিন", "৭ দিন", "১০ দিন", "১৪ দিন", "চলবে"];

const initial: RxFormState = {};
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

function composeDrug(d: Drug) {
  const form = d.dosageForm ? `${d.dosageForm}. ` : "";
  const name = d.brandName ?? d.genericName ?? "";
  const strength = d.strength ? ` ${d.strength}` : "";
  return `${form}${name}${strength}`.trim();
}

export default function RxEditor({
  rx, initialPatient, doctors, templates, defaultDentistId,
}: {
  rx?: RxLike;
  initialPatient?: { id: number; name: string } | null;
  doctors: Doctor[];
  templates: Template[];
  defaultDentistId?: number | null;
}) {
  const [state, action, pending] = useActionState(saveRx, initial);
  const editing = !!rx;

  const [patient, setPatient] = useState<{ id: number; name: string } | null>(initialPatient ?? null);
  // editing an Rx that has no linked patient ⇒ it's an anonymous/walk-in prescription
  const [anonymous, setAnonymous] = useState<boolean>(!!rx && !initialPatient);

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const c of CLINICAL) f[c.key] = (rx?.[c.key] as string) ?? "";
    return f;
  });
  const [lines, setLines] = useState<Line[]>(
    () => (rx?.drugs ?? []).map((d) => ({ drug: d.drug ?? "", dose: d.dose ?? "", meal: d.meal ?? "", duration: d.duration ?? "" }))
  );

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const addDrug = (d: Drug) => setLines((ls) => [...ls, { drug: composeDrug(d), dose: "", meal: "", duration: "" }]);
  const addBlank = () => setLines((ls) => [...ls, { drug: "", dose: "", meal: "", duration: "" }]);
  const updateLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => setLines((ls) => {
    const j = i + dir;
    if (j < 0 || j >= ls.length) return ls;
    const c = [...ls]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  function loadTemplate(name: string) {
    const t = templates.find((x) => x.name === name);
    if (!t) return;
    setFields((f) => ({
      ...f,
      complaints: t.complaints ?? f.complaints,
      findingsOnExamination: t.findingsOnExamination ?? f.findingsOnExamination,
      provisionalDiagnosis: t.provisionalDiagnosis ?? f.provisionalDiagnosis,
      differentialDiagnosis: t.differentialDiagnosis ?? f.differentialDiagnosis,
      investigationAdvised: t.investigationAdvised ?? f.investigationAdvised,
      confirmatoryDiagnosis: t.confirmatoryDiagnosis ?? f.confirmatoryDiagnosis,
      treatmentPlan: t.treatmentPlan ?? f.treatmentPlan,
      procedurePerformed: t.procedurePerformed ?? f.procedurePerformed,
      advise: t.advise ?? f.advise,
    }));
    if (t.drugs.length)
      setLines((ls) => [...ls, ...t.drugs.map((d) => ({ drug: d.drug ?? "", dose: d.dose ?? "", meal: d.meal ?? "", duration: d.duration ?? "" }))]);
  }

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={rx!.id} />}
      <input type="hidden" name="isAnonymous" value={anonymous ? "1" : "0"} />
      <input type="hidden" name="patientId" value={patient?.id ?? ""} />
      <input type="hidden" name="drugsJson" value={JSON.stringify(lines)} />
      {CLINICAL.map((c) => <input key={c.key} type="hidden" name={c.key} value={fields[c.key]} />)}

      {/* header: patient + dentist + date + template */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
              Patient
              <label className="flex items-center gap-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={anonymous} onChange={(e) => { setAnonymous(e.target.checked); if (e.target.checked) setPatient(null); }} />
                Anonymous / walk-in
              </label>
            </label>
            {anonymous ? (
              <div className="grid grid-cols-3 gap-2">
                <input name="randomName" defaultValue={rx?.randomName ?? ""} placeholder="Name" className={inputCls} />
                <input name="randomAge" defaultValue={rx?.randomAge ?? ""} placeholder="Age" className={inputCls} />
                <Combo name="randomSex" options={GENDERS} defaultValue={rx?.randomSex ?? ""}
                  placeholder="Sex" emptyLabel="—" aria-label="Sex" className={inputCls} />
              </div>
            ) : patient ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <span className="font-medium text-slate-800 dark:text-slate-200">{patient.name} <span className="text-slate-400">#{patient.id}</span></span>
                <button type="button" onClick={() => setPatient(null)} className="text-xs text-teal-700 hover:underline dark:text-teal-400">change</button>
              </div>
            ) : (
              <PatientPicker onPick={setPatient} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Prescribing doctor</span>
              <Combo
                name="dentistId"
                options={doctors.map((d) => ({ value: String(d.id), label: d.name }))}
                defaultValue={String(rx?.dentistId ?? defaultDentistId ?? "")}
                placeholder="Choose a doctor…" emptyLabel="—"
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
              <input type="date" name="rxDate" defaultValue={toDateInput(rx?.rxDate) || toDateInput(new Date())} className={`mt-1 ${inputCls}`} />
            </label>
          </div>
        </div>

        {templates.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Load template:</span>
            <div className="w-64">
              <Combo
                options={templates.map((t) => t.name)}
                value="" onChange={(v) => { if (v) loadTemplate(v); }}
                placeholder="Choose…" aria-label="Load template"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        )}
      </section>

      {/* clinical notes — above the medicines: the findings justify what is prescribed */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Clinical notes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {NOTES.map((c) => (
            <label key={c.key} className={`block ${c.full ? "sm:col-span-2" : ""}`}>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.label}</span>
              <textarea value={fields[c.key]} onChange={(e) => setField(c.key, e.target.value)} rows={2} className={`mt-1 ${inputCls}`} />
            </label>
          ))}
        </div>
      </section>

      {/* drug lines */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">℞ Medicines</h2>
          <button type="button" onClick={addBlank} className="text-xs text-teal-700 hover:underline dark:text-teal-400">+ blank line</button>
        </div>
        <DrugPicker onPick={addDrug} />

        {lines.length > 0 && (
          <ul className="mt-4 space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-xs text-slate-400">{i + 1}.</span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-12">
                    <input value={l.drug} onChange={(e) => updateLine(i, { drug: e.target.value })} placeholder="Drug" className={`sm:col-span-5 ${inputCls}`} />
                    <div className="sm:col-span-3">
                      <Combo options={DOSE_PRESETS} value={l.dose} onChange={(v) => updateLine(i, { dose: v })}
                        allowCustom placeholder="Dose ১+০+১" aria-label="Dose" className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <Combo options={MEAL_PRESETS} value={l.meal} onChange={(v) => updateLine(i, { meal: v })}
                        allowCustom placeholder="Meal" aria-label="Meal" className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <Combo options={DURATION_PRESETS} value={l.duration} onChange={(v) => updateLine(i, { duration: v })}
                        allowCustom placeholder="Duration" aria-label="Duration" className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-1 flex shrink-0 flex-col text-slate-400">
                    <button type="button" onClick={() => move(i, -1)} className="px-1 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Move up">▲</button>
                    <button type="button" onClick={() => move(i, 1)} className="px-1 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Move down">▼</button>
                  </div>
                  <button type="button" onClick={() => removeLine(i)} className="mt-1 shrink-0 px-1 text-rose-500 hover:text-rose-700" aria-label="Remove">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {lines.length === 0 && <p className="mt-3 text-center text-sm text-slate-400 dark:text-slate-500">Search a drug above to add it, or add a blank line.</p>}
      </section>

      {/* advice & follow-up — last, written after the prescription itself */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Advice &amp; follow-up</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{ADVICE.label}</span>
            <textarea value={fields[ADVICE.key]} onChange={(e) => setField(ADVICE.key, e.target.value)} rows={3} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Follow-up date</span>
            <input type="date" name="followUpDate" defaultValue={toDateInput(rx?.followUpDate)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Follow-up reason</span>
            <input name="followUpReason" defaultValue={rx?.followUpReason ?? ""} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" role="alert">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : editing ? "Save changes" : "Create prescription"}
        </button>
        <Link href={editing ? `/prescriptions/${rx!.id}` : "/prescriptions"} className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Link>
      </div>
    </form>
  );
}
