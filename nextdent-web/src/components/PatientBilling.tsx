"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { addCaseInline, addLineInline, payLineInline, type InlineState } from "@/lib/actions/billing";
import { afterDiscountClient } from "@/lib/billing-math";
import { taka, fmtDate, toDateInput } from "@/lib/format";

export type BillingPayment = {
  id: number;
  amount: number;
  paidAt: Date | string;
  method: string | null;
};
export type BillingLine = {
  id: number;
  treatmentDate: Date | string | null;
  treatmentName: string | null;
  totalAmount: number;
  discountPercent: number;
  afterDiscountAmount: number;
  amountPaid: number;
  // A treatment is billed once and paid off over several visits — ৳5,000 of work with
  // ৳1,000 on day one and ৳2,000 on day two. Each instalment is its own Payment row;
  // amountPaid is their running total.
  payments: BillingPayment[];
};
export type BillingCase = {
  id: number;
  name: string | null;
  status: string | null;
  notes: string | null;
  lines: BillingLine[];
};

const initial: InlineState = {};
const cell = "px-3 py-2 text-right tabular-nums";
const field =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

// A balance below zero is money the clinic is holding, not money owed — it reads as
// credit rather than as "৳-100 due".
const dueText = (n: number) => (n < 0 ? `${taka(-n)} credit` : taka(n));
const dueTone = (n: number) =>
  n > 0
    ? "text-rose-600 dark:text-rose-400"
    : n < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-400 dark:text-slate-500";

/** Clears the form once a submit comes back clean, so the next entry starts empty. */
function useResetOnSave(state: InlineState, form: React.RefObject<HTMLFormElement | null>) {
  const seen = useRef(state.savedAt);
  useEffect(() => {
    if (state.savedAt && state.savedAt !== seen.current) {
      seen.current = state.savedAt;
      form.current?.reset();
    }
  }, [state.savedAt, form]);
}

function AddCase({ patientId }: { patientId: number }) {
  const [state, action, pending] = useActionState(addCaseInline, initial);
  const form = useRef<HTMLFormElement>(null);
  useResetOnSave(state, form);

  return (
    <div>
      <form ref={form} action={action} className="flex items-center gap-2">
        <input type="hidden" name="patientId" value={patientId} />
        <input name="name" placeholder="New case — e.g. Upper right molar RCT" className={`${field} min-w-0 flex-[2]`} />
        <input name="notes" placeholder="Note (optional)" className={`${field} min-w-0 flex-1`} />
        <button
          type="submit"
          disabled={pending}
          title="Create case"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-teal-600 text-lg font-semibold leading-none text-white hover:bg-teal-700 disabled:opacity-50"
        >
          +
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{state.error}</p>}
    </div>
  );
}

