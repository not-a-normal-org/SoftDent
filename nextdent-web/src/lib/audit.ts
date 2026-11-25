import "server-only";
import { prisma } from "./prisma";
import { rangeBounds, type DateRange } from "./date-range";

export const AUDIT_PAGE_SIZE = 100;

/** Events in a date range, newest first, a page at a time. */
export async function getAuditLog(range: DateRange, page = 1) {
  const { start, end } = rangeBounds(range);
  const where = { at: { gte: start, lt: end } };
  const total = await prisma.auditLog.count({ where });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    skip: (p - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    include: { actor: { include: { person: true } } },
  });
  return { rows, total, page: p, pages };
}
