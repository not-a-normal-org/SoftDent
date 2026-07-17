import "server-only";
import { prisma } from "./prisma";

export function getAuditLog(limit = 200) {
  return prisma.auditLog.findMany({
    orderBy: { at: "desc" },
    take: limit,
    include: { actor: { include: { person: true } } },
  });
}
