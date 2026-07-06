import "server-only";
import { prisma } from "./prisma";

export type DashboardStats = {
  patients: number;
  appointmentsToday: number;
  appointmentsUpcoming: number;
  appointmentsTotal: number;
  prescriptions: number;
  treatmentCases: number;
  billed: number;
  paid: number;
  due: number;
  drugs: number;
  doctors: number;
  staff: number;
  labs: number;
  vendors: number;
  rxTemplates: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    patients, appointmentsToday, appointmentsUpcoming, appointmentsTotal,
    prescriptions, treatmentCases, billing, drugs, doctors, staff, labs, vendors, rxTemplates,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({ where: { appointmentDate: { gte: startToday, lt: endToday } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: startToday } } }),
    prisma.appointment.count(),
    prisma.prescription.count({ where: { deletedAt: null } }),
    prisma.treatmentCase.count(),
    prisma.treatmentLine.aggregate({ _sum: { afterDiscountAmount: true, amountPaid: true } }),
    prisma.drug.count(),
    prisma.doctor.count(),
    prisma.user.count(),
    prisma.lab.count(),
    prisma.vendor.count(),
    prisma.rxTemplate.count(),
  ]);

  const billed = billing._sum.afterDiscountAmount ?? 0;
  const paid = billing._sum.amountPaid ?? 0;

  return {
    patients, appointmentsToday, appointmentsUpcoming, appointmentsTotal,
    prescriptions, treatmentCases, billed, paid, due: billed - paid,
    drugs, doctors, staff, labs, vendors, rxTemplates,
  };
}
