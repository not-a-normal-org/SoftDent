/**
 * Reconciles the payouts pages against independent computations of the same figures.
 *
 *   npx tsx --conditions=react-server scripts/verify-payouts.ts
 *
 * (`react-server` lets the script import the app's `server-only` modules.)
 *
 * The app computes every payout in SQL from one payment-level CTE. This script
 * recomputes them a different way: it reads payments through the ORM, puts each one on
 * a clinic day with Intl (not SQL's AT TIME ZONE), splits it with integer arithmetic,
 * and sums in JS. Then it checks, for every member including the chamber:
 *   - every year, month and day bucket matches the independent figure;
 *   - days add up to their month and months to their year;
 *   - doctors + chamber = collected, for all time, every year and month, and odd ranges;
 *   - the paged payment lists add up to the totals;
 *   - month sums agree with a third method (a fixed +6h offset in SQL);
 *   - the all-time figures differ from the old line-based getPayouts() only by what
 *     getPayouts leaves out (refund lines), to the taka;
 *   - payments agree with their lines' running amountPaid;
 *   - both CSV exports parse back to the same totals, and the CSV writer escapes safely.
 * Exits non-zero on any failure.
 */
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/prisma";
import { CLINIC_TZ } from "../src/lib/format";
import { csvCell, toCsv } from "../src/lib/csv";
import {
  type DayRange, type Granularity, addDays, clinicToday, monthEnd, rangePresets,
} from "../src/lib/payout-period";
import {
  type PayoutMember, getPayouts, getPayoutBreakdown, getPayoutDataIssues, getPayoutMemberTotals,
  getPayoutSummary, listPayoutPayments,
} from "../src/lib/payouts";
import { buildPayoutCsv } from "../src/lib/payouts-export";

let failures = 0, checks = 0;
const check = (label: string, ok: boolean, detail = "") => {
  checks++;
  if (!ok) { failures++; console.log(`  ✗ ${label}${detail ? `: ${detail}` : ""}`); }
  return ok;
};
const pass = (label: string) => console.log(`  ✓ ${label}`);
const fmt = (n: number) => `৳${n.toLocaleString("en-US")}`;

// ── independent model ──────────────────────────────────────────────────────────────

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const clinicDay = (d: Date) => DAY.format(d); // en-CA formats as YYYY-MM-DD

/** amount × pct / 100, rounded half away from zero, in exact integer arithmetic (pct to 0.01). */
function share(amount: number, pct: number | null | undefined): number {
  if (pct === null || pct === undefined) return 0;
  const q = amount * Math.round(pct * 100); // exact: integer × integer
  return Math.sign(q) * Math.floor((Math.abs(q) + 5000) / 10000);
}

type P = { id: number; day: string; amount: number; lineId: number; consId: number | null; consShare: number; opId: number | null; opShare: number; chamber: number };
type Sums = { payments: number; collected: number; consultant: number; operator: number; chamber: number; share: number };
const zero = (): Sums => ({ payments: 0, collected: 0, consultant: 0, operator: 0, chamber: 0, share: 0 });

function memberPart(p: P, m: PayoutMember): Sums | null {
  if (typeof m === "number") {
    if (p.consId !== m && p.opId !== m) return null;
    const c = p.consId === m ? p.consShare : 0, o = p.opId === m ? p.opShare : 0;
    return { payments: 1, collected: p.amount, consultant: c, operator: o, chamber: p.chamber, share: c + o };
  }
  return {
    payments: 1, collected: p.amount, consultant: p.consShare, operator: p.opShare, chamber: p.chamber,
    share: m === "chamber" ? p.chamber : p.amount,
  };
}
const add = (a: Sums, b: Sums) => { for (const k of Object.keys(a) as (keyof Sums)[]) a[k] += b[k]; };
const bucketOf = (day: string, by: Granularity) => (by === "year" ? `${day.slice(0, 4)}-01-01` : by === "month" ? `${day.slice(0, 7)}-01` : day);
const inRange = (day: string, r: DayRange) => (!r.from || day >= r.from) && (!r.to || day <= r.to);

