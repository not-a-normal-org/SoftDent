// Labels on the printed prescription, in both languages the clinic works in.
// Only the printed furniture is translated — what the doctor typed is printed as
// typed, in whatever language they wrote it.

export type RxLang = "en" | "bn";
export const RX_LANGS: { value: RxLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা (Bangla)" },
];
export const DEFAULT_RX_LANG: RxLang = "en";

export const asRxLang = (v: string | null | undefined): RxLang =>
  v === "bn" || v === "en" ? v : DEFAULT_RX_LANG;

type Labels = {
  complaints: string; knownCase: string; onExamination: string; investigations: string;
  investigationFindings: string; diagnosis: string; treatmentPlan: string;
  treatmentDone: string; advice: string;
  drugHistory: string; name: string; sex: string; age: string; date: string; followUp: string;
};

/**
 * Bangla drafted here and still to be checked by a native clinical reader, exactly as
 * the SMS templates were — these go in a patient's hand.
 */
export const RX_LABELS: Record<RxLang, Labels> = {
  en: {
    complaints: "C/C", knownCase: "Known Case of", onExamination: "O/E",
    investigations: "Investigations", investigationFindings: "Findings on investigations",
    diagnosis: "Diagnosis",
    treatmentPlan: "Treatment Plan", treatmentDone: "Treatment Done", advice: "Advice",
    drugHistory: "Drug history", name: "Name", sex: "Sex", age: "Age", date: "Date",
    followUp: "Follow-up",
  },
  bn: {
    complaints: "প্রধান সমস্যা", knownCase: "পূর্ব রোগের ইতিহাস", onExamination: "পরীক্ষায় প্রাপ্ত",
    investigations: "পরীক্ষা-নিরীক্ষা", investigationFindings: "পরীক্ষা-নিরীক্ষার ফলাফল",
    diagnosis: "রোগ নির্ণয়",
    treatmentPlan: "চিকিৎসা পরিকল্পনা", treatmentDone: "সম্পন্ন চিকিৎসা", advice: "পরামর্শ",
    drugHistory: "ঔষধের ইতিহাস", name: "নাম", sex: "লিঙ্গ", age: "বয়স", date: "তারিখ",
    followUp: "পরবর্তী সাক্ষাৎ",
  },
};
