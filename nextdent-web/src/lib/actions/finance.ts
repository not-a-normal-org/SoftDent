"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type ExpenseFormState = { error?: string };

const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };

export async function addExpense(_prev: ExpenseFormState, fd: FormData): Promise<ExpenseFormState> {
  const user = await requireRole("OWNER");
  const amount = parseInt(s(fd, "amount") ?? "", 10);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount." };
  const dateStr = s(fd, "date");
  const date = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(+date)) return { error: "Invalid date." };

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
