// Isomorphic constants & types shared by client + server (no server-only imports).

export const GENDERS = ["Male", "Female", "Other"] as const;
// What the clinic actually records, commonest first. "Unmarried" was missing and is
// held by 480 of 1,453 patients — the picker showed those records as blank, so the
// field looked unset on a third of the register and one click would have rewritten it.
export const MARITAL = ["Married", "Unmarried", "Single", "Divorced", "Widowed"] as const;

export type PatientFormLists = {
  occupations: string[];
  relations: string[];
  doctors: { id: number; name: string }[];
  /** medical-history terms the clinic already uses, commonest first */
  medicalTerms: string[];
};
