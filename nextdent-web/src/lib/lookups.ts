import "server-only";
import { prisma } from "./prisma";
import type { PatientFormLists } from "./patient-constants";

export type { PatientFormLists };

// Options for the patient form's selects / type-ahead datalists.
export async function getPatientFormLists(): Promise<PatientFormLists> {
  const [occupations, relations, doctors] = await Promise.all([
    prisma.occupation.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.relation.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
  ]);
  return {
    occupations: occupations.map((o) => o.name),
    relations: relations.map((r) => r.name),
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
  };
}
