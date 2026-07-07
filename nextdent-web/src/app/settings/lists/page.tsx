import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getLookups, type LookupKey } from "@/lib/settings";
import { addLookup, deleteLookup } from "@/lib/actions/settings";

export default async function ListsPage() {
  await requireRole("OWNER");
  const lookups = await getLookups();

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Lookup lists</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(lookups).map(([key, list]) => (
          <section key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{list.label}</h2>
              <span className="text-xs text-slate-400">{list.items.length}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {list.items.length === 0 && <span className="text-xs text-slate-400">empty</span>}
              {list.items.map((it) => (
                <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {it.value}
                  <form action={deleteLookup.bind(null, key as LookupKey, it.id)}>
                    <button className="grid h-4 w-4 place-items-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20" aria-label={`Remove ${it.value}`}>✕</button>
                  </form>
                </span>
              ))}
            </div>
            <form action={addLookup.bind(null, key as LookupKey)} className="flex gap-2">
              <input name="value" placeholder={`Add to ${list.label.toLowerCase()}…`} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              <button className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">Add</button>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
