import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { suggestAddresses } from "@/lib/places";

// GET /api/places/autocomplete?q=...&s=<session token>
// Every call here is billed by Google, so it checks the session itself rather than
// relying only on the sign-in gate in proxy.ts, and bounds what it will forward.
export async function GET(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ results: [] }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 200) return NextResponse.json({ results: [] });

  // A session token is a UUID minted by the field; anything else is dropped rather
  // than forwarded, so arbitrary text never reaches Google's request.
  const s = params.get("s") ?? "";
  const session = /^[0-9a-f-]{36}$/i.test(s) ? s : undefined;

  return NextResponse.json({ results: await suggestAddresses(q, session) });
}
