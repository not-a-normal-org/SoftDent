import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getBillingOverview, listPatientBalances, BALANCE_SORTS, BALANCE_STATUSES, BALANCE_PERIODS, BALANCE_PAGE_SIZE, PAYMENTS_PAGE_SIZE,
  type BalanceSort, type BalanceStatus, type BalancePeriod,
} from "@/lib/billing";
import { taka, fmtDate } from "@/lib/format";
import { clinicToday, parseRange, rangeDates, rangeLabel, rangeQuery } from "@/lib/date-range";
import DateRangePicker from "@/components/DateRangePicker";
import Pager from "@/components/Pager";

// `pp` pages the payments list; `page` stays the balances table's, as it was
type Params = {
  q?: string; status?: string; period?: string; sort?: string; dir?: string; page?: string;
  from?: string; to?: string; date?: string; pp?: string;
};

const DEFAULTS = { status: "dues", period: "any", sort: "due", dir: "desc" } as const;
const pick = <T extends string>(v: string | undefined, allowed: readonly T[], dflt: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : dflt;

// the direction a column sorts in the first time it is clicked
const FIRST_DIR: Record<BalanceSort, "asc" | "desc"> = {
  due: "desc", billed: "desc", paid: "desc", lastVisit: "desc", name: "asc", id: "asc",
};

const STATUS_LABEL: Record<BalanceStatus, string> = { dues: "With dues", all: "All", paid: "Paid up", credit: "In credit" };
const PERIOD_LABEL: Record<BalancePeriod, string> = {
  any: "Any time", "30d": "Last 30 days", "90d": "Last 90 days", "1y": "Last 12 months", older: "Over a year ago",
};

// A balance below zero is money the clinic is holding — credit, not "৳-100 due".
const dueText = (n: number) => (n < 0 ? `${taka(-n)} credit` : taka(n));
const dueTone = (n: number) =>
  n > 0 ? "text-rose-600 dark:text-rose-400" : n < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = pick(sp.status, BALANCE_STATUSES, DEFAULTS.status);
  const period = pick(sp.period, BALANCE_PERIODS, DEFAULTS.period);
  const sort = pick(sp.sort, BALANCE_SORTS, DEFAULTS.sort);
  const dir = pick(sp.dir, ["asc", "desc"] as const, DEFAULTS.dir);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const paymentsPage = Math.max(1, Number.parseInt(sp.pp ?? "1", 10) || 1);
  const today = clinicToday();
  const range = parseRange(sp, today);
  const label = rangeLabel(range, today);

  const [{ billed, collected, due, payments }, list] = await Promise.all([
    getBillingOverview(range, paymentsPage),
    listPatientBalances({ q, status, period, sort, dir, page }),
  ]);

  // Every link rebuilds the URL from the current state plus one change, and drops
  // anything at its default, so the address stays short and shareable. Changing a
  // filter, search or sort returns to page 1; only the pager moves pages. The date
  // range and the payments page ride along on every link, and the payments pager
  // leaves the balances table where it was: the two lists page independently.
  const current = { q, status, period, sort, dir, page: list.page, pp: payments.page };
  const build = (next: typeof current, hash: string) => {
    const u = new URLSearchParams();
    if (next.q) u.set("q", next.q);
    for (const k of ["status", "period", "sort", "dir"] as const) if (next[k] !== DEFAULTS[k]) u.set(k, next[k]);
    if (next.page > 1) u.set("page", String(next.page));
    for (const [k, v] of Object.entries(rangeQuery(range, today))) u.set(k, v);
    if (next.pp > 1) u.set("pp", String(next.pp));
    const s = u.toString();
    return s ? `/billing?${s}${hash}` : `/billing${hash}`;
  };
  const href = (change: Partial<Omit<typeof current, "pp">>) => build({ ...current, page: 1, ...change }, "#balances");
  const paymentsHref = (n: number) => build({ ...current, pp: n }, "#payments");
  const sortHref = (col: BalanceSort) =>
    href({ sort: col, dir: sort === col ? (dir === "asc" ? "desc" : "asc") : FIRST_DIR[col] });

  // Which figures follow the dates is spelled out on each tile: billed and collected
  // are what happened on those days; outstanding is every unpaid balance, whenever it
  // was run up (see getBillingOverview).
  const kpis = [
    { label: "Billed", scope: label, value: taka(billed), href: null, tone: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    { label: "Collected", scope: label, value: taka(collected), href: "#payments", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { label: "Outstanding", scope: "All time", value: taka(due), href: "#balances", tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  ];

  const from = list.total === 0 ? 0 : (list.page - 1) * BALANCE_PAGE_SIZE + 1;
  const to = Math.min(list.page * BALANCE_PAGE_SIZE, list.total);
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${active
      ? "bg-teal-600 text-white"
      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Treatment & Billing</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The dates set what was billed and collected, and the payments listed. Outstanding and patient balances are all time.
          </p>
        </div>
        <DateRangePicker value={range} today={today} reset={["pp"]} label="Billing dates" />
        {/* three abreast leave ~65px a tile on a phone, too narrow for "৳2,112,900" */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((k, i) => {
            const span = i === kpis.length - 1 ? "col-span-2 sm:col-span-1" : "";
            const tile = (
              <div className={`h-full rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone}`}>
                <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</div>
                <div className="mt-0.5 text-[11px] opacity-70">{k.scope}</div>
              </div>
            );
            return k.href
              ? <Link key={k.label} href={k.href} className={`block ${span}`}>{tile}</Link>
              : <div key={k.label} className={span}>{tile}</div>;
          })}
        </div>
      </section>

      <section id="balances" className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Patient balances <span className="font-normal text-slate-400 dark:text-slate-500">· all time</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {list.total.toLocaleString()} {list.total === 1 ? "patient" : "patients"}
              {status !== "paid" && <> · <span className={`font-medium tabular-nums ${dueTone(list.totalDue)}`}>{dueText(list.totalDue)}</span> {list.totalDue < 0 ? "held" : "outstanding"}</>}
            </span>
          </div>

          {/* a plain GET form: the other filters ride along as hidden fields */}
          <form action="/billing" className="flex gap-2">
            {status !== DEFAULTS.status && <input type="hidden" name="status" value={status} />}
            {period !== DEFAULTS.period && <input type="hidden" name="period" value={period} />}
            {sort !== DEFAULTS.sort && <input type="hidden" name="sort" value={sort} />}
            {dir !== DEFAULTS.dir && <input type="hidden" name="dir" value={dir} />}
            {Object.entries(rangeQuery(range, today)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {payments.page > 1 && <input type="hidden" name="pp" value={payments.page} />}
            <input name="q" defaultValue={q} placeholder="Search by name, phone or patient ID…" aria-label="Search patients"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
            <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Search</button>
            {q && <Link href={href({ q: "" })} className="self-center px-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Clear</Link>}
          </form>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label="Balance status" className="flex flex-wrap gap-1.5">
              {BALANCE_STATUSES.map((st) => (
                <Link key={st} href={href({ status: st })} className={chip(st === status)} aria-current={st === status ? "true" : undefined}>
                  {STATUS_LABEL[st]} <span className="tabular-nums opacity-75">{list.counts[st].toLocaleString()}</span>
                </Link>
              ))}
            </nav>
            <nav aria-label="Last visit" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">Last visit</span>
              {BALANCE_PERIODS.map((pd) => (
                <Link key={pd} href={href({ period: pd })} className={chip(pd === period)} aria-current={pd === period ? "true" : undefined}>
                  {PERIOD_LABEL[pd]}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {list.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {q ? <>No patients match “{q}” here.</> : "No patients in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                  <SortTh label="ID" col="id" sort={sort} dir={dir} href={sortHref("id")} />
                  <SortTh label="Patient" col="name" sort={sort} dir={dir} href={sortHref("name")} />
                  <SortTh label="Last visit" col="lastVisit" sort={sort} dir={dir} href={sortHref("lastVisit")} />
                  <SortTh label="Billed" col="billed" sort={sort} dir={dir} href={sortHref("billed")} right />
                  <SortTh label="Paid" col="paid" sort={sort} dir={dir} href={sortHref("paid")} right />
                  <SortTh label="Due" col="due" sort={sort} dir={dir} href={sortHref("due")} right />
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-slate-400 dark:text-slate-500">#{r.id}</td>
                    <td className="px-5 py-2.5">
                      <Link href={`/patients/${r.id}`} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{r.fullName}</Link>
                      {r.primaryPhone && <span className="block text-xs text-slate-400 dark:text-slate-500">{r.primaryPhone}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-500 dark:text-slate-400">{r.lastVisit ? fmtDate(r.lastVisit) : "—"}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(r.billed)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{taka(r.paid)}</td>
                    <td className={`whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums ${dueTone(r.due)}`}>{dueText(r.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span> of <span className="tabular-nums">{list.total.toLocaleString()}</span>
            </span>
            {list.pages > 1 && <Pager page={list.page} pages={list.pages} href={(n) => href({ page: n })} />}
          </div>
        )}
      </section>

      <section id="payments" className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Payments <span className="font-normal text-slate-400 dark:text-slate-500">· {label === rangeDates(range) ? label : `${label}, ${rangeDates(range)}`}</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {payments.total.toLocaleString()} {payments.total === 1 ? "payment" : "payments"} · <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{taka(collected)}</span>
          </span>
        </div>
        {payments.rows.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No payments in these dates.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {payments.rows.map((p) => {
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
        {payments.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="tabular-nums">{((payments.page - 1) * PAYMENTS_PAGE_SIZE + 1).toLocaleString()}–{Math.min(payments.page * PAYMENTS_PAGE_SIZE, payments.total).toLocaleString()}</span> of <span className="tabular-nums">{payments.total.toLocaleString()}</span>
            </span>
            <Pager page={payments.page} pages={payments.pages} href={paymentsHref} label="Payment pages" />
          </div>
        )}
      </section>
    </div>
  );
}

function SortTh({ label, col, sort, dir, href, right = false }: {
  label: string; col: BalanceSort; sort: BalanceSort; dir: "asc" | "desc"; href: string; right?: boolean;
}) {
  const active = sort === col;
  return (
    <th className={`px-5 py-2 font-medium ${right ? "text-right" : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className={`inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 ${active ? "text-slate-700 dark:text-slate-200" : ""}`}>
        {label}
        <span aria-hidden className={active ? "" : "opacity-0"}>{active && dir === "asc" ? "▲" : "▼"}</span>
      </Link>
    </th>
  );
}
