// Isomorphic appointment status config (no server-only imports).
// Legacy `AppointmentStatusID` codes were undocumented; the web app uses this set.

export type StatusKey = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export const STATUSES: { key: StatusKey; label: string; chip: string }[] = [
  { key: "SCHEDULED", label: "Scheduled", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { key: "CONFIRMED", label: "Confirmed", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  { key: "COMPLETED", label: "Completed", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  { key: "CANCELLED", label: "Cancelled", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
  { key: "NO_SHOW", label: "No-show", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
];

export const CLOSED_STATUSES: StatusKey[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export function statusMeta(status: string | null) {
  return STATUSES.find((s) => s.key === status) ?? STATUSES[0]; // null/legacy → Scheduled
}
