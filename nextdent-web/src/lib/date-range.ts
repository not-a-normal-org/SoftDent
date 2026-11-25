// Isomorphic date-range helpers: the picker (client) and every page that reads
// `?from=&to=` (server) must agree on what a range means, so both use this file.
//
// A range is two clinic-calendar days, "yyyy-MM-dd", both inclusive. Calendar
// arithmetic below runs on the bare y/m/d through Date.UTC, never through a host
// timezone, so "the day before 1 Nov" is 31 Oct on a UTC server and in a Dhaka
// browser alike. Only `rangeBounds` turns days into instants, via `fromDateInput`,
// which reckons in Asia/Dhaka.

import { fmtDate, fromDateInput, toDateInput } from "./format";

export type DateRange = { from: string; to: string };
export type RangePreset = "today" | "yesterday" | "7d" | "month" | "lastMonth";

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const utc = (iso: string) => {
  const m = ISO.exec(iso)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A real calendar day in a plausible year. The year bound is not pedantry: a native
 * date input reports "0002-11-25" while someone is still typing "2026", and a page
 * that navigates on that would jump to the year 2.
 */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const y = +s.slice(0, 4);
  return y >= 1900 && y <= 2200 && iso(utc(s)) === s;
}

export const addDays = (day: string, n: number) => {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const addMonths = (day: string, n: number) => {
  const d = utc(monthStart(day));
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
};
const monthEnd = (day: string) => addDays(addMonths(day, 1), -1);

/** Today on the clinic's calendar — not the host's, which is UTC in production. */
export const clinicToday = () => toDateInput(new Date());

export function presetRange(p: RangePreset, today: string): DateRange {
  switch (p) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    // seven days counting today, the way "this past week" is meant at a front desk
    case "7d": return { from: addDays(today, -6), to: today };
    // the whole month, not the 1st-to-today: an appointment list for "this month"
    // should show what is still booked, and the money figures have nothing ahead anyway
    case "month": return { from: monthStart(today), to: monthEnd(today) };
    case "lastMonth": { const s = addMonths(today, -1); return { from: s, to: monthEnd(s) }; }
  }
}

export function matchPreset(r: DateRange | null, today: string): RangePreset | null {
  if (!r) return null;
  for (const { key } of RANGE_PRESETS) {
    const p = presetRange(key, today);
    if (p.from === r.from && p.to === r.to) return key;
  }
  return null;
}

export const isToday = (r: DateRange | null, today: string) => !!r && r.from === today && r.to === today;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
/** "Tue" for a calendar day. The day is already the clinic's, so it is read as UTC, not re-zoned. */
export const weekday = (day: string) => WEEKDAY.format(utc(day));

/** Days covered, counting both ends. */
export const rangeDays = (r: DateRange) => Math.round((+utc(r.to) - +utc(r.from)) / 86_400_000) + 1;

type RawParams = { from?: string | string[]; to?: string | string[]; date?: string | string[]; range?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The range a page should show, from its search params. Defaults to today.
 *
 * `?date=` is the single-day link the appointments page used before ranges (and that
 * saving an appointment still redirects to); it reads as from = to = date so old
 * bookmarks keep working. A lone `from` or `to` is a single day. A backwards range is
 * swapped rather than rejected — it is obvious what was meant.
 */
export function parseRange(sp: RawParams, today: string): DateRange {
  let from = one(sp.from), to = one(sp.to);
  if (!isIsoDate(from) && !isIsoDate(to)) from = to = one(sp.date);
  if (!isIsoDate(from)) from = to;
  if (!isIsoDate(to)) to = from;
  if (!isIsoDate(from) || !isIsoDate(to)) return { from: today, to: today };
  return from <= to ? { from, to } : { from: to, to: from };
}

/** As `parseRange`, but `?range=all` means no date filter: null. Only for pages that offer "All time". */
export function parseRangeOrAll(sp: RawParams, today: string): DateRange | null {
  return one(sp.range) === "all" ? null : parseRange(sp, today);
}

/** The instants a range covers: clinic midnight on `from` up to (not including) clinic midnight after `to`. */
export function rangeBounds(r: DateRange): { start: Date; end: Date } {
  // both strings are validated, so fromDateInput cannot return null here
  return { start: fromDateInput(r.from)!, end: fromDateInput(addDays(r.to, 1))! };
}

/**
 * The search params that encode a range. Today is the default and is left out, so a
 * plain link to the page shows today; "all" is spelled out.
 */
export function rangeQuery(r: DateRange | null, today: string): Record<string, string> {
  if (!r) return { range: "all" };
  if (isToday(r, today)) return {};
  return { from: r.from, to: r.to };
}

const short = (day: string) => fmtDate(fromDateInput(day)).replace(/ \d{4}$/, "");

/** "Today", "Last 7 days", "07 Oct 2026", "01 Oct – 15 Oct 2026", "All time". */
export function rangeLabel(r: DateRange | null, today: string): string {
  if (!r) return "All time";
  const p = matchPreset(r, today);
  return p ? RANGE_PRESETS.find((x) => x.key === p)!.label : rangeDates(r);
}

/** The dates themselves, for a subtitle under a preset name: "19 Nov – 25 Nov 2026". */
export function rangeDates(r: DateRange): string {
  if (r.from === r.to) return fmtDate(fromDateInput(r.from));
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${sameYear ? short(r.from) : fmtDate(fromDateInput(r.from))} – ${fmtDate(fromDateInput(r.to))}`;
}

/**
 * The same-sized range just before (-1) or after (+1). A range that is exactly one or
 * more whole calendar months steps by months, so "Last month" steps to the month
 * before it rather than to a 30-day window that straddles two months.
 */
export function shiftRange(r: DateRange, dir: -1 | 1): DateRange {
  if (r.from === monthStart(r.from) && r.to === monthEnd(r.to)) {
    const months = (+r.to.slice(0, 4) - +r.from.slice(0, 4)) * 12 + (+r.to.slice(5, 7) - +r.from.slice(5, 7)) + 1;
    const from = addMonths(r.from, dir * months);
    return { from, to: monthEnd(addMonths(from, months - 1)) };
  }
  const n = rangeDays(r);
  return { from: addDays(r.from, dir * n), to: addDays(r.to, dir * n) };
}
