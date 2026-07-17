import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleConfigured, exchangeCode, emailFromIdToken } from "@/lib/google";

export async function GET(request: Request) {
  const user = await requireUser();
  const base = process.env.APP_URL ?? "http://localhost:3300";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!googleConfigured() || !code || state !== String(user.id)) {
    return NextResponse.redirect(new URL("/settings/calendar?err=oauth", base));
  }

  try {
    const tok = await exchangeCode(code);
    if (!tok.access_token) throw new Error("no access token");
    const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null;
    const data = {
      googleEmail: emailFromIdToken(tok.id_token),
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? undefined,
      expiresAt,
    };
    await prisma.calendarConnection.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return NextResponse.redirect(new URL("/settings/calendar?ok=1", base));
  } catch (e) {
    console.error("google callback failed", e);
    return NextResponse.redirect(new URL("/settings/calendar?err=oauth", base));
  }
}
