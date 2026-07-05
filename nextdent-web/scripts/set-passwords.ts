// Set argon2 passwords for existing users (legacy VBA hashes were not migratable).
// Usage: SEED_PASSWORD='...' npx tsx scripts/set-passwords.ts
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();
const TEMP = process.env.SEED_PASSWORD ?? "ChangeMe#2026";

async function main() {
  const users = await prisma.user.findMany({ include: { person: true } });
  if (!users.length) { console.log("No users found — run the ETL first."); return; }

  for (const u of users) {
    const hash = await argon2.hash(TEMP, { type: argon2.argon2id });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash, needsPasswordReset: false } });
    console.log(`  ✓ ${u.username.padEnd(12)} ${u.role.padEnd(12)} ${u.person.fullName}`);
  }
  console.log(`\nTemporary password for all ${users.length} users: ${TEMP}`);
  console.log("→ Change it after first login.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
