import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAppointment, getAppointmentEditorData } from "@/lib/appointments";
import AppointmentForm from "@/components/AppointmentForm";

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const aid = Number.parseInt(id, 10);
  if (Number.isNaN(aid)) notFound();

  const [appt, data] = await Promise.all([getAppointment(aid), getAppointmentEditorData()]);
  if (!appt) notFound();

  return (
    <div className="space-y-6">
      <Link href="/appointments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Appointments</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit appointment</h1>
      <AppointmentForm
        appt={appt}
        initialPatient={appt.patient ? { id: appt.patient.id, name: appt.patient.fullName } : null}
        doctors={data.doctors}
        units={data.units}
      />
    </div>
  );
}
