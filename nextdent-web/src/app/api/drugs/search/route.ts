import { NextResponse } from "next/server";
import { searchDrugs } from "@/lib/prescriptions";

// type-ahead endpoint over the 46k-drug catalog: GET /api/drugs/search?q=...
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await searchDrugs(q, 15);
    return NextResponse.json({ results });
  } catch (e) {
    console.error("drug search failed", e);
    return NextResponse.json({ results: [], error: "search_failed" }, { status: 500 });
  }
}
