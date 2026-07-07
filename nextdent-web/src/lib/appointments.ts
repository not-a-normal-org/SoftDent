import "server-only";
import { prisma } from "./prisma";
import { CLOSED_STATUSES } from "./appointment-constants";

const dayRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const apptInclude = {
  patient: { select: { id: true, fullName: true, primaryPhone: true } },
  doctor: { include: { person: true } },
};
const apptOrder = [{ startsAt: "asc" as const }, { id: "asc" as const }];

export function getAppointmentsForDate(date: Date) {
  const { start, end } = dayRange(date);
  return prisma.appointment.findMany({ where: { appointmentDate: { gte: start, lt: end } }, include: apptInclude, orderBy: apptOrder });
}

export function getOverdue() {
  const { start: today } = dayRange(new Date());
  return prisma.appointment.findMany({
    where: {
      appointmentDate: { lt: today },
      OR: [{ status: null }, { status: { notIn: CLOSED_STATUSES } }],
    },
    include: apptInclude,
    orderBy: apptOrder,
    take: 50,
  });
}

export function getUpcoming(limit = 25) {
  const { start: today } = dayRange(new Date());
  return prisma.appointment.findMany({
    where: { appointmentDate: { gte: today } },
    include: apptInclude,
    orderBy: apptOrder,
    take: limit,
  });
}

export function getAppointment(id: number) {
  return prisma.appointment.findUnique({ where: { id }, include: apptInclude });
}

export async function getAppointmentEditorData() {
  const [doctors, units] = await Promise.all([
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);
  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
    units: units.map((u) => u.name),
  };
}
