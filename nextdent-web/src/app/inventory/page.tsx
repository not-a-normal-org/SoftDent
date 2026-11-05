import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProducts, inventoryStats, getInventoryEditorData, PRODUCT_PAGE_SIZE } from "@/lib/inventory";
import { deleteProduct } from "@/lib/actions/inventory";
import { taka } from "@/lib/format";
import ProductForm from "@/components/ProductForm";
import InventoryFilters from "@/components/InventoryFilters";
import StockMove from "@/components/StockMove";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; low?: string }> }) {
  await requireUser();
  const { q, category, low } = await searchParams;
  const lowOnly = low === "1";
  const [{ rows, total }, stats, editor] = await Promise.all([
    listProducts({ q, category, low: lowOnly }),
    inventoryStats(),
    getInventoryEditorData(),
  ]);
  const filtered = Boolean(q?.trim() || category || lowOnly);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventory</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {stats.total} products · stock worth {taka(stats.value)}
              {stats.low > 0 ? (
                <>
                  {" · "}
                  <Link href="/inventory?low=1" className="text-rose-600 hover:underline dark:text-rose-400">
                    {stats.low} at or below reorder level
                  </Link>
                  <span className="text-slate-400"> ({stats.out} with nothing on the shelf)</span>
                </>
              ) : null}
            </p>
          </div>
          <Link href="/inventory/vendors" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Vendors →</Link>
        </div>
        <div className="mt-4">
          <InventoryFilters categories={editor.categories} q={q} category={category} low={lowOnly} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {lowOnly ? "Low on stock" : "Products"}
            <span className="ml-2 font-normal text-slate-400">{total}</span>
          </h2>
          {filtered && <Link href="/inventory" className="text-xs text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">Clear filters</Link>}
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {filtered ? "Nothing matches those filters." : "No products yet — add one below."}
          </p>
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
                  <th className="px-5 py-2 font-medium">Receive / issue</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-slate-50 align-top dark:border-slate-800/60">
                    <td className="px-5 py-2">
                      <Link href={`/inventory/products/${p.id}/edit`} className="text-slate-800 hover:text-teal-700 hover:underline dark:text-slate-200 dark:hover:text-teal-400">{p.name}</Link>
                    </td>
                    <td className="px-5 py-2 text-slate-500 dark:text-slate-400">{p.category ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums">
                      <span className={p.lowStock ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}>{p.quantity}</span>
                      <span className="text-slate-400"> {p.unit ?? ""}</span>
                      {p.lowStock && (
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${p.outOfStock
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"}`}>
                          {p.outOfStock ? "out" : "low"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{taka(p.unitPrice)}</td>
                    <td className="px-5 py-2 text-slate-500 dark:text-slate-400">{p.vendor?.name ?? "—"}</td>
                    <td className="px-5 py-2"><StockMove productId={p.id} /></td>
                    <td className="whitespace-nowrap px-5 py-2 text-right text-xs">
                      <Link href={`/inventory/products/${p.id}/edit`} className="text-teal-700 hover:underline dark:text-teal-400">edit</Link>
                      <form action={deleteProduct.bind(null, p.id)} className="inline"><button className="ml-2 text-slate-300 hover:text-rose-600">✕</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > rows.length && (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Showing the first {PRODUCT_PAGE_SIZE} of {total} — search or pick a category to narrow it down.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Add product</h2>
        <ProductForm categories={editor.categories} vendors={editor.vendors} />
      </section>
    </div>
  );
}
