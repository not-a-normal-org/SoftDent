import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getVendor } from "@/lib/inventory";
import VendorForm from "@/components/VendorForm";

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const vid = Number.parseInt(id, 10);
  if (Number.isNaN(vid)) notFound();
  const vendor = await getVendor(vid);
  if (!vendor) notFound();

  return (
    <div className="space-y-6">
      <Link href="/inventory/vendors" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Vendors</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit — {vendor.name}</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <VendorForm vendor={vendor} />
      </section>
    </div>
  );
}
