import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAppointmentsInRange, getUpcoming, listMissed, countMissed, listDoctorOptions, type MissedRow,
} from "@/lib/appointments";
import { setAppointmentStatus } from "@/lib/actions/appointments";
import { toDateInput, fmtDate, fmtTime, fromDateInput } from "@/lib/format";
import { statusMeta } from "@/lib/appointment-constants";
import { clinicToday, parseRange, rangeDates, rangeLabel, rangeQuery, weekday } from "@/lib/date-range";
import DateRangePicker from "@/components/DateRangePicker";
import MissedAppointments from "@/components/MissedAppointments";
import Pager from "@/components/Pager";

type Appt = Awaited<ReturnType<typeof getAppointmentsInRange>>["rows"][number];
type Params = { from?: string; to?: string; date?: string; page?: string };

// Cards in the missed grid. The busiest day on record has 10 missed, so a single day
// always shows in full; a longer range shows the latest and hands the rest to the dialog.
const MISSED_GRID = 12;

function StatusBadge({ status }: { status: string | null }) {
  const m = statusMeta(status);
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m.chip}`}>{m.label}</span>;
}

const quickBtn = {
  confirm: "rounded-md px-2 py-1 text-xs text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10",
  done: "rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10",
  cancel: "rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10",
};

function ApptRow({ appt, showDate = false, quick = false }: { appt: Appt; showDate?: boolean; quick?: boolean }) {
  const name = appt.patient?.fullName ?? "—";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      {/* w-36, not w-24: the 12-hour range "3:30 PM–4:00 PM" needs the width. On a
          phone the time, the patient and the actions each take a line, or the name is
          squeezed to a word per line beside them. */}
      <div className="w-full shrink-0 sm:w-36 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
        {showDate ? fmtDate(appt.appointmentDate) : (fmtTime(appt.startsAt) || "—")}
        {!showDate && appt.endsAt ? <span className="font-normal text-slate-400">–{fmtTime(appt.endsAt)}</span> : null}
      </div>
      <div className="min-w-0 grow basis-full sm:basis-0">
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
          <form action={setAppointmentStatus.bind(null, appt.id, "CONFIRMED")}><button className={quickBtn.confirm}>Confirm</button></form>
          <form action={setAppointmentStatus.bind(null, appt.id, "COMPLETED")}><button className={quickBtn.done}>Done</button></form>
          <form action={setAppointmentStatus.bind(null, appt.id, "CANCELLED")}><button className={quickBtn.cancel}>Cancel</button></form>
        </div>
      )}
      <Link href={`/appointments/${appt.id}/edit`} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</Link>
    </div>
  );
}

/** One missed appointment, with what the front desk does next: it happened after all, it is off, or rebook it. */
function MissedCard({ m, showDate }: { m: MissedRow; showDate: boolean }) {
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 tabular-nums">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{fmtTime(m.startsAt) || "No time"}</div>
          {showDate && (
            <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">
              {fmtDate(m.appointmentDate ?? m.startsAt)}
            </div>
          )}
        </div>
        <StatusBadge status={m.status} />
      </div>
      <Link href={`/patients/${m.patientId}`} className="mt-1.5 truncate text-sm font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400">
        {m.patientName}
      </Link>
      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
        #{m.patientId}
        {m.phone && <> · <a href={`tel:${m.phone}`} className="hover:text-teal-700 dark:hover:text-teal-400">{m.phone}</a></>}
      </div>
      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
        {m.doctorName ?? "No doctor"}{m.allocatedUnit ? ` · ${m.allocatedUnit}` : ""}
      </div>
      <div className="mt-2.5 flex items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        <form action={setAppointmentStatus.bind(null, m.id, "COMPLETED")}><button className={quickBtn.done}>Done</button></form>
        <form action={setAppointmentStatus.bind(null, m.id, "CANCELLED")}><button className={quickBtn.cancel}>Cancel</button></form>
        <Link href={`/appointments/${m.id}/edit`} className="ml-auto rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          Reschedule
        </Link>
      </div>
    </li>
  );
}

function Panel({ title, sub, count, empty, children, footer }: {
  title: string; sub?: string; count: number; empty: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}{sub && <span className="font-normal text-slate-400 dark:text-slate-500"> · {sub}</span>}
        </h2>
        <span className="text-xs tabular-nums text-slate-400">{count.toLocaleString()}</span>
      </div>
      {count === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</p>
        : <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>}
      {footer}
    </section>
  );
}

const dayTitle = (day: string) => `${weekday(day)}, ${fmtDate(fromDateInput(day))}`;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const today = clinicToday();
  const range = parseRange(sp, today);
  const single = range.from === range.to;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [list, missed, missedAll, upcoming, doctors] = await Promise.all([
    getAppointmentsInRange(range, page),
    // a day reads in clock order, like the list above it; a range newest first, like the dialog
    listMissed({ range, sort: "date", dir: single ? "asc" : "desc", pageSize: MISSED_GRID }),
    countMissed(),
    getUpcoming(),
    listDoctorOptions(),
  ]);

  // a range's appointments, under a heading per day
  const byDay = new Map<string, Appt[]>();
  for (const a of list.rows) {
    const k = toDateInput(a.appointmentDate ?? a.startsAt);
    const g = byDay.get(k);
    if (g) g.push(a); else byDay.set(k, [a]);
  }

  const label = rangeLabel(range, today);
  const title = single ? dayTitle(range.from) : label;
  // a preset name ("Last 7 days") gets its dates alongside; a plain date is its own subtitle
  const sub = single ? (range.from === today ? "Today" : undefined) : label === rangeDates(range) ? undefined : rangeDates(range);
  // book onto the day being looked at — or today, when today is inside the range
  const bookDate = !single && range.from <= today && today <= range.to ? today : range.from;
  const pageHref = (n: number) => {
    const u = new URLSearchParams(rangeQuery(range, today));
    if (n > 1) u.set("page", String(n));
    const s = u.toString();
    return s ? `/appointments?${s}` : "/appointments";
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Appointments</h1>
          <Link href={`/appointments/new?date=${bookDate}`} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">+ New appointment</Link>
        </div>
        <div className="mt-4"><DateRangePicker value={range} today={today} label="Appointment dates" /></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title={title} sub={sub} count={list.total} empty={single ? "No appointments this day." : "No appointments in these dates."}
            footer={list.pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Page {list.page} of {list.pages}</span>
                <Pager page={list.page} pages={list.pages} href={pageHref} />
              </div>
            )}>
            {single
              ? list.rows.map((a) => <ApptRow key={a.id} appt={a} quick />)
              : [...byDay].map(([day, rows]) => (
                <div key={day}>
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <span>{dayTitle(day)}{day === today ? " · Today" : ""}</span>
                    <span className="tabular-nums">{rows.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((a) => <ApptRow key={a.id} appt={a} quick />)}
                  </div>
                </div>
              ))}
          </Panel>

          <section aria-labelledby="missed-heading" className="rounded-2xl border border-amber-200/70 bg-amber-50/40 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-amber-200/60 px-4 py-2.5 dark:border-amber-500/15">
              <div className="min-w-0">
                <h2 id="missed-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Missed <span className="font-normal text-slate-400 dark:text-slate-500">· {single ? fmtDate(fromDateInput(range.from)) : label}</span>
                  <span className="ml-2 text-xs font-normal tabular-nums text-slate-400">{missed.total.toLocaleString()}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Time has passed, never marked done or cancelled.</p>
              </div>
              <MissedAppointments doctors={doctors} today={today} label={`Show all missed appointments (${missedAll.toLocaleString()})`} />
            </div>
            {missed.total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {single ? "Nothing missed this day." : "Nothing missed in these dates."}
              </p>
            ) : (
              <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {missed.rows.map((m) => <MissedCard key={m.id} m={m} showDate={!single} />)}
              </ul>
            )}
            {missed.total > missed.rows.length && (
              // a div, not a p: the dialog inside is not allowed in a paragraph
              <div className="border-t border-amber-200/60 px-4 py-2.5 text-xs text-slate-500 dark:border-amber-500/15 dark:text-slate-400">
                Showing {single ? "the first" : "the latest"} {missed.rows.length} of {missed.total.toLocaleString()}.{" "}
                <MissedAppointments doctors={doctors} today={today} range={range} variant="link"
                  label={`See all ${missed.total.toLocaleString()} from these dates`} />
              </div>
            )}
          </section>
        </div>
        <div className="min-w-0">
          <Panel title="Upcoming" count={upcoming.length} empty="No upcoming appointments.">
            {upcoming.map((a) => <ApptRow key={a.id} appt={a} showDate />)}
          </Panel>
        </div>
      </div>
    </div>
  );
}
