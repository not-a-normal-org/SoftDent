import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLine, getBillingEditorData } from "@/lib/billing";
import LineForm from "@/components/LineForm";

export default async function EditLinePage({ params }: { params: Promise<{ id: string; lineId: string }> }) {
  await requireUser();
  const { id, lineId } = await params;
  const cid = Number.parseInt(id, 10);
  const lid = Number.parseInt(lineId, 10);
  if (Number.isNaN(cid) || Number.isNaN(lid)) notFound();

  const [line, editor] = await Promise.all([getLine(lid), getBillingEditorData()]);
  if (!line || line.caseId !== cid) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/cases/${cid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Back to case</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit procedure</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <LineForm caseId={cid} line={line} treatments={editor.treatments} doctors={editor.doctors} />
      </section>
    </div>
  );
}
