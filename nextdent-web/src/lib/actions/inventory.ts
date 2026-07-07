"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type ProductFormState = { error?: string };
export type VendorFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const i = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : null; };

// ── products ──
export async function saveProduct(_prev: ProductFormState, fd: FormData): Promise<ProductFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Product name is required." };
  const data = {
    name, category: s(fd, "category"), unit: s(fd, "unit"),
    quantity: i(fd, "quantity") ?? 0, reorderLevel: i(fd, "reorderLevel") ?? 0,
    unitPrice: i(fd, "unitPrice") ?? 0, vendorId: i(fd, "vendorId"), note: s(fd, "note"),
  };
  try {
    if (id) await prisma.product.update({ where: { id }, data });
    else await prisma.product.create({ data });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "product", action: id ? "update" : "create" } });
  } catch (e) { console.error("saveProduct failed", e); return { error: "Could not save the product." }; }
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deleteProduct(id: number) {
  await requireUser();
  await prisma.stockMovement.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  revalidatePath("/inventory");
}

export async function adjustStock(productId: number, fd: FormData) {
  const user = await requireUser();
  const delta = i(fd, "delta");
  if (!delta) redirect("/inventory");
  await prisma.stockMovement.create({ data: { productId, delta, reason: s(fd, "reason"), byId: user.id } });
  await prisma.product.update({ where: { id: productId }, data: { quantity: { increment: delta } } });
  revalidatePath("/inventory");
  redirect("/inventory");
}

// ── vendors ──
export async function saveVendor(_prev: VendorFormState, fd: FormData): Promise<VendorFormState> {
  const user = await requireUser();
  const id = i(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Vendor name is required." };
  const data = { name, businessPhone: s(fd, "businessPhone"), address: s(fd, "address"), website: s(fd, "website"), note: s(fd, "note") };
  try {
    if (id) await prisma.vendor.update({ where: { id }, data });
    else await prisma.vendor.create({ data });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "vendor", action: id ? "update" : "create" } });
  } catch (e) { console.error("saveVendor failed", e); return { error: "Could not save the vendor." }; }
  revalidatePath("/inventory/vendors");
  redirect("/inventory/vendors");
}

export async function deleteVendor(id: number) {
  await requireUser();
  await prisma.product.updateMany({ where: { vendorId: id }, data: { vendorId: null } });
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/inventory/vendors");
}
