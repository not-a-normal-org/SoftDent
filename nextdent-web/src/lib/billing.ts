import "server-only";
import { prisma } from "./prisma";
import { afterDiscountClient } from "./billing-math";

export const afterDiscount = afterDiscountClient;

export function getCase(id: number) {
  return prisma.treatmentCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, fullName: true } },
      lines: {
        orderBy: [{ treatmentDate: "asc" }, { id: "asc" }],
        include: {
          operatingDoctor: { include: { person: true } },
          payments: { orderBy: { paidAt: "desc" } },
        },
      },
    },
  });
}

export function getLine(id: number) {
  return prisma.treatmentLine.findUnique({ where: { id }, include: { case: true } });
}

/** Clinic letterhead for the printed invoice (legacy tbl_PrintDoc → "Invoice"). */
export const getInvoiceDoc = () => prisma.documentTemplate.findFirst({ where: { docName: "Invoice" } });

/** A case with everything needed to render its invoice. */
export function getCaseForInvoice(id: number) {
  return prisma.treatmentCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, fullName: true, primaryPhone: true, address: true } },
      lines: { orderBy: [{ treatmentDate: "asc" }, { id: "asc" }], include: { operatingDoctor: { include: { person: true } } } },
    },
  });
}

export async function getBillingEditorData() {
  const [treatments, doctors] = await Promise.all([
    prisma.treatment.findMany({ orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
  ]);
  return {
    treatments: treatments.map((t) => ({ name: t.name, price: t.defaultPrice })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
  };
}

export type DuesRow = { id: number; fullName: string; due: number };

export async function getBillingOverview() {
  const [totals, dues, recentPayments] = await Promise.all([
    prisma.treatmentLine.aggregate({ _sum: { afterDiscountAmount: true, amountPaid: true } }),
    prisma.$queryRaw<DuesRow[]>`
      SELECT p.id, p."fullName", SUM(l."afterDiscountAmount" - l."amountPaid")::int AS due
      FROM "TreatmentLine" l
      JOIN "TreatmentCase" c ON c.id = l."caseId"
      JOIN "Patient" p ON p.id = c."patientId"
      GROUP BY p.id, p."fullName"
      HAVING SUM(l."afterDiscountAmount" - l."amountPaid") > 0
      ORDER BY due DESC
      LIMIT 50`,
    prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { treatmentLine: { include: { case: { include: { patient: { select: { id: true, fullName: true } } } } } } },
    }),
  ]);
  const billed = totals._sum.afterDiscountAmount ?? 0;
  const paid = totals._sum.amountPaid ?? 0;
  return { billed, paid, due: billed - paid, dues, recentPayments };
}
