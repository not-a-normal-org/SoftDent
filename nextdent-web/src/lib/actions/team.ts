"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import type { Role } from "@prisma/client";

export type StaffFormState = { error?: string };

const ROLES: Role[] = ["OWNER", "DOCTOR", "RECEPTIONIST", "ASSISTANT"];
const s = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : v; };
const i = (fd: FormData, k: string) => { const v = s(fd, k); const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : null; };
const f = (fd: FormData, k: string, dflt: number) => { const v = s(fd, k); const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) ? n : dflt; };
const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";

export async function saveStaff(_prev: StaffFormState, fd: FormData): Promise<StaffFormState> {
  const actor = await requireRole("OWNER");

  const id = i(fd, "id");
  const fullName = s(fd, "fullName");
  if (!fullName) return { error: "Full name is required." };

  const personData = {
    fullName,
    nickName: s(fd, "nickName"),
    primaryPhone: s(fd, "primaryPhone"),
    email: s(fd, "email"),
    activeStatus: b(fd, "activeStatus"),
  };

  const username = s(fd, "username");
  const password = s(fd, "password");
  const roleRaw = s(fd, "role");
  const role: Role = (ROLES as string[]).includes(roleRaw ?? "") ? (roleRaw as Role) : "RECEPTIONIST";
  const isDoctor = b(fd, "isDoctor");

  try {
    // person
    const personId = id
      ? (await prisma.person.update({ where: { id }, data: personData })).id
      : (await prisma.person.create({ data: personData })).id;

    // login account
    if (username) {
      const existing = await prisma.user.findUnique({ where: { personId } });
      const taken = await prisma.user.findFirst({ where: { username, personId: { not: personId } } });
      if (taken) return { error: `Username “${username}” is already taken.` };
      if (!existing && !password) return { error: "Set a password for the new login." };
      const pwd = password ? { passwordHash: await hashPassword(password), needsPasswordReset: false } : {};
      await prisma.user.upsert({
        where: { personId },
        update: { username, role, activeStatus: personData.activeStatus, ...pwd },
        create: { personId, username, role, activeStatus: personData.activeStatus, passwordHash: (pwd as { passwordHash?: string }).passwordHash ?? "" },
      });
    }

    // doctor profile + revenue contract
    if (isDoctor) {
      const contract = {
        degree: s(fd, "degree"), designation1: s(fd, "designation"), regNo: s(fd, "regNo"),
        consultantSharePct: f(fd, "consultantSharePct", 20),
        operatorSharePct: f(fd, "operatorSharePct", 40),
        deductLabBeforeSplit: b(fd, "deductLabBeforeSplit"),
      };
      await prisma.doctor.upsert({
        where: { personId },
        update: contract,
        create: { personId, isOwner: false, activeStatus: "Active", ...contract },
      });
    }

    await prisma.auditLog.create({ data: { actorId: actor.id, entity: "staff", entityId: String(personId), action: id ? "update" : "create" } });
  } catch (e) {
    console.error("saveStaff failed", e);
    return { error: "Could not save the staff member." };
  }

  revalidatePath("/team");
  redirect("/team");
}

export async function setStaffActive(personId: number, active: boolean) {
  await requireRole("OWNER");
  await prisma.person.update({ where: { id: personId }, data: { activeStatus: active } });
  await prisma.user.updateMany({ where: { personId }, data: { activeStatus: active } });
  revalidatePath("/team");
}
