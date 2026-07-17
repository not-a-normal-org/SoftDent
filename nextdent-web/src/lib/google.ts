import "server-only";
import { prisma } from "./prisma";

// One app-level Google OAuth registration (set by the admin in env) powers per-user connections.
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => `${process.env.APP_URL ?? "http://localhost:3300"}/api/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "openid email https://www.googleapis.com/auth/calendar.events",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  return res.json() as Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string }>;
}

// pull the email out of the OIDC id_token (no verification needed — it came straight from Google over TLS)
export function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64").toString("utf8"));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export const getCalendarConnection = (userId: number) => prisma.calendarConnection.findUnique({ where: { userId } });
