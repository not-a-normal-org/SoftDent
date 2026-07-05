import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { recentPatients } from "@/lib/patients";
import { fmtDate, age, initials } from "@/lib/format";
import PatientSearch from "@/components/PatientSearch";

export default async function PatientsPage() {
  const [total, recent] = await Promise.all([prisma.patient.count(), recentPatients(24)]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Patients</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {total.toLocaleString()} registered · start typing a name or phone number
            </p>
          </div>
          <Link href="/patients/new"
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">
            + New patient
          </Link>
        </div>
        <div className="mt-4">
          <PatientSearch size="lg" autoFocus placeholder="Search by name or phone — e.g. “Rahman” or “01712”…" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Recently added
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((p) => {
            const a = age(p.dob);
            return (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                    {initials(p.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.fullName}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      #{p.id}
                      {p.primaryPhone ? ` · ${p.primaryPhone}` : ""}
                      {a != null ? ` · ${a}y` : ""}
                      {p.gender ? ` · ${p.gender}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{fmtDate(p.since)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
