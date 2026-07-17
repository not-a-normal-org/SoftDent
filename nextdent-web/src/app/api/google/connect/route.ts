import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { googleConfigured, googleAuthUrl } from "@/lib/google";

export async function GET() {
  const user = await requireUser();
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/settings/calendar?err=config", process.env.APP_URL ?? "http://localhost:3300"));
  }
  // state ties the callback to this user (hardening: swap for a signed nonce in production)
  return NextResponse.redirect(googleAuthUrl(String(user.id)));
}
