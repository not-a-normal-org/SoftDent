import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CaseForm from "@/components/CaseForm";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cid = Number.parseInt(id, 10);
  if (Number.isNaN(cid)) notFound();
  const c = await prisma.treatmentCase.findUnique({ where: { id: cid } });
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/cases/${cid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Back to case</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit case</h1>
      <CaseForm patientId={c.patientId} treatmentCase={c} cancelHref={`/cases/${cid}`} />
    </div>
  );
}
