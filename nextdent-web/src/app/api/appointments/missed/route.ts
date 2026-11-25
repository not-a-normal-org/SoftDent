import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMissed, MISSED_SORTS, OPEN_STATUS_KEYS, type MissedSort } from "@/lib/appointments";
import type { StatusKey } from "@/lib/appointment-constants";
import { clinicToday, parseRange } from "@/lib/date-range";

const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | null =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : null;

/**
 * The full missed-appointments list for the dialog on /appointments:
 * GET /api/appointments/missed?q=&from=&to=&doctor=&status=&sort=&dir=&page=
 * No from/to means any date. Every param is checked against a whitelist or parsed as
 * a number; anything else falls back to the default rather than erroring.
 */
export async function GET(request: Request) {
  // The proxy only checks that a session cookie exists. Patient names and phones are
  // behind this, so the session itself is verified here, as the pages do.
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const from = sp.get("from") ?? undefined, to = sp.get("to") ?? undefined;
  const doctor = Number.parseInt(sp.get("doctor") ?? "", 10);
  try {
    const result = await listMissed({
      q: (sp.get("q") ?? "").slice(0, 100),
      range: from || to ? parseRange({ from, to }, clinicToday()) : null,
      doctorId: Number.isFinite(doctor) && doctor > 0 ? doctor : null,
      status: pick<StatusKey>(sp.get("status"), OPEN_STATUS_KEYS),
      sort: pick<MissedSort>(sp.get("sort"), MISSED_SORTS) ?? "date",
      dir: sp.get("dir") === "asc" ? "asc" : "desc",
      page: Number.parseInt(sp.get("page") ?? "1", 10) || 1,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("missed appointments failed", e);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
