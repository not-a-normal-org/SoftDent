import Link from "next/link";
import { fmtDate, fmtTime, initials } from "@/lib/format";
import { statusMeta } from "@/lib/appointment-constants";

type Appt = {
  id: number;
  startsAt: Date | null;
  appointmentDate: Date | null;
  status: string | null;
  allocatedUnit: string | null;
  patient: { id: number; fullName: string };
  doctor: { person: { fullName: string } } | null;
};

function Row({ appt }: { appt: Appt }) {
  const s = statusMeta(appt.status);
  return (
    <li>
      <Link
        href={`/patients/${appt.patient.id}`}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        {/* w-20, not w-14: "10:30 AM" does not fit the width "10:30" needed */}
        <span className="w-20 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {fmtTime(appt.startsAt) || "—"}
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
          {initials(appt.patient.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {appt.patient.fullName}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {[appt.doctor?.person.fullName, appt.allocatedUnit].filter(Boolean).join(" · ") || "Unassigned"}
          </span>
        </span>
        {/* first word only — "Pending confirmation" would crowd out the patient's name */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.chip}`}>
          {s.label.split(" ")[0]}
        </span>
      </Link>
    </li>
  );
}

function Day({ label, date, appts }: { label: string; date: Date; appts: Appt[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between px-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {fmtDate(date)} · {appts.length === 0 ? "nothing booked" : `${appts.length} appointment${appts.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {appts.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          No appointments scheduled
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {appts.map((a) => (
            <Row key={a.id} appt={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AgendaPanel({
  today,
  tomorrow,
  todayDate,
  tomorrowDate,
}: {
  today: Appt[];
  tomorrow: Appt[];
  todayDate: Date;
  tomorrowDate: Date;
}) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Upcoming appointments
        </h2>
        <Link href="/appointments" className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400">
          Open →
        </Link>
      </div>
      <div className="space-y-5">
        <Day label="Today" date={todayDate} appts={today} />
        <Day label="Tomorrow" date={tomorrowDate} appts={tomorrow} />
      </div>
    </aside>
  );
}
