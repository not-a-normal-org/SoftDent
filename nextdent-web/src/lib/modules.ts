// Central module registry — shared by the navbar and the dashboard cards so
// navigation and the dashboard stay in sync. Isomorphic (no server-only imports).

export type ModuleStatus = "ready" | "soon";

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  icon: string;
  desc: string;
  status: ModuleStatus;
  chip: string; // literal Tailwind classes for the icon chip (kept literal for JIT)
  nav: boolean; // show in the top navbar
  card: boolean; // show as a dashboard card
  roles?: string[]; // if set, only these roles may see/access the module (undefined = everyone)
};

export const canAccessModule = (m: ModuleDef, role?: string | null) =>
  !m.roles || (role != null && m.roles.includes(role));

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "🏠", desc: "Clinic overview", status: "ready", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", nav: true, card: false },
  { key: "patients", label: "Patients", href: "/patients", icon: "👥", desc: "Register, search, profiles, history & dental charts", status: "ready", chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300", nav: true, card: true },
  { key: "appointments", label: "Appointments", href: "/appointments", icon: "📅", desc: "Calendar, bookings per chair, overdue list", status: "ready", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300", nav: true, card: true },
  { key: "prescriptions", label: "Prescriptions", href: "/prescriptions", icon: "℞", desc: "Rx editor, 46k-drug search, templates, print", status: "ready", chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", nav: true, card: true },
  { key: "billing", label: "Billing", href: "/billing", icon: "🧾", desc: "Cases, procedures, payments, dues", status: "ready", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", nav: true, card: true },
  { key: "recalls", label: "Recalls", href: "/recalls", icon: "🔔", desc: "Patients due back — follow-ups & reminders", status: "ready", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", nav: false, card: true },
  { key: "finance", label: "Finance", href: "/finance", icon: "📊", desc: "Income, expenses, profit charts", status: "ready", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", nav: false, card: true, roles: ["OWNER"] },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: "📦", desc: "Products, stock levels & vendors", status: "ready", chip: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300", nav: false, card: true },
  { key: "labs", label: "Lab Work", href: "/labs", icon: "🔬", desc: "Crown/denture orders, shades & lab tracking", status: "ready", chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300", nav: false, card: true },
  { key: "team", label: "Team", href: "/team", icon: "🧑‍💼", desc: "Staff, logins, roles & doctor profiles", status: "ready", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300", nav: true, card: true, roles: ["OWNER"] },
  { key: "settings", label: "Settings", href: "/settings", icon: "⚙️", desc: "Treatment catalog, lookup lists, clinic & letterhead", status: "ready", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", nav: false, card: true, roles: ["OWNER"] },
  { key: "audit", label: "Audit log", href: "/audit", icon: "🛡️", desc: "Who changed what, when", status: "ready", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", nav: false, card: true, roles: ["OWNER"] },
];

export const NAV_MODULES = MODULES.filter((m) => m.nav);
export const CARD_MODULES = MODULES.filter((m) => m.card);
