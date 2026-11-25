import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  type PayoutBucket, type PayoutMemberInfo, type PayoutPaymentRow, type PaymentSort, type SortDir,
  PAYMENT_SORTS, getPayoutBreakdown, getPayoutMember, getPayoutMemberTotals, listPayoutDoctors,
  listPayoutPayments, parseMember,
} from "@/lib/payouts";
import {
  type DayRange, type Granularity, bucketLabel, bucketRange, clinicToday, monthEnd, monthStart,
  normalizeRange, rangeKind, rangeLabel, rangeParams, weekdayLabel, withQuery, yearEnd, yearStart,
} from "@/lib/payout-period";
import PayoutRange from "@/components/PayoutRange";
import PayoutExport from "@/components/PayoutExport";
import { ContractCaveat, FlagChip, Kpi, Money, Pager } from "@/components/PayoutParts";

const VIEWS = ["year", "month", "day", "payment"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = { year: "Years", month: "Months", day: "Days", payment: "Payments" };
/** Clicking a period opens it one level down: a year by month, a month by day, a day as its payments. */
const DRILL: Record<Granularity, View> = { year: "month", month: "day", day: "payment" };

type Params = { from?: string; to?: string; by?: string; sort?: string; dir?: string; page?: string };

const pick = <T extends string>(v: string | undefined, allowed: readonly T[], dflt: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : dflt;

/** Monthly unless the range is a month or less, where months would be a single row. */
function defaultView(r: DayRange): View {
  if (rangeKind(r) === "day") return "payment";
  if (r.from && r.to && r.from.slice(0, 7) === r.to.slice(0, 7)) return "day";
  return "month";
}

// One member's payouts, period by period, for a range of payment dates: Years, Months
// (the default) or Days, each row opening the next level down, ending at the payments
// themselves, each with its whole split, so every figure can be traced to the money.
export default async function MemberPayoutPage({ params, searchParams }: {
  params: Promise<{ member: string }>; searchParams: Promise<Params>;
}) {
  await requireRole("OWNER");
  const [{ member: slug }, sp] = await Promise.all([params, searchParams]);
  const member = parseMember(slug);
  if (member === null) notFound();
  const info = await getPayoutMember(member);
  if (!info) notFound();

  const range = normalizeRange(sp.from, sp.to);
  const view = pick(sp.by, VIEWS, defaultView(range));
  const dir = pick(sp.dir, ["asc", "desc"] as const, "desc");
  const sort = pick(sp.sort, PAYMENT_SORTS, "date");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [totals, doctors] = await Promise.all([getPayoutMemberTotals(range, member), listPayoutDoctors()]);
  const breakdown = view === "payment" ? null : await getPayoutBreakdown(range, member, view, { dir, page });
  const payments = view === "payment" ? await listPayoutPayments(range, member, { sort, dir, page }) : null;

  // Links rebuild the URL from the state plus one change, leaving out defaults. A new
  // range or view starts again at page 1; the sort is kept only within the payments view.
  const base = `/team/payouts/${slug}`;
  const href = (c: { range?: DayRange; by?: View; sort?: PaymentSort; dir?: SortDir; page?: number } = {}) => {
    const r = c.range ?? range;
    const by = c.by ?? view;
    const s = c.sort ?? (by === "payment" && view === "payment" ? sort : "date");
    const d = c.dir ?? (c.range || c.by ? "desc" : dir);
    return withQuery(base, {
      ...rangeParams(r),
      by: by === defaultView(r) ? null : by,
      sort: by === "payment" && s !== "date" ? s : null,
      dir: d === "desc" ? null : d,
      page: c.page && c.page > 1 ? c.page : null,
    });
  };
  const label = rangeLabel(range);
  const today = clinicToday();

  return (
    <div className="space-y-5">
      <Crumbs info={info} range={range} slug={slug} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{info.name}</h1>
          <MemberLine info={info} />
        </div>
        <PayoutExport range={range} doctors={doctors} member={info.kind === "doctor" ? String(info.id) : "all"} by={view === "year" ? "year" : view === "month" ? "month" : "day"} />
      </div>

      <PayoutRange
        path={base}
        range={range}
        keep={Object.fromEntries(Object.entries({ by: sp.by && VIEWS.includes(sp.by as View) ? view : "", sort: sp.sort ? sort : "", dir: sp.dir ? dir : "" }).filter(([, v]) => v))}
      />

      <Totals info={info} totals={totals} />
      {totals.future && (
        <p className="-mt-2 text-xs text-amber-700 dark:text-amber-300">
          Includes a payment dated after today, probably a mistyped year. It is tagged <span className="font-medium">Future date</span>{" "}below.
        </p>
      )}

      <section aria-labelledby="breakdown-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
          <h2 id="breakdown-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {view === "payment" ? "Payments" : `By ${view}`} · {label}
          </h2>
          <nav aria-label="Group by" className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={href({ by: v })}
                aria-current={v === view ? "page" : undefined}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${v === view
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
              >
                {VIEW_LABEL[v]}
              </Link>
            ))}
          </nav>
        </div>

        {breakdown && view !== "payment" && (
          <Breakdown
            info={info}
            by={view}
            rows={breakdown.rows}
            totals={totals}
            label={label}
            dir={dir}
            drill={(key) => href({ range: bucketRange(key, view), by: DRILL[view] })}
            paymentsOf={(key) => href({ range: bucketRange(key, view), by: "payment" })}
            yearHref={(key) => href({ range: { from: yearStart(key), to: yearEnd(key) }, by: "month" })}
            flipHref={href({ dir: dir === "desc" ? "asc" : "desc", page: 1 })}
            paged={breakdown.pages > 1 ? { page: breakdown.page, pages: breakdown.pages, count: breakdown.count, href: (n: number) => href({ page: n }) } : null}
          />
        )}

        {payments && (
          <Payments
            info={info}
            rows={payments.rows}
            totals={payments.totals}
            today={today}
            sort={sort}
            dir={dir}
            sortHref={(col) => href({ sort: col, dir: sort === col ? (dir === "asc" ? "desc" : "asc") : col === "patient" ? "asc" : "desc", page: 1 })}
            pager={payments.pages > 1 ? { page: payments.page, pages: payments.pages, href: (n: number) => href({ page: n }) } : null}
          />
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={withQuery("/team/payouts", rangeParams(range))} className="text-sm text-teal-700 hover:underline dark:text-teal-400">
          Everyone for {label} →
        </Link>
      </div>
      {/* the chamber keeps the remainder, so its figures move with the contracts too */}
      <ContractCaveat />
    </div>
  );
}

// ── header pieces ──

function Crumbs({ info, range, slug }: { info: PayoutMemberInfo; range: DayRange; slug: string }) {
  const kind = rangeKind(range);
  const m = (r: DayRange, by?: View) => withQuery(`/team/payouts/${slug}`, { ...rangeParams(r), by: by && by !== defaultView(r) ? by : null });
  const trail: { label: string; href: string }[] = [
    { label: "Payouts", href: withQuery("/team/payouts", rangeParams(range)) },
    { label: info.name, href: m({ from: null, to: null }) },
  ];
  if (range.from && kind !== "all" && kind !== "custom") {
    const y = range.from;
    trail.push({ label: y.slice(0, 4), href: m({ from: yearStart(y), to: yearEnd(y) }) });
    if (kind === "month" || kind === "day") trail.push({ label: bucketLabel(y, "month"), href: m({ from: monthStart(y), to: monthEnd(y) }) });
    if (kind === "day") trail.push({ label: bucketLabel(y, "day"), href: m(range) });
  } else if (kind === "custom") {
    trail.push({ label: rangeLabel(range), href: m(range) });
  }
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        {trail.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-slate-300 dark:text-slate-600">/</span>}
            {i === trail.length - 1
              ? <span aria-current="page" className="font-medium text-slate-700 dark:text-slate-200">{c.label}</span>
              : <Link href={c.href} className="hover:text-teal-700 dark:hover:text-teal-400">{c.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function MemberLine({ info }: { info: PayoutMemberInfo }) {
  const cls = "mt-1 text-sm text-slate-500 dark:text-slate-400";
  if (info.kind === "chamber") return <p className={cls}>What the clinic keeps from each payment once the consultant&apos;s and operator&apos;s shares are taken out.</p>;
  if (info.kind === "all") return <p className={cls}>Every payment, and how it was split between the doctors and the chamber.</p>;
  return (
    <p className={cls}>
      Consultant <span className="font-medium text-slate-700 dark:text-slate-200">{info.consultantSharePct}%</span>
      {" · "}Operator <span className="font-medium text-slate-700 dark:text-slate-200">{info.operatorSharePct}%</span>
      {" · "}today&apos;s contract
      {" · "}<Link href={`/team/${info.personId}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">Edit</Link>
    </p>
  );
}

function Totals({ info, totals }: { info: PayoutMemberInfo; totals: Omit<PayoutBucket, "key"> }) {
  const n = totals.payments;
  const count = `${n.toLocaleString()} ${n === 1 ? "payment" : "payments"}`;
  if (info.kind === "doctor") {
    return (
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total share" tone="doctor" value={<Money n={totals.share} />} sub={`from ${count}`} />
        <Kpi label="As consultant" value={<Money n={totals.consultant} />} sub={`${info.consultantSharePct}% of their patients' payments`} />
        <Kpi label="As operator" value={<Money n={totals.operator} />} sub={`${info.operatorSharePct}% of treatments they did`} />
        <Kpi label="Collected on their cases" value={<Money n={totals.collected} />} sub="payments they were consultant or operator on" />
      </section>
    );
  }
  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {info.kind === "chamber"
        ? <Kpi label="Chamber keeps" tone="chamber" value={<Money n={totals.chamber} />} sub={totals.collected ? `${Math.round((totals.chamber / totals.collected) * 1000) / 10}% of collected` : undefined} />
        : <Kpi label="Collected" value={<Money n={totals.collected} />} sub={count} />}
      <Kpi label="Doctors' share" tone="doctor" value={<Money n={totals.consultant + totals.operator} />} sub={<>consultant <Money n={totals.consultant} /> · operator <Money n={totals.operator} /></>} />
      {info.kind === "chamber"
        ? <Kpi label="Collected" value={<Money n={totals.collected} />} sub={count} />
        : <Kpi label="Chamber" tone="chamber" value={<Money n={totals.chamber} />} />}
      <Kpi label="Check" value={totals.consultant + totals.operator + totals.chamber === totals.collected ? "✓ adds up" : "✗ mismatch"} sub="doctors + chamber = collected" />
    </section>
  );
}

// ── period table ──

function Breakdown({ info, by, rows, totals, label, dir, drill, paymentsOf, yearHref, flipHref, paged }: {
  info: PayoutMemberInfo; by: Granularity; rows: PayoutBucket[]; totals: Omit<PayoutBucket, "key">; label: string; dir: SortDir;
  drill: (key: string) => string; paymentsOf: (key: string) => string; yearHref: (key: string) => string; flipHref: string;
  paged: { page: number; pages: number; count: number; href: (n: number) => string } | null;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No payments for {info.name} in {label === "All time" ? "any period" : label}.</p>;
  }
  const isDoctor = info.kind === "doctor";
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.share)));
  // Months over several years are grouped under a row per year, with the year's sum.
  const groups: { year: string | null; rows: PayoutBucket[] }[] = [];
  if (by === "month" && new Set(rows.map((r) => r.key.slice(0, 4))).size > 1) {
    for (const r of rows) {
      const y = r.key.slice(0, 4);
      const g = groups[groups.length - 1];
      if (g && g.year === y) g.rows.push(r); else groups.push({ year: y, rows: [r] });
    }
  } else groups.push({ year: null, rows });

  const th = "px-3 py-2 font-medium first:pl-4 sm:first:pl-5";
  const td = "px-3 py-2.5 first:pl-4 sm:first:pl-5";
  const num = `${td} text-right tabular-nums`;
  const sm = "hidden sm:table-cell";
  const md = "hidden md:table-cell";
  const sumOf = (rs: PayoutBucket[], k: keyof Omit<PayoutBucket, "key" | "future">) => rs.reduce((s, r) => s + (r[k] as number), 0);

  // For everyone, the last column already is the amount collected.
  const cells = (r: Omit<PayoutBucket, "key">, strong = false) => (
    <>
      {info.kind !== "all" && <td className={`${num} ${sm} text-slate-600 dark:text-slate-300`}><Money n={r.collected} /></td>}
      {isDoctor ? (
        <>
          <td className={`${num} ${md} text-slate-600 dark:text-slate-300`}><Money n={r.consultant} /></td>
          <td className={`${num} ${md} text-slate-600 dark:text-slate-300`}><Money n={r.operator} /></td>
        </>
      ) : (
        <>
          <td className={`${num} ${md} text-slate-600 dark:text-slate-300`}><Money n={r.consultant + r.operator} /></td>
          {info.kind === "all" && <td className={`${num} ${md} text-slate-600 dark:text-slate-300`}><Money n={r.chamber} /></td>}
        </>
      )}
      <td className={`${num} ${strong ? "font-semibold" : "font-medium"} text-slate-900 dark:text-slate-100`}><Money n={r.share} /></td>
    </>
  );
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {info.name}, {label}, by {by}. Open a {by} for its {DRILL[by] === "payment" ? "payments" : `${DRILL[by]}s`}.
          </caption>
          <thead>
            <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
              <th scope="col" className={th}>
                <Link href={flipHref} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200" aria-label={`${by[0].toUpperCase()}${by.slice(1)}, ${dir === "desc" ? "newest first; show oldest first" : "oldest first; show newest first"}`}>
                  {by[0].toUpperCase() + by.slice(1)} <span aria-hidden>{dir === "desc" ? "▼" : "▲"}</span>
                </Link>
              </th>
              <th scope="col" className={`${th} ${sm} text-right`}>Payments</th>
              {info.kind !== "all" && <th scope="col" className={`${th} ${sm} text-right`}>Collected</th>}
              {isDoctor ? (
                <>
                  <th scope="col" className={`${th} ${md} text-right`}>As consultant</th>
                  <th scope="col" className={`${th} ${md} text-right`}>As operator</th>
                </>
              ) : (
                <>
                  <th scope="col" className={`${th} ${md} text-right`}>Doctors</th>
                  {info.kind === "all" && <th scope="col" className={`${th} ${md} text-right`}>Chamber</th>}
                </>
              )}
              <th scope="col" className={`${th} text-right`}>{isDoctor ? "Share" : info.kind === "chamber" ? "Chamber keeps" : "Collected"}</th>
              <th scope="col" className={`${th} hidden w-28 lg:table-cell`}><span className="sr-only">Relative size</span></th>
              <th scope="col" className="w-8 pr-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.year ?? "all"}>
              {g.year && (
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <th scope="rowgroup" className={`${td} text-left font-semibold text-slate-800 dark:text-slate-100`}>
                    <Link href={yearHref(`${g.year}-01-01`)} className="hover:text-teal-700 dark:hover:text-teal-400">{g.year}</Link>
                  </th>
                  <td className={`${num} ${sm} text-xs text-slate-500 dark:text-slate-400`}>{sumOf(g.rows, "payments").toLocaleString()}</td>
                  {cells({
                    payments: sumOf(g.rows, "payments"), collected: sumOf(g.rows, "collected"), consultant: sumOf(g.rows, "consultant"),
                    operator: sumOf(g.rows, "operator"), chamber: sumOf(g.rows, "chamber"), share: sumOf(g.rows, "share"), future: false,
                  }, true)}
                  <td className="hidden lg:table-cell" />
                  <td />
                </tr>
              )}
              {g.rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <Link href={drill(r.key)} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">
                      {bucketLabel(r.key, by)}
                    </Link>
                    {r.future && <span className="ml-2 align-middle"><FlagChip kind="future" /></span>}
                    <span className="block text-xs text-slate-400 sm:hidden dark:text-slate-500">{r.payments.toLocaleString()} {r.payments === 1 ? "payment" : "payments"}</span>
                  </th>
                  <td className={`${num} ${sm}`}>
                    <Link href={paymentsOf(r.key)} className="text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-teal-700 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-teal-400" aria-label={`${r.payments} payments in ${bucketLabel(r.key, by)}`}>
                      {r.payments.toLocaleString()}
                    </Link>
                  </td>
                  {cells(r)}
                  <td className="hidden px-3 lg:table-cell" aria-hidden>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-1.5 rounded-full ${r.share < 0 ? "bg-rose-400" : "bg-teal-500"}`} style={{ width: `${Math.max(2, (Math.abs(r.share) / max) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="pr-3 text-right">
                    <Link href={drill(r.key)} tabIndex={-1} aria-hidden className="text-slate-300 hover:text-teal-600 dark:text-slate-600 dark:hover:text-teal-400">›</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700">
              <th scope="row" className={`${td} text-left font-semibold text-slate-900 dark:text-slate-100`}>
                Total
                <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">
                  {paged ? `all ${paged.count.toLocaleString()} days` : label}
                </span>
              </th>
              <td className={`${num} ${sm} font-medium text-slate-600 dark:text-slate-300`}>{totals.payments.toLocaleString()}</td>
              {cells(totals, true)}
              <td className="hidden lg:table-cell" />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {paged && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:px-5 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Days with payments, page {paged.page} of {paged.pages}</span>
          <Pager page={paged.page} pages={paged.pages} href={paged.href} />
        </div>
      )}
    </>
  );
}

// ── the payments themselves ──

function Payments({ info, rows, totals, today, sort, dir, sortHref, pager }: {
  info: PayoutMemberInfo; rows: PayoutPaymentRow[]; totals: { count: number; amount: number; share: number };
  today: string; sort: PaymentSort; dir: SortDir; sortHref: (col: PaymentSort) => string;
  pager: { page: number; pages: number; href: (n: number) => string } | null;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No payments for {info.name} in this range.</p>;
  }
  const showShare = info.kind !== "all";
  const mine = (part: "cons" | "op" | "chamber", p: PayoutPaymentRow) =>
    (info.kind === "doctor" && ((part === "cons" && p.consId === info.id) || (part === "op" && p.opId === info.id))) ||
    (info.kind === "chamber" && part === "chamber");
  const th = "px-3 py-2 font-medium first:pl-4 sm:first:pl-5";
  const td = "px-3 py-2.5 align-top first:pl-4 sm:first:pl-5";
  const rest = (p: PayoutPaymentRow) => Math.round((100 - (p.consPct ?? 0) - (p.opPct ?? 0)) * 100) / 100;

  const Split = ({ p }: { p: PayoutPaymentRow }) => {
    const parts: { key: "cons" | "op" | "chamber"; role: string; who: string; pct: number; amt: number }[] = [];
    if (p.consId) parts.push({ key: "cons", role: "Consultant", who: p.consName ?? "", pct: p.consPct ?? 0, amt: p.consShare });
    if (p.opId) parts.push({ key: "op", role: "Operator", who: p.opName ?? "", pct: p.opPct ?? 0, amt: p.opShare });
    parts.push({ key: "chamber", role: "Chamber", who: "", pct: rest(p), amt: p.chamber });
    return (
      <ul className="max-w-md space-y-0.5 text-xs">
        {parts.map((x) => (
          <li key={x.key} className={`flex items-baseline justify-between gap-3 ${mine(x.key, p) ? "font-semibold text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-slate-400"}`}>
            <span className="min-w-0">{x.role}{x.who && <> · {x.who}</>} · {x.pct}%</span>
            <Money n={x.amt} className="shrink-0" />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Payments for {info.name}, each with its split between consultant, operator and chamber.</caption>
          <thead>
            <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
              <SortTh label="Date paid" col="date" sort={sort} dir={dir} href={sortHref("date")} className={`${th} hidden sm:table-cell`} />
              <SortTh label="Patient & procedure" col="patient" sort={sort} dir={dir} href={sortHref("patient")} className={th} />
              <SortTh label="Paid" col="amount" sort={sort} dir={dir} href={sortHref("amount")} className={`${th} text-right ${showShare ? "hidden sm:table-cell" : ""}`} right />
              <th scope="col" className={`${th} hidden md:table-cell`}>How it was split (today&apos;s %)</th>
              {showShare && <SortTh label={info.kind === "chamber" ? "Chamber" : "Their share"} col="share" sort={sort} dir={dir} href={sortHref("share")} className={`${th} text-right`} right />}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800/60">
                <td className={`${td} hidden whitespace-nowrap text-slate-600 sm:table-cell dark:text-slate-300`}>
                  {weekdayLabel(p.day)}
                  <span className="block text-xs text-slate-400 dark:text-slate-500">#{p.id}</span>
                </td>
                <td className={`${td} min-w-0`}>
                  <span className="block text-xs text-slate-400 sm:hidden dark:text-slate-500">{weekdayLabel(p.day)}</span>
                  <Link href={`/patients/${p.patientId}`} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{p.patient}</Link>
                  <Link href={`/cases/${p.caseId}`} className="block text-xs text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
                    {p.procedure ?? "Treatment"}{p.teeth ? ` · ${p.teeth}` : ""}
                  </Link>
                  {(p.amount < 0 || p.day > today) && (
                    <span className="mt-1 flex gap-1">
                      {p.amount < 0 && <FlagChip kind="refund" />}
                      {p.day > today && <FlagChip kind="future" />}
                    </span>
                  )}
                  <div className="mt-1.5 md:hidden">
                    {showShare && <span className="block text-xs text-slate-600 dark:text-slate-300">Paid <Money n={p.amount} className="font-medium" />, split:</span>}
                    <Split p={p} />
                  </div>
                </td>
                <td className={`${td} text-right font-medium text-slate-700 dark:text-slate-200 ${showShare ? "hidden sm:table-cell" : ""}`}><Money n={p.amount} /></td>
                <td className={`${td} hidden md:table-cell`}><Split p={p} /></td>
                {showShare && <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100`}><Money n={p.share} /></td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700">
              <th scope="row" className={`${td} hidden text-left font-semibold text-slate-900 sm:table-cell dark:text-slate-100`}>Total</th>
              <td className={`${td} text-xs text-slate-500 dark:text-slate-400`}>
                <span className="font-semibold text-slate-900 sm:hidden dark:text-slate-100">Total · </span>
                all {totals.count.toLocaleString()} {totals.count === 1 ? "payment" : "payments"}
              </td>
              <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100 ${showShare ? "hidden sm:table-cell" : ""}`}><Money n={totals.amount} /></td>
              <td className="hidden md:table-cell" />
              {showShare && <td className={`${td} text-right font-semibold text-slate-900 dark:text-slate-100`}><Money n={totals.share} /></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      {pager && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:px-5 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Page {pager.page} of {pager.pages}</span>
          <Pager page={pager.page} pages={pager.pages} href={pager.href} />
        </div>
      )}
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">
        Each payment&apos;s consultant, operator and chamber parts add up to what was paid, each rounded to the taka.
        A refund is a negative payment and takes its shares back.
      </p>
    </>
  );
}

function SortTh({ label, col, sort, dir, href, className, right = false }: {
  label: string; col: PaymentSort; sort: PaymentSort; dir: SortDir; href: string; className: string; right?: boolean;
}) {
  const active = sort === col;
  return (
    <th scope="col" className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className={`inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 ${right ? "justify-end" : ""} ${active ? "text-slate-700 dark:text-slate-200" : ""}`}>
        {label}
        <span aria-hidden className={active ? "" : "opacity-0"}>{active && dir === "asc" ? "▲" : "▼"}</span>
      </Link>
    </th>
  );
}
