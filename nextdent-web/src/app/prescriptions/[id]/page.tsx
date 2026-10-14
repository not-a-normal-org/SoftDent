import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrescription, getRxLetterhead } from "@/lib/prescriptions";
import { getClinicConfig } from "@/lib/settings";
import { formatRxText } from "@/lib/rx-safety";
import { softDeleteRx } from "@/lib/actions/prescriptions";
import { fmtDate, age } from "@/lib/format";
import RxPrintMode from "@/components/RxPrintMode";

export default async function PrescriptionViewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const rid = Number.parseInt(id, 10);
  if (Number.isNaN(rid)) notFound();

  const [rx, letterhead, clinic] = await Promise.all([
    getPrescription(rid),
    getRxLetterhead(),
    getClinicConfig(),
  ]);
  if (!rx) notFound();

  // The clinic's long-standing default — "Body" means print onto pre-printed paper.
  const defaultBodyOnly = (clinic.settings?.defaultRxType ?? "Body") === "Body";

  const p = rx.patient;
  const dentist = rx.dentist;
  const name = p?.fullName ?? rx.randomName ?? "Anonymous";
  const years = p ? age(p.dob) : null;
  const patientAge = years != null ? `${years} yrs` : (p ? null : rx.randomAge);
  const sex = p ? p.gender : rx.randomSex;
  // legacy Access import stored the registration number as a float ("5790.0")
  const regNo = dentist?.regNo?.replace(/\.0+$/, "");

  // The clinic's stationery has exactly these seven headings, always printed, in this
  // order. Fields it has no heading for go under the nearest one rather than being
  // dropped from the paper.
  const notes: [string, (string | null)[]][] = [
    ["C/C", [rx.complaints]],
    ["Known Case of", [rx.medicalHistory, rx.drugHistory && `Drug history: ${rx.drugHistory}`]],
    ["O/E", [rx.findingsOnExamination]],
    ["Investigations", [rx.investigationAdvised]],
    ["Diagnosis", [
      rx.confirmatoryDiagnosis,
      rx.provisionalDiagnosis && `Provisional: ${rx.provisionalDiagnosis}`,
      rx.differentialDiagnosis && `D/D: ${rx.differentialDiagnosis}`,
    ]],
    ["Treatment Plan", [rx.treatmentPlan]],
    ["Treatment Done", [rx.procedurePerformed]],
  ];

  return (
    <div className="space-y-4">
      {/* action bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/prescriptions" className="text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← All prescriptions</Link>
        <div className="flex items-center gap-2">
          {p && <Link href={`/patients/${p.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Patient</Link>}
          <Link href={`/prescriptions/${rx.id}/edit`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">✎ Edit</Link>
          <form action={softDeleteRx.bind(null, rx.id)}>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-500/10">Delete</button>
          </form>
          <RxPrintMode
            defaultBodyOnly={defaultBodyOnly}
            topMm={clinic.settings?.rxBodyTopMm ?? 45}
            bottomMm={clinic.settings?.rxBodyBottomMm ?? 20}
          />
        </div>
      </div>

      {/* The printable sheet — a copy of the clinic's Rx stationery. Always paper-white,
          also in dark mode; sizes are in pt (see .rx-paper in globals.css). */}
      <div className="overflow-x-auto print:overflow-visible">
        <article className="print-area rx-paper mx-auto shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <header className="rx-letterhead-header rx-head">
            <div className="rx-clinic">
              <div className="rx-clinic-name">{letterhead?.heading1 ?? "NextDent"}</div>
              {letterhead?.heading2 && <div className="rx-clinic-addr">{letterhead.heading2}</div>}
            </div>

            <Image src="/rx-logo.png" alt="NextDent" width={925} height={696} unoptimized loading="eager" className="rx-logo" />

            <div className="rx-doctor">
              {dentist?.person?.fullName && <div className="rx-doctor-name">{dentist.person.fullName}</div>}
              {dentist?.degree && <div className="rx-doctor-degree">{dentist.degree}</div>}
              {dentist?.designation1 && <div>{dentist.designation1}</div>}
              {dentist?.designation2 && <div>{dentist.designation2}</div>}
              {dentist?.clinicName && <div>{dentist.clinicName}</div>}
              {regNo && <div>{letterhead?.heading7 ?? "BMDC Reg. No:"} {regNo}</div>}
              {letterhead?.heading8 && <div>{letterhead.heading8}</div>}
              {letterhead?.heading9 && <div>{letterhead.heading9}</div>}
            </div>
          </header>

          {/* columns sit where the stationery prints them: x = 60, 275, 356, 457pt */}
          <div className="rx-patient">
            <div style={{ left: "42.4pt", width: "210pt" }}><b>Name:</b>{name}</div>
            <div style={{ left: "256.6pt", width: "78pt" }}><b>Sex:</b>{sex}</div>
            <div style={{ left: "337.7pt", width: "98pt" }}><b>Age:</b>{patientAge}</div>
            <div style={{ left: "439pt", width: "118pt" }}><b>Date:</b>{fmtDate(rx.rxDate)}</div>
          </div>

          <div className="rx-body">
            <div className="rx-notes">
              {notes.map(([label, lines]) => {
                const text = lines.filter(Boolean).join("\n");
                return (
                  <section key={label} className="rx-note">
                    <div className="rx-note-label">{label}</div>
                    {text && <div className="rx-note-text">{text}</div>}
                  </section>
                );
              })}
            </div>

            <div className="rx-meds">
              <Image src="/rx-mark.png" alt="Rx." width={372} height={190} unoptimized loading="eager" className="rx-mark" />
              {rx.drugs.length > 0 && (
                <ol>
                  {rx.drugs.map((d, i) => (
                    <li key={d.id} className="rx-drug">
                      {/* ISMP: keep clear space between the number and the drug name, or
                          the number is read as part of the dose. */}
                      <span className="rx-drug-num tabular-nums">{i + 1}.</span>
                      <div className="min-w-0">
                        <div className="rx-drug-name">{formatRxText(d.drug)}</div>
                        {/* dosing is written in Bangla — needs the Bengali face */}
                        <div className="rx-dosing bn">
                          {[d.dose, d.meal, d.duration].filter(Boolean).join("  —  ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {/* Advice reads as guidance to the patient, so it gets the stationery's own
                  heading style rather than colour — prescriptions get photocopied. */}
              {rx.advise && (
                <div className="rx-extra">
                  <div className="rx-note-label">Advice</div>
                  <div className="rx-note-text bn">{rx.advise}</div>
                </div>
              )}
              {(rx.followUpDate || rx.followUpReason) && (
                <div className="rx-extra">
                  <b>Follow-up: </b>
                  {fmtDate(rx.followUpDate)}{rx.followUpReason ? ` — ${rx.followUpReason}` : ""}
                </div>
              )}
            </div>
          </div>

          <footer className="rx-letterhead-footer rx-foot">{letterhead?.footer}</footer>
        </article>
      </div>
    </div>
  );
}
