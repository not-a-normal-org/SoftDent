import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPayouts } from "@/lib/payouts";
import { taka } from "@/lib/format";

export default async function PayoutsPage() {
  await requireRole("OWNER");
  const { doctors, chamber, collected } = await getPayouts();

  return (
    <div className="space-y-6">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Team</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Doctor payouts</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Computed from each doctor&apos;s revenue contract on collected treatment revenue. Edit shares under Team → a doctor.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Collected</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{taka(collected)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4 shadow-sm dark:border-slate-800 dark:bg-emerald-500/10">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">Doctors&apos; share</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{taka(doctors.reduce((s, d) => s + d.total, 0))}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Chamber (clinic)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-700 dark:text-slate-200">{taka(chamber)}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {doctors.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No collected revenue attributed to a doctor yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                <th className="px-5 py-2 font-medium">Doctor</th>
                <th className="px-5 py-2 text-right font-medium">As consultant</th>
                <th className="px-5 py-2 text-right font-medium">As operator</th>
                <th className="px-5 py-2 text-right font-medium">Total payout</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-t border-slate-50 dark:border-slate-800/60">
                  <td className="px-5 py-2.5 text-slate-800 dark:text-slate-200">{d.name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(d.consultant)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(d.operator)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{taka(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
