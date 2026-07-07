import "server-only";
import { prisma } from "./prisma";

export async function listProducts() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" }, include: { vendor: { select: { name: true } } } });
  return products.map((p) => ({ ...p, lowStock: p.quantity <= p.reorderLevel }));
}

export const getProduct = (id: number) => prisma.product.findUnique({ where: { id }, include: { movements: { orderBy: { at: "desc" }, take: 10 } } });

export const listVendors = () => prisma.vendor.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
export const getVendor = (id: number) => prisma.vendor.findUnique({ where: { id } });

export async function getInventoryEditorData() {
  const [categories, vendors] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories: categories.map((c) => c.name), vendors };
}
