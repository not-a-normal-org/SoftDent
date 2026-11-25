import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPrescriptions } from "@/lib/prescriptions";
import { fmtDate } from "@/lib/format";
import { clinicToday, parseRangeOrAll, rangeLabel, rangeQuery } from "@/lib/date-range";
import DateRangePicker from "@/components/DateRangePicker";
import Pager from "@/components/Pager";

type Params = { q?: string; from?: string; to?: string; range?: string; page?: string };

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const today = clinicToday();
  // "All time" is offered here, unlike the money pages: looking up a returning
  // patient's old prescription by name is the other half of what this page is for
  const range = parseRangeOrAll(sp, today);
  const label = rangeLabel(range, today);
  const list = await listPrescriptions({ q, range, page: Number.parseInt(sp.page ?? "1", 10) || 1 });

  const href = (change: { q?: string; all?: boolean; page?: number }) => {
    const u = new URLSearchParams(rangeQuery(change.all ? null : range, today));
    const term = change.q ?? q;
    if (term) u.set("q", term);
    if (change.page && change.page > 1) u.set("page", String(change.page));
    const s = u.toString();
    return s ? `/prescriptions?${s}` : "/prescriptions";
  };

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
          {/* the search keeps the dates it was typed under */}
          {Object.entries(rangeQuery(range, today)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={q} placeholder="Search prescriptions…" aria-label="Search prescriptions"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </form>
        <div className="mt-4"><DateRangePicker value={range} today={today} allowAll label="Prescription dates" /></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {label}{q && <span className="font-normal text-slate-400 dark:text-slate-500"> · “{q}”</span>}
          </h2>
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {list.total.toLocaleString()} {list.total === 1 ? "prescription" : "prescriptions"}
          </span>
        </div>
        {list.rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q ? <>No prescriptions match “{q}”{range ? " in these dates" : ""}.</> : range ? "No prescriptions in these dates." : "No prescriptions yet."}
            {range && <> <Link href={href({ all: true })} className="font-medium text-teal-700 hover:underline dark:text-teal-400">Search all dates</Link></>}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.rows.map((rx) => (
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
        {list.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Page {list.page} of {list.pages}</span>
            <Pager page={list.page} pages={list.pages} href={(n) => href({ page: n })} />
          </div>
        )}
      </section>
    </div>
  );
}
