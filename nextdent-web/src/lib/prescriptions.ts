import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type DrugHit = {
  id: number;
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
};

// Everything a doctor might type at: "Napa 500", "cap seclo 20", "tab amox".
const DRUG_HAYSTACK = Prisma.sql`(
  COALESCE("brandName", '') || ' ' || COALESCE("genericName", '') || ' ' ||
  COALESCE("strength", '') || ' ' || COALESCE("dosageForm", '')
)`;

// A token only has to *resemble* a word in the row. Trigram similarity handles
// letters well but is blind to short numeric slips ("4oo" scores 0.25 against
// "400"), so edit distance backs it up — one slip in a short token, two in a longer.
const WORD_SIMILARITY = 0.45;
const editBudget = (t: string) => (t.length <= 2 ? 1 : t.length <= 5 ? 2 : 3);

// user input goes into LIKE patterns, so its wildcards must not act as wildcards
const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const hasLetter = (s: string) => /\p{L}/u.test(s);

/**
 * Drug search over the 46k catalog, in two passes:
 *   1. literal — every token must appear somewhere in the row, in any order, so
 *      "napa 500" and "cap seclo" match on strength and form as well as the names.
 *   2. fuzzy   — nothing matched, so the doctor probably misspelled it. Trigram
 *      similarity on the indexed name columns proposes candidates, then each token
 *      is matched against the row's individual words by similarity or edit distance.
 *
 * Both passes rank the same way: how squarely the brand was hit, then how often the
 * clinic prescribes it, then trigram similarity and edit distance.
 */
export async function searchDrugs(q: string, limit = 15): Promise<DrugHit[]> {
  const term = q.trim().replace(/\s+/g, " ").slice(0, 120);
  if (term.length < 1) return [];
  const tokens = term.split(" ").slice(0, 6).map((t) => t.toLowerCase());
  const literal = (t: string) => Prisma.sql`hay LIKE ${`%${likeEscape(t)}%`}`;

  // Brands the doctor has started spelling come first, and among those the ones this
  // clinic actually prescribes — so "f" leads with Flamex, a regular, rather than with
  // the obscure brand named exactly "F". Exactness is not its own tier: it falls out of
  // the similarity and length tiebreaks below once weight has had its say.
  const ranking = Prisma.sql`
    CASE WHEN ${Prisma.join(
      tokens.map((t) => Prisma.sql`brand LIKE ${`${likeEscape(t)}%`}`),
      " OR "
    )} THEN 0 ELSE 1 END,
    "usageCount" DESC,
    GREATEST(${Prisma.join([
      ...tokens.map((t) => Prisma.sql`similarity(brand, ${t})`),
      Prisma.sql`similarity(lower(COALESCE("genericName", '')), ${term})`,
    ])}) DESC,
    LEAST(${Prisma.join(tokens.map((t) => Prisma.sql`levenshtein(${t}, left(brand, 255))`))}),
    length(brand), id`;

  const select = Prisma.sql`
    SELECT id, "brandName", "genericName", "strength", "dosageForm", "usageCount",
           lower(COALESCE("brandName", '')) AS brand, lower(${DRUG_HAYSTACK}) AS hay
    FROM "Drug"`;

  const hits = await prisma.$queryRaw<DrugHit[]>`
    SELECT id, "brandName", "genericName", "strength", "dosageForm"
    FROM (${select}) d
    WHERE ${Prisma.join(tokens.map(literal), " AND ")}
    ORDER BY ${ranking}
    LIMIT ${limit}`;
  if (hits.length > 0) return hits;

  // `%` against the bare columns keeps candidate-picking on the gin_trgm_ops indexes
  // (a few ms rather than a scan of all 46k rows); the token filters then run over
  // that short list, where the per-word edit distance is cheap.
  const named = tokens.filter(hasLetter);
  const candidates = Prisma.join(
    (named.length ? named : tokens).flatMap((t) => [
      Prisma.sql`"brandName" % ${t}`,
      Prisma.sql`"genericName" % ${t}`,
    ]),
    " OR "
  );
  const resembles = (t: string) => Prisma.sql`(
    ${literal(t)}
    OR word_similarity(${t}, hay) >= ${WORD_SIMILARITY}
    OR EXISTS (
      SELECT 1 FROM unnest(string_to_array(hay, ' ')) AS w
      WHERE w <> '' AND levenshtein(${t}, left(w, 255)) <= ${editBudget(t)}
    )
  )`;

  return prisma.$queryRaw<DrugHit[]>`
    SELECT id, "brandName", "genericName", "strength", "dosageForm"
    FROM (${select} WHERE ${candidates}) d
    WHERE ${Prisma.join(tokens.map(resembles), " AND ")}
    ORDER BY ${ranking}
    LIMIT ${limit}`;
}

/** Bump a drug's weight when it is picked, so the type-ahead learns what gets used. */
export async function recordDrugUse(drugId: number) {
  await prisma.drug.update({
    where: { id: drugId },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
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
