// Isomorphic constants & types shared by client + server (no server-only imports).

export const GENDERS = ["Male", "Female", "Other"] as const;
export const MARITAL = ["Single", "Married", "Divorced", "Widowed"] as const;

export type PatientFormLists = {
  occupations: string[];
  relations: string[];
  doctors: { id: number; name: string }[];
};
