import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPrescriptions } from "@/lib/prescriptions";
import { fmtDate } from "@/lib/format";

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  const rows = await listPrescriptions(q);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Prescriptions</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Rx history · search by patient name or Rx #</p>
          </div>
          <Link href="/prescriptions/new" className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">
            + New prescription
          </Link>
        </div>
        <form className="mt-4" action="/prescriptions">
          <input name="q" defaultValue={q ?? ""} placeholder="Search prescriptions…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No prescriptions found.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((rx) => (
              <li key={rx.id}>
                <Link href={`/prescriptions/${rx.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {rx.patient?.fullName ?? rx.randomName ?? "Anonymous"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Rx #{rx.id}
                      {rx.dentist ? ` · ${rx.dentist.person.fullName}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{fmtDate(rx.rxDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
