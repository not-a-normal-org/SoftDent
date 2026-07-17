"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };

// ── family connections ──
export async function addConnection(patientId: number, fd: FormData) {
  await requireUser();
  const relatedName = s(fd, "relatedName");
  if (!relatedName) { revalidatePath(`/patients/${patientId}`); return; }
  await prisma.patientConnection.create({ data: { patientId, relatedName, relation: s(fd, "relation") } });
  revalidatePath(`/patients/${patientId}`);
}

export async function deleteConnection(id: number, patientId: number) {
  await requireUser();
  await prisma.patientConnection.delete({ where: { id } });
  revalidatePath(`/patients/${patientId}`);
}

// ── health records / vitals ──
export async function addHealthRecord(patientId: number, fd: FormData) {
  const user = await requireUser();
  const anything = ["bloodPressure", "pulse", "weightKg", "bloodGroup", "allergies", "conditions", "note"].some((k) => s(fd, k));
  if (!anything) { revalidatePath(`/patients/${patientId}`); return; }
  await prisma.healthRecord.create({
    data: {
      patientId, recordedById: user.id,
      bloodPressure: s(fd, "bloodPressure"), pulse: s(fd, "pulse"), weightKg: s(fd, "weightKg"),
      bloodGroup: s(fd, "bloodGroup"), allergies: s(fd, "allergies"), conditions: s(fd, "conditions"), note: s(fd, "note"),
    },
  });
  revalidatePath(`/patients/${patientId}`);
}

export async function deleteHealthRecord(id: number, patientId: number) {
  await requireUser();
  await prisma.healthRecord.delete({ where: { id } });
  revalidatePath(`/patients/${patientId}`);
}
