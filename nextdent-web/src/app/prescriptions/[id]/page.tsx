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
import { RX_LABELS, asRxLang, type RxNoteKey } from "@/lib/rx-language";
import { RX_FIELDS } from "@/lib/rx-fields";
import { parseTerms } from "@/lib/history-terms";

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

  // One heading per clinical field, in the consultant's own order of consultation —
  // the clinic's marked-up stationery (Nov 2026), which is exactly the editor's field
  // list, so the paper and the form can no longer drift apart. Advice and follow-up
  // are not here: they print in their own column beside the medicines.
  //
  // A heading is printed only when something is written under it. An empty
  // "Investigation Advised" on a patient's copy reads as work skipped rather than
  // work not needed.
  const L = RX_LABELS[asRxLang(rx.language)];
  const notes = RX_FIELDS
    .filter((f): f is typeof f & { key: RxNoteKey } => f.key !== "advise" && f.key !== "followUpReason")
    .map((f) => ({ key: f.key, label: L[f.key], text: rx[f.key]?.trim() ?? "" }))
    .filter((n) => n.text);

  // Each heading keeps the stationery's 78pt of writing room while there is space for
  // it. With all eleven filled that would run 300pt past the sheet, so the room is
  // shared out instead — 49pt each at eleven, measured to leave ~30pt spare on A4 —
  // and a full prescription still prints on one page. A section with more text than
  // that simply grows.
  const NOTE_ROOM_PT = 490;
  const noteMinPt = notes.length > 1 ? Math.min(78, Math.floor(NOTE_ROOM_PT / (notes.length - 1))) : 78;

  // Advice picked from the clinic's list posts as "• line • line"; the post-extraction
  // instructions are seven full sentences, so each gets its own printed line. Advice
  // typed as prose has no bullets and is left exactly as it was written.
  const advise = rx.advise?.includes("\u2022") ? parseTerms(rx.advise).join("\n") : rx.advise;
  const hasSide = Boolean(advise || rx.followUpDate || rx.followUpReason);

  // A quantity must never be split from its unit across a line ("০৫" / "দিন"), and a
  // dash stays with the word before it, so a wrapped dosing line can only break
  // between whole instructions. Non-breaking spaces do it without stopping a long
  // sentence — the suppository directions, the post-extraction advice — from wrapping.
  const keepUnits = (t: string) => t.replace(/([0-9\u09E6-\u09EF])[ \t]+(?=\S)/g, "$1\u00A0");

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
            <div style={{ left: "42.4pt", width: "210pt" }}><b>{L.name}:</b>{name}</div>
            {/* absolutely positioned, so leaving one out moves nothing else */}
            {sex && <div style={{ left: "256.6pt", width: "78pt" }}><b>{L.sex}:</b>{sex}</div>}
            {patientAge && <div style={{ left: "337.7pt", width: "98pt" }}><b>{L.age}:</b>{patientAge}</div>}
            <div style={{ left: "439pt", width: "118pt" }}><b>{L.date}:</b>{fmtDate(rx.rxDate)}</div>
          </div>

          <div className="rx-body">
            <div className="rx-notes" style={{ "--rx-note-min": `${noteMinPt}pt` } as React.CSSProperties}>
              {notes.map((n) => (
                <section key={n.key} className="rx-note">
                  <div className="rx-note-label">{n.label}</div>
                  <div className="rx-note-text">{n.text}</div>
                </section>
              ))}
            </div>

            {/* Medicines on the left, advice and follow-up in their own column on the
                right, divided by the same hairline as the notes column. The divider and
                the column exist only when there is advice or a follow-up to put there —
                an empty column would be the blank heading problem over again. */}
            <div className={`rx-meds${hasSide ? " rx-meds--split" : ""}`}>
              <div className="rx-meds-main">
                <Image src="/rx-mark.png" alt="Rx." width={372} height={190} unoptimized loading="eager" className="rx-mark" />
                {rx.drugs.length > 0 && (
                  <ol>
                    {rx.drugs.map((d, i) => (
                      <li key={d.id} className="rx-drug">
                        {/* ISMP: keep clear space between the number and the drug name, or
                            the number is read as part of the dose. */}
                        <span className="rx-drug-num tabular-nums">{i + 1}.</span>
                        <div className="min-w-0">
                          <div className="rx-drug-name">{keepUnits(formatRxText(d.drug))}</div>
                          {/* dosing is written in Bangla — needs the Bengali face */}
                          <div className="rx-dosing bn">
                            {keepUnits([d.dose, d.meal, d.duration].filter(Boolean).join("\u00A0— "))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Advice reads as guidance to the patient, so it gets the stationery's own
                  heading style rather than colour — prescriptions get photocopied. */}
              {hasSide && (
                <aside className="rx-side">
                  {advise && (
                    <div className="rx-extra">
                      <div className="rx-note-label">{L.advice}</div>
                      <div className="rx-note-text bn">{keepUnits(advise)}</div>
                    </div>
                  )}
                  {(rx.followUpDate || rx.followUpReason) && (
                    <div className="rx-extra">
                      <div className="rx-note-label">{L.followUp}</div>
                      <div className="rx-note-text">
                        {keepUnits([rx.followUpDate && fmtDate(rx.followUpDate), rx.followUpReason].filter(Boolean).join("\n"))}
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </div>

          <footer className="rx-letterhead-footer rx-foot">{letterhead?.footer}</footer>
        </article>
      </div>
    </div>
  );
}
