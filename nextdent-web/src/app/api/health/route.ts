import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Liveness/readiness probe: verifies the app is up and the DB is reachable.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
