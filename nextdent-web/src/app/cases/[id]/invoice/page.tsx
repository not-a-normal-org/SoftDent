import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCaseForInvoice, getInvoiceDoc } from "@/lib/billing";
import { taka, fmtDate } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (Number.isNaN(cid)) notFound();

  const [c, doc] = await Promise.all([getCaseForInvoice(cid), getInvoiceDoc()]);
  if (!c) notFound();

  const billed = c.lines.reduce((s, l) => s + l.afterDiscountAmount, 0);
  const gross = c.lines.reduce((s, l) => s + l.totalAmount, 0);
  const paid = c.lines.reduce((s, l) => s + l.amountPaid, 0);
  const due = billed - paid;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href={`/cases/${c.id}`} className="text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Back to case</Link>
        <PrintButton />
      </div>

      {/* printable invoice — intentionally always light ("paper") */}
      <article className="print-area mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b-2 border-teal-700 pb-3">
          <div>
            <div className="text-xl font-bold text-teal-800">{doc?.heading1 ?? "Dental Clinic"}</div>
            {doc?.heading2 && <div className="text-xs text-slate-600">{doc.heading2}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-wide text-slate-800">INVOICE</div>
            <div className="text-xs text-slate-500">#{String(c.id).padStart(5, "0")}</div>
            <div className="text-xs text-slate-500">{fmtDate(new Date())}</div>
          </div>
        </header>

        <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 py-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{doc?.heading7 ?? "Invoice to"}</div>
            <div className="font-semibold">{c.patient.fullName}</div>
            {c.patient.primaryPhone && <div className="text-slate-600">{c.patient.primaryPhone}</div>}
            {c.patient.address && <div className="text-slate-600">{c.patient.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Case</div>
            <div className="font-medium">{c.name || `Case #${c.id}`}</div>
            {c.status && <div className="text-slate-600">{c.status}</div>}
          </div>
        </div>

        <table className="w-full py-4 text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 font-semibold">Procedure</th>
              <th className="py-2 text-right font-semibold">Amount</th>
              <th className="py-2 text-right font-semibold">Disc</th>
              <th className="py-2 text-right font-semibold">Payable</th>
            </tr>
          </thead>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-2 text-slate-500">{fmtDate(l.treatmentDate)}</td>
                <td className="py-2">
                  {l.treatmentName || "—"}
                  {l.operatingDoctor && <span className="block text-[11px] text-slate-400">{l.operatingDoctor.person.fullName}</span>}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-600">{taka(l.totalAmount)}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">{l.discountPercent ? `${l.discountPercent}%` : "—"}</td>
                <td className="py-2 text-right font-medium tabular-nums">{taka(l.afterDiscountAmount)}</td>
              </tr>
            ))}
            {c.lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No procedures on this case.</td></tr>}
          </tbody>
        </table>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          {gross !== billed && (
            <div className="flex justify-between text-slate-500"><span>Gross</span><span className="tabular-nums">{taka(gross)}</span></div>
          )}
          <div className="flex justify-between text-slate-600"><span>Total payable</span><span className="tabular-nums font-medium">{taka(billed)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="tabular-nums">{taka(paid)}</span></div>
          <div className={`flex justify-between border-t border-slate-300 pt-1 text-base font-bold ${due > 0 ? "text-rose-700" : "text-slate-800"}`}>
            <span>Due</span><span className="tabular-nums">{taka(due)}</span>
          </div>
        </div>

        <footer className="mt-8 flex items-end justify-between gap-6">
          <div className="text-center text-xs italic text-slate-500">{doc?.footer}</div>
          <div className="w-48 border-t border-slate-400 pt-1 text-center text-xs text-slate-500">Authorised signature</div>
        </footer>
      </article>
    </div>
  );
}
