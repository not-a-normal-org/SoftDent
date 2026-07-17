import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listRxTemplates } from "@/lib/prescriptions";
import { deleteRxTemplate } from "@/lib/actions/rx-templates";
import { fmtDate } from "@/lib/format";

export default async function RxTemplatesPage() {
  await requireRole("OWNER");
  const templates = await listRxTemplates();

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Prescription templates</h1>
        <Link href="/settings/rx-templates/new" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">+ New template</Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {templates.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No templates yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{t.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t._count.drugs} drug(s){t.editedBy ? ` · edited by ${t.editedBy}` : ""}{t.editedAt ? ` · ${fmtDate(t.editedAt)}` : ""}</div>
                </div>
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  <Link href={`/settings/rx-templates/${t.id}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                  <form action={deleteRxTemplate.bind(null, t.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
