"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Combo from "@/components/Combo";
import {
  seedTerms, cleanTerm, termsToPost, parseDrugHistory, drugHistoryToPost, type DrugHistoryRow,
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
 * A picked term is a starting point, not the finished entry. The clinic asked for
 * "Bad breath" to become "Bad breath since 2 weeks", and some of its options only make
 * sense completed — "Food accumulation in", "Pulp necrosis in" — so picking one adds an
 * editable row, prefilled, with the caret left at the end to carry on typing. They used
 * to be fixed chips.
 *
 * They all post a plain string in the shape the database already holds, so the printed
 * prescription and every existing row keep working untouched.
 */

/** A term on its own, or one carrying a hint shown only in the dropdown. */
export type TermOption = string | { value: string; hint?: string };

const termValue = (o: TermOption): string => (typeof o === "string" ? o : o.value);

// Row ids are React keys, never written into the DOM, so a counter shared by the
// server and browser renders cannot cause a hydration mismatch.
let lastRowId = 0;
const newRowId = () => ++lastRowId;

/**
 * What a row may hold. "•" is the separator in the stored string — one typed inside a
 * row would split it in two on the next read — and a row is one line.
 */
const scrub = (v: string) => v.replace(/•/g, "").replace(/[\r\n]+/g, " ");

/** Enter as a key, not as the end of an IME composition (Bangla is typed through one). */
const isEnter = (e: React.KeyboardEvent) =>
  e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229;

function focusAtEnd(el: HTMLInputElement | HTMLTextAreaElement | null | undefined) {
  if (!el) return;
  el.focus();
  const n = el.value.length;
  el.setSelectionRange(n, n);
}

/** One box, shared by the row text and its invisible twin, so the two wrap alike. */
const rowBox =
  "col-start-1 row-start-1 w-full min-w-0 rounded-lg border px-3 py-1.5 text-sm leading-5 whitespace-pre-wrap break-words";

/** An entry already in the list: tinted like the chips it replaces, edited in place. */
const rowSkin =
  "resize-none overflow-hidden border-teal-200 bg-teal-50/60 text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/30 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-800";

/** The other boxes in a drug row, the same height as the row text beside them. */
const compactInput =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

/**
 * The text of a row. A textarea that grows with what is written rather than a
 * one-line input: the advice options are whole sentences, and on a phone a single
 * line would show the first few words of them. It still behaves as one line — Enter
 * never makes a new one — because the stored format has no room for line breaks.
 *
 * The height comes from an invisible copy of the text in the same grid cell, so it
 * also follows the box getting wider or narrower without measuring anything.
 */
function RowText({
  value, onChange, onEnter, label, placeholder, inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  label: string;
  placeholder?: string;
  inputRef: (el: HTMLTextAreaElement | null) => void | (() => void);
}) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1">
      <div aria-hidden className={`${rowBox} invisible border-transparent`}>{value + " "}</div>
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        enterKeyHint="next"
        autoComplete="off"
        onChange={(e) => {
          const el = e.currentTarget;
          const raw = el.value;
          const v = scrub(raw);
          onChange(v);
          // React puts the caret at the end when it rewrites the value; put it back
          // where the stripped character was
          if (v !== raw) {
            const at = scrub(raw.slice(0, el.selectionStart ?? raw.length)).length;
            requestAnimationFrame(() => el.setSelectionRange(at, at));
          }
        }}
        onKeyDown={(e) => {
          // a row is finished, not a form submitted: go back to the picker for the next
          if (isEnter(e)) { e.preventDefault(); onEnter(); }
        }}
        className={`${rowBox} ${rowSkin}`}
      />
    </div>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: (byKeyboard: boolean) => void }) {
  return (
    <button
      type="button"
      // a click from Enter or Space has no pointer behind it
      onClick={(e) => onRemove(e.detail === 0)}
      aria-label={label}
      title={label}
      className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
    >
      ✕
    </button>
  );
}

/**
 * The dropdown under a list of rows, and where focus goes around it.
 *
 * Focus follows an addition into the new row only when the clinician chose it — Enter,
 * or a click in the list. The picker also adds what was typed when it is left by Tab or
 * by a click elsewhere; pulling focus back into the row then would drop the next Tab on
 * the row's ✕, or snatch the field the clinician had just clicked into.
 */
