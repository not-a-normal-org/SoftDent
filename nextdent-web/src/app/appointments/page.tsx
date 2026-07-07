import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAppointmentsForDate, getOverdue, getUpcoming } from "@/lib/appointments";
import { setAppointmentStatus } from "@/lib/actions/appointments";
import { toDateInput, fmtDate, fmtTime } from "@/lib/format";
import { statusMeta } from "@/lib/appointment-constants";
import AppointmentDateNav from "@/components/AppointmentDateNav";

type Appt = Awaited<ReturnType<typeof getAppointmentsForDate>>[number];

function StatusBadge({ status }: { status: string | null }) {
  const m = statusMeta(status);
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.chip}`}>{m.label}</span>;
}

function ApptRow({ appt, showDate = false, quick = false }: { appt: Appt; showDate?: boolean; quick?: boolean }) {
  const name = appt.patient?.fullName ?? "—";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="w-24 shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
        {showDate ? fmtDate(appt.appointmentDate) : (fmtTime(appt.startsAt) || "—")}
        {!showDate && appt.endsAt ? <span className="font-normal text-slate-400">–{fmtTime(appt.endsAt)}</span> : null}
      </div>
      <div className="min-w-0 flex-1">
        {appt.patient ? (
          <Link href={`/patients/${appt.patient.id}`} className="text-sm font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400">{name}</Link>
        ) : <span className="text-sm text-slate-500">{name}</span>}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {appt.allocatedUnit ?? "—"}{appt.doctor ? ` · ${appt.doctor.person.fullName}` : ""}{appt.note ? ` · ${appt.note}` : ""}
        </div>
      </div>
      <StatusBadge status={appt.status} />
      {quick && (
        <div className="flex items-center gap-1">
          <form action={setAppointmentStatus.bind(null, appt.id, "CONFIRMED")}>
            <button className="rounded-md px-2 py-1 text-xs text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10">Confirm</button>
          </form>
          <form action={setAppointmentStatus.bind(null, appt.id, "COMPLETED")}>
            <button className="rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">Done</button>
          </form>
          <form action={setAppointmentStatus.bind(null, appt.id, "CANCELLED")}>
            <button className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">Cancel</button>
          </form>
        </div>
      )}
      <Link href={`/appointments/${appt.id}/edit`} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</Link>
    </div>
  );
}

function Panel({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {count === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</p>
        : <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>}
    </section>
  );
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireUser();
  const { date } = await searchParams;
  const parsed = date ? new Date(`${date}T00:00`) : new Date();
  const selDate = isNaN(+parsed) ? new Date() : parsed;
  const dateStr = toDateInput(selDate);

  const [day, overdue, upcoming] = await Promise.all([
    getAppointmentsForDate(selDate),
    getOverdue(),
    getUpcoming(),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Appointments</h1>
          <Link href={`/appointments/new?date=${dateStr}`} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">+ New appointment</Link>
        </div>
        <div className="mt-4"><AppointmentDateNav date={dateStr} /></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={fmtDate(selDate)} count={day.length} empty="No appointments this day.">
            {day.map((a) => <ApptRow key={a.id} appt={a} quick />)}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Overdue" count={overdue.length} empty="Nothing overdue.">
            {overdue.map((a) => <ApptRow key={a.id} appt={a} showDate />)}
          </Panel>
          <Panel title="Upcoming" count={upcoming.length} empty="No upcoming appointments.">
            {upcoming.map((a) => <ApptRow key={a.id} appt={a} showDate />)}
          </Panel>
        </div>
      </div>
    </div>
  );
}
