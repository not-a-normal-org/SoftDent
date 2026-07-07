import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTreatments } from "@/lib/settings";
import { deleteTreatment } from "@/lib/actions/settings";
import { taka } from "@/lib/format";
import TreatmentForm from "@/components/TreatmentForm";

export default async function TreatmentsPage() {
  await requireRole("OWNER");
  const treatments = await getTreatments();

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Treatment catalog</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add procedure</h2>
        <TreatmentForm inline />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">{treatments.length} procedures</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {treatments.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-slate-800 dark:text-slate-200">{t.name}</span>
              <span className="flex items-center gap-4">
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{taka(t.defaultPrice)}</span>
                <Link href={`/settings/treatments/${t.id}/edit`} className="text-xs text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                <form action={deleteTreatment.bind(null, t.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
