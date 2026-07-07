import "server-only";
import { prisma } from "./prisma";

// Allowlisted lookup tables (table/column names are constants — never user input —
// so they're safe to interpolate into raw SQL; values are always parameterized).
export const LOOKUP_TABLES = {
  occupations: { table: "Occupation", col: "name", label: "Occupations" },
  relations: { table: "Relation", col: "name", label: "Emergency relations" },
  connectionRelations: { table: "ConnectionRelation", col: "name", label: "Family connections" },
  units: { table: "Unit", col: "name", label: "Chairs / units" },
  caseTypes: { table: "CaseType", col: "name", label: "Treatment case types" },
  labShades: { table: "LabShade", col: "code", label: "Lab shades" },
  salaryTypes: { table: "SalaryType", col: "name", label: "Salary types" },
  productCategories: { table: "ProductCategory", col: "name", label: "Product categories" },
  expenseCategories: { table: "ExpenseCategory", col: "name", label: "Expense categories" },
  scheduleSlots: { table: "ScheduleSlot", col: "label", label: "Schedule times" },
  addressPresets: { table: "AddressPreset", col: "value", label: "Address presets" },
} as const;

export type LookupKey = keyof typeof LOOKUP_TABLES;

export async function getLookups() {
  const out: Record<string, { label: string; items: { id: number; value: string }[] }> = {};
  for (const [key, cfg] of Object.entries(LOOKUP_TABLES)) {
    const items = await prisma.$queryRawUnsafe<{ id: number; value: string }[]>(
      `SELECT id, "${cfg.col}"::text AS value FROM "${cfg.table}" ORDER BY "${cfg.col}"`
    );
    out[key] = { label: cfg.label, items };
  }
  return out;
}

export const getTreatments = () => prisma.treatment.findMany({ orderBy: { name: "asc" } });
export const getTreatment = (id: number) => prisma.treatment.findUnique({ where: { id } });

export async function getClinicConfig() {
  const [settings, rxDoc] = await Promise.all([
    prisma.clinicSetting.findFirst(),
    prisma.documentTemplate.findFirst({ where: { docName: "Prescription" } }),
  ]);
  return { settings, rxDoc };
}
