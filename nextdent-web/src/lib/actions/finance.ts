"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { fromDateInput } from "@/lib/format";
import { isIncomeCategory } from "@/lib/income-constants";

export type FinanceFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };

/**
 * Amount and date are the two fields both forms share, and both can arrive malformed.
 *
 * Taka are whole units here, and `parseInt` does not reject a non-integer, it truncates
 * one: "100.75" booked ৳100, "500abc" ৳500, "1e3" ৳1, "1,500" ৳1. A wrong number saved
 * silently is worse than a rejected form, so anything but digits is an error.
 */
function money(fd: FormData): { amount: number } | { error: string } {
  const raw = s(fd, "amount");
  if (!raw) return { error: "Enter an amount." };
  const digits = raw.replace(/[\s,]/g, ""); // "1,500" and "1 500" are the same ৳1500
  if (!/^\d+$/.test(digits)) return { error: `“${raw}” is not a whole amount — enter taka in digits only, e.g. 1500.` };
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return { error: "That amount is too large." };
  if (n === 0) return { error: "Enter an amount greater than zero." };
  return { amount: n };
}

export async function addExpense(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await requireRole("OWNER");
  const parsed = money(fd);
  if ("error" in parsed) return { error: parsed.error };
  const amount = parsed.amount;
  const dateStr = s(fd, "date");
  const date = dateStr ? fromDateInput(dateStr) : new Date();
  if (!date) return { error: "Invalid date." };

  try {
    await prisma.expense.create({
      data: { date, category: s(fd, "category"), description: s(fd, "description"), amount, createdById: user.id },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "expense", action: "create" } });
  } catch (e) {
    console.error("addExpense failed", e);
    return { error: "Could not save the expense." };
  }

  revalidatePath("/finance");
  redirect("/finance");
}

export async function deleteExpense(id: number) {
  const user = await requireRole("OWNER");
  await prisma.expense.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "expense", entityId: String(id), action: "delete" } });
  revalidatePath("/finance");
}

export async function addIncome(_prev: FinanceFormState, fd: FormData): Promise<FinanceFormState> {
  const user = await requireRole("OWNER");
  const parsed = money(fd);
  if ("error" in parsed) return { error: parsed.error };
  const amount = parsed.amount;
  const dateStr = s(fd, "date");
  const date = dateStr ? fromDateInput(dateStr) : new Date();
  if (!date) return { error: "Invalid date." };
  const category = s(fd, "category");
  if (!isIncomeCategory(category)) return { error: "Choose an income category." };

  try {
    await prisma.income.create({
      data: { date, category, description: s(fd, "description"), amount, createdById: user.id },
    });
    await prisma.auditLog.create({ data: { actorId: user.id, entity: "income", action: "create" } });
  } catch (e) {
    console.error("addIncome failed", e);
    return { error: "Could not save the income." };
  }

  revalidatePath("/finance");
  redirect("/finance");
}

export async function deleteIncome(id: number) {
  const user = await requireRole("OWNER");
  await prisma.income.delete({ where: { id } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "income", entityId: String(id), action: "delete" } });
  revalidatePath("/finance");
}