function usePicker(rows: unknown) {
  const box = useRef<HTMLDivElement>(null);
  const chose = useRef(false);
  const pending = useRef<(() => HTMLInputElement | HTMLTextAreaElement | null | undefined) | null>(null);

  // the new row exists only after the render its addition causes
  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    focusAtEnd(target());
  }, [rows]);

  return {
    /** spread on the element wrapping the picker's Combo */
    boxProps: {
      ref: box,
      onKeyDownCapture: (e: React.KeyboardEvent) => { chose.current = isEnter(e); },
      onMouseDownCapture: () => { chose.current = true; },
      onKeyDown: (e: React.KeyboardEvent) => {
        // Enter with the list closed would otherwise submit the whole form from here
        if (isEnter(e) && !e.defaultPrevented) e.preventDefault();
      },
    },
    /** whether the addition being handled now was chosen (and so should take focus) */
    takeChoice: () => { const c = chose.current; chose.current = false; return c; },
    focusAfterRender: (target: () => HTMLInputElement | HTMLTextAreaElement | null | undefined) => {
      pending.current = target;
    },
    focusPicker: () => box.current?.querySelector<HTMLInputElement>("input[role=combobox]")?.focus(),
  };
}

type Row = { id: number; text: string };

/**
 * Pick terms out of a vocabulary, or type one the vocabulary does not have yet, and
 * write on from there.
 *
 * Generalised out of the medical-history box once the consultant's own pick-lists
 * arrived: every clinical heading on a prescription is the same shape — a short run of
 * named terms, not prose — and they all have to post the same "• A • B" string.
 */
export function TermPickerField({
  name, defaultValue, options, placeholder = "Add…", ariaLabel = "Add a term", rowLabel,
}: {
  name: string;
  defaultValue?: string | null;
  /** known terms, most-used first */
  options: readonly TermOption[];
  placeholder?: string;
  /** names the picker */
  ariaLabel?: string;
  /** names the rows, numbered: "Chief complaints 1" */
  rowLabel?: string;
}) {
  // what the record held when the form opened: posted back as-is until it is edited
  const [original] = useState(defaultValue ?? "");
  const [rows, setRows] = useState<Row[]>(() => seedTerms(defaultValue).map((text) => ({ id: newRowId(), text })));
  const inputs = useRef(new Map<number, HTMLTextAreaElement>());
  const picker = usePicker(rows);
  const label = rowLabel ?? ariaLabel;

  const add = (v: string) => {
    const focus = picker.takeChoice();
    const t = cleanTerm(v);
    if (!t) return;
    // case-insensitive, so "htn" does not become a second HTN; go to the one there is
    const same = rows.find((r) => cleanTerm(r.text).toLowerCase() === t.toLowerCase());
    if (same) {
      if (focus) focusAtEnd(inputs.current.get(same.id));
      return;
    }
    const id = newRowId();
    if (focus) picker.focusAfterRender(() => inputs.current.get(id));
    // the trailing space is the blank to write in: "Bad breath " → "Bad breath since 2 weeks"
    setRows((rs) => [...rs, { id, text: `${t} ` }]);
  };

  const remove = (id: number, byKeyboard: boolean) => {
    const i = rows.findIndex((r) => r.id === id);
    const rest = rows.filter((r) => r.id !== id);
    setRows(rest);
    // a keyboard user would otherwise be dropped back at the top of the page
    if (!byKeyboard) return;
    const next = rest[i] ?? rest[i - 1];
    if (next) focusAtEnd(inputs.current.get(next.id));
    else picker.focusPicker();
  };

  // What is already in the list is not offered again — unless it has been written on:
  // "Food accumulation in 36" leaves "Food accumulation in" free for 46.
  const choices = useMemo(() => {
    const taken = new Set(rows.map((r) => cleanTerm(r.text).toLowerCase()));
    return options
      .filter((o) => !taken.has(termValue(o).toLowerCase()))
      .map((o) => (typeof o === "string" ? o : { value: o.value, label: o.value, hint: o.hint }));
  }, [options, rows]);

  return (
    <div className="mt-1 space-y-1.5">
      <input type="hidden" name={name} value={termsToPost(original, rows.map((r) => r.text))} />
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-start gap-1">
              <RowText
                value={r.text}
                onChange={(text) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, text } : x)))}
                onEnter={picker.focusPicker}
                label={`${label} ${i + 1}`}
                inputRef={(el) => {
                  if (!el) return;
                  inputs.current.set(r.id, el);
                  return () => { inputs.current.delete(r.id); };
                }}
              />
              <RemoveButton
                label={`Remove ${cleanTerm(r.text) || `${label} ${i + 1}`}`}
                onRemove={(byKeyboard) => remove(r.id, byKeyboard)}
              />
            </li>
          ))}
        </ul>
      )}
      <div {...picker.boxProps}>
        <Combo
          options={choices}
          value=""
          onChange={add}
          allowCustom
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      </div>
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
      rowLabel="Medical history"
    />
  );
}

