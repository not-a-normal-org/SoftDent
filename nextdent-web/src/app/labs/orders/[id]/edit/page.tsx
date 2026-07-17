import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLabOrder, getLabEditorData } from "@/lib/labs";
import LabOrderForm from "@/components/LabOrderForm";

export default async function EditLabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const oid = Number.parseInt(id, 10);
  if (Number.isNaN(oid)) notFound();
  const [order, editor] = await Promise.all([getLabOrder(oid), getLabEditorData()]);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <Link href="/labs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Lab work</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit lab order</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <LabOrderForm
          order={order}
          initialPatient={{ id: order.patient.id, name: order.patient.fullName }}
          labs={editor.labs}
          shades={editor.shades}
        />
      </section>
    </div>
  );
}
