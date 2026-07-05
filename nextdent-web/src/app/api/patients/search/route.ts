import { NextResponse } from "next/server";
import { searchPatients } from "@/lib/patients";

// type-ahead endpoint: GET /api/patients/search?q=...
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await searchPatients(q, 20);
    return NextResponse.json({ results });
  } catch (e) {
    console.error("patient search failed", e);
    return NextResponse.json({ results: [], error: "search_failed" }, { status: 500 });
  }
}
