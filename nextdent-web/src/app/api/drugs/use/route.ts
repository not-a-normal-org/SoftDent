import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordDrugUse } from "@/lib/prescriptions";

// POST /api/drugs/use { id } — records that a drug was picked, weighting the
// type-ahead towards what this clinic actually prescribes. Fire-and-forget.
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = Number((body as { id?: unknown } | null)?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await recordDrugUse(id);
  } catch (e) {
    // a stale id must never break picking the drug in the editor, but don't claim
    // the weight was recorded when it wasn't
    console.error("drug use tracking failed", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
