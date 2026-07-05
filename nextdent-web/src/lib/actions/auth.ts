"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, destroySession, getCurrentUser } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user && user.activeStatus && (await verifyPassword(user.passwordHash, password));
  if (!user || !ok) {
    // uniform message — don't reveal which field was wrong
    return { error: "Invalid username or password." };
  }

  const ua = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, ua);
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "auth", action: "login" } });

  redirect("/patients"); // throws — must be outside try/catch
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await prisma.auditLog.create({ data: { actorId: user.id, entity: "auth", action: "logout" } });
  await destroySession();
  redirect("/login");
}
