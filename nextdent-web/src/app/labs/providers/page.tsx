import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLabs } from "@/lib/labs";
import { deleteLab } from "@/lib/actions/labs";
import LabProviderForm from "@/components/LabProviderForm";

export default async function LabProvidersPage() {
  await requireUser();
  const labs = await listLabs();

  return (
    <div className="space-y-6">
      <Link href="/labs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Lab work</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Labs</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add lab</h2>
        <LabProviderForm />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {labs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {l.name}{!l.isActive && <span className="ml-2 text-xs text-rose-500">(inactive)</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {[l.contactPerson, l.contactNumber, l.paymentTerms].filter(Boolean).join(" · ") || "—"}
                  {l._count.orders > 0 ? ` · ${l._count.orders} order(s)` : ""}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                <Link href={`/labs/providers/${l.id}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                {l._count.orders === 0 && (
                  <form action={deleteLab.bind(null, l.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