function AddLine({ caseId }: { caseId: number }) {
  const [state, action, pending] = useActionState(addLineInline, initial);
  const form = useRef<HTMLFormElement>(null);
  useResetOnSave(state, form);

  // live preview of what the doctor is typing, so Due is visible before saving
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [payableInput, setPayableInput] = useState("");
  const [paid, setPaid] = useState("");
  // clear the row the moment a save lands — adjusting state during render rather
  // than in an effect, so there is no flash of the previous entry
  const [lastSaved, setLastSaved] = useState(state.savedAt);
  if (state.savedAt !== lastSaved) {
    setLastSaved(state.savedAt);
    setAmount("");
    setDiscount("");
    setPayableInput("");
    setPaid("");
  }

  // Discount and payable are two views of the same number, so either can be typed:
  // enter 10% against ৳2,000 and payable shows ৳1,800; type ৳1,800 and the discount
  // becomes 10%. Only `discountPercent` is submitted — payable is derived server-side
  // by afterDiscount(), so the two can never disagree in the database.
  const gross = Number(amount) || 0;
  const payable = payableInput === "" ? afterDiscountClient(gross, Number(discount) || 0) : Number(payableInput) || 0;
  const paidNum = Number(paid) || 0;
  const due = payable - paidNum;

  function onDiscountChange(v: string) {
    setDiscount(v);
    setPayableInput(""); // payable is derived again
  }
  function onPayableChange(v: string) {
    setPayableInput(v);
    const want = Number(v);
    // Round to the same 0.5 step the input allows, so the stored percent reproduces
    // the typed figure instead of drifting by a taka.
    if (gross > 0 && Number.isFinite(want)) {
      const pct = Math.round(((gross - want) / gross) * 1000) / 10;
      setDiscount(String(Math.min(100, Math.max(0, pct))));
    }
  }

  return (
    <>
      <tr className="border-t border-slate-100 dark:border-slate-800">
        <td className="px-3 py-2">
          {/* the row's inputs are wired to this form by id, so they can sit in their own cells */}
          <form ref={form} id={`line-${caseId}`} action={action}>
            <input type="hidden" name="caseId" value={caseId} />
          </form>
          <input type="date" name="treatmentDate" defaultValue={toDateInput(new Date())} form={`line-${caseId}`} className={`${field} w-full`} />
        </td>
        <td className="px-3 py-2">
          <input name="treatmentName" placeholder="Procedure" form={`line-${caseId}`} className={`${field} w-full`} />
        </td>
        <td className="px-3 py-2">
          <input type="number" name="totalAmount" min="0" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} form={`line-${caseId}`} className={`${field} w-24 text-right`} />
        </td>
        <td className="px-3 py-2">
          <input type="number" name="discountPercent" min="0" max="100" step="0.1" placeholder="0" value={discount} onChange={(e) => onDiscountChange(e.target.value)} form={`line-${caseId}`} className={`${field} w-16 text-right`} />
        </td>
        <td className="px-3 py-2">
          {/* editable: type the figure you actually want to charge and the % follows */}
          <input type="number" min="0" placeholder={gross ? String(gross) : "0"}
            value={payableInput === "" ? (payable || "") : payableInput}
            onChange={(e) => onPayableChange(e.target.value)}
            title="Type the final amount and the discount % is worked out for you"
            className={`${field} w-24 text-right`} />
        </td>
        <td className="px-3 py-2">
          <input type="number" name="paidNow" min="0" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} form={`line-${caseId}`} className={`${field} w-24 text-right`} />
        </td>
        <td className={`${cell} ${dueTone(due)}`}>
          {payable || paidNum ? dueText(due) : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="submit"
            form={`line-${caseId}`}
            disabled={pending}
            title="Add procedure"
            className="grid h-7 w-7 place-items-center rounded-md bg-teal-600 text-base font-semibold leading-none text-white hover:bg-teal-700 disabled:opacity-50"
          >
            +
          </button>
        </td>
      </tr>
      {state.error && (
        <tr>
          <td colSpan={8} className="px-3 pb-2 text-xs text-rose-600 dark:text-rose-400">{state.error}</td>
        </tr>
      )}
    </>
  );
}

