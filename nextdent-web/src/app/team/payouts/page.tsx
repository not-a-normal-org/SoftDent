import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPayoutSummary, getPayoutDataIssues, listPayoutDoctors, CHAMBER_NAME } from "@/lib/payouts";
import { normalizeRange, rangeLabel, rangeParams, withQuery } from "@/lib/payout-period";
import { taka } from "@/lib/format";
import PayoutRange from "@/components/PayoutRange";
import PayoutExport from "@/components/PayoutExport";
import { ContractCaveat, DataIssues, EyeLink, Kpi, Money } from "@/components/PayoutParts";

type Params = { from?: string; to?: string };

const pctOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "—");

// Who got what for a range of payment dates. Every member row, the chamber included,
// opens that member's year → month → day → payment breakdown for the same range.
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole("OWNER");
  const sp = await searchParams;
  const range = normalizeRange(sp.from, sp.to);
  const [{ doctors, totals }, issues, allDoctors] = await Promise.all([
    getPayoutSummary(range),
    getPayoutDataIssues(),
    listPayoutDoctors(),
  ]);

  const label = rangeLabel(range);
  const memberHref = (slug: string | number) => withQuery(`/team/payouts/${slug}`, rangeParams(range));
  const idle = allDoctors.filter((d) => !doctors.some((x) => x.id === d.id));
  const consultantSum = doctors.reduce((s, d) => s + d.consultant, 0);
  const operatorSum = doctors.reduce((s, d) => s + d.operator, 0);
  const reconciles = totals.doctors + totals.chamber === totals.collected;

  const th = "px-4 py-2 font-medium sm:px-5";
  const td = "px-4 py-3 sm:px-5";

  return (
    <div className="space-y-5">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Team</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Doctor payouts</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Each payment is split on the day it is paid: the patient&apos;s consultant and the treatment&apos;s operator
            take their contract percentage, and the chamber keeps the rest. Open a row with the eye for its months, days and payments.
          </p>
        </div>
        <PayoutExport range={range} doctors={allDoctors} />
      </div>

      <PayoutRange path="/team/payouts" range={range} />

      <DataIssues future={issues.future} mismatches={issues.mismatches} />

      <section aria-label={`Totals for ${label}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          label="Collected"
          className="col-span-2 sm:col-span-1"
          value={<Money n={totals.collected} />}
          sub={<>
            {totals.payments.toLocaleString()} {totals.payments === 1 ? "payment" : "payments"}
            {totals.refunds > 0 && <> · incl. {totals.refunds} {totals.refunds === 1 ? "refund" : "refunds"} <Money n={totals.refundAmount} /></>}
          </>}
        />
        <Kpi label="Doctors' share" tone="doctor" value={<Money n={totals.doctors} />} sub={`${pctOf(totals.doctors, totals.collected)} of collected`} />
        <Kpi label="Chamber (clinic)" tone="chamber" value={<Money n={totals.chamber} />} sub={`${pctOf(totals.chamber, totals.collected)} of collected`} />
      </section>
      {totals.future > 0 && (
        <p className="-mt-2 text-xs text-amber-700 dark:text-amber-300">
          This range includes {totals.future} future-dated {totals.future === 1 ? "payment" : "payments"} (<Money n={totals.futureAmount} />): see the note above.
        </p>
      )}

      <section aria-labelledby="members-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
          <h2 id="members-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Who got what · {label}</h2>
          <Link href={memberHref("all")} className="text-xs text-teal-700 hover:underline dark:text-teal-400">Everyone by month →</Link>
        </div>

        {totals.payments === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No payments were made in {label.toLowerCase() === "all time" ? "any period" : label}.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Payout per member for {label}. Doctors plus chamber equal the amount collected.</caption>
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                <th scope="col" className={th}>Member</th>
                <th scope="col" className={`${th} hidden text-right sm:table-cell`}>As consultant</th>
                <th scope="col" className={`${th} hidden text-right sm:table-cell`}>As operator</th>
                <th scope="col" className={`${th} text-right`}>Total</th>
                <th scope="col" className={`${th} hidden text-right md:table-cell`}>Of collected</th>
                <th scope="col" className="w-12 py-2 pr-3"><span className="sr-only">Breakdown</span></th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800/60">
                  <td className={td}>
                    <Link href={memberHref(d.id)} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{d.name}</Link>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      Consultant {d.consultantSharePct}% · Operator {d.operatorSharePct}% · {d.payments.toLocaleString()} {d.payments === 1 ? "payment" : "payments"}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 sm:hidden dark:text-slate-400">
                      As consultant <Money n={d.consultant} /> · as operator <Money n={d.operator} />
                    </span>
                  </td>
                  <td className={`${td} hidden text-right text-slate-600 sm:table-cell dark:text-slate-300`}><Money n={d.consultant} /></td>
                  <td className={`${td} hidden text-right text-slate-600 sm:table-cell dark:text-slate-300`}><Money n={d.operator} /></td>
                  <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100`}><Money n={d.total} /></td>
                  <td className={`${td} hidden text-right text-slate-500 md:table-cell dark:text-slate-400`}>{pctOf(d.total, totals.collected)}</td>
                  <td className="py-2 pr-3 text-right"><EyeLink href={memberHref(d.id)} label={`See ${d.name}'s payouts by month`} /></td>
                </tr>
              ))}
              <tr className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-800/30">
                <td className={td}>
                  <Link href={memberHref("chamber")} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{CHAMBER_NAME}</Link>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">Keeps what is left of each payment</span>
                </td>
                <td className={`${td} hidden text-right text-slate-300 sm:table-cell dark:text-slate-600`}>—</td>
                <td className={`${td} hidden text-right text-slate-300 sm:table-cell dark:text-slate-600`}>—</td>
                <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100`}><Money n={totals.chamber} /></td>
                <td className={`${td} hidden text-right text-slate-500 md:table-cell dark:text-slate-400`}>{pctOf(totals.chamber, totals.collected)}</td>
                <td className="py-2 pr-3 text-right"><EyeLink href={memberHref("chamber")} label="See the chamber's share by month" /></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                <th scope="row" className={`${td} text-left font-semibold text-slate-900 dark:text-slate-100`}>
                  Collected
                  <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">All payments in the range</span>
                </th>
                <td className={`${td} hidden text-right font-medium text-slate-600 sm:table-cell dark:text-slate-300`}><Money n={consultantSum} /></td>
                <td className={`${td} hidden text-right font-medium text-slate-600 sm:table-cell dark:text-slate-300`}><Money n={operatorSum} /></td>
                <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100`}><Money n={totals.collected} /></td>
                <td className={`${td} hidden text-right text-slate-500 md:table-cell dark:text-slate-400`}>100%</td>
                <td className="py-2 pr-3 text-right"><EyeLink href={memberHref("all")} label="See everyone's payouts by month" /></td>
              </tr>
            </tfoot>
          </table>
        )}

        {totals.payments > 0 && (
          <p className={`border-t border-slate-100 px-4 py-3 text-xs sm:px-5 dark:border-slate-800 ${reconciles ? "text-slate-500 dark:text-slate-400" : "font-medium text-rose-600 dark:text-rose-400"}`}>
            {reconciles ? "✓ " : "✗ "}
            Doctors {taka(totals.doctors)} + chamber {taka(totals.chamber)} = {taka(totals.doctors + totals.chamber)}
            {reconciles ? ", the amount collected." : `, but ${taka(totals.collected)} was collected. Please report this.`}
            {idle.length > 0 && <> Not listed, with no payments in this range: {idle.map((d) => d.name).join(", ")}.</>}
          </p>
        )}
      </section>

      <ContractCaveat />
    </div>
  );
}
