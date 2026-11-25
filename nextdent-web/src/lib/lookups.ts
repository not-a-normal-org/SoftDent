import "server-only";
import { prisma } from "./prisma";
import type { PatientFormLists } from "./patient-constants";
import { medicalHistoryTerms } from "./clinical-vocab";

export type { PatientFormLists };

// Options for the patient form's selects / type-ahead datalists.
export async function getPatientFormLists(): Promise<PatientFormLists> {
  const [occupations, relations, doctors, medicalTerms, addresses] = await Promise.all([
    prisma.occupation.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.relation.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
    medicalHistoryTerms(),
    addressList(),
  ]);
  return {
    occupations: occupations.map((o) => o.name),
    relations: relations.map((r) => r.name),
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
    medicalTerms,
    addresses,
  };
}

/**
 * The address box's suggestions: the clinic's own list (AddressPreset — the legacy
 * app's common addresses, plus every address typed since), never an outside service.
 * Ordered by how many patients live there, so "Barishal Sadar" (two thirds of the
 * patients) is at the top before anything is typed. Matching is case-insensitive
 * because the data has "kuriana" and "Kuriana" style variants.
 */
async function addressList(): Promise<{ value: string; label: string; hint?: string }[]> {
  const rows = await prisma.$queryRaw<{ value: string; patients: number }[]>`
    SELECT ap.value, COUNT(p.id)::int AS patients
    FROM "AddressPreset" ap
    LEFT JOIN "Patient" p ON lower(trim(p.address)) = lower(trim(ap.value))
    GROUP BY ap.value
    ORDER BY patients DESC, lower(ap.value) ASC`;
  return rows.map((r) => ({
    value: r.value,
    label: r.value,
    hint: r.patients ? `${r.patients.toLocaleString()} ${r.patients === 1 ? "patient" : "patients"}` : undefined,
  }));
}
