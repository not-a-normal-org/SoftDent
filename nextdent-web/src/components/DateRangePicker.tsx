"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RANGE_PRESETS, isIsoDate, matchPreset, presetRange, rangeQuery, shiftRange, type DateRange,
} from "@/lib/date-range";

/*
 * The date-range picker: quick presets, two native date inputs, and ◀ ▶ to step the
 * range back or forward by its own length (by whole months for a month range).
 *
 * Two ways to use it:
 *
 *   <DateRangePicker value={range} today={today} />
 *     URL-bound, for pages. The range lives in `?from=&to=` (yyyy-MM-dd, clinic days,
 *     both inclusive), so a view is shareable and the back button steps through it.
 *     On the server: `const today = clinicToday(); const range = parseRange(await
 *     searchParams, today)` from lib/date-range, and `rangeBounds(range)` for the
 *     instants to query between. Today is the default and is left out of the URL.
 *     Changing the range keeps every other param except `page` (or `reset`), and drops
 *     the legacy `?date=`. With `allowAll`, "All time" is offered and is
 *     `?range=all` — read it with `parseRangeOrAll`, which returns null.
 *
 *   <DateRangeControl value={range} today={today} onChange={setRange} />
 *     Controlled, for state that is not in the URL (the missed-appointments dialog).
 *
 * `today` comes from the server (`clinicToday()`) so the presets the server rendered
 * and the ones the browser computes agree, whatever timezone the browser is in.
 */

const chip = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition ${active
    ? "bg-teal-600 text-white"
    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`;
const arrow =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
const dateInput =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 sm:w-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

// A native date input reports a value per typed segment, so committing on every change
// would navigate mid-year ("0002-…"). Changes settle for this long first; picking from
// the calendar, Enter and leaving the field commit at once.
const SETTLE_MS = 500;

export type DateRangeControlProps = {
  /** null = all time (only meaningful with `allowAll`) */
  value: DateRange | null;
  /** the clinic's today, yyyy-MM-dd — from `clinicToday()` on the server */
  today: string;
  onChange: (range: DateRange | null) => void;
  /** offer an "All time" preset */
  allowAll?: boolean;
  /** a navigation is in flight: dims the control */
  pending?: boolean;
  /** accessible name of the group */
  label?: string;
};

export function DateRangeControl({ value, today, onChange, allowAll = false, pending = false, label = "Date range" }: DateRangeControlProps) {
  // What the two inputs show. It follows `value`, but also holds a half-typed date
  // that has not been committed yet.
  const [draft, setDraft] = useState({ from: value?.from ?? "", to: value?.to ?? "" });
  const [shown, setShown] = useState(value);
  if (shown?.from !== value?.from || shown?.to !== value?.to) {
    setShown(value);
    setDraft({ from: value?.from ?? "", to: value?.to ?? "" });
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fromInput = useRef<HTMLInputElement>(null);
  // the last range handed to onChange, so a blur right after the settle timer fired
  // does not send the same range twice (two identical history entries)
  // (while `value` is still the one it was sent from — once the page moves, it no longer applies)
  const sent = useRef<{ key: string; from: string } | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const preset = matchPreset(value, today);

  const commit = (r: DateRange | null) => {
    clearTimeout(timer.current);
    const key = r ? `${r.from}/${r.to}` : "all";
    const current = value ? `${value.from}/${value.to}` : "all";
    if (key === current || (sent.current?.key === key && sent.current.from === current)) return;
    sent.current = { key, from: current };
    onChange(r);
  };

  /** The range the inputs describe, or null while one is still being typed. */
  const resolve = (d: { from: string; to: string }, edited: "from" | "to"): DateRange | null => {
    const v = d[edited];
    if (!isIsoDate(v)) return null;
    const other = edited === "from" ? d.to : d.from;
    // moving one end past the other (or filling one end of an all-time range) makes a single day
    if (!isIsoDate(other)) return { from: v, to: v };
    const r = edited === "from" ? { from: v, to: other } : { from: other, to: v };
    return r.from <= r.to ? r : { from: v, to: v };
  };

  const edit = (end: "from" | "to", v: string) => {
    const next = { ...draft, [end]: v };
    setDraft(next);
    clearTimeout(timer.current);
    const r = resolve(next, end);
    if (r) timer.current = setTimeout(() => commit(r), SETTLE_MS);
  };
  const flush = (end: "from" | "to") => {
    const r = resolve(draft, end);
    if (r) commit(r);
  };

  const openCustom = () => {
    const el = fromInput.current;
    if (!el) return;
    el.focus();
    // Chrome and Safari can open the calendar straight away; elsewhere focus is enough
    try { el.showPicker?.(); } catch { /* needs a user gesture in some browsers; focus stands */ }
  };

  const input = (end: "from" | "to", name: string) => (
    <input
      ref={end === "from" ? fromInput : undefined}
      type="date"
      aria-label={name}
      value={draft[end]}
      onChange={(e) => edit(end, e.target.value)}
      onBlur={() => flush(end)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); flush(end); } }}
      className={dateInput}
    />
  );

  return (
    <div role="group" aria-label={label} aria-busy={pending || undefined}
      className={`space-y-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap gap-1.5">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} type="button" aria-pressed={preset === p.key} className={chip(preset === p.key)}
            onClick={() => commit(presetRange(p.key, today))}>
            {p.label}
          </button>
        ))}
        {allowAll && (
          <button type="button" aria-pressed={value === null} className={chip(value === null)} onClick={() => commit(null)}>
            All time
          </button>
        )}
        <button type="button" aria-pressed={value !== null && preset === null} className={chip(value !== null && preset === null)}
          onClick={openCustom}>
          Custom
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className={arrow} aria-label="Earlier dates" title="Earlier"
          disabled={!value} onClick={() => value && commit(shiftRange(value, -1))}>◀</button>
        {/* on a phone the two dates stack between the arrows: side by side they get
            about 100px each, which cuts off "22/09/2026" */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none sm:flex-row sm:items-center">
          {input("from", "From date")}
          <span aria-hidden className="hidden text-slate-400 sm:inline">–</span>
          {input("to", "To date")}
        </div>
        <button type="button" className={arrow} aria-label="Later dates" title="Later"
          disabled={!value} onClick={() => value && commit(shiftRange(value, 1))}>▶</button>
      </div>
    </div>
  );
}

export type DateRangePickerProps = {
  /** the range the page is showing — what `parseRange` / `parseRangeOrAll` returned */
  value: DateRange | null;
  today: string;
  allowAll?: boolean;
  /** params to drop when the range changes, because they index into the old result; default ["page"] */
  reset?: string[];
  label?: string;
};

export default function DateRangePicker({ value, today, allowAll = false, reset = ["page"], label }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = (r: DateRange | null) => {
    const u = new URLSearchParams(params.toString());
    for (const k of ["from", "to", "date", "range", ...reset]) u.delete(k);
    for (const [k, v] of Object.entries(rangeQuery(r, today))) u.set(k, v);
    const qs = u.toString();
    // scroll: false — the picker sits at the top of what it filters; jumping the page
    // to the top on every step through the days is disorienting
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return <DateRangeControl value={value} today={today} onChange={go} allowAll={allowAll} pending={pending} label={label} />;
}
