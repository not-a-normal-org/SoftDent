"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveRxTemplate, type RxTemplateFormState } from "@/lib/actions/rx-templates";
import DrugPicker, { type Drug } from "@/components/DrugPicker";

type Line = { drug: string; dose: string; meal: string; duration: string };
type Tpl = {
  id: number; name: string; complaints: string | null; findingsOnExamination: string | null;
  provisionalDiagnosis: string | null; differentialDiagnosis: string | null; investigationAdvised: string | null;
  confirmatoryDiagnosis: string | null; treatmentPlan: string | null; procedurePerformed: string | null;
  advise: string | null; followUpDay: number | null; followUpReason: string | null;
  drugs: { drug: string | null; dose: string | null; meal: string | null; duration: string | null }[];
};

const CLINICAL: { key: string; label: string; full?: boolean }[] = [
  { key: "complaints", label: "Chief complaints", full: true },
  { key: "findingsOnExamination", label: "Findings on examination" },
  { key: "provisionalDiagnosis", label: "Provisional diagnosis" },
  { key: "differentialDiagnosis", label: "Differential diagnosis" },
  { key: "confirmatoryDiagnosis", label: "Diagnosis" },
  { key: "investigationAdvised", label: "Investigation advised" },
  { key: "treatmentPlan", label: "Treatment plan" },
  { key: "procedurePerformed", label: "Procedure performed" },
  { key: "advise", label: "Advice", full: true },
];
const DOSE = ["১+০+১", "১+১+১", "০+০+১", "১+০+০"];
const MEAL = ["খাবার পর খাবেন", "খাবার আগে খাবেন"];
const DUR = ["৩ দিন", "৫ দিন", "৭ দিন", "১৪ দিন", "চলবে"];

const initial: RxTemplateFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const composeDrug = (d: Drug) => `${d.dosageForm ? d.dosageForm + ". " : ""}${d.brandName ?? d.genericName ?? ""}${d.strength ? " " + d.strength : ""}`.trim();

export default function RxTemplateEditor({ template }: { template?: Tpl }) {
  const [state, action, pending] = useActionState(saveRxTemplate, initial);
  const [lines, setLines] = useState<Line[]>(() => (template?.drugs ?? []).map((d) => ({ drug: d.drug ?? "", dose: d.dose ?? "", meal: d.meal ?? "", duration: d.duration ?? "" })));
  const t = template;

  const update = (idx: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === idx ? { ...l, ...patch } : l)));

  return (
    <form action={action} className="space-y-6">
      {t && <input type="hidden" name="id" value={t.id} />}
      <input type="hidden" name="drugsJson" value={JSON.stringify(lines)} />
      <datalist id="tDose">{DOSE.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="tMeal">{MEAL.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="tDur">{DUR.map((v) => <option key={v} value={v} />)}</datalist>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Template name <span className="text-rose-500">*</span></span>
          <input name="name" defaultValue={t?.name ?? ""} required className={inputCls} /></label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">℞ Medicines</h2>
          <button type="button" onClick={() => setLines((ls) => [...ls, { drug: "", dose: "", meal: "", duration: "" }])} className="text-xs text-teal-700 hover:underline dark:text-teal-400">+ blank line</button>
        </div>
        <DrugPicker onPick={(d) => setLines((ls) => [...ls, { drug: composeDrug(d), dose: "", meal: "", duration: "" }])} />
        {lines.length > 0 && (
          <ul className="mt-4 space-y-2">
            {lines.map((l, idx) => (
              <li key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                <span className="mt-2 w-5 text-center text-xs text-slate-400">{idx + 1}.</span>
                <div className="grid flex-1 gap-2 sm:grid-cols-12">
                  <input value={l.drug} onChange={(e) => update(idx, { drug: e.target.value })} placeholder="Drug" className={`sm:col-span-5 ${inputCls} mt-0`} />
                  <input value={l.dose} onChange={(e) => update(idx, { dose: e.target.value })} list="tDose" placeholder="Dose" className={`sm:col-span-3 ${inputCls} mt-0`} />
                  <input value={l.meal} onChange={(e) => update(idx, { meal: e.target.value })} list="tMeal" placeholder="Meal" className={`sm:col-span-2 ${inputCls} mt-0`} />
                  <input value={l.duration} onChange={(e) => update(idx, { duration: e.target.value })} list="tDur" placeholder="Duration" className={`sm:col-span-2 ${inputCls} mt-0`} />
                </div>
                <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== idx))} className="mt-1 px-1 text-rose-500 hover:text-rose-700">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Clinical notes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CLINICAL.map((c) => (
            <label key={c.key} className={`block ${c.full ? "sm:col-span-2" : ""}`}>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.label}</span>
              <textarea name={c.key} defaultValue={(t?.[c.key as keyof Tpl] as string) ?? ""} rows={2} className={inputCls} />
            </label>
          ))}
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Follow-up (days)</span>
            <input type="number" name="followUpDay" defaultValue={t?.followUpDay ?? ""} className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Follow-up reason</span>
            <input name="followUpReason" defaultValue={t?.followUpReason ?? ""} className={inputCls} /></label>
        </div>
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : t ? "Save template" : "Create template"}
        </button>
        <Link href="/settings/rx-templates" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400">Cancel</Link>
      </div>
    </form>
  );
}
