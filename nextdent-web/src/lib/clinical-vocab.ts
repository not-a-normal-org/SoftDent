import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { seedTerms } from "./history-terms";

/**
 * The medical-history vocabulary, built from what the clinic has actually written
 * rather than from a textbook list: every term already used on a patient record or
 * a prescription, plus the legacy Rx "sider" pick-list the Access app offered.
 *
 * Ordered by how often each term appears, so NAD, HTN, DM and Asthma — which cover
 * most of the 1,120 recorded histories — are the first things in the list.
 *
 * `cache` dedupes this within a request; it is a handful of indexed scans and the
 * result is small, but a form that renders several of these should not repeat it.
 */

/**
 * One stored value → the condition names it offers.
 *
 * Split on lines first: 101 of the 932 prescription histories hold CRLFs, and 18 have
 * no bullet at all, so `parseTerms` alone glued whole paragraphs into one "term" —
 * the worst was a 109-character run of three drug lines. `seedTerms` then handles
 * each line, bulleted or not.
 */
const candidateTerms = (raw: string | null): string[] =>
  (raw ?? "")
    .split(/\r?\n/)
    .flatMap(seedTerms)
    // the Access pick-list was "Asthma Since ____"; imported unfilled it leaves a
    // dangling "Since". Strip it rather than drop the row, or 40 real conditions
    // (Epilepsy, Hemophilia, Glaucoma…) would vanish from the list.
    .map((t) => t.replace(/\s+since\s*:?$/i, "").trim())
    .filter(Boolean);

// Longest term the clinic has ever repeated is 29 characters; past 40 it is a
// sentence about one patient, not a condition.
const MAX_LEN = 40;
// A long phrase nobody has typed twice is free text ("Trauma to lower jaw 15 days
// back"). Short one-offs are kept — real abbreviations often appear exactly once.
const ONE_OFF_LEN = 24;

const plausible = (label: string, n: number, curated: boolean): boolean =>
  /[a-z]/i.test(label) && // drops the stray "." the Access export left behind
  !label.endsWith(":") && // "Drug History:" is a heading, not a condition
  label.length <= MAX_LEN &&
  (curated || n > 1 || label.length <= ONE_OFF_LEN);

export const medicalHistoryTerms = cache(async (): Promise<string[]> => {
  const [patients, rxs, snippets] = await Promise.all([
    prisma.patient.findMany({ where: { medicalHistory: { not: null } }, select: { medicalHistory: true } }),
    prisma.prescription.findMany({ where: { medicalHistory: { not: null } }, select: { medicalHistory: true } }),
    prisma.rxSnippet.findMany({ where: { medicalHistory: { not: null } }, select: { medicalHistory: true } }),
  ]);

  const freq = new Map<string, { label: string; n: number; curated: boolean }>();
  const add = (raw: string | null, weight: number, curated = false) => {
    for (const t of candidateTerms(raw)) {
      // fold case so "HTN" and "htn" are one entry; the commonest spelling wins
      const k = t.toLowerCase();
      const cur = freq.get(k);
      if (cur) {
        cur.n += weight;
        cur.curated ||= curated;
      } else freq.set(k, { label: t, n: weight, curated });
    }
  };
  for (const r of patients) add(r.medicalHistory, 1);
  for (const r of rxs) add(r.medicalHistory, 1);
  // the curated pick-list ranks above one-off typed entries even though it is unused;
  // it is also exempt from the one-off rule — it was authored as condition names
  for (const r of snippets) add(r.medicalHistory, 0.5, true);

  return [...freq.values()]
    .filter((x) => plausible(x.label, x.n, x.curated))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .map((x) => x.label);
});
