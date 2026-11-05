"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { afterDiscount } from "@/lib/billing";
import { canonicalCaseStatus, DEFAULT_CASE_STATUS } from "@/lib/case-constants";

export type CaseFormState = { error?: string };
export type LineFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const i = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : null; };
const f = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) ? n : 0; };
const d = (fd: FormData, k: string) => { const v = s(fd, k); if (!v) return null; const x = new Date(v); return isNaN(+x) ? null : x; };

function revalidateBilling(caseId: number, patientId?: number) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/billing");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

// ── cases ──
export async function saveCase(_prev: CaseFormState, fd: FormData): Promise<CaseFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const patientId = i(fd, "patientId");
  if (!patientId) return { error: "Missing patient." };
  const data = { patientId, name: s(fd, "name"), description: s(fd, "description"), status: canonicalCaseStatus(s(fd, "status")) ?? DEFAULT_CASE_STATUS, notes: s(fd, "notes") };

  let caseId: number;
  try {
    if (id) { await prisma.treatmentCase.update({ where: { id }, data }); caseId = id; }
    else { const c = await prisma.treatmentCase.create({ data }); caseId = c.id; }
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "case", entityId: String(caseId), action: id ? "update" : "create" } });
  } catch (e) { console.error("saveCase failed", e); return { error: "Could not save the case." }; }

  revalidateBilling(caseId, patientId);
  redirect(`/cases/${caseId}`);
}

export async function deleteCase(caseId: number) {
  const user = await requireUser();
  const c = await prisma.treatmentCase.findUnique({ where: { id: caseId }, include: { lines: { select: { id: true } } } });
  if (!c) redirect("/patients");
  const lineIds = c.lines.map((l) => l.id);
  await prisma.payment.deleteMany({ where: { treatmentLineId: { in: lineIds } } });
  await prisma.patientEvent.deleteMany({ where: { refId: { in: lineIds }, eventType: "treatment" } });
  await prisma.treatmentLine.deleteMany({ where: { caseId } });
  await prisma.treatmentCase.delete({ where: { id: caseId } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "case", entityId: String(caseId), action: "delete" } });
  revalidateBilling(caseId, c.patientId);
  redirect(`/patients/${c.patientId}`);
}

// ── lines ──
export async function saveLine(_prev: LineFormState, fd: FormData): Promise<LineFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const caseId = i(fd, "caseId");
  if (!caseId) return { error: "Missing case." };
  const c = await prisma.treatmentCase.findUnique({ where: { id: caseId }, select: { patientId: true } });
  if (!c) return { error: "Case not found." };

  const total = i(fd, "totalAmount") ?? 0;
  const discount = f(fd, "discountPercent");
  const data = {
    caseId,
    treatmentName: s(fd, "treatmentName"),
    treatmentDate: d(fd, "treatmentDate"),
    operatingDoctorId: i(fd, "operatingDoctorId"),
    totalAmount: total,
    discountPercent: discount,
    afterDiscountAmount: afterDiscount(total, discount),
    note: s(fd, "note"),
  };

  let lineId: number;
  try {
    if (id) { await prisma.treatmentLine.update({ where: { id }, data }); lineId = id; }
    else {
      const l = await prisma.treatmentLine.create({ data: { ...data, amountPaid: 0 } });
      lineId = l.id;
      await prisma.patientEvent.create({
        data: { patientId: c.patientId, eventType: "treatment", refId: lineId, occurredAt: data.treatmentDate ?? new Date(),
          summary: `${data.treatmentName ?? "Treatment"} — ৳${data.afterDiscountAmount}` },
      });
    }
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "line", entityId: String(lineId), action: id ? "update" : "create" } });
  } catch (e) { console.error("saveLine failed", e); return { error: "Could not save the procedure." }; }

  revalidateBilling(caseId, c.patientId);
  redirect(`/cases/${caseId}`);
}

export async function deleteLine(lineId: number) {
  const user = await requireUser();
  const line = await prisma.treatmentLine.findUnique({ where: { id: lineId }, include: { case: { select: { id: true, patientId: true } } } });
  if (!line) redirect("/billing");
  await prisma.payment.deleteMany({ where: { treatmentLineId: lineId } });
  await prisma.patientEvent.deleteMany({ where: { refId: lineId, eventType: "treatment" } });
  await prisma.treatmentLine.delete({ where: { id: lineId } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "line", entityId: String(lineId), action: "delete" } });
  revalidateBilling(line.case.id, line.case.patientId);
  redirect(`/cases/${line.case.id}`);
}

