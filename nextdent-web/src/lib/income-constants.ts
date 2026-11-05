// Isomorphic: shared by the form (client) and the action (server).

/**
 * Money the clinic books that is not a patient payment. Expense categories come from
 * the editable `ExpenseCategory` lookup and accept custom values; income does not —
 * the owner records exactly these two, and a closed list is what keeps the monthly
 * figures comparable instead of accumulating near-duplicate spellings.
 */
export const INCOME_CATEGORIES = ["Re-investment", "Professional training"] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const DEFAULT_INCOME_CATEGORY: IncomeCategory = "Re-investment";

/** The form is not trusted: a category outside the list is rejected, not stored. */
export const isIncomeCategory = (v: string | null | undefined): v is IncomeCategory =>
  (INCOME_CATEGORIES as readonly string[]).includes((v ?? "").trim());
