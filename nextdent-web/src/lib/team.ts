import "server-only";
import { prisma } from "./prisma";

export function listStaff() {
  return prisma.person.findMany({
    orderBy: { id: "asc" },
    include: { user: true, doctor: true },
  });
}

export function getStaff(personId: number) {
  return prisma.person.findUnique({
    where: { id: personId },
    include: { user: true, doctor: true },
  });
}
