import "server-only";
import { prisma } from "./prisma";
import { OPEN_LAB_STATUSES } from "./lab-constants";

const orderInclude = {
  patient: { select: { id: true, fullName: true } },
  lab: { select: { id: true, name: true } },
};

export function listLabOrders(openOnly = false) {
  return prisma.labOrder.findMany({
    where: openOnly ? { status: { in: OPEN_LAB_STATUSES } } : undefined,
    include: orderInclude,
    orderBy: [{ expectedAt: "asc" }, { id: "desc" }],
    take: 100,
  });
}

export const getLabOrder = (id: number) => prisma.labOrder.findUnique({ where: { id }, include: orderInclude });

export const listLabs = () => prisma.lab.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { orders: true } } } });
export const getLab = (id: number) => prisma.lab.findUnique({ where: { id } });

export async function getLabEditorData() {
  const [labs, shades] = await Promise.all([
    prisma.lab.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.labShade.findMany({ orderBy: { code: "asc" }, select: { code: true } }),
  ]);
  return { labs, shades: shades.map((s) => s.code) };
}
