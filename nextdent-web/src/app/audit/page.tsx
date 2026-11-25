import { requireRole } from "@/lib/auth";
import { getAuditLog } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { clinicToday, parseRange, rangeDates, rangeLabel, rangeQuery } from "@/lib/date-range";
import DateRangePicker from "@/components/DateRangePicker";
import Pager from "@/components/Pager";

const actionChip: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  update: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  delete: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  status: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  stock: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  login: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; page?: string }> }) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const today = clinicToday();
  const range = parseRange(sp, today);
  const label = rangeLabel(range, today);
  const { rows, total, page, pages } = await getAuditLog(range, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageHref = (n: number) => {
    const u = new URLSearchParams(rangeQuery(range, today));
    if (n > 1) u.set("page", String(n));
    const s = u.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Audit log</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Who changed what, when — {total.toLocaleString()} {total === 1 ? "event" : "events"} · {label === rangeDates(range) ? label : `${label}, ${rangeDates(range)}`}.
          </p>
        </div>
        <DateRangePicker value={range} today={today} label="Audit dates" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No activity recorded in these dates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-5 py-2 font-medium">Who</th>
                  <th className="px-5 py-2 font-medium">Action</th>
                  <th className="px-5 py-2 font-medium">Entity</th>
                  <th className="px-5 py-2 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-50 dark:border-slate-800/60">
                    <td className="whitespace-nowrap px-5 py-2 text-slate-500 dark:text-slate-400">{fmtDateTime(r.at)}</td>
                    <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{r.actor?.person.fullName ?? "—"}</td>
                    <td className="px-5 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionChip[r.action] ?? actionChip.login}`}>{r.action}</span></td>
                    <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{r.entity}</td>
                    <td className="px-5 py-2 font-mono text-xs text-slate-400">{r.entityId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {pages}</span>
            <Pager page={page} pages={pages} href={pageHref} />
          </div>
        )}
      </section>
    </div>
  );
}
