// Isomorphic formatting + domain helpers (safe on server & client).

export const taka = (n: number | null | undefined) =>
  `৳${(n ?? 0).toLocaleString("en-US")}`;

const D = (d: Date | string | null | undefined) =>
  d ? (typeof d === "string" ? new Date(d) : d) : null;

/**
 * Every date on screen is clinic-local, never viewer-local or server-local.
 *
 * Without this, formatting depends on the host's timezone: Cloud Run runs UTC while
 * the clinic is UTC+6, so the server rendered one time and the browser another — a
 * 6-hour error on every appointment, and a React hydration mismatch on top. An
 * appointment at 3pm is 3pm in Dhaka no matter who is looking at it.
 */
export const CLINIC_TZ = "Asia/Dhaka";

/** Calendar parts of an instant *as seen in the clinic's timezone*. */
const clinicParts = (x: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(x);
  const get = (t: string) => parts.find((v) => v.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mi: get("minute") };
};

export const fmtDate = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: CLINIC_TZ }).format(x);
};

export const fmtDateTime = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "—";
  // en-GB for the date, because Bangladesh writes the day first — en-US would give
  // "Nov 05, 2026". Its meridiem is lower case though, and fmtTime's is upper, so it
  // is raised here rather than showing two casings on one screen.
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: CLINIC_TZ, hour12: true,
  }).format(x).replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());
};

// Date → "yyyy-MM-dd" for <input type="date"> default values
export const toDateInput = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  const { y, m, d: day } = clinicParts(x);
  return `${y}-${m}-${day}`;
};

/**
 * "yyyy-MM-dd" from an <input type="date"> → the instant that day starts in the clinic.
 *
 * `new Date("2026-11-05")` is midnight *UTC*, i.e. 6am in Dhaka, so a day typed here
 * and read back through `fmtDate` on a host behind UTC comes out as the day before.
 * The offset is read from the zone database rather than hardcoded as +06.
 */
export const fromDateInput = (s: string | null | undefined, time?: string | null): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  // optional "HH:MM" from an <input type="time">, so a date and a time typed in the
  // clinic resolve to the instant its own clock showed — not the host's
  const t = /^(\d{1,2}):(\d{2})/.exec((time ?? "").trim());
  const hh = t ? Math.min(23, +t[1]) : 0;
  const mi = t ? Math.min(59, +t[2]) : 0;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], hh, mi);
  const p = clinicParts(new Date(asUtc));
  const offset = Date.UTC(+p.y, +p.m - 1, +p.d, +p.hh, +p.mi) - asUtc;
  const x = new Date(asUtc - offset);
  return isNaN(+x) ? null : x;
};

// Date → "HH:MM" for <input type="time"> default values
export const toTimeInput = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  const { hh, mi } = clinicParts(x);
  return `${hh}:${mi}`;
};

export const fmtTime = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: CLINIC_TZ, hour12: true }).format(x);
};

export const age = (dob: Date | string | null | undefined) => {
  const x = D(dob);
  if (!x || isNaN(+x)) return null;
  const now = new Date();
  let a = now.getFullYear() - x.getFullYear();
  const m = now.getMonth() - x.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < x.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};

export const initials = (name?: string | null) =>
  (name ?? "?")
    .replace(/^(mr|mrs|ms|dr|md)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

// Extract FDI tooth numbers (permanent 11–48, primary 51–85) mentioned in free text
// e.g. "Ext 14", "LCF calss I on 28", "on 48".
export function parseTeeth(text?: string | null): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/\b([1-8][1-8])\b/g)) {
    const q = +m[1][0], t = +m[1][1];
    // valid FDI: permanent quadrants 1-4 (teeth 1-8) or primary quadrants 5-8 (teeth 1-5)
    if ((q >= 1 && q <= 4 && t >= 1 && t <= 8) || (q >= 5 && q <= 8 && t >= 1 && t <= 5)) out.add(m[1]);
  }
  return [...out];
}

/**
 * "15:30" → "3:30 PM". For the appointment slots, which are wall-clock strings with
 * no date attached, so they cannot go through Intl's date formatting. The 24-hour
 * form stays the stored and submitted value; only the label changes.
 */
export const clock12 = (hhmm: string): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
};
