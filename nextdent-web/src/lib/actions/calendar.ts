"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function disconnectCalendar() {
  const user = await requireUser();
  await prisma.calendarConnection.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings/calendar");
}
