import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listVendors } from "@/lib/inventory";
import { deleteVendor } from "@/lib/actions/inventory";
import VendorForm from "@/components/VendorForm";

export default async function VendorsPage() {
  await requireUser();
  const vendors = await listVendors();

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Inventory</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Vendors</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add vendor</h2>
        <VendorForm />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {vendors.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 dark:text-slate-200">{v.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {[v.businessPhone, v.address, v.note].filter(Boolean).join(" · ") || "—"}
                  {v._count.products > 0 ? ` · ${v._count.products} product(s)` : ""}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                <Link href={`/inventory/vendors/${v.id}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                <form action={deleteVendor.bind(null, v.id)}><button className="text-slate-300 hover:text-rose-600">✕</button></form>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
