import "server-only";
import { prisma } from "./prisma";

// Revenue split driven by each doctor's per-contract percentages (see data-model §7.2).
// Consultant = patient.consultantDoctor; operator = line.operatingDoctor; chamber keeps the rest.
// Split is applied to *collected* revenue (amountPaid).
export async function getPayouts() {
  const lines = await prisma.treatmentLine.findMany({
    where: { amountPaid: { gt: 0 } },
    include: {
      case: { include: { patient: { include: { consultantDoctor: { include: { person: true } } } } } },
      operatingDoctor: { include: { person: true } },
    },
  });

  const byDoctor = new Map<number, { name: string; consultant: number; operator: number }>();
  const bump = (id: number, name: string, role: "consultant" | "operator", amt: number) => {
    const e = byDoctor.get(id) ?? { name, consultant: 0, operator: 0 };
    e[role] += amt;
    byDoctor.set(id, e);
  };

  let chamber = 0;
  let collected = 0;
  for (const l of lines) {
    const base = l.amountPaid; // lab cost isn't modelled per-line yet; deductLabBeforeSplit reserved for later
    collected += base;
    let allocated = 0;
    const cons = l.case.patient.consultantDoctor;
    const op = l.operatingDoctor;
    if (cons) { const share = Math.round((base * cons.consultantSharePct) / 100); bump(cons.id, cons.person.fullName, "consultant", share); allocated += share; }
    if (op) { const share = Math.round((base * op.operatorSharePct) / 100); bump(op.id, op.person.fullName, "operator", share); allocated += share; }
    chamber += base - allocated;
  }

  const doctors = [...byDoctor.entries()]
    .map(([id, v]) => ({ id, ...v, total: v.consultant + v.operator }))
    .sort((a, b) => b.total - a.total);

  return { doctors, chamber, collected };
}
