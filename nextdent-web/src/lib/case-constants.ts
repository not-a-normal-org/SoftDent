// Isomorphic: shared by the forms (client) and the actions (server).

/**
 * The life of a treatment case. Kept to one spelling each, because the imported
 * data already shows what happens otherwise — "Cancel", "On Hold" and "Planned"
 * each appear exactly once beside 534 "Active" and 952 "Completed".
 *
 * `legacy` lists the spellings that mean the same thing, so a row written by the
 * Access app still lands on the right option instead of looking like a custom value.
 */
export const CASE_STATUSES = [
  { value: "Planned", legacy: ["Plan", "Planning"] },
  { value: "In progress", legacy: ["Active", "Ongoing", "In Progress"] },
  { value: "On hold", legacy: ["On Hold", "On-hold", "Hold"] },
  { value: "Completed", legacy: ["Complete", "Done"] },
  { value: "Cancelled", legacy: ["Cancel", "Canceled"] },
] as const;

export const CASE_STATUS_VALUES = CASE_STATUSES.map((s) => s.value);

export const DEFAULT_CASE_STATUS = "In progress";

/** Fold a stored value onto its canonical spelling; unknown values are kept as-is. */
export function canonicalCaseStatus(v: string | null | undefined): string | null {
  const x = (v ?? "").trim();
  if (!x) return null;
  const hit = CASE_STATUSES.find(
    (s) =>
      s.value.toLowerCase() === x.toLowerCase() ||
      (s.legacy as readonly string[]).some((l) => l.toLowerCase() === x.toLowerCase())
  );
  return hit ? hit.value : x;
}

/** Colour for the status pill — done is settled, cancelled is struck, the rest are live. */
export function caseStatusTone(v: string | null | undefined): string {
  switch (canonicalCaseStatus(v)) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "Cancelled":
      return "bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400";
    case "On hold":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "Planned":
      return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
    default:
      return "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300";
  }
}
