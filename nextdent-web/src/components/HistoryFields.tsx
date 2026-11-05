"use client";

import { useMemo, useState } from "react";
import Combo from "@/components/Combo";
import {
  seedTerms, formatTerms, parseDrugHistory, formatDrugHistory, type DrugHistoryRow,
} from "@/lib/history-terms";
import { searchDrugs } from "@/lib/drug-search-client";

/**
 * The prescription's term pickers — history, and now every clinical heading that has
 * a vocabulary — plus drug history, which has a catalogue instead of a list.
 *
 * None of them were ever really prose: across the imported records they are a bulleted run
 * of terms, and 88 distinct ones cover 1,120 rows — NAD, HTN, DM and Asthma alone
 * account for most of it. Typed by hand they drifted ("Hypothyroidism" 23 times,
 * "Hyporthyroidism" 15, "Hypertension" 4 against "HTN" 392), which is exactly the
 * kind of spread that makes the data impossible to search later. Picking from a list
 * stops the drift; typing a new term is still allowed, because the vocabulary has to
 * grow (nobody is going to find "Ca Tongue Surgery 2017" in a dropdown).
 *
 * They all post a plain string in the shape the database already holds, so the printed
 * prescription and every existing row keep working untouched.
 */

const chip =
  "inline-flex max-w-full items-start gap-1 rounded-full bg-teal-50 py-1 pl-2.5 pr-1 text-xs font-medium text-teal-800 dark:bg-teal-500/15 dark:text-teal-300";

/** A term on its own, or one carrying a hint shown only in the dropdown. */
export type TermOption = string | { value: string; hint?: string };

const termValue = (o: TermOption): string => (typeof o === "string" ? o : o.value);

/**
 * Pick terms out of a vocabulary, or type one the vocabulary does not have yet.
 *
 * Generalised out of the medical-history box once the consultant's own pick-lists
 * arrived: every clinical heading on a prescription is the same shape — a short run of
 * named terms, not prose — and they all have to post the same "• A • B" string.
 */
export function TermPickerField({
  name, defaultValue, options, placeholder = "Add…", ariaLabel = "Add a term",
}: {
  name: string;
  defaultValue?: string | null;
  /** known terms, most-used first */
  options: readonly TermOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [terms, setTerms] = useState<string[]>(() => seedTerms(defaultValue));
  const [draft, setDraft] = useState("");

  const add = (v: string) => {
    const t = v.trim();
    // case-insensitive, so "htn" does not become a second HTN
    if (!t || terms.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(""); return; }
    setTerms((ts) => [...ts, t]);
    setDraft("");
  };

  // what is already picked is not offered again
  const choices = useMemo(
    () =>
      options
        .filter((o) => !terms.some((t) => t.toLowerCase() === termValue(o).toLowerCase()))
        .map((o) => (typeof o === "string" ? o : { value: o.value, label: o.value, hint: o.hint })),
    [options, terms]
  );

  return (
    <div className="mt-1 space-y-2">
      <input type="hidden" name={name} value={formatTerms(terms)} />
      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {terms.map((t, i) => (
            <li key={`${t}-${i}`} className={chip}>
              {/* advice runs to a full sentence, so the chip has to be allowed to wrap */}
              <span className="min-w-0 break-words">{t}</span>
              <button
                type="button"
                onClick={() => setTerms((ts) => ts.filter((_, j) => j !== i))}
                aria-label={`Remove ${t}`}
                className="rounded-full px-1 text-teal-600 hover:bg-teal-100 hover:text-teal-900 dark:text-teal-400 dark:hover:bg-teal-500/20"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Combo
        options={choices}
        value={draft}
        onChange={add}
        allowCustom
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/** Medical history: the same picker, with the wording it has always had. */
export function MedicalHistoryField({
  name, defaultValue, options, placeholder = "Add a condition…",
}: {
  name: string;
  defaultValue?: string | null;
  options: readonly TermOption[];
  placeholder?: string;
}) {
  return (
    <TermPickerField
      name={name}
      defaultValue={defaultValue}
      options={options}
      placeholder={placeholder}
      ariaLabel="Add to history"
    />
  );
}

const SINCE_HINT = "e.g. 2019";
const DURATIONS = ["Ongoing", "1 month", "3 months", "6 months", "1 year", "2 years", "5 years+"];

export function DrugHistoryField({
  name, defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [rows, setRows] = useState<DrugHistoryRow[]>(() => parseDrugHistory(defaultValue));

  const set = (i: number, patch: Partial<DrugHistoryRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (drug = "") => setRows((rs) => [...rs, { drug, duration: "", since: "" }]);

  return (
    <div className="mt-1 space-y-2">
      <input type="hidden" name={name} value={formatDrugHistory(rows)} />

      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Combo
                search={searchDrugs}
                options={r.drug ? [r.drug] : []}
                value={r.drug}
                onChange={(v) => set(i, { drug: v })}
                allowCustom
                placeholder="Search the drug catalogue…"
                aria-label={`Drug ${i + 1}`}
              />
            </div>
            <div className="sm:col-span-3">
              <Combo
                options={DURATIONS}
                value={r.duration}
                onChange={(v) => set(i, { duration: v })}
                allowCustom
                placeholder="Duration"
                aria-label={`Duration ${i + 1}`}
              />
            </div>
            <div className="sm:col-span-3">
              <input
                value={r.since}
                onChange={(e) => set(i, { since: e.target.value })}
                placeholder={SINCE_HINT}
                aria-label={`Since ${i + 1}`}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            aria-label={`Remove drug ${i + 1}`}
            className="mt-2 shrink-0 px-1 text-rose-500 hover:text-rose-700"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => addRow()}
        className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
      >
        + add a drug
      </button>
    </div>
  );
}
