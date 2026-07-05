import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomBytes, createHash } from "crypto";
import argon2 from "argon2";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "nd_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── password hashing ──
export const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash: string, pw: string) =>
  hash ? argon2.verify(hash, pw).catch(() => false) : Promise.resolve(false);

// opaque token in cookie; only its sha-256 hash is stored in the DB
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number, userAgent?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, userAgent } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // must be false on localhost http
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: number;
  username: string;
  role: Role;
  name: string;
};

// Resolve the logged-in user for this request (memoized per render).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { person: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.activeStatus) return null;

  const u = session.user;
  return { id: u.id, username: u.username, role: u.role, name: u.person.fullName };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/patients?forbidden=1");
  return user;
}
