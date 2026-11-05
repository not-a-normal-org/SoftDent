import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProduct, getInventoryEditorData } from "@/lib/inventory";
import { fmtDateTime, taka } from "@/lib/format";
import ProductForm from "@/components/ProductForm";
import StockMove from "@/components/StockMove";

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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{product.name}</h1>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm">
          <p className="text-slate-500 dark:text-slate-400">
            {product.category ?? "Uncategorised"}
            {product.vendor ? ` · ${product.vendor.name}` : ""}
            {` · ${taka(product.unitPrice)} per ${product.unit ?? "unit"}`}
          </p>
          <p className="mt-1">
            <span className={`text-lg font-semibold tabular-nums ${product.lowStock ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
              {product.quantity}
            </span>
            <span className="text-slate-500 dark:text-slate-400"> {product.unit ?? ""} in stock · reorder at {product.reorderLevel}</span>
          </p>
        </div>
        <StockMove productId={product.id} defaultOpen />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">Stock movements</h2>
        {product.movements.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing received or issued yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-5 py-2 text-right font-medium">Change</th>
                <th className="px-5 py-2 font-medium">Reason</th>
                <th className="px-5 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {product.movements.map((m) => (
                <tr key={m.id} className="border-t border-slate-50 dark:border-slate-800/60">
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500 dark:text-slate-400">{fmtDateTime(m.at)}</td>
                  <td className={`px-5 py-2 text-right font-medium tabular-nums ${m.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {m.delta >= 0 ? "+" : ""}{m.delta}
                  </td>
                  <td className="px-5 py-2 text-slate-600 dark:text-slate-300">{m.reason ?? "—"}</td>
                  {/* Legacy movements imported from Access carry no user at all. */}
                  <td className="px-5 py-2 text-slate-500 dark:text-slate-400">{m.by ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Edit product</h2>
        <ProductForm product={product} categories={editor.categories} vendors={editor.vendors} />
      </section>
    </div>
  );
}
