"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { LOOKUP_TABLES, type LookupKey } from "@/lib/settings";

export type TreatmentFormState = { error?: string };
export type ClinicFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

// ── treatment catalog ──
export async function saveTreatment(_prev: TreatmentFormState, fd: FormData): Promise<TreatmentFormState> {
  const user = await requireRole("OWNER");
  const id = s(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const price = parseInt(s(fd, "defaultPrice") ?? "0", 10) || 0;

  try {
    if (id) await prisma.treatment.update({ where: { id: parseInt(id, 10) }, data: { name, defaultPrice: price } });
    else await prisma.treatment.create({ data: { name, defaultPrice: price } });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "treatment", action: id ? "update" : "create" } });
  } catch {
    return { error: "A procedure with that name already exists." };
  }
  revalidatePath("/settings/treatments");
  redirect("/settings/treatments");
}

export async function deleteTreatment(id: number) {
  await requireRole("OWNER");
  await prisma.treatment.delete({ where: { id } });
  revalidatePath("/settings/treatments");
}

// ── generic lookup lists ──
export async function addLookup(key: LookupKey, fd: FormData) {
  await requireRole("OWNER");
  const cfg = LOOKUP_TABLES[key];
  const value = s(fd, "value");
  if (!cfg || !value) redirect("/settings/lists");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${cfg.table}" ("${cfg.col}") VALUES ($1) ON CONFLICT ("${cfg.col}") DO NOTHING`,
    value
  );
  revalidatePath("/settings/lists");
}

export async function deleteLookup(key: LookupKey, id: number) {
  await requireRole("OWNER");
  const cfg = LOOKUP_TABLES[key];
  if (!cfg) redirect("/settings/lists");
  await prisma.$executeRawUnsafe(`DELETE FROM "${cfg.table}" WHERE id = $1`, id);
  revalidatePath("/settings/lists");
}

// ── clinic settings + Rx letterhead ──
export async function saveClinicConfig(_prev: ClinicFormState, fd: FormData): Promise<ClinicFormState> {
  const user = await requireRole("OWNER");
  try {
    const existing = await prisma.clinicSetting.findFirst();
    const data = {
      defaultRxType: s(fd, "defaultRxType"),
      autoAddAppointment: b(fd, "autoAddAppointment"),
      autoCompleteAppointment: b(fd, "autoCompleteAppointment"),
    };
    if (existing) await prisma.clinicSetting.update({ where: { id: existing.id }, data });
    else await prisma.clinicSetting.create({ data });

    const rxDoc = await prisma.documentTemplate.findFirst({ where: { docName: "Prescription" } });
    const docData = { heading1: s(fd, "clinicName"), heading8: s(fd, "appointmentLine"), heading9: s(fd, "visitTime"), footer: s(fd, "footer") };
    if (rxDoc) await prisma.documentTemplate.update({ where: { id: rxDoc.id }, data: docData });
    else await prisma.documentTemplate.create({ data: { docName: "Prescription", ...docData } });

    await prisma.auditLog.create({ data: { actorId: user.id, entity: "clinic-settings", action: "update" } });
  } catch (e) {
    console.error("saveClinicConfig failed", e);
    return { error: "Could not save settings." };
  }
  revalidatePath("/settings/clinic");
  redirect("/settings/clinic");
}
