import { fmtDateTime } from "@/lib/format";

type Event = {
  id: number;
  eventType: string;
  occurredAt: Date;
  summary: string | null;
};

const STYLE: Record<string, { dot: string; icon: string; label: string }> = {
  appointment:  { dot: "bg-sky-500",    icon: "📅", label: "Appointment" },
  treatment:    { dot: "bg-teal-500",   icon: "🦷", label: "Treatment" },
  payment:      { dot: "bg-emerald-500",icon: "💵", label: "Payment" },
  prescription: { dot: "bg-violet-500", icon: "℞",  label: "Prescription" },
  note:         { dot: "bg-amber-500",  icon: "📝", label: "Note" },
  lab:          { dot: "bg-cyan-500",   icon: "🔬", label: "Lab work" },
  sms:          { dot: "bg-slate-400",  icon: "✉️", label: "SMS" },
};

export default function Timeline({ events }: { events: Event[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Clinical timeline</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No recorded history yet.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-[9px] before:top-1 before:h-full before:w-px before:bg-slate-200 dark:before:bg-slate-700">
          {events.map((e) => {
            const st = STYLE[e.eventType] ?? { dot: "bg-slate-400", icon: "•", label: e.eventType };
            return (
              <li key={e.id} className="relative pl-8">
                <span className={`absolute left-0 top-1 grid h-5 w-5 place-items-center rounded-full ${st.dot} text-[10px] text-white ring-4 ring-white dark:ring-slate-900`}>
                  {st.icon}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{st.label}</span>
                  <time className="text-xs text-slate-400 dark:text-slate-500">{fmtDateTime(e.occurredAt)}</time>
                </div>
                {e.summary && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{e.summary}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
