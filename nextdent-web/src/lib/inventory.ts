import "server-only";
import { prisma } from "./prisma";

/** How many rows /inventory will render; the catalogue is ~470 items and growing. */
export const PRODUCT_PAGE_SIZE = 150;

export type ProductFilter = { q?: string; category?: string; low?: boolean };

export async function listProducts(filter: ProductFilter = {}) {
  const q = filter.q?.trim();
  const products = await prisma.product.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    },
    orderBy: { name: "asc" },
    include: { vendor: { select: { name: true } } },
  });
  const rows = products.map((p) => ({ ...p, lowStock: p.quantity <= p.reorderLevel, outOfStock: p.quantity <= 0 }));
  // "at or below reorderLevel" compares two columns of the same row, which a Prisma
  // where clause cannot express. Filtering here instead of dropping to raw SQL keeps
  // one query shape for every filter combination.
  const matched = filter.low ? rows.filter((p) => p.lowStock) : rows;
  return { rows: matched.slice(0, PRODUCT_PAGE_SIZE), total: matched.length };
}

/** Totals for the whole catalogue, not the filtered view — the header always shows these. */
export async function inventoryStats() {
  const rows = await prisma.product.findMany({ select: { quantity: true, reorderLevel: true, unitPrice: true } });
  return {
    total: rows.length,
    low: rows.filter((r) => r.quantity <= r.reorderLevel).length,
    // Counted apart from `low` because the seeded catalogue starts at quantity 0 with
    // no reorder level, which makes almost everything technically "low". Splitting the
    // two tells the owner what has run out from what is merely getting thin.
    out: rows.filter((r) => r.quantity <= 0).length,
    // Integer taka throughout, so this stays exact.
    value: rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0),
  };
}

export async function getProduct(id: number, movementLimit = 50) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { movements: { orderBy: { at: "desc" }, take: movementLimit }, vendor: { select: { name: true } } },
  });
  if (!product) return null;

  // StockMovement.byId is a plain Int, not a User relation, so "who moved it" has to
  // be resolved in a second query rather than joined.
  const actorIds = [...new Set(product.movements.map((m) => m.byId).filter((x): x is number => x != null))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true, person: { select: { fullName: true } } } })
    : [];
  const nameById = new Map(actors.map((u) => [u.id, u.person.fullName || u.username]));

  return {
    ...product,
    lowStock: product.quantity <= product.reorderLevel,
    movements: product.movements.map((m) => ({ ...m, by: m.byId == null ? null : nameById.get(m.byId) ?? null })),
  };
}

export const listVendors = () => prisma.vendor.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
export const getVendor = (id: number) => prisma.vendor.findUnique({ where: { id } });

export async function getInventoryEditorData() {
  const [categories, used, vendors] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.product.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // The legacy Access import filed products under categories nobody added to the
  // lookup list, and a filter that cannot offer them cannot find them.
  const names = new Set([...categories.map((c) => c.name), ...used.map((u) => u.category!)]);
  return { categories: [...names].sort((a, b) => a.localeCompare(b)), vendors };
}
