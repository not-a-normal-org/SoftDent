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
    const workingDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => fd.get(`day-${d}`) === "on");
    const slot = parseInt(s(fd, "slotMinutes") ?? "30", 10);
    // clamped rather than trusted: these drive print padding, and a silly value
    // would push the whole prescription off the page
    const mm = (k: string, fallback: number) => {
      const n = parseInt(s(fd, k) ?? "", 10);
      return Number.isFinite(n) ? Math.min(150, Math.max(0, n)) : fallback;
    };
    const data = {
      defaultRxType: s(fd, "defaultRxType"),
      rxBodyTopMm: mm("rxBodyTopMm", 45),
      rxBodyBottomMm: mm("rxBodyBottomMm", 20),
      autoAddAppointment: b(fd, "autoAddAppointment"),
      autoCompleteAppointment: b(fd, "autoCompleteAppointment"),
      workingDays,
      openTime: s(fd, "openTime") ?? "15:00",
      closeTime: s(fd, "closeTime") ?? "19:00",
      slotMinutes: Number.isFinite(slot) && slot > 0 ? slot : 30,
    };
    if (existing) await prisma.clinicSetting.update({ where: { id: existing.id }, data });
    else await prisma.clinicSetting.create({ data });

    const rxDoc = await prisma.documentTemplate.findFirst({ where: { docName: "Prescription" } });
    const docData = { heading1: s(fd, "clinicName"), heading2: s(fd, "clinicAddress"), heading7: s(fd, "regLabel"), heading8: s(fd, "appointmentLine"), heading9: s(fd, "visitTime"), footer: s(fd, "footer") };
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
