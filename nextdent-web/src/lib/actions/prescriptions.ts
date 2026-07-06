"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type RxFormState = { error?: string };

const str = (fd: FormData, k: string) => {
  const s = String(fd.get(k) ?? "").trim();
  return s === "" ? null : s;
};
const int = (fd: FormData, k: string) => {
  const s = str(fd, k);
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};
const dt = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(+d) ? null : d;
};

type Line = { drug?: string; dose?: string; meal?: string; duration?: string };

export async function saveRx(_prev: RxFormState, fd: FormData): Promise<RxFormState> {
  const user = await requireUser();

  const id = int(fd, "id");
  const anonymous = str(fd, "isAnonymous") === "1";
  const patientId = anonymous ? null : int(fd, "patientId");
  if (!anonymous && !patientId) return { error: "Select a patient, or mark the prescription as anonymous." };

  // drug lines arrive as JSON from the editor
  let lines: Line[] = [];
  try {
    lines = JSON.parse(String(fd.get("drugsJson") ?? "[]"));
  } catch {
    lines = [];
  }
  const drugRows = lines
    .filter((l) => (l.drug ?? "").trim() !== "")
    .map((l, i) => ({
      sortOrder: i,
      drug: (l.drug ?? "").trim(),
      dose: (l.dose ?? "").trim() || null,
      meal: (l.meal ?? "").trim() || null,
      duration: (l.duration ?? "").trim() || null,
    }));

  const data = {
    patientId,
    dentistId: int(fd, "dentistId"),
    rxDate: dt(fd, "rxDate") ?? new Date(),
    complaints: str(fd, "complaints"),
    medicalHistory: str(fd, "medicalHistory"),
    drugHistory: str(fd, "drugHistory"),
    previousDentalHistory: str(fd, "previousDentalHistory"),
    findingsOnExamination: str(fd, "findingsOnExamination"),
    provisionalDiagnosis: str(fd, "provisionalDiagnosis"),
    differentialDiagnosis: str(fd, "differentialDiagnosis"),
    investigationAdvised: str(fd, "investigationAdvised"),
    confirmatoryDiagnosis: str(fd, "confirmatoryDiagnosis"),
    treatmentPlan: str(fd, "treatmentPlan"),
    procedurePerformed: str(fd, "procedurePerformed"),
    advise: str(fd, "advise"),
    followUpDate: dt(fd, "followUpDate"),
    followUpReason: str(fd, "followUpReason"),
    randomName: anonymous ? str(fd, "randomName") : null,
    randomAge: anonymous ? str(fd, "randomAge") : null,
    randomSex: anonymous ? str(fd, "randomSex") : null,
  };

  let rxId: number;
  try {
    if (id) {
      await prisma.prescription.update({ where: { id }, data });
      await prisma.prescriptionDrug.deleteMany({ where: { prescriptionId: id } });
      if (drugRows.length)
        await prisma.prescriptionDrug.createMany({ data: drugRows.map((d) => ({ ...d, prescriptionId: id })) });
      rxId = id;
      await prisma.auditLog.create({ data: { actorId: user.id, entity: "prescription", entityId: String(id), action: "update" } });
    } else {
      const rx = await prisma.prescription.create({ data });
      rxId = rx.id;
      if (drugRows.length)
        await prisma.prescriptionDrug.createMany({ data: drugRows.map((d) => ({ ...d, prescriptionId: rxId })) });
      if (patientId)
        await prisma.patientEvent.create({
          data: { patientId, eventType: "prescription", refId: rxId, occurredAt: data.rxDate, summary: "Prescription issued" },
        });
      await prisma.auditLog.create({ data: { actorId: user.id, entity: "prescription", entityId: String(rxId), action: "create" } });
    }
  } catch (e) {
    console.error("saveRx failed", e);
    return { error: "Could not save the prescription. Please try again." };
  }

  revalidatePath("/prescriptions");
  revalidatePath(`/prescriptions/${rxId}`);
  redirect(`/prescriptions/${rxId}`);
}

export async function softDeleteRx(id: number) {
  const user = await requireUser();
  await prisma.prescription.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.name } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "prescription", entityId: String(id), action: "delete" } });
  revalidatePath("/prescriptions");
  redirect("/prescriptions");
}
