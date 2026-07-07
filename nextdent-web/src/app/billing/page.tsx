import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBillingOverview } from "@/lib/billing";
import { taka, fmtDate } from "@/lib/format";

export default async function BillingPage() {
  await requireUser();
  const { billed, paid, due, dues, recentPayments } = await getBillingOverview();

  const kpis = [
    { label: "Total billed", value: taka(billed), tone: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    { label: "Collected", value: taka(paid), tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { label: "Outstanding", value: taka(due), tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Treatment & Billing</h1>

      <section className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Patients with dues</h2>
            <span className="text-xs text-slate-400">{dues.length}</span>
          </div>
          {dues.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No outstanding dues.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {dues.map((d) => (
                <li key={d.id}>
                  <Link href={`/patients/${d.id}`} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-800 dark:text-slate-200">{d.fullName}</span>
                    <span className="font-medium tabular-nums text-rose-600 dark:text-rose-400">{taka(d.due)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Recent payments</h2>
          {recentPayments.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No payments recorded.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentPayments.map((p) => {
                const pat = p.treatmentLine.case.patient;
                return (
                  <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link href={`/patients/${pat.id}`} className="text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{pat.fullName}</Link>
                      <span className="block text-xs text-slate-400">{fmtDate(p.paidAt)}{p.method ? ` · ${p.method}` : ""}</span>
                    </span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{taka(p.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