// ── payments ──
export async function recordPayment(lineId: number, fd: FormData) {
  const user = await requireUser();
  const amount = i(fd, "amount");
  const line = await prisma.treatmentLine.findUnique({ where: { id: lineId }, include: { case: { select: { id: true, patientId: true } } } });
  if (!line || !amount || amount <= 0) redirect(`/cases/${line?.case.id ?? ""}`);

  await prisma.payment.create({ data: { treatmentLineId: lineId, amount, method: s(fd, "method"), paidAt: d(fd, "paidAt") ?? new Date() } });
  await prisma.treatmentLine.update({ where: { id: lineId }, data: { amountPaid: { increment: amount } } });
  await prisma.patientEvent.create({
    data: { patientId: line.case.patientId, eventType: "payment", refId: lineId, occurredAt: d(fd, "paidAt") ?? new Date(), summary: `Payment ৳${amount}` },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "payment", entityId: String(lineId), action: "create" } });
  revalidateBilling(line.case.id, line.case.patientId);
  redirect(`/cases/${line.case.id}`);
}

// ── inline billing on the patient profile ──
// These mirror the actions above but return instead of redirecting, so adding a
// case, a procedure or a payment never navigates the doctor off the patient page.
export type InlineState = { error?: string; savedAt?: number };

export async function addCaseInline(_prev: InlineState, fd: FormData): Promise<InlineState> {
  const user = await requireUser();
  const patientId = i(fd, "patientId");
  if (!patientId) return { error: "Missing patient." };
  const name = s(fd, "name");
  if (!name) return { error: "Name the case first." };

  try {
    const c = await prisma.treatmentCase.create({
      data: {
        patientId, name, notes: s(fd, "notes"),
        status: canonicalCaseStatus(s(fd, "status")) ?? DEFAULT_CASE_STATUS,
      },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "case", entityId: String(c.id), action: "create" } });
    revalidateBilling(c.id, patientId);
  } catch (e) {
    console.error("addCaseInline failed", e);
    return { error: "Could not create the case." };
  }
  return { savedAt: Date.now() };
}

/** Rename a case, change its note, or move it along its status. */
export async function updateCaseInline(caseId: number, _prev: InlineState, fd: FormData): Promise<InlineState> {
  const user = await requireUser();
  const c = await prisma.treatmentCase.findUnique({ where: { id: caseId }, select: { patientId: true } });
  if (!c) return { error: "Case not found." };
  const name = s(fd, "name");
  if (!name) return { error: "Name the case." };
  try {
    await prisma.treatmentCase.update({
      where: { id: caseId },
      data: { name, notes: s(fd, "notes"), status: canonicalCaseStatus(s(fd, "status")) },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "case", entityId: String(caseId), action: "update" } });
    revalidateBilling(caseId, c.patientId);
  } catch (e) {
    console.error("updateCaseInline failed", e);
    return { error: "Could not save the case." };
  }
  return { savedAt: Date.now() };
}

/**
 * The one-click tick beside the pencil. Takes the status as an argument rather than
 * from a form so the button needs no fields, and so the same action can put a case
 * back to work if it was ticked by mistake.
 */
export async function setCaseStatusInline(caseId: number, status: string): Promise<InlineState> {
  const user = await requireUser();
  const c = await prisma.treatmentCase.findUnique({ where: { id: caseId }, select: { patientId: true } });
  if (!c) return { error: "Case not found." };
  try {
    await prisma.treatmentCase.update({
      where: { id: caseId },
      data: { status: canonicalCaseStatus(status) ?? DEFAULT_CASE_STATUS },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, entity: "case", entityId: String(caseId), action: `status:${status}` },
    });
    revalidateBilling(caseId, c.patientId);
  } catch (e) {
    console.error("setCaseStatusInline failed", e);
    return { error: "Could not change the status." };
  }
  return { savedAt: Date.now() };
}

export async function addLineInline(_prev: InlineState, fd: FormData): Promise<InlineState> {
  const user = await requireUser();
  const caseId = i(fd, "caseId");
  if (!caseId) return { error: "Missing case." };
  const c = await prisma.treatmentCase.findUnique({ where: { id: caseId }, select: { patientId: true } });
  if (!c) return { error: "Case not found." };

  const name = s(fd, "treatmentName");
  if (!name) return { error: "Name the procedure." };
  let total = i(fd, "totalAmount") ?? 0;
  let discount = f(fd, "discountPercent");
  if (discount < 0 || discount > 100) return { error: "Discount must be between 0 and 100%." };
  // The payable the doctor saw wins over anything recomputed from a rounded percent.
  const shown = i(fd, "afterDiscountAmount");
  // A payable typed with no amount used to save a ৳0 line and lose the billed work
  // entirely — the money was only ever in the percent, and with no gross there was no
  // percent to derive. Treat the figure as the price of the procedure.
  if (total <= 0 && shown && shown > 0) { total = shown; discount = 0; }
  const payable = shown !== null && shown >= 0 ? shown : afterDiscount(total, discount);
  // Money that was handed over is recorded as handed over. It is deliberately NOT
  // capped at the payable: a line can be worth ৳0 and still take ৳100 (an advance
  // against work not yet priced), and silently dropping that was losing payments.
  // Anything beyond the payable shows as credit against the line.
  const paidNow = Math.max(0, i(fd, "paidNow") ?? 0);
  const when = d(fd, "treatmentDate") ?? new Date();

  try {
    const line = await prisma.treatmentLine.create({
      data: {
        caseId, treatmentName: name, treatmentDate: when,
        totalAmount: total, discountPercent: discount,
        afterDiscountAmount: payable, amountPaid: paidNow,
      },
    });
    await prisma.patientEvent.create({
      data: { patientId: c.patientId, eventType: "treatment", refId: line.id, occurredAt: when,
        summary: `${name} — ৳${payable}` },
    });
    if (paidNow > 0) {
      await prisma.payment.create({ data: { treatmentLineId: line.id, amount: paidNow, paidAt: when } });
      await prisma.patientEvent.create({
        data: { patientId: c.patientId, eventType: "payment", refId: line.id, occurredAt: when, summary: `Payment ৳${paidNow}` },
      });
    }
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "line", entityId: String(line.id), action: "create" } });
    revalidateBilling(caseId, c.patientId);
  } catch (e) {
    console.error("addLineInline failed", e);
    return { error: "Could not add the procedure." };
  }
  return { savedAt: Date.now() };
}

