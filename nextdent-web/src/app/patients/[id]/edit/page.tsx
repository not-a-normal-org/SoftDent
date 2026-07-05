import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPatientFormLists } from "@/lib/lookups";
import PatientForm from "@/components/PatientForm";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();

  const [patient, lists] = await Promise.all([
    prisma.patient.findUnique({ where: { id: pid } }),
    getPatientFormLists(),
  ]);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/patients/${pid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
        ← Back to patient
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Edit — {patient.fullName}
      </h1>
      <PatientForm patient={patient} lists={lists} />
    </div>
  );
}
