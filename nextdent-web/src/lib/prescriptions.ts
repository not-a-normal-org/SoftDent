import "server-only";
import { prisma } from "./prisma";

export type DrugHit = {
  id: number;
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
};

/** Fuzzy drug search over the 46k catalog (trigram on brand + generic). */
export async function searchDrugs(q: string, limit = 15): Promise<DrugHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  return prisma.$queryRaw<DrugHit[]>`
    SELECT id, "brandName", "genericName", "strength", "dosageForm"
    FROM "Drug"
    WHERE "brandName" ILIKE ${like} OR "genericName" ILIKE ${like}
    ORDER BY GREATEST(
      similarity("brandName", ${term}),
      similarity(COALESCE("genericName", ''), ${term})
    ) DESC
    LIMIT ${limit}`;
}

/** Recent prescriptions or search by patient name / Rx id. */
export async function listPrescriptions(q?: string) {
  const term = (q ?? "").trim();
  const base = {
    where: { deletedAt: null as Date | null },
    orderBy: [{ rxDate: "desc" as const }, { id: "desc" as const }],
    take: 40,
    include: { patient: { select: { id: true, fullName: true } }, dentist: { include: { person: true } } },
  };
  if (!term) return prisma.prescription.findMany(base);

  const asId = Number.parseInt(term, 10);
  return prisma.prescription.findMany({
    ...base,
    where: {
      deletedAt: null,
      OR: [
        ...(Number.isFinite(asId) ? [{ id: asId }] : []),
        { patient: { fullName: { contains: term, mode: "insensitive" as const } } },
        { randomName: { contains: term, mode: "insensitive" as const } },
      ],
    },
  });
}

export function getPrescription(id: number) {
  return prisma.prescription.findFirst({
    where: { id, deletedAt: null },
    include: {
      patient: true,
      dentist: { include: { person: true } },
      drugs: { orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Options + context for the Rx editor. */
export async function getRxEditorData() {
  const [doctors, templates, settings] = await Promise.all([
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
    prisma.rxTemplate.findMany({ orderBy: { name: "asc" }, include: { drugs: { orderBy: { sortOrder: "asc" } } } }),
    prisma.clinicSetting.findFirst(),
  ]);
  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
    templates,
    defaultRxType: settings?.defaultRxType ?? "Body",
  };
}

/** Clinic letterhead (header/footer) for the printed prescription. */
export async function getRxLetterhead() {
  return prisma.documentTemplate.findFirst({ where: { docName: "Prescription" } });
}

export const listRxTemplates = () =>
  prisma.rxTemplate.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { drugs: true } } } });
export const getRxTemplateFull = (id: number) =>
  prisma.rxTemplate.findUnique({ where: { id }, include: { drugs: { orderBy: { sortOrder: "asc" } } } });
