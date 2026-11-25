// Medical and drug history are stored as a bulleted run of terms — "• HTN • DM •
// Asthma" — not as prose. That is the shape the Access app wrote and the shape the
// 1,120 imported rows are already in, so the editor builds the same string rather
// than inventing a new encoding that would split the data in two.
//
// Isomorphic: the form parses and formats in the browser, the print page on the server.

/** "• HTN • DM" → ["HTN", "DM"]. Tolerates the stray newlines and "•HTN" in the data. */
export const parseTerms = (v: string | null | undefined): string[] =>
  (v ?? "")
    .split("•")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t !== "" && t !== ".");

/** ["HTN", "DM"] → "• HTN • DM". Empty list gives "", never a bare bullet. */
export const formatTerms = (terms: readonly string[]): string =>
  terms.length ? terms.map((t) => `• ${t}`).join(" ") : "";

/**
 * Seed a picker from a value that may predate the bullet encoding. Thousands of
 * imported rows hold prose, often several lines of it, and `parseTerms` would collapse
 * all of it into one chip and lose the line breaks the clinician typed. One line, one
 * term — close enough to what they meant, and it round-trips from then on.
 */
export const seedTerms = (v: string | null | undefined): string[] =>
  (v ?? "").includes("\u2022")
    ? parseTerms(v)
    : (v ?? "").split("\n").map((t) => t.trim()).filter(Boolean);

/**
 * One row as the clinician typed it \u2192 one term as stored. A "\u2022" inside a row would
 * split it in two on the next read, because it is the separator, so it goes; runs of
 * whitespace collapse, as `parseTerms` would collapse them anyway.
 */
export const cleanTerm = (t: string): string =>
  t.replace(/\u2022/g, " ").replace(/\s+/g, " ").trim();

/**
 * Editable rows \u2192 "\u2022 A \u2022 B". A row left empty is dropped, and so is a lone ".", which
 * `parseTerms` throws away too \u2014 so what is saved reads back as exactly these rows.
 */
export const formatRows = (rows: readonly string[]): string =>
  formatTerms(rows.map(cleanTerm).filter((t) => t !== "" && t !== "."));

/**
 * What a term picker posts: the stored value byte for byte while its rows still say
 * what they said when the form opened, and the rows reformatted only once edited.
 *
 * Reformatting on every save would rewrite records nobody touched. A good share of the
 * imported bullets are not in `formatTerms`'s exact shape \u2014 "\u2022HTN\r\n\r\n \u2022DM",
 * "\u2022 HTN  \u2022 CABG": 1,365 of the stored values in Nov 2026 \u2014 so opening a prescription
 * and saving it unchanged used to rewrite them, and on a patient's history it logged a
 * new version for an edit nobody made. Old prose stays prose for the same reason, until
 * a row of it is changed.
 */
export const termsToPost = (original: string | null | undefined, rows: readonly string[]): string => {
  const now = formatRows(rows);
  return now === formatRows(seedTerms(original)) ? (original ?? "") : now;
};

/**
 * A drug the patient is already taking: what it is, how long they have been on it,
 * and since when.
 */
export type DrugHistoryRow = { drug: string; duration: string; since: string };

/**
 * Each row is one bullet, its parts joined by an em dash: the drug names in this
 * catalog are full of "+", "/" and "mg", but none contain " — ", so it round-trips.
 * The eleven rows already in the database are bare drug names and parse as
 * drug-only, which is why this reads the parts positionally instead of requiring
 * all three.
 */
const PART = " — ";
const SINCE = /^since\s+/i;

export const parseDrugHistory = (v: string | null | undefined): DrugHistoryRow[] =>
  parseTerms(v).map((term) => {
    const parts = term.split(PART).map((x) => x.trim());
    const [drug = "", second = "", third = ""] = parts;
    // `formatDrugHistory` omits empty parts, so two parts are either drug+duration
    // or drug+since. Reading them positionally put "since 2019" in the Duration box;
    // the "since " prefix is what tells them apart, and no duration carries it.
    if (parts.length === 2 && SINCE.test(second)) {
      return { drug, duration: "", since: second.replace(SINCE, "") };
    }
    return { drug, duration: second, since: third.replace(SINCE, "") };
  });

export const formatDrugHistory = (rows: readonly DrugHistoryRow[]): string =>
  formatTerms(
    rows
      .map((r) => ({ drug: cleanTerm(r.drug), duration: cleanTerm(r.duration), since: cleanTerm(r.since) }))
      .filter((r) => r.drug)
      .map((r) => [r.drug, r.duration, r.since && `since ${r.since}`].filter(Boolean).join(PART))
  );

/** `termsToPost` for drug history: an untouched list goes back exactly as it came. */
export const drugHistoryToPost = (
  original: string | null | undefined,
  rows: readonly DrugHistoryRow[]
): string => {
  const now = formatDrugHistory(rows);
  return now === formatDrugHistory(parseDrugHistory(original)) ? (original ?? "") : now;
};
