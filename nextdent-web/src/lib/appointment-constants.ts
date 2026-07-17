// Isomorphic appointment status config (no server-only imports).
//
// DECODED from the legacy Access DB (see data-model.md §7):
// `tbl_Appointments.AppointmentStatusID` is a foreign key into `tbl_Sms.SmsID` —
// the old app used the SMS-template table as its status list, so changing a status
// could fire the matching SMS (hence IsAppointSmsSend / AppointmentSmsLog).
// SmsID 1–5 are payment/welcome templates; 6–14 are the appointment lifecycle.
// Evidence: the only codes in the data (12, 14) decode to Overdue / Completed and
// match the appointment dates; the labels appear nowhere in the compiled front-end
// (they were bound from the table, not hardcoded).

export type StatusKey =
  | "CONFIRMED" | "REMINDED" | "RESCHEDULED" | "CANCELLED"
  | "WAITLISTED" | "LATE" | "OVERDUE" | "PENDING" | "COMPLETED";

export const STATUSES: { key: StatusKey; label: string; legacyCode: number; chip: string }[] = [
  { key: "PENDING",     label: "Pending confirmation", legacyCode: 13, chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { key: "CONFIRMED",   label: "Confirmed",            legacyCode: 6,  chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  { key: "REMINDED",    label: "Reminded",             legacyCode: 7,  chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" },
  { key: "RESCHEDULED", label: "Rescheduled",          legacyCode: 8,  chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
  { key: "WAITLISTED",  label: "Waitlisted",           legacyCode: 10, chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300" },
  { key: "LATE",        label: "Late",                 legacyCode: 11, chip: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  { key: "OVERDUE",     label: "Overdue",              legacyCode: 12, chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  { key: "COMPLETED",   label: "Completed",            legacyCode: 14, chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  { key: "CANCELLED",   label: "Cancelled",            legacyCode: 9,  chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
];

/** legacy AppointmentStatusID → status key (used by the ETL / backfill) */
export const LEGACY_STATUS_BY_CODE: Record<number, StatusKey> = Object.fromEntries(
  STATUSES.map((s) => [s.legacyCode, s.key])
) as Record<number, StatusKey>;

/** statuses that close an appointment (excluded from the overdue/open lists) */
export const CLOSED_STATUSES: StatusKey[] = ["COMPLETED", "CANCELLED"];

export function statusMeta(status: string | null) {
  return STATUSES.find((s) => s.key === status) ?? STATUSES[0]; // null/unknown → Pending
}
