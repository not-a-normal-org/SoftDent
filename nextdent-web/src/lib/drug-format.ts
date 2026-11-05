// How a drug is written on a prescription line: "TAB. Napa 500 mg".
// Shared so drug history reads identically to the ℞ lines — the imported history
// rows are already in this exact shape ("TAB. Clopid AS 75 mg + 75 mg").
export type DrugLike = {
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
};

export function composeDrug(d: DrugLike): string {
  const form = d.dosageForm ? `${d.dosageForm}. ` : "";
  const name = d.brandName ?? d.genericName ?? "";
  const strength = d.strength ? ` ${d.strength}` : "";
  // 623 catalogue rows hold a double space ("Lopirel   PLUS"). `parseTerms` collapses
  // whitespace when reading history back, so a drug stored verbatim stopped matching
  // the catalogue entry it came from; collapse on the way in too and both sides agree.
  return `${form}${name}${strength}`.replace(/\s+/g, " ").trim();
}
