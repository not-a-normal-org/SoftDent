// Calendar ranges for the payouts pages, as plain "YYYY-MM-DD" clinic days.
//
// A day here is a day on the clinic's calendar (Asia/Dhaka), and it never becomes a Date
// until it is formatted, so no host timezone can move it. The database buckets payments
// on the same calendar (see `splitCte` in payouts.ts). `Date.UTC` below is only a day
// counter for "add a day" and "last day of the month", never a point in time.
// Isomorphic: imported by server pages and the client export dialog alike.

import { toDateInput } from "./format";

/** Inclusive range of clinic days. `null` is open-ended: no `from` and no `to` is all time. */
export type DayRange = { from: string | null; to: string | null };
export type Granularity = "year" | "month" | "day";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const split = (day: string) => day.split("-").map(Number) as [number, number, number];
const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);

/** A real calendar day as "YYYY-MM-DD", or null. Rejects "2026-02-30" and junk. */
export function parseDay(s: string | null | undefined): string | null {
  const m = ISO.exec((s ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 1900 || y > 2999) return null;
  return iso(y, mo - 1, d) === m[0] ? m[0] : null;
}

export const addDays = (day: string, n: number) => { const [y, m, d] = split(day); return iso(y, m - 1, d + n); };
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
export const monthEnd = (day: string) => { const [y, m] = split(day); return iso(y, m, 0); };
export const yearStart = (day: string) => `${day.slice(0, 4)}-01-01`;
export const yearEnd = (day: string) => `${day.slice(0, 4)}-12-31`;
const addMonths = (day: string, n: number) => { const [y, m] = split(day); return iso(y, m - 1 + n, 1); };

/** Today on the clinic's calendar, whatever the host's zone. */
export const clinicToday = (now = new Date()) => toDateInput(now);

/** From URL values to a clean range: invalid days are dropped, a reversed range is swapped. */
export function normalizeRange(from: string | null | undefined, to: string | null | undefined): DayRange {
  let f = parseDay(from), t = parseDay(to);
  if (f && t && f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

export type RangeKind = "all" | "year" | "month" | "day" | "custom";

/** Whether a range is exactly one calendar year, month or day: these step, label and drill as units. */
export function rangeKind(r: DayRange): RangeKind {
  if (!r.from && !r.to) return "all";
  if (!r.from || !r.to) return "custom";
  if (r.from === r.to) return "day";
  if (r.from === monthStart(r.from) && r.to === monthEnd(r.from)) return "month";
  if (r.from === yearStart(r.from) && r.to === yearEnd(r.from)) return "year";
  return "custom";
}

/** The range one step earlier (-1) or later (+1): a month moves by a month, a custom range by its own length. */
export function shiftRange(r: DayRange, step: -1 | 1): DayRange | null {
  const kind = rangeKind(r);
  if (kind === "all" || !r.from || !r.to) return null;
  if (kind === "year") { const y = +r.from.slice(0, 4) + step; return { from: `${y}-01-01`, to: `${y}-12-31` }; }
  if (kind === "month") { const f = addMonths(r.from, step); return { from: f, to: monthEnd(f) }; }
  const [fy, fm, fd] = split(r.from), [ty, tm, td] = split(r.to);
  const len = (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000 + 1;
  return { from: addDays(r.from, step * len), to: addDays(r.to, step * len) };
}

/** The range a bucket covers: the bucket key is its first day ("2026-03-01" for March). */
export function bucketRange(key: string, by: Granularity): DayRange {
  if (by === "year") return { from: yearStart(key), to: yearEnd(key) };
  if (by === "month") return { from: monthStart(key), to: monthEnd(key) };
  return { from: key, to: key };
}

// Formatting a calendar day: build the UTC midnight and format it *in UTC*, so the
// label is that day and not the day the host's zone thinks it is.
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });
const F_DAY = fmt({ day: "numeric", month: "short", year: "numeric" });
const F_DAY_SHORT = fmt({ day: "numeric", month: "short" });
const F_WEEKDAY = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const F_MONTH = fmt({ month: "short", year: "numeric" });
const F_MONTH_LONG = fmt({ month: "long", year: "numeric" });
const asDate = (day: string) => { const [y, m, d] = split(day); return new Date(Date.UTC(y, m - 1, d)); };

export const dayLabel = (day: string) => F_DAY.format(asDate(day));
export const weekdayLabel = (day: string) => F_WEEKDAY.format(asDate(day));

/** "2026", "Mar 2026" or "Sat, 14 Mar 2026" for a bucket key. */
export function bucketLabel(key: string, by: Granularity): string {
  if (by === "year") return key.slice(0, 4);
  if (by === "month") return F_MONTH.format(asDate(key));
  return F_WEEKDAY.format(asDate(key));
}

/** A range in words: "All time", "2026", "March 2026", "14 Mar 2026", "1 Mar – 10 Apr 2026". */
export function rangeLabel(r: DayRange): string {
  switch (rangeKind(r)) {
    case "all": return "All time";
    case "year": return r.from!.slice(0, 4);
    case "month": return F_MONTH_LONG.format(asDate(r.from!));
    case "day": return F_DAY.format(asDate(r.from!));
  }
  if (!r.from) return `Up to ${dayLabel(r.to!)}`;
  if (!r.to) return `From ${dayLabel(r.from)}`;
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${sameYear ? F_DAY_SHORT.format(asDate(r.from)) : dayLabel(r.from)} – ${dayLabel(r.to)}`;
}

export type RangePreset = { key: string; label: string; range: DayRange };

/** The ranges a payroll run actually uses, worked out from today on the clinic's calendar. */
export function rangePresets(today = clinicToday()): RangePreset[] {
  const lastMonth = addMonths(today, -1);
  const lastYear = String(+today.slice(0, 4) - 1);
  return [
    { key: "this-month", label: "This month", range: { from: monthStart(today), to: monthEnd(today) } },
    { key: "last-month", label: "Last month", range: { from: lastMonth, to: monthEnd(lastMonth) } },
    { key: "this-year", label: "This year", range: { from: yearStart(today), to: yearEnd(today) } },
    { key: "last-year", label: "Last year", range: { from: `${lastYear}-01-01`, to: `${lastYear}-12-31` } },
    { key: "all", label: "All time", range: { from: null, to: null } },
  ];
}

export const sameRange = (a: DayRange, b: DayRange) => a.from === b.from && a.to === b.to;

/** `from`/`to` query parameters for a range, omitted when open-ended. */
export function rangeParams(r: DayRange): Record<string, string> {
  const out: Record<string, string> = {};
  if (r.from) out.from = r.from;
  if (r.to) out.to = r.to;
  return out;
}

/** A path plus query, leaving out empty values so shared links stay short. */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}
