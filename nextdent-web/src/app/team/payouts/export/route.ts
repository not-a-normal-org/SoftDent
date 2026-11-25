import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { normalizeRange, type Granularity } from "@/lib/payout-period";
import { parseMember } from "@/lib/payouts";
import { buildPayoutCsv } from "@/lib/payouts-export";

const BYS: readonly Granularity[] = ["month", "day", "year"];

// GET /team/payouts/export?from=&to=&kind=summary|detail&by=month|day|year&member=all|<doctor id>
// The same OWNER-only check as the payouts page: requireRole redirects anyone else to
// /login or away, so the file is never built for them.
export async function GET(request: NextRequest) {
  await requireRole("OWNER");
  const sp = request.nextUrl.searchParams;
  const range = normalizeRange(sp.get("from"), sp.get("to"));
  const kind = sp.get("kind") === "detail" ? "detail" : "summary";
  const by = BYS.find((b) => b === sp.get("by")) ?? "month";
  const member = parseMember(sp.get("member")) ?? "all";

  const { filename, csv } = await buildPayoutCsv({ range, kind, by, member });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // payroll figures: never kept by a browser or proxy cache
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
