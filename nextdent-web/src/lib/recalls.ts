import "server-only";
import { prisma } from "./prisma";

export type RecallItem = {
  id: number;
  patient: { id: number; fullName: string; primaryPhone: string | null };
  dueDate: Date;
  reason: string | null;
  source: string;
};

// "Who's due back" — derived from prescription follow-up dates (+ any explicit recall rows).
export async function getRecalls() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [rxs, recalls] = await Promise.all([
    prisma.prescription.findMany({
      where: { deletedAt: null, followUpDate: { not: null }, patientId: { not: null } },
      include: { patient: { select: { id: true, fullName: true, primaryPhone: true } } },
      orderBy: { followUpDate: "asc" },
    }),
    prisma.recall.findMany({
      where: { status: "pending" },
      include: { patient: { select: { id: true, fullName: true, primaryPhone: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const items: RecallItem[] = [
    ...rxs.map((r) => ({ id: r.id, patient: r.patient!, dueDate: r.followUpDate!, reason: r.followUpReason, source: "Prescription" })),
    ...recalls.map((r) => ({ id: r.id, patient: r.patient, dueDate: r.dueDate, reason: r.reason, source: "Recall" })),
  ].sort((a, b) => +a.dueDate - +b.dueDate);

  return {
    overdue: items.filter((i) => i.dueDate < today),
    upcoming: items.filter((i) => i.dueDate >= today),
  };
}
