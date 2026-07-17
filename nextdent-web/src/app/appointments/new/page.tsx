import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppointmentEditorData } from "@/lib/appointments";
import AppointmentForm from "@/components/AppointmentForm";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ patientId?: string; date?: string }> }) {
  await requireUser();
  const { patientId, date } = await searchParams;
  const pid = patientId ? Number.parseInt(patientId, 10) : NaN;

  const [data, patient] = await Promise.all([
    getAppointmentEditorData(),
    Number.isFinite(pid) ? prisma.patient.findUnique({ where: { id: pid }, select: { id: true, fullName: true } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <Link href="/appointments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Appointments</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New appointment</h1>
      <AppointmentForm
        doctors={data.doctors}
        units={data.units}
        schedule={data.schedule}
        defaultDate={date}
        initialPatient={patient ? { id: patient.id, name: patient.fullName } : null}
      />
    </div>
  );
}