const SINCE_HINT = "Since, e.g. 2019";
const DURATIONS = ["Ongoing", "1 month", "3 months", "6 months", "1 year", "2 years", "5 years+"];

type DrugRow = DrugHistoryRow & { id: number };

/**
 * Drug history: the same list-of-rows-over-a-picker as the term fields, except that a
 * row has three parts — the drug, how long, since when — and the picker searches the
 * drug catalogue. Picking a drug adds its row and moves on to the duration, which is
 * what is written next.
 */
export function DrugHistoryField({
  name, defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [original] = useState(defaultValue ?? "");
  const [rows, setRows] = useState<DrugRow[]>(() =>
    parseDrugHistory(defaultValue).map((r) => ({ ...r, id: newRowId() }))
  );
  const drugInputs = useRef(new Map<number, HTMLTextAreaElement>());
  const durationBoxes = useRef(new Map<number, HTMLDivElement>());
  const picker = usePicker(rows);

  const set = (id: number, patch: Partial<DrugHistoryRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const add = (v: string) => {
    const focus = picker.takeChoice();
    const drug = cleanTerm(v);
    if (!drug) return;
    const id = newRowId();
    if (focus) {
      picker.focusAfterRender(() =>
        durationBoxes.current.get(id)?.querySelector<HTMLInputElement>("input[role=combobox]")
      );
    }
    setRows((rs) => [...rs, { id, drug, duration: "", since: "" }]);
  };

  const remove = (id: number, byKeyboard: boolean) => {
    const i = rows.findIndex((r) => r.id === id);
    const rest = rows.filter((r) => r.id !== id);
    setRows(rest);
    if (!byKeyboard) return;
    const next = rest[i] ?? rest[i - 1];
    if (next) focusAtEnd(drugInputs.current.get(next.id));
    else picker.focusPicker();
  };

  return (
    <div className="mt-1 space-y-1.5">
      <input type="hidden" name={name} value={drugHistoryToPost(original, rows)} />

      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex items-start gap-1"
              onKeyDown={(e) => {
                // Enter anywhere in the row finishes it, as in the term rows; an open
                // duration list has already taken its own Enter
                if (isEnter(e) && !e.defaultPrevented) { e.preventDefault(); picker.focusPicker(); }
              }}
            >
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-12">
                <div className="col-span-2 min-w-0 sm:col-span-6">
                  <RowText
                    value={r.drug}
                    onChange={(drug) => set(r.id, { drug })}
                    onEnter={picker.focusPicker}
                    label={`Drug ${i + 1}`}
                    placeholder="Drug"
                    inputRef={(el) => {
                      if (!el) return;
                      drugInputs.current.set(r.id, el);
                      return () => { drugInputs.current.delete(r.id); };
                    }}
                  />
                </div>
                <div
                  className="min-w-0 sm:col-span-3"
                  ref={(el) => {
                    if (!el) return;
                    durationBoxes.current.set(r.id, el);
                    return () => { durationBoxes.current.delete(r.id); };
                  }}
                >
                  <Combo
                    options={DURATIONS}
                    value={r.duration}
                    onChange={(v) => set(r.id, { duration: scrub(v) })}
                    allowCustom
                    placeholder="Duration"
                    aria-label={`Duration ${i + 1}`}
                    className={compactInput}
                  />
                </div>
                <input
                  value={r.since}
                  onChange={(e) => set(r.id, { since: scrub(e.target.value) })}
                  placeholder={SINCE_HINT}
                  aria-label={`Since ${i + 1}`}
                  autoComplete="off"
                  enterKeyHint="next"
                  className={`sm:col-span-3 ${compactInput}`}
                />
              </div>
              <RemoveButton
                label={`Remove ${cleanTerm(r.drug) || `drug ${i + 1}`}`}
                onRemove={(byKeyboard) => remove(r.id, byKeyboard)}
              />
            </li>
          ))}
        </ul>
      )}

      <div {...picker.boxProps}>
        <Combo
          search={searchDrugs}
          value=""
          onChange={add}
          allowCustom
          placeholder="Add a drug — search the catalogue…"
          aria-label="Add a drug"
        />
      </div>
    </div>
  );
}