/**
 * Edit a procedure in place on the patient profile.
 *
 * Deliberately does not touch `amountPaid`: that total is the sum of the Payment
 * rows, and letting it be typed over here would put the ledger and the receipts out
 * of step with no trace. Payments are added and removed through their own control.
 *
 * `afterDiscountAmount` is recomputed from the amount and the discount, so an edited
 * line always reconciles — including the 95 imported lines whose stored payable never
 * matched their own discount.
 */
export async function updateLineInline(lineId: number, _prev: InlineState, fd: FormData): Promise<InlineState> {
  const user = await requireUser();
  const line = await prisma.treatmentLine.findUnique({
    where: { id: lineId },
    include: { case: { select: { id: true, patientId: true } } },
  });
  if (!line) return { error: "Line not found." };

  const name = s(fd, "treatmentName");
  if (!name) return { error: "Name the procedure." };
  const total = i(fd, "totalAmount") ?? 0;
  const discount = f(fd, "discountPercent");
  if (discount < 0 || discount > 100) return { error: "Discount must be between 0 and 100%." };

  // Store the payable the editor displayed, not one recomputed from the percent.
  // 75 imported lines have a payable their own discount does not reproduce — one is
  // ৳20,000 billed against a ৳3,220 amount — and recomputing on every edit wrote
  // ৳16,780 of that off the moment anyone corrected a typo in the procedure name.
  const shown = i(fd, "afterDiscountAmount");
  const payable = shown !== null && shown >= 0 ? shown : afterDiscount(total, discount);

  try {
    await prisma.treatmentLine.update({
      where: { id: lineId },
      data: {
        treatmentName: name,
        treatmentDate: d(fd, "treatmentDate") ?? line.treatmentDate,
        totalAmount: total,
        discountPercent: discount,
        afterDiscountAmount: payable,
      },
    });
    await prisma.patientEvent.updateMany({
      where: { refId: lineId, eventType: "treatment" },
      data: { summary: `${name} — ৳${payable}` },
    });
    // the before/after goes in the audit row: without it an overwritten payable is
    // unrecoverable, which is exactly what made the silent recompute dangerous
    await prisma.auditLog.create({
      data: {
        actorId: user.id, entity: "line", entityId: String(lineId), action: "update",
        diff: {
          before: {
            treatmentName: line.treatmentName, totalAmount: line.totalAmount,
            discountPercent: line.discountPercent, afterDiscountAmount: line.afterDiscountAmount,
          },
          after: { treatmentName: name, totalAmount: total, discountPercent: discount, afterDiscountAmount: payable },
        },
      },
    });
    revalidateBilling(line.case.id, line.case.patientId);
  } catch (e) {
    console.error("updateLineInline failed", e);
    return { error: "Could not save the change." };
  }
  return { savedAt: Date.now() };
}

export async function payLineInline(lineId: number, _prev: InlineState, fd: FormData): Promise<InlineState> {
  const user = await requireUser();
  const line = await prisma.treatmentLine.findUnique({
    where: { id: lineId },
    include: { case: { select: { id: true, patientId: true } } },
  });
  if (!line) return { error: "Line not found." };
  const amount = i(fd, "amount") ?? 0;
  if (amount <= 0) return { error: "Enter an amount." };
  // No ceiling on the amount: a line may be worth ৳0 and still take a payment, and a
  // patient may pay ahead. The excess is shown as credit rather than refused.

  try {
    const paidAt = d(fd, "paidAt") ?? new Date();
    await prisma.payment.create({ data: { treatmentLineId: lineId, amount, method: s(fd, "method"), paidAt } });
    await prisma.treatmentLine.update({ where: { id: lineId }, data: { amountPaid: { increment: amount } } });
    await prisma.patientEvent.create({
      data: { patientId: line.case.patientId, eventType: "payment", refId: lineId, occurredAt: paidAt, summary: `Payment ৳${amount}` },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "payment", entityId: String(lineId), action: "create" } });
    revalidateBilling(line.case.id, line.case.patientId);
  } catch (e) {
    console.error("payLineInline failed", e);
    return { error: "Could not record the payment." };
  }
  return { savedAt: Date.now() };
}
