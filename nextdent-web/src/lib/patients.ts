import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseTeeth } from "./format";

export type PatientHit = {
  id: number;
  fullName: string;
  primaryPhone: string | null;
  gender: string | null;
  dob: Date | null;
};

/**
 * Type-ahead patient search.
 * - all-digits query → dash-insensitive phone match (+ id match), uses phoneDigits index
 * - otherwise → trigram fuzzy name/nickname match, ranked by similarity (GIN index)
 */
export async function searchPatients(q: string, limit = 20): Promise<PatientHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const isPhone = /^[\d\s-]+$/.test(term);

  if (isPhone) {
    const dg = term.replace(/\D/g, "");
    if (!dg) return [];
    return prisma.$queryRaw<PatientHit[]>`
      SELECT id, "fullName", "primaryPhone", gender, dob
      FROM "Patient"
      WHERE "phoneDigits" LIKE ${"%" + dg + "%"} OR CAST(id AS text) = ${dg}
      ORDER BY "phoneDigits" ASC
      LIMIT ${limit}`;
  }

  const like = `%${term}%`;
  return prisma.$queryRaw<PatientHit[]>`
    SELECT id, "fullName", "primaryPhone", gender, dob
    FROM "Patient"
    WHERE "fullName" ILIKE ${like} OR "nickName" ILIKE ${like}
    ORDER BY GREATEST(
      similarity("fullName", ${term}),
      similarity(COALESCE("nickName", ''), ${term})
    ) DESC, "fullName" ASC
    LIMIT ${limit}`;
}

/** Most-recently-added patients, for the empty-state / landing list. */
export function recentPatients(limit = 25) {
  return prisma.patient.findMany({
    orderBy: { id: "desc" },
    take: limit,
    select: { id: true, fullName: true, primaryPhone: true, gender: true, dob: true, since: true },
  });
}

export async function getPatientProfile(id: number) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { consultantDoctor: { include: { person: true } } },
  });
  if (!patient) return null;

  const [cases, prescriptions, events, agg, connections, healthRecords] = await Promise.all([
    prisma.treatmentCase.findMany({
      where: { patientId: id },
      orderBy: { id: "desc" },
      include: { lines: { include: { payments: true }, orderBy: { treatmentDate: "asc" } } },
    }),
    prisma.prescription.findMany({
      where: { patientId: id, deletedAt: null },
      orderBy: [{ rxDate: "desc" }, { id: "desc" }],
      include: { drugs: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.patientEvent.findMany({
      where: { patientId: id },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.treatmentLine.aggregate({
      where: { case: { patientId: id } },
      _sum: { afterDiscountAmount: true, amountPaid: true },
    }),
    prisma.patientConnection.findMany({
      where: { patientId: id },
      include: { relatedPatient: { select: { id: true, fullName: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.healthRecord.findMany({ where: { patientId: id }, orderBy: { recordedAt: "desc" } }),
  ]);

  const billed = agg._sum.afterDiscountAmount ?? 0;
  const paid = agg._sum.amountPaid ?? 0;

  // dental chart: FDI tooth → treatment labels, parsed from case & line text
  const teeth: Record<string, string[]> = {};
  const addTeeth = (text: string | null, label: string) => {
    for (const t of parseTeeth(text)) (teeth[t] ??= []).push(label);
  };
  for (const c of cases) {
    addTeeth(c.name, c.name ?? "case");
    for (const l of c.lines) addTeeth(l.treatmentName, l.treatmentName ?? "treatment");
  }

  return {
    patient,
    cases,
    prescriptions,
    events,
    teeth,
    connections,
    healthRecords,
    billing: { billed, paid, due: billed - paid },
  };
}

export type PatientProfile = NonNullable<Awaited<ReturnType<typeof getPatientProfile>>>;
