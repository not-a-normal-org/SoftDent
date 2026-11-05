import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed Middleware → Proxy. This is an OPTIMISTIC gate only:
// it checks for the session cookie's presence (edge-safe, no DB). Real session
// validation happens in the server components/actions via src/lib/auth.ts.
const SESSION_COOKIE = "nd_session"; // keep in sync with lib/auth.ts (not imported — that pulls Node-only deps)
// /api/health is public on purpose: it is the uptime probe DEPLOY.md points at, and a
// gated probe redirects to /login and reports the app healthy when the DB is down.
// It returns only {ok, db} — no patient data, no session, nothing to enumerate.
const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // run on everything except Next internals and static asset files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
