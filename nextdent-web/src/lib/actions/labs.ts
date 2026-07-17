"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type LabOrderFormState = { error?: string };
export type LabFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const i = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : null; };
const d = (fd: FormData, k: string) => { const v = s(fd, k); if (!v) return null; const x = new Date(v); return isNaN(+x) ? null : x; };

// ── lab orders ──
export async function saveLabOrder(_prev: LabOrderFormState, fd: FormData): Promise<LabOrderFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const patientId = i(fd, "patientId");
  const labId = i(fd, "labId");
  if (!patientId) return { error: "Select a patient." };
  if (!labId) return { error: "Select a lab." };

  const data = {
    patientId, labId,
    workType: s(fd, "workType"), toothFdi: s(fd, "toothFdi"), shade: s(fd, "shade"),
    sentAt: d(fd, "sentAt"), expectedAt: d(fd, "expectedAt"), receivedAt: d(fd, "receivedAt"),
    status: s(fd, "status") ?? "SENT", cost: i(fd, "cost") ?? 0, note: s(fd, "note"),
  };

  try {
    if (id) {
      await prisma.labOrder.update({ where: { id }, data });
    } else {
      const order = await prisma.labOrder.create({ data });
      await prisma.patientEvent.create({
        data: { patientId, eventType: "lab", refId: order.id, occurredAt: data.sentAt ?? new Date(),
          summary: `Lab work sent — ${data.workType ?? "order"}${data.toothFdi ? ` on ${data.toothFdi}` : ""}` },
      });
    }
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "lab-order", action: id ? "update" : "create" } });
  } catch (e) { console.error("saveLabOrder failed", e); return { error: "Could not save the lab order." }; }

  revalidatePath("/labs");
  revalidatePath(`/patients/${patientId}`);
  redirect("/labs");
}

export async function setLabOrderStatus(id: number, status: string) {
  const user = await requireUser();
  const patch: { status: string; receivedAt?: Date } = { status };
  if (status === "RECEIVED") patch.receivedAt = new Date();
  await prisma.labOrder.update({ where: { id }, data: patch });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "lab-order", entityId: String(id), action: "status" } });
  revalidatePath("/labs");
}

export async function deleteLabOrder(id: number) {
  await requireUser();
  await prisma.patientEvent.deleteMany({ where: { refId: id, eventType: "lab" } });
  await prisma.labOrder.delete({ where: { id } });
  revalidatePath("/labs");
}

// ── lab providers ──
export async function saveLab(_prev: LabFormState, fd: FormData): Promise<LabFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Lab name is required." };
  const data = {
    name, contactPerson: s(fd, "contactPerson"), contactNumber: s(fd, "contactNumber"),
    address: s(fd, "address"), email: s(fd, "email"), specialization: s(fd, "specialization"),
    paymentTerms: s(fd, "paymentTerms"), isActive: fd.get("isActive") === "on", notes: s(fd, "notes"),
  };
  try {
    if (id) await prisma.lab.update({ where: { id }, data });
    else await prisma.lab.create({ data });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "lab", action: id ? "update" : "create" } });
  } catch (e) { console.error("saveLab failed", e); return { error: "Could not save the lab." }; }
  revalidatePath("/labs/providers");
  redirect("/labs/providers");
}

export async function deleteLab(id: number) {
  await requireUser();
  const count = await prisma.labOrder.count({ where: { labId: id } });
  if (count > 0) redirect("/labs/providers"); // keep referential integrity — labs with orders stay
  await prisma.lab.delete({ where: { id } });
  revalidatePath("/labs/providers");
}
