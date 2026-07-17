import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCase, getBillingEditorData } from "@/lib/billing";
import { deleteCase, deleteLine } from "@/lib/actions/billing";
import { taka, fmtDate } from "@/lib/format";
import LineForm from "@/components/LineForm";
import PayLine from "@/components/PayLine";

export default async function CaseManagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (Number.isNaN(cid)) notFound();

  const [c, editor] = await Promise.all([getCase(cid), getBillingEditorData()]);
  if (!c) notFound();

  const billed = c.lines.reduce((s, l) => s + l.afterDiscountAmount, 0);
  const paid = c.lines.reduce((s, l) => s + l.amountPaid, 0);
  const due = billed - paid;
  const payments = c.lines.flatMap((l) => l.payments.map((p) => ({ ...p, proc: l.treatmentName })));

  return (
    <div className="space-y-6">
      <Link href={`/patients/${c.patient.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← {c.patient.fullName}</Link>

      {/* case header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{c.name || `Case #${c.id}`}</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{c.status ?? "Active"}{c.description ? ` · ${c.description}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-right text-slate-700 dark:bg-slate-800 dark:text-slate-200"><span className="block text-[10px] uppercase opacity-70">Billed</span><span className="text-sm font-semibold tabular-nums">{taka(billed)}</span></span>
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-right text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><span className="block text-[10px] uppercase opacity-70">Paid</span><span className="text-sm font-semibold tabular-nums">{taka(paid)}</span></span>
              <span className={`rounded-lg px-3 py-1.5 text-right ${due > 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-slate-50 text-slate-500 dark:bg-slate-800"}`}><span className="block text-[10px] uppercase opacity-70">Due</span><span className="text-sm font-semibold tabular-nums">{taka(due)}</span></span>
            </div>
            <Link href={`/cases/${c.id}/invoice`} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600">🧾 Invoice</Link>
            <Link href={`/cases/${c.id}/edit`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">✎</Link>
            <form action={deleteCase.bind(null, c.id)}><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-500/10">Delete</button></form>
          </div>
        </div>
      </section>

      {/* lines */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Procedures</h2>
        {c.lines.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No procedures yet — add one below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Procedure</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 text-right font-medium">Disc</th>
                  <th className="px-5 py-2 text-right font-medium">Payable</th>
                  <th className="px-5 py-2 text-right font-medium">Paid</th>
                  <th className="px-5 py-2 text-right font-medium">Due</th>
                  <th className="px-5 py-2 text-right font-medium">Pay</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l) => {
                  const ldue = l.afterDiscountAmount - l.amountPaid;
                  return (
                    <tr key={l.id} className="border-t border-slate-50 dark:border-slate-800/60">
                      <td className="whitespace-nowrap px-5 py-2 text-slate-500 dark:text-slate-400">{fmtDate(l.treatmentDate)}</td>
                      <td className="px-5 py-2 text-slate-800 dark:text-slate-200">{l.treatmentName || "—"}{l.operatingDoctor ? <span className="block text-[11px] text-slate-400">{l.operatingDoctor.person.fullName}</span> : null}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(l.totalAmount)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{l.discountPercent ? `${l.discountPercent}%` : "—"}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{taka(l.afterDiscountAmount)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{taka(l.amountPaid)}</td>
                      <td className={`px-5 py-2 text-right tabular-nums ${ldue > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>{taka(ldue)}</td>
                      <td className="px-5 py-2 text-right"><PayLine lineId={l.id} due={ldue} /></td>
                      <td className="whitespace-nowrap px-5 py-2 text-right text-xs">
                        <Link href={`/cases/${c.id}/lines/${l.id}/edit`} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</Link>
                        <form action={deleteLine.bind(null, l.id)} className="inline"><button className="ml-2 text-slate-400 hover:text-rose-600">✕</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/30">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Add procedure</h3>
          <LineForm caseId={c.id} treatments={editor.treatments} doctors={editor.doctors} compact />
        </div>
      </section>

      {/* payment history */}
      {payments.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Payment history</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{fmtDate(p.paidAt)} · {p.proc}{p.method ? ` · ${p.method}` : ""}</span>
                <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{taka(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
