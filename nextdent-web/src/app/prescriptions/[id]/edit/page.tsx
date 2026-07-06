import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrescription, getRxEditorData } from "@/lib/prescriptions";
import RxEditor from "@/components/RxEditor";

export default async function EditPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const rid = Number.parseInt(id, 10);
  if (Number.isNaN(rid)) notFound();

  const [rx, data] = await Promise.all([getPrescription(rid), getRxEditorData()]);
  if (!rx) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/prescriptions/${rx.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
        ← Back to prescription
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit prescription — Rx #{rx.id}</h1>
      <RxEditor
        rx={rx}
        initialPatient={rx.patient ? { id: rx.patient.id, name: rx.patient.fullName } : null}
        doctors={data.doctors}
        templates={data.templates}
      />
    </div>
  );
}
