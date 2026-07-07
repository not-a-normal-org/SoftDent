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
