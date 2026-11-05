"use client";

import { composeDrug, type DrugLike } from "./drug-format";

/**
 * Catalogue lookup for the browser. The drug table has 34,914 rows, so the list is
 * searched on the server and only the hits come back — the same endpoint the ℞ drug
 * picker uses, which means the usage weighting applies here too.
 */
export async function searchDrugs(q: string): Promise<string[]> {
  const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: DrugLike[] };
  return (data.results ?? []).map(composeDrug).filter(Boolean);
}
