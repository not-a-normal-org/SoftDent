// Rename the owner doctor and (re)set their login credentials.
// Usage: OWNER_NAME='Dr. ...' OWNER_USER='nayeem' OWNER_PASSWORD='...' npx tsx scripts/set-owner.ts
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const NAME = process.env.OWNER_NAME ?? "Dr. Nazmul Alam Nayeem";
const USERNAME = process.env.OWNER_USER ?? "nayeem";
const PASSWORD = process.env.OWNER_PASSWORD ?? "Nayeem#2026";

async function main() {
  // the owner doctor (isOwner) → its person → its user
  const owner = await prisma.doctor.findFirst({
    where: { isOwner: true },
    include: { person: { include: { user: true } } },
    orderBy: { id: "asc" },
  });
  if (!owner) throw new Error("No owner doctor found — run the ETL first.");

  const oldName = owner.person.fullName;
  await prisma.person.update({ where: { id: owner.personId }, data: { fullName: NAME } });

  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { personId: owner.personId },
    update: { username: USERNAME, passwordHash: hash, role: "OWNER", activeStatus: true, needsPasswordReset: false },
    create: { personId: owner.personId, username: USERNAME, passwordHash: hash, role: "OWNER", activeStatus: true, needsPasswordReset: false },
  });

  // invalidate any existing sessions for this user so the new creds take effect cleanly
  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`Owner renamed:  "${oldName}"  →  "${NAME}"`);
  console.log(`Login ready →  username: ${USERNAME}   password: ${PASSWORD}   role: OWNER`);
  console.log("Change the password after first login.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
