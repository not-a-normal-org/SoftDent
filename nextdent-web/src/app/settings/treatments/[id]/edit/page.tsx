import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getTreatment } from "@/lib/settings";
import TreatmentForm from "@/components/TreatmentForm";

export default async function EditTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("OWNER");
  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid)) notFound();
  const treatment = await getTreatment(tid);
  if (!treatment) notFound();

  return (
    <div className="space-y-6">
      <Link href="/settings/treatments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Treatment catalog</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit procedure</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TreatmentForm treatment={treatment} />
      </section>
    </div>
  );
}
