import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getRxTemplateFull } from "@/lib/prescriptions";
import RxTemplateEditor from "@/components/RxTemplateEditor";

export default async function EditRxTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("OWNER");
  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid)) notFound();
  const template = await getRxTemplateFull(tid);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <Link href="/settings/rx-templates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Templates</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit template — {template.name}</h1>
      <RxTemplateEditor template={template} />
    </div>
  );
}
