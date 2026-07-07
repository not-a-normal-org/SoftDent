import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listStaff } from "@/lib/team";
import { setStaffActive } from "@/lib/actions/team";
import { initials } from "@/lib/format";

const roleChip: Record<string, string> = {
  OWNER: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  DOCTOR: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  RECEPTIONIST: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  ASSISTANT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function TeamPage() {
  await requireRole("OWNER");
  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Team</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{staff.length} people · manage logins, roles & doctor profiles</p>
        </div>
        <Link href="/team/new" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">+ Add staff</Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{initials(s.fullName)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.fullName}{!s.activeStatus && <span className="ml-2 text-xs text-rose-500">(inactive)</span>}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {s.user ? `@${s.user.username}` : "no login"}{s.primaryPhone ? ` · ${s.primaryPhone}` : ""}{s.doctor ? " · 🩺 doctor" : ""}
                </div>
              </div>
              {s.user && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleChip[s.user.role] ?? roleChip.ASSISTANT}`}>{s.user.role}</span>}
              <form action={setStaffActive.bind(null, s.id, !s.activeStatus)}>
                <button className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{s.activeStatus ? "Deactivate" : "Activate"}</button>
              </form>
              <Link href={`/team/${s.id}/edit`} className="text-xs text-teal-700 hover:underline dark:text-teal-400">Edit</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
