import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseTeeth } from "./format";

/**
 * A jump bigger than this ends the clinic's numbering run. The legacy IDs climb in
 * steps of at most 26 (records deleted over the years); the one stray 99999 in the
 * import sits 97,682 past the run. Anything in between is a deliberate one-off.
 */
const ID_RUN_GAP = 1000;

/**
 * The next patient ID in the clinic's own sequence — the number the new-patient form
 * suggests. The patient ID is the record's key, the "#38" in every list and picker,
 * and the number the legacy app printed as "Laila Akter-38".
 *
 * Not simply MAX(id) + 1. The import carried one patient numbered 99999, and because
 * the database counter follows the maximum, every patient added since was numbered
 * 100000 and up instead of continuing at 2318. So this finds where the unbroken run
 * from the bottom ends and suggests the number after it; outliers above a gap of
 * ID_RUN_GAP are ignored. The suggestion is always free: everything above the run's
 * end sits at least ID_RUN_GAP higher.
 */
export async function nextPatientId(): Promise<number> {
  const [row] = await prisma.$queryRaw<{ next: number }[]>`
    WITH s AS (SELECT id, id - LAG(id) OVER (ORDER BY id) AS gap FROM "Patient"),
         b AS (SELECT MIN(id) AS cut FROM s WHERE gap > ${ID_RUN_GAP})
    SELECT (COALESCE(MAX(p.id), 0) + 1)::int AS next
    FROM "Patient" p, b
    WHERE b.cut IS NULL OR p.id < b.cut`;
  return row?.next ?? 1;
}

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

/**
 * The search box's rules as a SQL condition, for list queries that join "Patient" as
 * `p`: digits match the phone (dash-insensitive) or the patient ID, anything else the
 * name or nickname. Shared so that "01711" or "Rahim" finds the same people in the
 * billing table, the missed-appointments list and the type-ahead.
 */
export function patientSearchSql(q: string): Prisma.Sql {
  const term = q.trim();
  if (!term) return Prisma.sql`TRUE`;
  if (/^[\d\s-]+$/.test(term)) {
    const dg = term.replace(/\D/g, "");
    if (!dg) return Prisma.sql`TRUE`;
    return Prisma.sql`(p."phoneDigits" LIKE ${"%" + dg + "%"} OR CAST(p.id AS text) = ${dg})`;
  }
  const like = `%${term}%`;
  return Prisma.sql`(p."fullName" ILIKE ${like} OR p."nickName" ILIKE ${like})`;
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
  // Both the name and the description can mention the same tooth ("Ext 14" with
  // "on 14" beside it), so the two are parsed together and the label is recorded
  // once — otherwise the chart reads "Extraction, Extraction" on tooth 14.
  const addTeeth = (texts: (string | null)[], label: string) => {
    const found = new Set(texts.flatMap((t) => parseTeeth(t)));
    for (const t of found) (teeth[t] ??= []).push(label);
  };
  // The tooth number is almost never in the procedure name — "Crown Supply" says
  // nothing — it is in the description the clinic types beside it: "On tooth 36".
  // Parsing the name alone found teeth on 9 of 8,505 imported lines; reading the
  // description too finds them on 5,884, which is the difference between an empty
  // dental chart and a populated one. The label stays the procedure name, because
  // that is what the chart is meant to show against the tooth.
  for (const c of cases) {
    addTeeth([c.name, c.description], c.name ?? "case");
    for (const l of c.lines) addTeeth([l.treatmentName, l.description], l.treatmentName ?? "treatment");
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
