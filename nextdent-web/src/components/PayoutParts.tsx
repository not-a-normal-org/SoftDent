import Link from "next/link";
import { taka } from "@/lib/format";
import { dayLabel } from "@/lib/payout-period";
import type { FuturePayment, LineMismatch } from "@/lib/payouts";

// Small server-rendered pieces shared by the payouts summary and member pages.

/** Money with refunds kept visibly negative: "−৳2,000" in rose, never "৳-2,000". */
export function Money({ n, className = "" }: { n: number; className?: string }) {
  if (n < 0) return <span className={`tabular-nums text-rose-600 dark:text-rose-400 ${className}`}>−{taka(-n)}</span>;
  return <span className={`tabular-nums ${className}`}>{taka(n)}</span>;
}

/** First, last, and the pages around the current one, with gaps shown as "…" (as on Billing). */
export function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-xs tabular-nums";
  const idle = `${btn} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      {page > 1
        ? <Link href={href(page - 1)} className={idle} aria-label="Previous page">‹</Link>
        : <span className={`${btn} text-slate-300 dark:text-slate-600`} aria-hidden>‹</span>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
          {n === page
            ? <span className={`${btn} bg-teal-600 font-medium text-white`} aria-current="page">{n}</span>
            : <Link href={href(n)} className={idle} aria-label={`Page ${n}`}>{n}</Link>}
        </span>
      ))}
      {page < pages
        ? <Link href={href(page + 1)} className={idle} aria-label="Next page">›</Link>
        : <span className={`${btn} text-slate-300 dark:text-slate-600`} aria-hidden>›</span>}
    </nav>
  );
}

export function EyeLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-500 dark:text-slate-500 dark:hover:bg-teal-500/10 dark:hover:text-teal-400"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
        <path d="M2.25 12s3.5-6.75 9.75-6.75S21.75 12 21.75 12 18.25 18.75 12 18.75 2.25 12 2.25 12Z" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </Link>
  );
}

export function Kpi({ label, value, sub, tone = "plain", className = "" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "plain" | "doctor" | "chamber"; className?: string;
}) {
  const box = {
    plain: "bg-white dark:bg-slate-900",
    doctor: "bg-emerald-50 dark:bg-emerald-500/10",
    chamber: "bg-slate-50 dark:bg-slate-800/50",
  }[tone];
  const head = {
    plain: "text-slate-400",
    doctor: "text-emerald-700/70 dark:text-emerald-300/70",
    chamber: "text-slate-400",
  }[tone];
  const num = {
    plain: "text-slate-900 dark:text-slate-100",
    doctor: "text-emerald-700 dark:text-emerald-300",
    chamber: "text-slate-700 dark:text-slate-200",
  }[tone];
  return (
    <div className={`min-w-0 rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${box} ${className}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${head}`}>{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold tabular-nums sm:text-xl ${num}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function FlagChip({ kind }: { kind: "refund" | "future" }) {
  return kind === "refund"
    ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Refund</span>
    : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title="Dated after today: probably a mistyped year">Future date</span>;
}

/** Why past figures can move: there is no record of the share in force when a payment was made. */
export function ContractCaveat({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-slate-500 dark:text-slate-400 ${className}`}>
      <span className="font-medium text-slate-600 dark:text-slate-300">Worked out with today&apos;s contracts.</span>{" "}
      Each payment is split with the doctor&apos;s percentages as they are now, not as they were when it was paid.
      Changing a contract under Team changes every past figure here, including months already paid out.
      Lab costs are not deducted before the split yet.
    </p>
  );
}

/**
 * Data that a payout can't place honestly, shown on every range so it gets fixed:
 * payments dated in the future, and lines whose paid total disagrees with their payments.
 */
export function DataIssues({ future, mismatches }: { future: FuturePayment[]; mismatches: LineMismatch[] }) {
  if (future.length === 0 && mismatches.length === 0) return null;
  return (
    <section aria-labelledby="payout-issues" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <h2 id="payout-issues" className="font-semibold">Check {future.length + mismatches.length === 1 ? "this record" : "these records"}</h2>
      {future.length > 0 && (
        <div className="mt-2">
          <p>
            {future.length === 1 ? "1 payment is" : `${future.length} payments are`} dated after today, probably a mistyped year.
            {" "}{future.length === 1 ? "It is" : "They are"} counted on the date entered, so {future.length === 1 ? "it shows" : "they show"} under that year with a
            {" "}<span className="font-medium">Future date</span>{" "}tag, and in no current month.
            Payment dates can&apos;t be edited in the app yet; correct {future.length === 1 ? "it" : "them"} in the database.
          </p>
          <ul className="mt-2 space-y-1">
            {future.map((f) => (
              <li key={f.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium tabular-nums">{dayLabel(f.day)}</span>
                <Money n={f.amount} className="font-medium" />
                <Link href={`/cases/${f.caseId}`} className="underline decoration-amber-500/50 underline-offset-2 hover:decoration-amber-600">{f.patient}{f.procedure ? ` · ${f.procedure}` : ""}</Link>
                <span className="text-amber-700/80 dark:text-amber-300/70">payment #{f.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mismatches.length > 0 && (
        <div className="mt-3">
          <p>
            {mismatches.length === 1 ? "1 treatment line's" : `${mismatches.length} treatment lines'`} paid total disagrees with the payments recorded against it.
            Payouts follow the payments, so the line&apos;s balance and its payout will not match until this is fixed.
          </p>
          <ul className="mt-2 space-y-1">
            {mismatches.slice(0, 10).map((m) => (
              <li key={m.lineId} className="flex flex-wrap gap-x-2">
                <Link href={`/cases/${m.caseId}`} className="underline decoration-amber-500/50 underline-offset-2">{m.patient}</Link>
                <span>line #{m.lineId}: paid <Money n={m.amountPaid} />, payments <Money n={m.payments} /></span>
              </li>
            ))}
            {mismatches.length > 10 && <li>…and {mismatches.length - 10} more (see scripts/verify-payouts.ts)</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
