import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProduct, getInventoryEditorData } from "@/lib/inventory";
import { fmtDateTime } from "@/lib/format";
import ProductForm from "@/components/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();
  const [product, editor] = await Promise.all([getProduct(pid), getInventoryEditorData()]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Inventory</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit — {product.name}</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ProductForm product={product} categories={editor.categories} vendors={editor.vendors} />
      </section>

      {product.movements.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Recent stock movements</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {product.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">{fmtDateTime(m.at)}{m.reason ? ` · ${m.reason}` : ""}</span>
                <span className={`font-medium tabular-nums ${m.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{m.delta >= 0 ? "+" : ""}{m.delta}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
