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

// generate "HH:MM" slot start times from open→close at slot-minute steps
function buildSlots(open: string, close: string, minutes: number): string[] {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + om, end = ch * 60 + cm, step = Math.max(5, minutes);
  const out: string[] = [];
  for (let t = start; t + step <= end; t += step) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

export async function getAppointmentEditorData() {
  const [doctors, units, settings] = await Promise.all([
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.clinicSetting.findFirst(),
  ]);
  const open = settings?.openTime ?? "15:00", close = settings?.closeTime ?? "19:00", slot = settings?.slotMinutes ?? 30;
  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
    units: units.map((u) => u.name),
    schedule: { workingDays: settings?.workingDays ?? [6, 0, 1, 2, 3], slotMinutes: slot, slots: buildSlots(open, close, slot) },
  };
}
export type ApptSchedule = Awaited<ReturnType<typeof getAppointmentEditorData>>["schedule"];