function PayCell({ line }: { line: BillingLine }) {
  const [state, action, pending] = useActionState(payLineInline.bind(null, line.id), initial);
  const [open, setOpen] = useState(false);
  const due = line.afterDiscountAmount - line.amountPaid;
  // close the little payment box once the payment is in (see AddLine on why not an effect)
  const [lastSaved, setLastSaved] = useState(state.savedAt);
  if (state.savedAt !== lastSaved) {
    setLastSaved(state.savedAt);
    setOpen(false);
  }

  // The + stays even with nothing due: a ৳0 line is how an advance is held, and it
  // would otherwise be the one row that can never take money.
  return (
    <span className="relative inline-flex items-center justify-end gap-1.5">
      <span className="text-emerald-600 dark:text-emerald-400">{taka(line.amountPaid)}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Record a payment"
        className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-xs font-semibold leading-none text-white hover:bg-emerald-700"
      >
        +
      </button>
      {/* floated, so opening it never widens the column */}
      {open && (
        <form
          action={action}
          className="absolute right-0 top-full z-20 mt-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          <input type="hidden" name="paidAt" value={toDateInput(new Date())} />
          {/* no max — paying more than is due is allowed and becomes credit */}
          <input name="amount" type="number" min="1" defaultValue={due > 0 ? due : ""} autoFocus className={`${field} w-24 text-right`} />
          <button type="submit" disabled={pending} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">✓</button>
          <button type="button" onClick={() => setOpen(false)} className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </form>
      )}
      {state.error && <span className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap text-xs text-rose-600 dark:text-rose-400">{state.error}</span>}
    </span>
  );
}

export default function PatientBilling({ patientId, cases }: { patientId: number; cases: BillingCase[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Treatment &amp; billing</h2>

      <AddCase patientId={patientId} />

      {cases.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          No treatment cases yet — name one above to start billing.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {cases.map((c) => {
            const billed = c.lines.reduce((t, l) => t + l.afterDiscountAmount, 0);
            const paid = c.lines.reduce((t, l) => t + l.amountPaid, 0);
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.name || `Case #${c.id}`}</span>
                    {c.notes && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{c.notes}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {taka(billed)} billed · <span className="text-emerald-600 dark:text-emerald-400">{taka(paid)} paid</span> ·{" "}
                      <span className={dueTone(billed - paid)}>
                        {billed - paid < 0 ? `${taka(paid - billed)} credit` : `${taka(billed - paid)} due`}
                      </span>
                    </span>
                    <a href={`/cases/${c.id}/invoice`} className="text-teal-700 hover:underline dark:text-teal-400">invoice</a>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Procedure</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-right font-medium">Disc %</th>
                        <th className="px-3 py-2 text-right font-medium">Payable</th>
                        <th className="px-3 py-2 text-right font-medium">Paid</th>
                        <th className="px-3 py-2 text-right font-medium">Due</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {c.lines.map((l) => {
                        const due = l.afterDiscountAmount - l.amountPaid;
                        const instalments = [...(l.payments ?? [])].sort(
                          (a, b) => +new Date(a.paidAt) - +new Date(b.paidAt)
                        );
                        return (
                          <Fragment key={l.id}>
                            <tr className="border-t border-slate-50 dark:border-slate-800/60">
                              <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{fmtDate(l.treatmentDate)}</td>
                              <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{l.treatmentName || "—"}</td>
                              <td className={`${cell} text-slate-700 dark:text-slate-300`}>{taka(l.totalAmount)}</td>
                              <td className={`${cell} text-slate-500 dark:text-slate-400`}>{l.discountPercent ? `${l.discountPercent}%` : "—"}</td>
                              <td className={`${cell} text-slate-700 dark:text-slate-300`}>{taka(l.afterDiscountAmount)}</td>
                              <td className={cell}><PayCell line={l} /></td>
                              <td className={`${cell} ${dueTone(due)}`}>{dueText(due)}</td>
                              <td className="px-3 py-2" />
                            </tr>
                            {/* Instalments against this treatment, oldest first, with a
                                running balance — so "৳1,000 on day one, ৳2,000 on day
                                two" is visible rather than collapsed into one total. */}
                            {instalments.length > 1 && (
                              <tr className="border-0">
                                <td />
                                <td colSpan={7} className="px-3 pb-2">
                                  <ul className="space-y-0.5 border-l-2 border-emerald-200 pl-3 text-xs text-slate-500 dark:border-emerald-900 dark:text-slate-400">
                                    {instalments.map((pmt, i) => {
                                      const running = instalments
                                        .slice(0, i + 1)
                                        .reduce((t, x) => t + x.amount, 0);
                                      return (
                                        <li key={pmt.id} className="flex gap-3 tabular-nums">
                                          <span className="w-24 shrink-0">{fmtDate(pmt.paidAt)}</span>
                                          <span className="w-20 text-right text-emerald-600 dark:text-emerald-400">{taka(pmt.amount)}</span>
                                          {pmt.method && <span className="w-20 truncate">{pmt.method}</span>}
                                          <span className="text-slate-400 dark:text-slate-500">
                                            paid {taka(running)} of {taka(l.afterDiscountAmount)}
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      <AddLine caseId={c.id} />
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
