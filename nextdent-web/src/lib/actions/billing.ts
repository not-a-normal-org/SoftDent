"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { afterDiscount } from "@/lib/billing";

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
  const data = { patientId, name: s(fd, "name"), description: s(fd, "description"), status: s(fd, "status") ?? "Active", notes: s(fd, "notes") };

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
      data: { patientId, name, notes: s(fd, "notes"), status: "Active" },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "case", entityId: String(c.id), action: "create" } });
    revalidateBilling(c.id, patientId);
  } catch (e) {
    console.error("addCaseInline failed", e);
    return { error: "Could not create the case." };
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
  const total = i(fd, "totalAmount") ?? 0;
  const discount = f(fd, "discountPercent");
  const payable = afterDiscount(total, discount);
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
