import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrescription, getRxLetterhead } from "@/lib/prescriptions";
import { softDeleteRx } from "@/lib/actions/prescriptions";
import { fmtDate, age } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

const CLINICAL: { key: string; label: string }[] = [
  { key: "complaints", label: "Chief complaints" },
  { key: "findingsOnExamination", label: "On examination" },
  { key: "provisionalDiagnosis", label: "Provisional diagnosis" },
  { key: "differentialDiagnosis", label: "Differential diagnosis" },
  { key: "confirmatoryDiagnosis", label: "Diagnosis" },
  { key: "investigationAdvised", label: "Investigation advised" },
  { key: "treatmentPlan", label: "Treatment plan" },
  { key: "procedurePerformed", label: "Procedure done" },
  { key: "medicalHistory", label: "Medical history" },
  { key: "drugHistory", label: "Drug history" },
];

export default async function PrescriptionViewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const rid = Number.parseInt(id, 10);
  if (Number.isNaN(rid)) notFound();

  const [rx, letterhead] = await Promise.all([getPrescription(rid), getRxLetterhead()]);
  if (!rx) notFound();

  const p = rx.patient;
  const doc = rx.dentist?.person;
  const name = p?.fullName ?? rx.randomName ?? "Anonymous";
  const sub = p ? `#${p.id}${age(p.dob) != null ? ` · ${age(p.dob)}y` : ""}${p.gender ? ` · ${p.gender}` : ""}` : [rx.randomAge, rx.randomSex].filter(Boolean).join(" · ");
  const clinical = CLINICAL.filter((c) => (rx as unknown as Record<string, string | null>)[c.key]);

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
          <PrintButton />
        </div>
      </div>

      {/* printable letterhead — intentionally always light ("paper") */}
      <article className="print-area mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b-2 border-teal-700 pb-3">
          <div>
            <div className="text-lg font-bold text-teal-800">{doc?.fullName ?? letterhead?.heading1 ?? "NextDent"}</div>
            {rx.dentist?.degree && <div className="text-xs text-slate-600">{rx.dentist.degree}</div>}
            {rx.dentist?.designation1 && <div className="text-xs text-slate-600">{rx.dentist.designation1}</div>}
            {(rx.dentist?.regNo || letterhead?.heading7) && (
              <div className="text-xs text-slate-600">{letterhead?.heading7 ?? "Reg No:"} {rx.dentist?.regNo}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{letterhead?.heading1 ?? "Dental Clinic"}</div>
            {letterhead?.heading8 && <div className="text-xs text-slate-600">{letterhead.heading8}</div>}
            {letterhead?.heading9 && <div className="text-xs text-slate-600">{letterhead.heading9}</div>}
          </div>
        </header>

        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-200 py-2 text-sm">
          <span><span className="text-slate-500">Name: </span><span className="font-semibold">{name}</span> <span className="text-slate-500">{sub}</span></span>
          <span className="text-slate-500">Date: <span className="font-medium text-slate-800">{fmtDate(rx.rxDate)}</span></span>
        </div>

        <div className="grid gap-6 py-4 md:grid-cols-3">
          {/* clinical sidebar */}
          <div className="space-y-3 text-sm md:col-span-1 md:border-r md:border-slate-200 md:pr-4">
            {clinical.length === 0 ? (
              <p className="text-slate-400">No clinical notes.</p>
            ) : clinical.map((c) => (
              <div key={c.key}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
                <div className="whitespace-pre-wrap text-slate-700">{(rx as unknown as Record<string, string>)[c.key]}</div>
              </div>
            ))}
          </div>

          {/* Rx medicines */}
          <div className="md:col-span-2">
            <div className="mb-2 text-3xl font-serif text-teal-800">℞</div>
            {rx.drugs.length === 0 ? (
              <p className="text-sm text-slate-400">No medicines.</p>
            ) : (
              <ol className="space-y-2.5">
                {rx.drugs.map((d, i) => (
                  <li key={d.id} className="flex gap-2 text-sm">
                    <span className="text-slate-400">{i + 1}.</span>
                    <div>
                      <div className="font-semibold text-slate-800">{d.drug}</div>
                      <div className="text-slate-600">
                        {[d.dose, d.meal, d.duration].filter(Boolean).join("  —  ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {rx.advise && (
              <div className="mt-5 text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Advice</div>
                <div className="whitespace-pre-wrap text-slate-700">{rx.advise}</div>
              </div>
            )}
            {(rx.followUpDate || rx.followUpReason) && (
              <div className="mt-3 text-sm text-slate-700">
                <span className="font-semibold">Follow-up: </span>
                {fmtDate(rx.followUpDate)}{rx.followUpReason ? ` — ${rx.followUpReason}` : ""}
              </div>
            )}
          </div>
        </div>

        {letterhead?.footer && (
          <footer className="mt-4 border-t border-slate-200 pt-2 text-center text-xs italic text-slate-500">{letterhead.footer}</footer>
        )}
      </article>
    </div>
  );
}