function independent(ps: P[], m: PayoutMember, by: Granularity, r: DayRange = { from: null, to: null }) {
  const out = new Map<string, Sums>();
  for (const p of ps) {
    if (!inRange(p.day, r)) continue;
    const part = memberPart(p, m);
    if (!part) continue;
    const k = bucketOf(p.day, by);
    const s = out.get(k) ?? zero();
    add(s, part);
    out.set(k, s);
  }
  return out;
}
function independentTotal(ps: P[], m: PayoutMember, r: DayRange) {
  const s = zero();
  for (const p of ps) if (inRange(p.day, r)) { const part = memberPart(p, m); if (part) add(s, part); }
  return s;
}
const same = (a: Sums, b: Partial<Sums>) =>
  (Object.keys(a) as (keyof Sums)[]).every((k) => b[k] === undefined || a[k] === b[k]);
const diff = (a: Sums, b: Partial<Sums>) =>
  (Object.keys(a) as (keyof Sums)[]).filter((k) => b[k] !== undefined && a[k] !== b[k]).map((k) => `${k} ${a[k]} vs ${b[k]}`).join(", ");

// ── run ────────────────────────────────────────────────────────────────────────────

async function main() {
  const today = clinicToday();
  console.log(`Payout reconciliation · clinic today ${today} (${CLINIC_TZ})\n`);

  const rows = await prisma.payment.findMany({
    include: { treatmentLine: { include: { operatingDoctor: true, case: { include: { patient: { include: { consultantDoctor: true } } } } } } },
    orderBy: { id: "asc" },
  });
  const ps: P[] = rows.map((r) => {
    const cons = r.treatmentLine.case.patient.consultantDoctor, op = r.treatmentLine.operatingDoctor;
    const consShare = cons ? share(r.amount, cons.consultantSharePct) : 0;
    const opShare = op ? share(r.amount, op.operatorSharePct) : 0;
    return { id: r.id, day: clinicDay(r.paidAt), amount: r.amount, lineId: r.treatmentLineId, consId: cons?.id ?? null, consShare, opId: op?.id ?? null, opShare, chamber: r.amount - consShare - opShare };
  });
  const doctors = await prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } });
  const members: PayoutMember[] = ["all", "chamber", ...doctors.map((d) => d.id)];
  const name = (m: PayoutMember) => (typeof m === "number" ? doctors.find((d) => d.id === m)!.person.fullName : m);
  const collected = ps.reduce((s, p) => s + p.amount, 0);
  console.log(`Payments: ${ps.length.toLocaleString()} totalling ${fmt(collected)} · doctors on contract: ${doctors.map((d) => `${d.person.fullName} (${d.consultantSharePct}/${d.operatorSharePct})`).join(", ")}\n`);

  // 1. payments vs their lines
  console.log("1. Payments vs treatment lines (amountPaid)");
  const lines = await prisma.treatmentLine.findMany({ select: { id: true, amountPaid: true } });
  const perLine = new Map<number, number>();
  for (const p of ps) perLine.set(p.lineId, (perLine.get(p.lineId) ?? 0) + p.amount);
  const mismatched = lines.filter((l) => (perLine.get(l.id) ?? 0) !== l.amountPaid);
  const linesTotal = lines.reduce((s, l) => s + l.amountPaid, 0);
  if (check("every line's amountPaid equals the sum of its payments", mismatched.length === 0, mismatched.slice(0, 20).map((l) => `line ${l.id}: amountPaid ${l.amountPaid}, payments ${perLine.get(l.id) ?? 0}`).join("; ")))
    pass(`${lines.length.toLocaleString()} lines, ${fmt(linesTotal)} = ${fmt(collected)} in payments, 0 mismatches`);
  const multi = [...perLine.keys()].filter((id) => ps.filter((p) => p.lineId === id).length > 1).length;
  console.log(`  · lines paid in more than one payment: ${multi}`);
  const issues = await getPayoutDataIssues();
  check("page's mismatch list agrees", issues.mismatches.length === mismatched.length);

  // 2. clinic-day bucketing: the obvious SQL is wrong for this column type
  console.log("\n2. Clinic-day bucketing");
  const naive = await prisma.$queryRaw<{ id: number; day: string }[]>`
    SELECT id, to_char(("paidAt" AT TIME ZONE ${CLINIC_TZ}::text)::date, 'YYYY-MM-DD') AS day FROM "Payment"`;
  const naiveOff = naive.filter((n) => ps.find((p) => p.id === n.id)!.day !== n.day).length;
  console.log(`  · "paidAt" AT TIME ZONE '${CLINIC_TZ}' alone (timestamp without time zone) puts ${naiveOff.toLocaleString()} of ${ps.length.toLocaleString()} payments on the wrong day`);
  const sixH = await prisma.$queryRaw<{ m: string; n: number; s: number }[]>`
    SELECT to_char(date_trunc('month', "paidAt" + interval '6 hours'), 'YYYY-MM-01') AS m, COUNT(*)::int AS n, SUM(amount)::int AS s
    FROM "Payment" GROUP BY 1`;
  const appMonths = (await getPayoutBreakdown({ from: null, to: null }, "all", "month", { unpaged: true })).rows;
  const sixOk = sixH.length === appMonths.length && sixH.every((x) => { const a = appMonths.find((r) => r.key === x.m); return a && a.payments === x.n && a.collected === x.s; });
  if (check("month buckets equal a fixed UTC+6 offset in SQL (Bangladesh has had no DST since 2009)", sixOk)) pass(`${sixH.length} months agree with "paidAt" + 6h`);

  // 3. every bucket of every member against the independent model
  console.log("\n3. Every year, month and day bucket, every member, all time");
  for (const m of members) {
    let n = 0, bad = 0;
    for (const by of ["year", "month", "day"] as Granularity[]) {
      const app = (await getPayoutBreakdown({ from: null, to: null }, m, by, { unpaged: true })).rows;
      const ind = independent(ps, m, by);
      if (!check(`${name(m)} by ${by}: bucket count`, app.length === ind.size, `${app.length} vs ${ind.size}`)) bad++;
      for (const a of app) {
        n++;
        const i = ind.get(a.key);
        if (!i || !check(`${name(m)} ${by} ${a.key}`, same(i, a), i ? diff(i, a) : "missing independently")) bad++;
      }
    }
    if (!bad) pass(`${name(m)}: ${n.toLocaleString()} buckets match`);
  }

  // 4. hierarchy: days → months → years, and doctors + chamber = collected per bucket
  console.log("\n4. Days sum to months, months to years; doctors + chamber = collected");
  for (const m of members) {
    const get = async (by: Granularity) => (await getPayoutBreakdown({ from: null, to: null }, m, by, { unpaged: true })).rows;
    const [ys, ms, ds] = await Promise.all([get("year"), get("month"), get("day")]);
    const roll = (src: typeof ds, len: number) => {
      const out = new Map<string, Sums>();
      for (const r of src) { const k = len === 7 ? `${r.key.slice(0, 7)}-01` : `${r.key.slice(0, 4)}-01-01`; const s = out.get(k) ?? zero(); add(s, r); out.set(k, s); }
      return out;
    };
    const d2m = roll(ds, 7), m2y = roll(ms, 4);
    const okM = ms.every((r) => { const s = d2m.get(r.key); return s && same(s, r); }) && d2m.size === ms.length;
    const okY = ys.every((r) => { const s = m2y.get(r.key); return s && same(s, r); }) && m2y.size === ys.length;
    check(`${name(m)}: days sum to months`, okM);
    check(`${name(m)}: months sum to years`, okY);
    if (m === "all") {
      const all3 = [...ys, ...ms, ...ds].every((r) => r.consultant + r.operator + r.chamber === r.collected);
      check("everyone: consultant + operator + chamber = collected in every bucket", all3);
      if (okM && okY && all3) pass(`everyone: ${ds.length} days → ${ms.length} months → ${ys.length} years, each bucket splits exactly`);
    } else if (okM && okY) pass(`${name(m)}: ${ds.length} days → ${ms.length} months → ${ys.length} years`);
  }

  // 5. ranges: summary and member totals against the independent model
  console.log("\n5. Ranges: doctors + chamber = collected, and every member's total");
  const years = [...new Set(ps.map((p) => p.day.slice(0, 4)))].sort();
  const lastYear = years.filter((y) => y <= today.slice(0, 4)).pop()!;
  const ranges: { label: string; r: DayRange }[] = [
    { label: "all time", r: { from: null, to: null } },
    ...years.map((y) => ({ label: y, r: { from: `${y}-01-01`, to: `${y}-12-31` } })),
    ...Array.from({ length: 12 }, (_, i) => { const f = `${lastYear}-${String(i + 1).padStart(2, "0")}-01`; return { label: f.slice(0, 7), r: { from: f, to: monthEnd(f) } }; }),
    { label: "mid-month to mid-month", r: { from: `${lastYear}-03-15`, to: `${lastYear}-04-10` } },
    { label: "a single day", r: { from: ps[ps.length - 1].day, to: ps[ps.length - 1].day } },
    { label: "open start", r: { from: null, to: `${+lastYear - 2}-12-31` } },
    { label: "open end", r: { from: `${lastYear}-01-01`, to: null } },
    { label: "up to today (no future-dated)", r: { from: null, to: today } },
    { label: "after today (future-dated only)", r: { from: addDays(today, 1), to: null } },
    ...rangePresets(today).map((p) => ({ label: `preset: ${p.label}`, r: p.range })),
  ];
  let rangeBad = 0;
  for (const { label, r } of ranges) {
    const { doctors: ds, totals } = await getPayoutSummary(r);
    const all = independentTotal(ps, "all", r);
    let ok = check(`${label}: doctors + chamber = collected`, totals.doctors + totals.chamber === totals.collected, `${totals.doctors} + ${totals.chamber} vs ${totals.collected}`);
    ok = check(`${label}: collected/payments`, totals.collected === all.collected && totals.payments === all.payments, `${totals.collected}/${totals.payments} vs ${all.collected}/${all.payments}`) && ok;
    ok = check(`${label}: sum of doctor rows = doctors' share`, ds.reduce((s, d) => s + d.total, 0) === totals.doctors) && ok;
    for (const d of doctors) {
      const ind = independentTotal(ps, d.id, r);
      const app = ds.find((x) => x.id === d.id);
      ok = check(`${label}: ${d.person.fullName}`, (app?.consultant ?? 0) === ind.consultant && (app?.operator ?? 0) === ind.operator && (app?.payments ?? 0) === ind.payments,
        `app ${app?.consultant}/${app?.operator}/${app?.payments} vs ${ind.consultant}/${ind.operator}/${ind.payments}`) && ok;
    }
    for (const m of members) {
      const t = await getPayoutMemberTotals(r, m);
      ok = check(`${label}: ${name(m)} totals`, same(independentTotal(ps, m, r), t), diff(independentTotal(ps, m, r), t)) && ok;
    }
    if (!ok) rangeBad++;
  }
  if (!rangeBad) pass(`${ranges.length} ranges × ${members.length} members agree`);
  const at = await getPayoutSummary({ from: null, to: null });
  console.log(`  · all time: doctors ${fmt(at.totals.doctors)} + chamber ${fmt(at.totals.chamber)} = ${fmt(at.totals.doctors + at.totals.chamber)}; collected ${fmt(at.totals.collected)}`);
  for (const d of at.doctors) console.log(`      ${d.name}: consultant ${fmt(d.consultant)} + operator ${fmt(d.operator)} = ${fmt(d.total)}`);

  // 6. paged payment lists add up
  console.log("\n6. Paged payment lists add up to the totals");
  for (const m of members) {
    const r = { from: `${lastYear}-01-01`, to: `${lastYear}-12-31` };
    let page = 1, pages = 1, amount = 0, shareSum = 0, count = 0;
    const seen = new Set<number>();
    do {
      const res = await listPayoutPayments(r, m, { page, sort: "patient", dir: "asc" });
      pages = res.pages;
      for (const row of res.rows) {
        amount += row.amount; shareSum += row.share; count++; seen.add(row.id);
        check(`payment ${row.id} splits exactly`, row.consShare + row.opShare + row.chamber === row.amount);
      }
      page++;
    } while (page <= pages);
    const t = await getPayoutMemberTotals(r, m);
    if (check(`${name(m)} ${lastYear}: pages sum to totals`, amount === t.collected && shareSum === t.share && count === t.payments && seen.size === count, `${amount}/${shareSum}/${count} vs ${t.collected}/${t.share}/${t.payments}`))
      pass(`${name(m)} ${lastYear}: ${pages} pages, ${count} payments, share ${fmt(shareSum)}`);
  }

  // 7. against the old line-based getPayouts()
  console.log("\n7. Against the existing all-time getPayouts() (line-based)");
  const old = await getPayouts();
  // What getPayouts leaves out or rounds differently, computed independently:
  // lines with amountPaid <= 0 (it reads only amountPaid > 0), and per-line vs per-payment rounding.
  const expected = { collected: 0, chamber: 0, byDoc: new Map<number, { consultant: number; operator: number }>() };
  const fullLines = await prisma.treatmentLine.findMany({ include: { operatingDoctor: true, case: { include: { patient: { include: { consultantDoctor: true } } } } } });
  const lineSplit = new Map<number, { amt: number; c: number; o: number; ch: number; cId: number | null; oId: number | null }>();
  for (const l of fullLines) {
    if (l.amountPaid <= 0) continue;
    const cons = l.case.patient.consultantDoctor, op = l.operatingDoctor;
    const c = cons ? Math.round((l.amountPaid * cons.consultantSharePct) / 100) : 0;
    const o = op ? Math.round((l.amountPaid * op.operatorSharePct) / 100) : 0;
    lineSplit.set(l.id, { amt: l.amountPaid, c, o, ch: l.amountPaid - c - o, cId: cons?.id ?? null, oId: op?.id ?? null });
  }
  const bump = (id: number, k: "consultant" | "operator", v: number) => { const e = expected.byDoc.get(id) ?? { consultant: 0, operator: 0 }; e[k] += v; expected.byDoc.set(id, e); };
  for (const p of ps) { expected.collected += p.amount; expected.chamber += p.chamber; if (p.consId) bump(p.consId, "consultant", p.consShare); if (p.opId) bump(p.opId, "operator", p.opShare); }
  for (const s of lineSplit.values()) { expected.collected -= s.amt; expected.chamber -= s.ch; if (s.cId) bump(s.cId, "consultant", -s.c); if (s.oId) bump(s.oId, "operator", -s.o); }
  const excluded = fullLines.filter((l) => l.amountPaid < 0);
  console.log(`  · getPayouts reads lines with amountPaid > 0 only; ${excluded.length} line(s) are negative (legacy refunds): ${excluded.map((l) => `line ${l.id} ${fmt(l.amountPaid)}`).join(", ") || "none"}`);
  const dCol = at.totals.collected - old.collected, dCh = at.totals.chamber - old.chamber;
  console.log(`  · collected: getPayouts ${fmt(old.collected)} → payments ${fmt(at.totals.collected)} (Δ ${dCol}, explained ${expected.collected})`);
  console.log(`  · chamber:   getPayouts ${fmt(old.chamber)} → payments ${fmt(at.totals.chamber)} (Δ ${dCh}, explained ${expected.chamber})`);
  let oldOk = check("collected difference fully explained", dCol === expected.collected) && check("chamber difference fully explained", dCh === expected.chamber);
  for (const d of doctors) {
    const o = old.doctors.find((x) => x.id === d.id) ?? { consultant: 0, operator: 0 };
    const n = at.doctors.find((x) => x.id === d.id) ?? { consultant: 0, operator: 0 };
    const e = expected.byDoc.get(d.id) ?? { consultant: 0, operator: 0 };
    const dc = n.consultant - o.consultant, dop = n.operator - o.operator;
    console.log(`  · ${d.person.fullName}: consultant Δ ${dc} (explained ${e.consultant}), operator Δ ${dop} (explained ${e.operator})`);
    oldOk = check(`${d.person.fullName}: difference fully explained`, dc === e.consultant && dop === e.operator) && oldOk;
  }
  if (oldOk) pass("every difference from getPayouts() is accounted for, to the taka");

  // 8. future-dated payments
  console.log("\n8. Future-dated payments");
  const fut = ps.filter((p) => p.day > today);
  if (check("page lists exactly the payments dated after today", issues.future.length === fut.length && fut.every((f) => issues.future.some((x) => x.id === f.id))))
    pass(`${fut.length} flagged: ${issues.future.map((f) => `#${f.id} on ${f.day} ${fmt(f.amount)} (${f.patient})`).join("; ") || "none"}`);

  // 9. CSV exports
  console.log("\n9. CSV exports");
  check("csvCell neutralises formulas in text", csvCell("=HYPERLINK(\"x\")") === `"'=HYPERLINK(""x"")"` && csvCell("+1") === "'+1" && csvCell("-1") === "'-1" && csvCell("@SUM(A1)") === "'@SUM(A1)");
  check("csvCell leaves numbers numeric (a refund still sums)", csvCell(-2000) === "-2000" && csvCell(0) === "0");
  check("csvCell quotes commas, quotes and newlines", csvCell('a,"b"') === '"a,""b"""' && csvCell("x\ny") === '"x\ny"');
  const bn = toCsv([["রোগী", "মোঃ করিম, ঢাকা"]]);
  check("Bangla survives with BOM + CRLF", bn === "﻿রোগী,\"মোঃ করিম, ঢাকা\"\r\n");
  for (const by of ["year", "month", "day"] as Granularity[]) {
    const { csv } = await buildPayoutCsv({ range: { from: null, to: null }, kind: "summary", by, member: "all" });
    check(`summary by ${by}: BOM`, csv.startsWith("﻿"));
    check(`summary by ${by}: CRLF only`, !/[^\r]\n/.test(csv));
    const recs: string[][] = parse(csv, { bom: true, relax_column_count: true });
    const head = recs[0];
    const data = recs.slice(1).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[1] ?? "") && r[0] !== "Total");
    const total = recs.find((r) => r[0] === "Total")!;
    const col = (h: string) => head.indexOf(h);
    const sumCol = (i: number) => data.reduce((s, r) => s + Number(r[i]), 0);
    let ok = check(`summary by ${by}: Collected column sums to the total`, sumCol(col("Collected")) === at.totals.collected && Number(total[col("Collected")]) === at.totals.collected);
    ok = check(`summary by ${by}: each row's doctors + chamber = collected`, data.every((r) => Number(r[col("Doctors total")]) + Number(r[col("Chamber (clinic)")]) === Number(r[col("Collected")]))) && ok;
    for (const d of at.doctors) ok = check(`summary by ${by}: ${d.name} column`, sumCol(col(d.name)) === d.total && Number(total[col(d.name)]) === d.total) && ok;
    if (ok) pass(`summary by ${by}: ${data.length} rows, every column reconciles`);
  }
  const det = await buildPayoutCsv({ range: { from: null, to: null }, kind: "detail", by: "month", member: "all" });
  const drecs: string[][] = parse(det.csv, { bom: true, relax_column_count: true });
  const dh = drecs[0];
  const drows = drecs.slice(1).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? ""));
  const di = (h: string) => dh.indexOf(h);
  const dsum = (h: string) => drows.reduce((s, r) => s + Number(r[di(h)] || 0), 0);
  let dok = check("detail: one row per payment", drows.length === ps.length, `${drows.length} vs ${ps.length}`);
  dok = check("detail: Paid sums to collected", dsum("Paid") === at.totals.collected) && dok;
  dok = check("detail: every row's shares add up to what was paid", drows.every((r) => Number(r[di("Consultant share")] || 0) + Number(r[di("Operator share")] || 0) + Number(r[di("Chamber share")]) === Number(r[di("Paid")]))) && dok;
  dok = check("detail: chamber column = chamber total", dsum("Chamber share") === at.totals.chamber) && dok;
  dok = check("detail: refunds and future dates flagged", drows.filter((r) => r[di("Flag")].includes("Refund")).length === ps.filter((p) => p.amount < 0).length && drows.filter((r) => r[di("Flag")].includes("Future")).length === fut.length) && dok;
  if (dok) pass(`detail: ${drows.length.toLocaleString()} payments, Paid ${fmt(dsum("Paid"))}, consultant ${fmt(dsum("Consultant share"))} + operator ${fmt(dsum("Operator share"))} + chamber ${fmt(dsum("Chamber share"))}`);
  for (const d of doctors) {
    const one = await buildPayoutCsv({ range: { from: null, to: null }, kind: "detail", by: "month", member: d.id });
    const rr: string[][] = parse(one.csv, { bom: true, relax_column_count: true });
    const h = rr[0], col = h.indexOf(`${d.person.fullName} share`);
    const body = rr.slice(1).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? ""));
    const t = at.doctors.find((x) => x.id === d.id);
    check(`detail for ${d.person.fullName}: their column sums to their total`, body.reduce((s, r) => s + Number(r[col]), 0) === (t?.total ?? 0));
  }

  console.log(`\n${checks.toLocaleString()} checks, ${failures} failed`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
