// Isomorphic formatting + domain helpers (safe on server & client).

export const taka = (n: number | null | undefined) =>
  `৳${(n ?? 0).toLocaleString("en-US")}`;

const D = (d: Date | string | null | undefined) =>
  d ? (typeof d === "string" ? new Date(d) : d) : null;

export const fmtDate = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(x);
};

export const fmtDateTime = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(x);
};

// Date → "yyyy-MM-dd" for <input type="date"> default values
export const toDateInput = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
};

// Date → "HH:MM" for <input type="time"> default values
export const toTimeInput = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
};

export const fmtTime = (d: Date | string | null | undefined) => {
  const x = D(d);
  if (!x || isNaN(+x)) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(x);
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
