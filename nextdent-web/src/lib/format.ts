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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: CLINIC_TZ, hourCycle: "h23",
  }).format(x);
};

// Date → "yyyy-MM-dd" for <input type="date"> default values
export const toDateInput = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  const { y, m, d: day } = clinicParts(x);
  return `${y}-${m}-${day}`;
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
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TZ, hourCycle: "h23" }).format(x);
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
