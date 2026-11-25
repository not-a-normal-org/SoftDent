// CSV that Excel opens correctly, with Bangla names intact, and that cannot run a formula.
//
// - UTF-8 with a byte-order mark: without it Excel assumes the PC's ANSI code page and
//   Bangla comes out as mojibake.
// - CRLF line endings and RFC 4180 quoting: a comma, quote or line break inside a value
//   cannot split a row.
// - Formula injection: a *text* cell starting with = + - @ (or a tab or CR) is read by
//   Excel as a formula, so a patient saved as `=HYPERLINK(...)` would become a live link.
//   Such cells get a leading apostrophe (OWASP's advice). Numbers are written as numbers
//   and are not touched, so a refund of -2000 still sums in Excel.

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: CsvCell[][]): string =>
  "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
