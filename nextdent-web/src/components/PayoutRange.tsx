import Link from "next/link";
import {
  type DayRange, rangePresets, rangeLabel, shiftRange, sameRange, rangeParams, withQuery,
} from "@/lib/payout-period";

/**
 * The payouts pages' date-range control: presets, previous/next period, and a from/to
 * form. Plain links and a GET form, so it needs no client JS and every range is a URL
 * (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, both optional; neither means all time).
 *
 * Deliberately self-contained: the app-wide range picker being built on another branch
 * reads and writes the same two parameters, so it can replace this file wholesale.
 * `keep` carries the page's other parameters across a range change.
 */
export default function PayoutRange({ path, range, keep = {} }: {
  path: string; range: DayRange; keep?: Record<string, string>;
}) {
  const href = (r: DayRange) => withQuery(path, { ...keep, ...rangeParams(r) });
  const prev = shiftRange(range, -1);
  const next = shiftRange(range, 1);
  const presets = rangePresets();
  // the range in words, unless a lit preset chip already says it and there is nowhere to step
  const showLabel = !!(prev || next) || !presets.some((p) => sameRange(p.range, range));
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${active
      ? "bg-teal-600 text-white"
      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`;
  const arrow = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";
  const input = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]";

  return (
    <section aria-label="Date range" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showLabel && (
          <div className="flex items-center gap-1">
            {prev && <Link href={href(prev)} className={arrow} aria-label={`Previous period: ${rangeLabel(prev)}`}>‹</Link>}
            <span className="min-w-0 px-1 text-sm font-semibold text-slate-900 dark:text-slate-100" aria-live="polite">{rangeLabel(range)}</span>
            {next && <Link href={href(next)} className={arrow} aria-label={`Next period: ${rangeLabel(next)}`}>›</Link>}
          </div>
        )}
        <nav aria-label="Quick ranges" className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = sameRange(p.range, range);
            return <Link key={p.key} href={href(p.range)} className={chip(active)} aria-current={active ? "true" : undefined}>{p.label}</Link>;
          })}
        </nav>
      </div>

      {/* keyed by the range so the inputs show the range on screen after a preset or arrow */}
      <form key={`${range.from}|${range.to}`} action={path} className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="block min-w-0 text-xs text-slate-500 dark:text-slate-400">
          From
          <input type="date" name="from" defaultValue={range.from ?? ""} className={`mt-1 sm:w-40 ${input}`} />
        </label>
        <label className="block min-w-0 text-xs text-slate-500 dark:text-slate-400">
          To
          <input type="date" name="to" defaultValue={range.to ?? ""} className={`mt-1 sm:w-40 ${input}`} />
        </label>
        <button className="col-span-2 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 sm:col-span-1">Apply</button>
      </form>
    </section>
  );
}
