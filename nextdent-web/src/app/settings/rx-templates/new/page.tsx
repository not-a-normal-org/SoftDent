import Link from "next/link";
import { requireRole } from "@/lib/auth";
import RxTemplateEditor from "@/components/RxTemplateEditor";

export default async function NewRxTemplatePage() {
  await requireRole("OWNER");
  return (
    <div className="space-y-6">
      <Link href="/settings/rx-templates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Templates</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New prescription template</h1>
      <RxTemplateEditor />
    </div>
  );
}
