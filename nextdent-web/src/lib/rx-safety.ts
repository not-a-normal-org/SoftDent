/**
 * Formatting rules for anything that appears on a printed prescription.
 *
 * These are not cosmetic. Each one maps to a documented misreading that has caused
 * real overdoses, from the ISMP List of Error-Prone Abbreviations, Symbols and Dose
 * Designations (2024) and the ISMP Guidelines for Safe Electronic Communication of
 * Medication Information (2019):
 *
 *   "1.0 mg"        → read as 10 mg when the decimal point is lost to a fax,
 *                     photocopy or a dirty print head. Ten-fold overdose.
 *   ".5 mg"         → read as 5 mg for the same reason. Ten-fold overdose.
 *   "4U"            → read as 40 or 44 units.
 *   "µg"            → read as mg. Thousand-fold overdose.
 *   "cc"            → read as "u" (units).
 *   "propranolol20" → read as "propranolol 120".
 *
 * Deliberately conservative: each rule rewrites only what it is certain about and
 * leaves everything else untouched. A prescription is not the place to guess.
 *
 * Note the ISMP dagger convention — a number of their entries are flagged as risks
 * "mostly in handwritten communications". Those are not enforced here, because this
 * output is printed from structured data. That is why "১+০+১" is left alone: ISMP
 * flags "+" as mistakable for a 4, but only in handwriting, and the notation is
 * universally read in Bangladesh.
 */

/**
 * Unit spellings that are dangerous when abbreviated.
 *
 * Order matters: the digit-adjacent form of each unit must come before the standalone
 * form, otherwise "50µg" is rewritten to "50mcg" by the standalone rule and never gets
 * its separating space. Likewise "5cc" needs an explicit digit-adjacent rule, because
 * \bcc\b finds no word boundary between "5" and "c".
 */
const UNIT_FIXES: [RegExp, string][] = [
  // international units / units — only attached to a number or standing alone, so a
  // drug name containing a capital U is never mangled.
  [/(\d)\s*IU\b/g, "$1 units"],
  [/\bIU\b/g, "units"],
  [/(\d)\s*U\b/g, "$1 units"],
  // micrograms: µ and μ are different codepoints, and "ug" is the ASCII stand-in
  [/(\d)\s*[µμ]g\b/g, "$1 mcg"],
  [/(\d)\s*ug\b/g, "$1 mcg"],
  [/\B[µμ]g\b/g, "mcg"],
  [/\bug\b/g, "mcg"],
  // volume: cc reads as "u"; lowercase ml/l are ISMP-flagged in favour of mL/L
  [/(\d)\s*cc\b/g, "$1 mL"],
  [/\bcc\b/g, "mL"],
  [/(\d)\s*ml\b/g, "$1 mL"],
  [/\bml\b/g, "mL"],
  [/(\d)\s*l\b/g, "$1 L"],
];

/** Frequency abbreviations ISMP bans outright, mapped to what should be printed. */
const FREQUENCY_FIXES: [RegExp, string][] = [
  [/\bQD\b/gi, "daily"],
  [/\bQ\.?D\.?\b/g, "daily"],
  [/\bQOD\b/gi, "every other day"],
  [/\bOD\b/g, "daily"], // OD also means "right eye" — never safe as "once daily"
  [/\bTIW\b/gi, "3 times a week"],
  [/\bBIW\b/gi, "2 times a week"],
  [/\bSC\b/g, "SUBQ"],
  [/\bSQ\b/g, "SUBQ"],
  [/\bsub\s?q\b/gi, "SUBQ"],
];

/**
 * Fix decimal notation: strip trailing zeros after a decimal point and add a leading
 * zero to naked decimals. Applied only to numbers, never to text.
 */
export function fixDecimals(text: string): string {
  return (
    text
      // ".5" → "0.5". Uses a replacer rather than "$10.$2", which is ambiguous between
      // capture group 10 and group 1 followed by a literal zero.
      .replace(/(^|[^\d.])\.(\d)/g, (_m, before, digit) => `${before}0.${digit}`)
      // "1.0" → "1", "2.50" → "2.5". Keeps meaningful precision, drops the dangerous
      // trailing zero that is read as another digit when the point is lost.
      // "0.05" is left alone — those zeros are significant.
      .replace(/(\d+)\.(\d*?)0+\b/g, (_m, whole, frac) => (frac ? `${whole}.${frac}` : whole))
  );
}

/**
 * Insert a space where a dose has run into the drug name ("propranolol20mg" →
 * "propranolol 20 mg").
 *
 * Only splits when the digits are followed by a unit. Splitting on any letter-digit
 * boundary would wreck names where the number *is* the name — B12, D3, K2 — which is
 * worse than the problem it fixes.
 */
export function separateDoseFromName(text: string): string {
  return text
    // amoxicillin500 mg → amoxicillin 500 mg   (but B12 stays B12)
    .replace(/([a-zA-Zঀ-৿])(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|mL|g|units?|IU)\b)/g, "$1 $2")
    // 500mg → 500 mg
    .replace(/(\d)\s*(mg|mcg|mL|L|g|units?|IU)\b/gi, "$1 $2");
}

/**
 * Normalise a drug/dose string for printing. Safe to run repeatedly — every rule is
 * idempotent, so re-formatting stored text does not compound changes.
 */
export function formatRxText(input: string | null | undefined): string {
  if (!input) return "";
  let out = String(input);
  // Units first: spacing depends on units already being in their final spelling.
  for (const [re, to] of UNIT_FIXES) out = out.replace(re, to);
  for (const [re, to] of FREQUENCY_FIXES) out = out.replace(re, to);
  out = separateDoseFromName(out);
  out = fixDecimals(out);
  // collapse any double spaces the substitutions introduced
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

export type RxWarning = { field: string; text: string; why: string };

/**
 * Report anything still risky *without* rewriting it, for display to the prescriber.
 * Formatting fixes what it can prove; this flags what needs a human decision.
 */
export function checkRxText(field: string, input: string | null | undefined): RxWarning[] {
  if (!input) return [];
  const text = String(input);
  const out: RxWarning[] = [];

  if (/\d\.\d*0\b/.test(text))
    out.push({ field, text, why: "Trailing zero — “1.0 mg” is read as 10 mg if the decimal is lost." });
  if (/(^|[^\d.])\.\d/.test(text))
    out.push({ field, text, why: "Naked decimal — “.5 mg” is read as 5 mg. Write “0.5 mg”." });
  if (/(\d\s*U\b|\bIU\b)/.test(text))
    out.push({ field, text, why: "“U” is read as 0 or 4. Write “units”." });
  if (/[µμ]g\b/.test(text))
    out.push({ field, text, why: "“µg” is read as mg — a thousand-fold error. Write “mcg”." });
  if (/\bcc\b/.test(text))
    out.push({ field, text, why: "“cc” is read as “u”. Write “mL”." });
  if (/\b(QD|QOD|OD|TIW|BIW)\b/i.test(text))
    out.push({ field, text, why: "Banned frequency abbreviation — spell it out." });
  if (/\b1\/2\b/.test(text))
    out.push({ field, text, why: "“1/2” is read as 1 or 2. Write “half”." });
  if (/\bx\s?\d/i.test(text))
    out.push({ field, text, why: "“x3” is ambiguous between dose and duration. Write “for 3 days”." });

  return out;
}
