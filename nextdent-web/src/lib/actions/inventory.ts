"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type ProductFormState = { error?: string };
export type VendorFormState = { error?: string };
export type StockFormState = { error?: string; ok?: string };

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

/**
 * Receive stock in or issue it out. The direction comes from the submitting button,
 * so one form serves both and the quantity typed is always a positive number — asking
 * staff to type a minus sign is how a receipt gets recorded as a consumption.
 *
 * Product.quantity is a running total of the StockMovement ledger, so the movement
 * row and the new total are written in one interactive transaction: the stock level
 * is re-read inside it, which is also what makes the "cannot go negative" check
 * mean anything under two people counting at once.
 */
export async function moveStock(productId: number, _prev: StockFormState, fd: FormData): Promise<StockFormState> {
  const user = await requireUser();
  const direction = s(fd, "direction") === "out" ? "out" : "in";
  const qty = i(fd, "qty");
  if (!qty || qty <= 0) return { error: "Enter a quantity above zero." };
  const reason = s(fd, "reason");
  const delta = direction === "out" ? -qty : qty;

  let result: { error?: string; quantity?: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId }, select: { quantity: true } });
      if (!p) return { error: "That product no longer exists." };
      // Nothing is written on this path, so returning early leaves the ledger alone.
      if (p.quantity + delta < 0) return { error: `Only ${p.quantity} in stock.` };

      await tx.stockMovement.create({ data: { productId, delta, reason, byId: user.id } });
      const after = await tx.product.update({ where: { id: productId }, data: { quantity: { increment: delta } }, select: { quantity: true } });
      await tx.auditLog.create({
        data: { actorId: user.id, entity: "product", entityId: String(productId), action: "stock", diff: { delta, reason, quantity: after.quantity } },
      });
      return { quantity: after.quantity };
    });
  } catch (e) {
    console.error("moveStock failed", e);
    return { error: "Could not record the stock movement." };
  }
  if (result.error) return { error: result.error };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/products/${productId}/edit`);
  // An inline control on a long table must not navigate — the row the user was
  // looking at would scroll away. The new level is reported in place instead.
  return { ok: `${delta > 0 ? "+" : ""}${delta} · ${result.quantity} in stock` };
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
