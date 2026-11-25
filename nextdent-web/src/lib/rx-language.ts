// Labels on the printed prescription, in both languages the clinic works in.
// Only the printed furniture is translated — what the doctor typed is printed as
// typed, in whatever language they wrote it.

import type { RxFieldKey } from "./rx-fields";

export type RxLang = "en" | "bn";
export const RX_LANGS: { value: RxLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা (Bangla)" },
];
export const DEFAULT_RX_LANG: RxLang = "en";

export const asRxLang = (v: string | null | undefined): RxLang =>
  v === "bn" || v === "en" ? v : DEFAULT_RX_LANG;

/** The clinical fields that print as headings in the notes column, in RX_FIELDS order. */
export type RxNoteKey = Exclude<RxFieldKey, "advise" | "followUpReason">;

type Labels = Record<RxNoteKey, string> & {
  advice: string; followUp: string; name: string; sex: string; age: string; date: string;
};

/**
 * The English headings follow the clinic's own marked-up stationery (Nov 2026): one
 * heading per field the editor has, in the consultant's order of consultation, in
 * place of the old grouped C/C, Known Case of, O/E, Investigations, Diagnosis and
 * Treatment Done. Where the mark-up used ditto marks ("Investigation ″") the wording
 * is the editor's own label for that field.
 *
 * Bangla drafted here and still to be checked by a native clinical reader, exactly as
 * the SMS templates were — these go in a patient's hand.
 */
export const RX_LABELS: Record<RxLang, Labels> = {
  en: {
    complaints: "Chief Complaint",
    medicalHistory: "Medical History",
    drugHistory: "Drug History",
    findingsOnExamination: "Findings on Examination",
    provisionalDiagnosis: "Provisional Diagnosis",
    differentialDiagnosis: "Differential Diagnosis",
    investigationAdvised: "Investigation Advised",
    investigationInterpretation: "Findings on Investigation",
    confirmatoryDiagnosis: "Confirmatory Diagnosis",
    treatmentPlan: "Treatment Plan",
    procedurePerformed: "Procedure Performed",
    advice: "Advice", followUp: "Follow-up",
    name: "Name", sex: "Sex", age: "Age", date: "Date",
  },
  bn: {
    complaints: "প্রধান সমস্যা",
    medicalHistory: "পূর্ব রোগের ইতিহাস",
    drugHistory: "ঔষধের ইতিহাস",
    findingsOnExamination: "পরীক্ষায় প্রাপ্ত",
    provisionalDiagnosis: "প্রাথমিক রোগ নির্ণয়",
    differentialDiagnosis: "পার্থক্যমূলক রোগ নির্ণয়",
    investigationAdvised: "পরীক্ষা-নিরীক্ষা",
    investigationInterpretation: "পরীক্ষা-নিরীক্ষার ফলাফল",
    confirmatoryDiagnosis: "নিশ্চিত রোগ নির্ণয়",
    treatmentPlan: "চিকিৎসা পরিকল্পনা",
    procedurePerformed: "সম্পন্ন চিকিৎসা",
    advice: "পরামর্শ", followUp: "পরবর্তী সাক্ষাৎ",
    name: "নাম", sex: "লিঙ্গ", age: "বয়স", date: "তারিখ",
  },
};
