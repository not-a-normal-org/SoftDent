// The clinical fields of a prescription, in the order they are written and read.
// Shared so the editor, the patient profile and anything else that lists them stay
// in step — the profile used to show two of these and silently drop the other nine.
//
// The order is the consultant's own "chronology of headings": it is the sequence a
// consultation actually happens in, complaint through follow-up, so the form reads
// top to bottom the way the examination goes.

export type RxFieldKey =
  | "complaints"
  | "medicalHistory"
  | "drugHistory"
  | "findingsOnExamination"
  | "provisionalDiagnosis"
  | "differentialDiagnosis"
  | "investigationAdvised"
  | "investigationInterpretation"
  | "confirmatoryDiagnosis"
  | "treatmentPlan"
  | "procedurePerformed"
  | "advise"
  | "followUpReason";

export type RxField = { key: RxFieldKey; label: string; full?: boolean };

export const RX_FIELDS: RxField[] = [
  { key: "complaints", label: "Chief complaints", full: true },
  { key: "medicalHistory", label: "Medical history", full: true },
  { key: "drugHistory", label: "Drug history", full: true },
  { key: "findingsOnExamination", label: "Findings on examination", full: true },
  { key: "provisionalDiagnosis", label: "Provisional diagnosis", full: true },
  { key: "differentialDiagnosis", label: "Differential diagnosis", full: true },
  { key: "investigationAdvised", label: "Investigation advised" },
  { key: "investigationInterpretation", label: "Findings on investigations" },
  { key: "confirmatoryDiagnosis", label: "Confirmatory diagnosis", full: true },
  { key: "treatmentPlan", label: "Treatment plan", full: true },
  { key: "procedurePerformed", label: "Procedure performed", full: true },
  { key: "advise", label: "Advice", full: true },
  { key: "followUpReason", label: "Follow-up reason" },
];

/** Everything the profile should show, including what the editor keeps elsewhere. */
export const RX_VIEW_FIELDS: { key: RxFieldKey | "note"; label: string; full?: boolean }[] = [
  ...RX_FIELDS,
  { key: "note", label: "Note", full: true },
];
