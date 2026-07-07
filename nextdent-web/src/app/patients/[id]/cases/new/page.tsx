import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CaseForm from "@/components/CaseForm";

export default async function NewCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();
  const patient = await prisma.patient.findUnique({ where: { id: pid }, select: { id: true, fullName: true } });
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/patients/${pid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← {patient.fullName}</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New treatment case</h1>
      <CaseForm patientId={pid} cancelHref={`/patients/${pid}`} />
    </div>
  );
}
