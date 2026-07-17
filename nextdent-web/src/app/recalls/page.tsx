import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRecalls, type RecallItem } from "@/lib/recalls";
import { fmtDate } from "@/lib/format";

function Row({ item, overdue }: { item: RecallItem; overdue?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <Link href={`/patients/${item.patient.id}`} className="font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400">{item.patient.fullName}</Link>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {item.source}{item.reason ? ` · ${item.reason}` : ""}{item.patient.primaryPhone ? ` · ${item.patient.primaryPhone}` : ""}
        </div>
      </div>
      <span className={`text-xs ${overdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>due {fmtDate(item.dueDate)}</span>
      <Link href={`/appointments/new?patientId=${item.patient.id}`} className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700">Book</Link>
    </li>
  );
}

function Panel({ title, count, tone, empty, children }: { title: string; count: number; tone: string; empty: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 className={`text-sm font-semibold ${tone}`}>{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {count === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</p>
        : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>}
    </section>
  );
}

export default async function RecallsPage() {
  await requireUser();
  const { overdue, upcoming } = await getRecalls();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Recalls</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Patients due back — from prescription follow-ups and recall reminders.</p>
      </div>
      <Panel title="Overdue" count={overdue.length} tone="text-rose-700 dark:text-rose-400" empty="No overdue follow-ups.">
        {overdue.map((i) => <Row key={`${i.source}-${i.id}`} item={i} overdue />)}
      </Panel>
      <Panel title="Upcoming" count={upcoming.length} tone="text-slate-900 dark:text-slate-100" empty="No upcoming follow-ups.">
        {upcoming.map((i) => <Row key={`${i.source}-${i.id}`} item={i} />)}
      </Panel>
    </div>
  );
}
