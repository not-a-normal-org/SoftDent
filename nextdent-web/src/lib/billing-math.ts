// Shared discount maths. Lives apart from lib/billing.ts because that module is
// server-only, and the inline billing table previews the total as the doctor types.
export const afterDiscountClient = (total: number, discountPercent: number) =>
  Math.max(0, Math.round(total * (1 - (discountPercent || 0) / 100)));
