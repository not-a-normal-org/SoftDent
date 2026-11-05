"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addCaseInline, addLineInline, payLineInline, updateLineInline,
  updateCaseInline, setCaseStatusInline, type InlineState,
} from "@/lib/actions/billing";
import { CASE_STATUS_VALUES, DEFAULT_CASE_STATUS, canonicalCaseStatus, caseStatusTone } from "@/lib/case-constants";
import Combo from "@/components/Combo";
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
  const [status, setStatus] = useState<string>(DEFAULT_CASE_STATUS);
  useResetOnSave(state, form);

  return (
    <div>
      <form ref={form} action={action} className="flex items-center gap-2">
        <input type="hidden" name="patientId" value={patientId} />
        <input name="name" placeholder="New case — e.g. Upper right molar RCT" className={`${field} min-w-0 flex-[2]`} />
        <input name="notes" placeholder="Note (optional)" className={`${field} min-w-0 flex-1`} />
        <div className="w-36 shrink-0">
          <Combo name="status" options={CASE_STATUS_VALUES} value={status} onChange={setStatus}
            aria-label="New case status" className={`${field} w-full`} />
        </div>
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

function AddLine({ caseId, lifetimeDiscount }: { caseId: number; lifetimeDiscount: number }) {
  const [state, action, pending] = useActionState(addLineInline, initial);
  const form = useRef<HTMLFormElement>(null);
  useResetOnSave(state, form);

  // live preview of what the doctor is typing, so Due is visible before saving
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [payableInput, setPayableInput] = useState("");
  const [paid, setPaid] = useState("");
  // A lifetime discount is a standing agreement with the patient, so it should not
  // have to be remembered and retyped on every line. It fills in the moment there is
  // an amount to apply it to, and stops as soon as the discount is touched by hand.
  const [discountTouched, setDiscountTouched] = useState(false);
  const autoDiscount = lifetimeDiscount > 0 && !discountTouched && amount.trim() !== "";
  // clear the row the moment a save lands — adjusting state during render rather
  // than in an effect, so there is no flash of the previous entry
  const [lastSaved, setLastSaved] = useState(state.savedAt);
  if (state.savedAt !== lastSaved) {
    setLastSaved(state.savedAt);
    setAmount("");
    setDiscount("");
    setPayableInput("");
    setPaid("");
    setDiscountTouched(false);
  }

  // Discount and payable are two views of the same number, so either can be typed:
  // enter 10% against ৳2,000 and payable shows ৳1,800; type ৳1,800 and the discount
  // becomes 10%. Only `discountPercent` is submitted — payable is derived server-side
  // by afterDiscount(), so the two can never disagree in the database.
  const gross = Number(amount) || 0;
  // what the discount box actually shows: the standing agreement until someone
  // overrides it, their figure afterwards
  const effectiveDiscount = autoDiscount ? String(lifetimeDiscount) : discount;
  const payable = payableInput === "" ? afterDiscountClient(gross, Number(effectiveDiscount) || 0) : Number(payableInput) || 0;
  const paidNum = Number(paid) || 0;
  const due = payable - paidNum;

  function onDiscountChange(v: string) {
    setDiscount(v);
    setDiscountTouched(true);
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
      setDiscountTouched(true);
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
          <input type="number" name="discountPercent" min="0" max="100" step="0.1" placeholder="0"
            value={effectiveDiscount} onChange={(e) => onDiscountChange(e.target.value)} form={`line-${caseId}`}
            title={autoDiscount ? `${lifetimeDiscount}% lifetime discount applied automatically` : undefined}
            className={`${field} w-16 text-right ${autoDiscount ? "border-teal-400 text-teal-700 dark:border-teal-600 dark:text-teal-300" : ""}`} />
        </td>
        <td className="px-3 py-2">
          {/* Editable: type the figure you actually want to charge and the % follows.
              The figure itself is submitted — a percent rounded to 0.1% cannot
              reproduce it (৳38,000 of ৳45,000 is 15.555…%, which stores back as
              ৳37,980), and the money charged must be the money shown. */}
          <input type="hidden" name="afterDiscountAmount" value={String(payable)} form={`line-${caseId}`} />
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

/**
 * One billed procedure: read-only until the pencil is pressed, then the same row
 * becomes inputs in place.
 *
 * Each row owns its edit state, so opening one does not close another and adding a
 * new procedure below leaves every open row exactly as it was — the list re-renders
 * on save, but rows are keyed by line id, so their state survives it.
 *
 * Paid is not editable here. That figure is the sum of the payment rows, and typing
 * over it would silently separate the ledger from the receipts that justify it;
 * payments stay under the + control beside it.
 */
function LineRow({ line, children }: { line: BillingLine; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(updateLineInline.bind(null, line.id), initial);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(line.treatmentName ?? "");
  const [date, setDate] = useState(toDateInput(line.treatmentDate));
  const [amount, setAmount] = useState(String(line.totalAmount));
  const [discount, setDiscount] = useState(String(line.discountPercent || ""));
  // 75 imported lines hold a payable their own amount and discount do not reproduce
  // — one is ৳20,000 billed against a ৳3,220 amount. Seed the box from the STORED
  // figure for those, or the editor opens showing ৳3,220 and saving a typo fix in
  // the procedure name writes ৳16,780 off the patient's bill.
  const storedDiffers = line.afterDiscountAmount !== afterDiscountClient(line.totalAmount, line.discountPercent);
  const [payableInput, setPayableInput] = useState(storedDiffers ? String(line.afterDiscountAmount) : "");

  // close once the save lands (see AddLine on why this is not an effect)
  const [lastSaved, setLastSaved] = useState(state.savedAt);
  if (state.savedAt !== lastSaved) { setLastSaved(state.savedAt); setEditing(false); }

  const gross = Number(amount) || 0;
  const payable = payableInput === "" ? afterDiscountClient(gross, Number(discount) || 0) : Number(payableInput) || 0;
  const due = payable - line.amountPaid;

  function onPayableChange(v: string) {
    setPayableInput(v);
    const want = Number(v);
    if (gross > 0 && Number.isFinite(want)) {
      const pct = Math.round(((gross - want) / gross) * 1000) / 10;
      setDiscount(String(Math.min(100, Math.max(0, pct))));
    }
  }

  function startEditing() {
    // re-read from the row, so a cancelled edit never leaves stale figures behind,
    // and so a payable that its own discount cannot reproduce is shown as stored
    setName(line.treatmentName ?? "");
    setDate(toDateInput(line.treatmentDate));
    setAmount(String(line.totalAmount));
    setDiscount(String(line.discountPercent || ""));
    setPayableInput(storedDiffers ? String(line.afterDiscountAmount) : "");
    setEditing(true);
  }

  if (!editing) {
    const readDue = line.afterDiscountAmount - line.amountPaid;
    return (
      <>
        <tr className="group border-t border-slate-50 dark:border-slate-800/60">
          <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{fmtDate(line.treatmentDate)}</td>
          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{line.treatmentName || "—"}</td>
          <td className={`${cell} text-slate-700 dark:text-slate-300`}>{taka(line.totalAmount)}</td>
          <td className={`${cell} text-slate-500 dark:text-slate-400`}>{line.discountPercent ? `${line.discountPercent}%` : "—"}</td>
          <td className={`${cell} text-slate-700 dark:text-slate-300`}>{taka(line.afterDiscountAmount)}</td>
          <td className={cell}><PayCell line={line} /></td>
          <td className={`${cell} ${dueTone(readDue)}`}>{dueText(readDue)}</td>
          <td className="px-3 py-2 text-right">
            <button
              type="button"
              onClick={startEditing}
              title="Edit this procedure"
              aria-label={`Edit ${line.treatmentName ?? "procedure"}`}
              className="rounded px-1 text-slate-300 transition hover:text-teal-700 group-hover:text-slate-500 dark:text-slate-600 dark:hover:text-teal-400 dark:group-hover:text-slate-400"
            >
              ✎
            </button>
          </td>
        </tr>
        {children}
      </>
    );
  }

  return (
    <>
      <tr className="border-t border-teal-200 bg-teal-50/40 dark:border-teal-800 dark:bg-teal-500/5">
        <td className="px-3 py-2">
          {/* the row's inputs bind to this form by id, so they can sit in their own cells */}
          <form id={`edit-${line.id}`} action={action}>
            <input type="hidden" name="discountPercent" value={discount || "0"} />
          </form>
          <input type="date" name="treatmentDate" value={date} onChange={(e) => setDate(e.target.value)}
            form={`edit-${line.id}`} className={`${field} w-full`} />
        </td>
        <td className="px-3 py-2">
          <input name="treatmentName" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Procedure" form={`edit-${line.id}`} className={`${field} w-full`} />
        </td>
        <td className="px-3 py-2">
          {/* re-pricing the procedure releases a seeded payable so it follows again */}
          <input type="number" name="totalAmount" min="0" value={amount}
            onChange={(e) => { setAmount(e.target.value); setPayableInput(""); }}
            form={`edit-${line.id}`} className={`${field} w-24 text-right`} />
        </td>
        <td className="px-3 py-2">
          <input type="number" min="0" max="100" step="0.1" value={discount}
            onChange={(e) => { setDiscount(e.target.value); setPayableInput(""); }}
            className={`${field} w-16 text-right`} />
        </td>
        <td className="px-3 py-2">
          {/* posts the payable shown, so editing an unrelated field cannot rewrite it */}
          <input type="hidden" name="afterDiscountAmount" value={String(payable)} form={`edit-${line.id}`} />
          <input type="number" min="0" placeholder={gross ? String(gross) : "0"}
            value={payableInput === "" ? (payable || "") : payableInput}
            onChange={(e) => onPayableChange(e.target.value)}
            title="Type the final amount and the discount % is worked out for you"
            className={`${field} w-24 text-right`} />
        </td>
        <td className={`${cell} text-emerald-600 dark:text-emerald-400`}>{taka(line.amountPaid)}</td>
        <td className={`${cell} ${dueTone(due)}`}>{dueText(due)}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button type="submit" form={`edit-${line.id}`} disabled={pending}
            title="Save" aria-label="Save changes"
            className="rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "…" : "✓"}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            title="Cancel" aria-label="Cancel editing"
            className="ml-1 px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </td>
      </tr>
      {state.error && (
        <tr><td colSpan={8} className="bg-teal-50/40 px-3 pb-2 text-xs text-rose-600 dark:bg-teal-500/5 dark:text-rose-400">{state.error}</td></tr>
      )}
      {children}
    </>
  );
}

/**
 * The case header: what it is called, where it has got to, and the two controls the
 * clinic actually reaches for — a tick to say it is finished, and a pencil for
 * everything else. The tick is a single click because marking work complete is the
 * commonest edit by far; it toggles, so a mis-click is undone the same way.
 */
function CaseHeader({ c, billed, paid }: { c: BillingCase; billed: number; paid: number }) {
  const [state, action, pending] = useActionState(updateCaseInline.bind(null, c.id), initial);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(canonicalCaseStatus(c.status) ?? DEFAULT_CASE_STATUS);
  const [busy, setBusy] = useState(false);

  const [lastSaved, setLastSaved] = useState(state.savedAt);
  if (state.savedAt !== lastSaved) { setLastSaved(state.savedAt); setEditing(false); }

  const current = canonicalCaseStatus(c.status) ?? DEFAULT_CASE_STATUS;
  const done = current === "Completed";

  async function toggleDone() {
    setBusy(true);
    await setCaseStatusInline(c.id, done ? DEFAULT_CASE_STATUS : "Completed");
    setBusy(false);
  }

  return (
    <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-slate-800 dark:text-slate-200">{c.name || `Case #${c.id}`}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${caseStatusTone(current)}`}>{current}</span>
          {c.notes && <span className="text-xs text-slate-400 dark:text-slate-500">{c.notes}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {taka(billed)} billed · <span className="text-emerald-600 dark:text-emerald-400">{taka(paid)} paid</span> ·{" "}
            <span className={dueTone(billed - paid)}>
              {billed - paid < 0 ? `${taka(paid - billed)} credit` : `${taka(billed - paid)} due`}
            </span>
          </span>
          <a href={`/cases/${c.id}/invoice`} className="text-teal-700 hover:underline dark:text-teal-400">invoice</a>
          <button
            type="button"
            onClick={toggleDone}
            disabled={busy}
            title={done ? "Mark as still in progress" : "Mark this case complete"}
            aria-label={done ? `Reopen ${c.name ?? "case"}` : `Complete ${c.name ?? "case"}`}
            className={`rounded px-1 text-base leading-none transition disabled:opacity-40 ${
              done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 hover:text-emerald-600 dark:text-slate-600 dark:hover:text-emerald-400"
            }`}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => { setStatus(current); setEditing((e) => !e); }}
            title="Edit this case"
            aria-label={`Edit case ${c.name ?? c.id}`}
            className="rounded px-1 text-slate-300 transition hover:text-teal-700 dark:text-slate-600 dark:hover:text-teal-400"
          >
            ✎
          </button>
        </div>
      </div>

      {editing && (
        <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
          <input name="name" defaultValue={c.name ?? ""} placeholder="Case name" className={`${field} min-w-0 flex-[2]`} />
          <input name="notes" defaultValue={c.notes ?? ""} placeholder="Note (optional)" className={`${field} min-w-0 flex-1`} />
          <div className="w-40">
            <Combo name="status" options={CASE_STATUS_VALUES} value={status} onChange={setStatus}
              aria-label="Case status" className={`${field} w-full`} />
          </div>
          <button type="submit" disabled={pending}
            className="rounded-md bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Cancel</button>
          {state.error && <span className="text-xs text-rose-600 dark:text-rose-400">{state.error}</span>}
        </form>
      )}
    </div>
  );
}

export default function PatientBilling({
  patientId, cases, lifetimeDiscount = 0,
}: {
  patientId: number;
  cases: BillingCase[];
  /** standing discount agreed with this patient, pre-filled on every new line */
  lifetimeDiscount?: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Treatment &amp; billing</h2>
        {lifetimeDiscount > 0 && (
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">
            {lifetimeDiscount}% lifetime discount — applied to new lines
          </span>
        )}
      </div>

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
                <CaseHeader c={c} billed={billed} paid={paid} />

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
                        const instalments = [...(l.payments ?? [])].sort(
                          (a, b) => +new Date(a.paidAt) - +new Date(b.paidAt)
                        );
                        return (
                          <LineRow key={l.id} line={l}>
                            {/* Instalments against this treatment, oldest first, with a
                                running balance — so "৳1,000 on day one, ৳2,000 on day
                                two" is visible rather than collapsed into one total. */}
                            {instalments.length > 1 ? (
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
                            ) : null}
                          </LineRow>
                        );
                      })}
                      <AddLine caseId={c.id} lifetimeDiscount={lifetimeDiscount} />
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
