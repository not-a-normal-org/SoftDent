"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type PatientFormState = { error?: string; fieldErrors?: { fullName?: string } };

const str = (fd: FormData, k: string) => {
  const s = String(fd.get(k) ?? "").trim();
  return s === "" ? null : s;
};
const num = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (s == null) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const date = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(+d) ? null : d;
};
const digits = (s: string | null) => (s ? s.replace(/\D/g, "") || null : null);

export async function savePatient(_prev: PatientFormState, fd: FormData): Promise<PatientFormState> {
  const user = await requireUser();

  const fullName = str(fd, "fullName");
  if (!fullName) return { fieldErrors: { fullName: "Full name is required." } };

  const idRaw = str(fd, "id");
  const id = idRaw ? Number.parseInt(idRaw, 10) : null;

  const primaryPhone = str(fd, "primaryPhone");
  const consultantDoctorId = num(fd, "consultantDoctorId");
  const medicalHistory = str(fd, "medicalHistory");
  const drugHistory = str(fd, "drugHistory");

  const data = {
    fullName,
    nickName: str(fd, "nickName"),
    gender: str(fd, "gender"),
    maritalStatus: str(fd, "maritalStatus"),
    dob: date(fd, "dob"),
    since: date(fd, "since"),
    occupation: str(fd, "occupation"),
    primaryPhone,
    phoneDigits: digits(primaryPhone),
    foreignPhone: str(fd, "foreignPhone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    consultantDoctorId: consultantDoctorId ?? undefined,
    lifetimeDiscount: num(fd, "lifetimeDiscount") ?? 0,
    emergencyRelation: str(fd, "emergencyRelation"),
    emergencyName: str(fd, "emergencyName"),
    emergencyPhone: str(fd, "emergencyPhone"),
    medicalHistory,
    drugHistory,
    note: str(fd, "note"),
  };

  let savedId: number;
  try {
    if (id) {
      const before = await prisma.patient.findUnique({
        where: { id },
        select: { medicalHistory: true, drugHistory: true },
      });
      if (!before) return { error: "Patient not found." };

      const updated = await prisma.patient.update({ where: { id }, data });
      savedId = updated.id;

      // append-only clinical history: record a version whenever these change
      const versions = [];
      if ((before.medicalHistory ?? null) !== (medicalHistory ?? null) && medicalHistory)
        versions.push({ patientId: id, kind: "MEDICAL" as const, body: medicalHistory, authorId: user.id });
      if ((before.drugHistory ?? null) !== (drugHistory ?? null) && drugHistory)
        versions.push({ patientId: id, kind: "DRUG" as const, body: drugHistory, authorId: user.id });
      if (versions.length) await prisma.patientHistoryVersion.createMany({ data: versions });

      await prisma.auditLog.create({ data: { actorId: user.id, entity: "patient", entityId: String(id), action: "update" } });
    } else {
      const created = await prisma.patient.create({ data });
      savedId = created.id;

      const versions = [];
      if (medicalHistory) versions.push({ patientId: savedId, kind: "MEDICAL" as const, body: medicalHistory, authorId: user.id });
      if (drugHistory) versions.push({ patientId: savedId, kind: "DRUG" as const, body: drugHistory, authorId: user.id });
      if (versions.length) await prisma.patientHistoryVersion.createMany({ data: versions });

      await prisma.auditLog.create({ data: { actorId: user.id, entity: "patient", entityId: String(savedId), action: "create" } });
    }
  } catch (e) {
    console.error("savePatient failed", e);
    return { error: "Could not save the patient. Please try again." };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${savedId}`);
  redirect(`/patients/${savedId}`); // throws — outside try/catch
}
