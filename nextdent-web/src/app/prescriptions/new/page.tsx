import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRxEditorData } from "@/lib/prescriptions";
import RxEditor from "@/components/RxEditor";

export default async function NewPrescriptionPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  await requireUser();
  const { patientId } = await searchParams;
  const pid = patientId ? Number.parseInt(patientId, 10) : NaN;

  const [data, patient] = await Promise.all([
    getRxEditorData(),
    Number.isFinite(pid) ? prisma.patient.findUnique({ where: { id: pid }, select: { id: true, fullName: true } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <Link href="/prescriptions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
        ← All prescriptions
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New prescription</h1>
      <RxEditor
        doctors={data.doctors}
        templates={data.templates}
        medicalTerms={data.medicalTerms}
        defaultDentistId={data.doctors[0]?.id ?? null}
        initialPatient={patient ? { id: patient.id, name: patient.fullName } : null}
      />
    </div>
  );
}
