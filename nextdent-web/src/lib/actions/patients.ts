"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { nextPatientId } from "@/lib/patients";

export type PatientFormState = {
  error?: string;
  fieldErrors?: { fullName?: string; patientID?: string };
  /** after an ID clash, the free number the form should offer instead */
  nextPatientID?: number;
};

const MAX_ID = 2_147_483_647; // Postgres int4

/** Who already holds an ID, phrased for the form — so the clash can be checked, not guessed at. */
async function idTaken(wanted: number): Promise<PatientFormState | undefined> {
  const holder = await prisma.patient.findUnique({ where: { id: wanted }, select: { fullName: true } });
  if (!holder) return undefined;
  const next = await nextPatientId();
  return {
    fieldErrors: { patientID: `Patient ID ${wanted} already belongs to ${holder.fullName}. The next free ID is ${next}.` },
    nextPatientID: next,
  };
}

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

  // patientID is the number the clinic files the patient under, and it IS the record's
  // key — the #38 in every list, picker, search and URL — so the two can never
  // disagree. Changing it on an existing patient is one UPDATE: all 14 tables that
  // point at a patient do so ON UPDATE CASCADE.
  const wantedRaw = str(fd, "patientID");
  if (wantedRaw != null && !/^\d+$/.test(wantedRaw))
    return { fieldErrors: { patientID: "Patient ID must be a whole number." } };
  const wanted = wantedRaw != null ? Number.parseInt(wantedRaw, 10) : null;
  if (wanted != null && (wanted < 1 || wanted > MAX_ID))
    return { fieldErrors: { patientID: "Patient ID must be a positive whole number." } };
  if (wanted != null && wanted !== id) {
    const clash = await idTaken(wanted);
    if (clash) return clash;
  }

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

      // a blank box keeps the current ID rather than clearing the key
      const renumber = wanted != null && wanted !== id;
      const updated = await prisma.patient.update({ where: { id }, data: renumber ? { ...data, id: wanted } : data });
      savedId = updated.id;

      // append-only clinical history: record a version whenever these change. Written
      // against savedId, not id — after a renumber the old ID no longer exists.
      const versions = [];
      if ((before.medicalHistory ?? null) !== (medicalHistory ?? null) && medicalHistory)
        versions.push({ patientId: savedId, kind: "MEDICAL" as const, body: medicalHistory, authorId: user.id });
      if ((before.drugHistory ?? null) !== (drugHistory ?? null) && drugHistory)
        versions.push({ patientId: savedId, kind: "DRUG" as const, body: drugHistory, authorId: user.id });
      if (versions.length) await prisma.patientHistoryVersion.createMany({ data: versions });

      // A renumber is logged under the NEW id with the old one in the diff, so the
      // trail from a paper record carrying the old number is never lost.
      await prisma.auditLog.create({
        data: {
          actorId: user.id, entity: "patient", entityId: String(savedId), action: "update",
          ...(renumber ? { diff: { before: { patientID: id }, after: { patientID: savedId } } } : {}),
        },
      });
    } else {
      // A blank box still gets the clinic's next number, never the database counter,
      // which sits above the import's stray 99999.
      const created = await prisma.patient.create({ data: { ...data, id: wanted ?? (await nextPatientId()) } });
      savedId = created.id;

      const versions = [];
      if (medicalHistory) versions.push({ patientId: savedId, kind: "MEDICAL" as const, body: medicalHistory, authorId: user.id });
      if (drugHistory) versions.push({ patientId: savedId, kind: "DRUG" as const, body: drugHistory, authorId: user.id });
      if (versions.length) await prisma.patientHistoryVersion.createMany({ data: versions });

      await prisma.auditLog.create({ data: { actorId: user.id, entity: "patient", entityId: String(savedId), action: "create" } });
    }
  } catch (e) {
    // Two people saving the same suggested ID at once: the check above passed for
    // both, and the database refused the second. Say so, with the next free number.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const next = await nextPatientId();
      return {
        fieldErrors: { patientID: `That Patient ID was just taken by someone else. The next free ID is ${next}.` },
        nextPatientID: next,
      };
    }
    console.error("savePatient failed", e);
    return { error: "Could not save the patient. Please try again." };
  }

  await rememberAddress(data.address);

  revalidatePath("/patients");
  revalidatePath(`/patients/${savedId}`);
  redirect(`/patients/${savedId}`); // throws — outside try/catch
}

/**
 * A new address joins the clinic's address list, so the next patient from the same
 * place finds it in the dropdown. Matched without regard to case or surrounding space,
 * so "kuriana" does not add a second "Kuriana". Best effort: the patient is already
 * saved, and a list that missed one entry must not turn that into an error.
 */
async function rememberAddress(address: string | null) {
  if (!address) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "AddressPreset" (value)
      SELECT ${address}
      WHERE NOT EXISTS (SELECT 1 FROM "AddressPreset" WHERE lower(trim(value)) = lower(trim(${address})))
      ON CONFLICT (value) DO NOTHING`;
  } catch (e) {
    console.error("rememberAddress failed", e);
  }
}
