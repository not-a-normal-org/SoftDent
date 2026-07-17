"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type RxTemplateFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const i = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : null; };

type Line = { drug?: string; dose?: string; meal?: string; duration?: string };

export async function saveRxTemplate(_prev: RxTemplateFormState, fd: FormData): Promise<RxTemplateFormState> {
  const user = await requireRole("OWNER");
  const id = i(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Template name is required." };

  let lines: Line[] = [];
  try { lines = JSON.parse(String(fd.get("drugsJson") ?? "[]")); } catch { lines = []; }
  const drugRows = lines.filter((l) => (l.drug ?? "").trim()).map((l, idx) => ({
    sortOrder: idx, drug: (l.drug ?? "").trim(), dose: (l.dose ?? "").trim() || null,
    meal: (l.meal ?? "").trim() || null, duration: (l.duration ?? "").trim() || null,
  }));

  const data = {
    name,
    complaints: s(fd, "complaints"), findingsOnExamination: s(fd, "findingsOnExamination"),
    provisionalDiagnosis: s(fd, "provisionalDiagnosis"), differentialDiagnosis: s(fd, "differentialDiagnosis"),
    investigationAdvised: s(fd, "investigationAdvised"), confirmatoryDiagnosis: s(fd, "confirmatoryDiagnosis"),
    treatmentPlan: s(fd, "treatmentPlan"), procedurePerformed: s(fd, "procedurePerformed"),
    advise: s(fd, "advise"), followUpDay: i(fd, "followUpDay"), followUpReason: s(fd, "followUpReason"),
  };

  try {
    let tplId: number;
    if (id) {
      await prisma.rxTemplate.update({ where: { id }, data: { ...data, editedBy: user.name, editedAt: new Date() } });
      await prisma.rxTemplateDrug.deleteMany({ where: { templateId: id } });
      tplId = id;
    } else {
      const t = await prisma.rxTemplate.create({ data: { ...data, createdBy: user.name, createdAt: new Date(), editedBy: user.name, editedAt: new Date() } });
      tplId = t.id;
    }
    if (drugRows.length) await prisma.rxTemplateDrug.createMany({ data: drugRows.map((d) => ({ ...d, templateId: tplId })) });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "rx-template", entityId: String(tplId), action: id ? "update" : "create" } });
  } catch (e) { console.error("saveRxTemplate failed", e); return { error: "Could not save the template." }; }

  revalidatePath("/settings/rx-templates");
  redirect("/settings/rx-templates");
}

export async function deleteRxTemplate(id: number) {
  await requireRole("OWNER");
  await prisma.rxTemplateDrug.deleteMany({ where: { templateId: id } });
  await prisma.rxTemplate.delete({ where: { id } });
  revalidatePath("/settings/rx-templates");
}
