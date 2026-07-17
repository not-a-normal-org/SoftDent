// Isomorphic lab-order status config (no server-only imports).

export type LabStatus = "SENT" | "IN_PROGRESS" | "RECEIVED" | "FITTED" | "CANCELLED";

export const LAB_STATUSES: { key: LabStatus; label: string; chip: string }[] = [
  { key: "SENT", label: "Sent to lab", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  { key: "IN_PROGRESS", label: "In progress", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  { key: "RECEIVED", label: "Received", chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300" },
  { key: "FITTED", label: "Fitted", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  { key: "CANCELLED", label: "Cancelled", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
];

export const OPEN_LAB_STATUSES: LabStatus[] = ["SENT", "IN_PROGRESS"];
export const WORK_TYPES = ["Crown (PFM)", "Crown (Zirconia)", "Bridge", "Partial Denture", "Complete Denture", "Post & Core", "Other"];

export const labStatusMeta = (s: string | null) => LAB_STATUSES.find((x) => x.key === s) ?? LAB_STATUSES[0];
