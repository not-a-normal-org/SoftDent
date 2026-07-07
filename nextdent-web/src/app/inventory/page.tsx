import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProducts, getInventoryEditorData } from "@/lib/inventory";
import { deleteProduct } from "@/lib/actions/inventory";
import { taka } from "@/lib/format";
import ProductForm from "@/components/ProductForm";
import StockAdjust from "@/components/StockAdjust";

export default async function InventoryPage() {
  await requireUser();
  const [products, editor] = await Promise.all([listProducts(), getInventoryEditorData()]);
  const lowCount = products.filter((p) => p.lowStock).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {products.length} products{lowCount > 0 ? <span className="text-rose-600 dark:text-rose-400"> · {lowCount} low on stock</span> : null}
          </p>
        </div>
        <Link href="/inventory/vendors" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Vendors →</Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add product</h2>
        <ProductForm categories={editor.categories} vendors={editor.vendors} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {products.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No products yet — add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-2 font-medium">Product</th>
                  <th className="px-5 py-2 font-medium">Category</th>
                  <th className="px-5 py-2 text-right font-medium">Stock</th>
                  <th className="px-5 py-2 text-right font-medium">Unit price</th>
                  <th className="px-5 py-2 font-medium">Vendor</th>
                  <th className="px-5 py-2 font-medium">Adjust</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-50 dark:border-slate-800/60">
                    <td className="px-5 py-2 text-slate-800 dark:text-slate-200">{p.name}</td>
                    <td className="px-5 py-2 text-slate-500 dark:text-slate-400">{p.category ?? "—"}</td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      <span className={p.lowStock ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}>{p.quantity}</span>
                      <span className="text-slate-400"> {p.unit ?? ""}</span>
                      {p.lowStock && <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">low</span>}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(p.unitPrice)}</td>
                    <td className="px-5 py-2 text-slate-500 dark:text-slate-400">{p.vendor?.name ?? "—"}</td>
                    <td className="px-5 py-2"><StockAdjust productId={p.id} /></td>
                    <td className="whitespace-nowrap px-5 py-2 text-right text-xs">
                      <Link href={`/inventory/products/${p.id}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                      <form action={deleteProduct.bind(null, p.id)} className="inline"><button className="ml-2 text-slate-300 hover:text-rose-600">✕</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
