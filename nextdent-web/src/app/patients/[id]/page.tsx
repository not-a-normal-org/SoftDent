import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatientProfile } from "@/lib/patients";
import { RX_VIEW_FIELDS } from "@/lib/rx-fields";
import { taka, fmtDate, age, initials } from "@/lib/format";
import DentalChart from "@/components/DentalChart";
import PatientBilling from "@/components/PatientBilling";
import PatientSms from "@/components/PatientSms";
import Timeline from "@/components/Timeline";
import { addConnection, deleteConnection, addHealthRecord, deleteHealthRecord } from "@/lib/actions/patient-extras";
import { listSmsTemplates, recentSmsForPatient, normalisePhone, smsValuesForPatient } from "@/lib/sms";

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();

  const data = await getPatientProfile(pid);
  if (!data) notFound();

  const [smsTemplates, smsLog, sms] = await Promise.all([
    listSmsTemplates(),
    recentSmsForPatient(pid),
    smsValuesForPatient(pid),
  ]);

  const { patient: p, cases, prescriptions, events, teeth, billing, connections, healthRecords } = data;
  const vitalsInput = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const a = age(p.dob);
  const consultant = p.consultantDoctor?.person.fullName ?? null;

  return (
    <div className="space-y-6">
      <Link href="/patients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
        ← All patients
      </Link>

      {/* header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-teal-100 text-xl font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
            {initials(p.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{p.fullName}</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Patient #{p.id}
              {a != null ? ` · ${a} yrs` : ""}
              {p.gender ? ` · ${p.gender}` : ""}
              {p.maritalStatus ? ` · ${p.maritalStatus}` : ""}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              <Field label="Phone" value={p.primaryPhone} mono />
              <Field label="Since" value={fmtDate(p.since)} />
              <Field label="DOB" value={fmtDate(p.dob)} />
              <Field label="Consultant" value={consultant ?? "Unassigned"} />
              <Field label="Occupation" value={p.occupation} />
              <Field label="Lifetime discount" value={p.lifetimeDiscount ? `${p.lifetimeDiscount}%` : "—"} />
              {p.address && <Field label="Address" value={p.address} />}
            </dl>
          </div>

          {/* billing summary + actions */}
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link href={`/appointments/new?patientId=${p.id}`}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-700">
                📅 Book
              </Link>
              <Link href={`/prescriptions/new?patientId=${p.id}`}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-700">
                ℞ New Rx
              </Link>
              <Link href={`/patients/${p.id}/edit`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                ✎ Edit
              </Link>
            </div>
            <div className="flex gap-3">
              <Stat label="Billed" value={taka(billing.billed)} tone="slate" />
              <Stat label="Paid" value={taka(billing.paid)} tone="emerald" />
              {/* paid ahead of the billing shows as credit, not as a negative due */}
              <Stat
                label={billing.due < 0 ? "Credit" : "Due"}
                value={taka(Math.abs(billing.due))}
                tone={billing.due > 0 ? "rose" : "emerald"}
              />
            </div>
          </div>
        </div>
      </section>

      {/* full width — the billing table carries eight columns plus an entry row */}
      <PatientBilling patientId={p.id} cases={cases} lifetimeDiscount={p.lifetimeDiscount} />

      <PatientSms
        patientId={p.id}
        hasPhone={Boolean(normalisePhone(p.primaryPhone))}
        phone={normalisePhone(p.primaryPhone)}
        templates={smsTemplates}
        values={sms.values}
        booked={sms.booked}
        log={smsLog}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          <DentalChart teeth={teeth} />

          {/* prescriptions */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Prescriptions</h2>
            {prescriptions.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No prescriptions issued.</p>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => {
                  // every clinical field that was actually filled in — the profile used
                  // to show the complaint and the drugs and quietly drop the other nine
                  const written = RX_VIEW_FIELDS
                    .map((f) => ({ ...f, value: (rx as unknown as Record<string, unknown>)[f.key] }))
                    .filter((f) => typeof f.value === "string" && f.value.trim() !== "");
                  return (
                    <div key={rx.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Rx #{rx.id}</span>
                        <span className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400 dark:text-slate-500">{fmtDate(rx.rxDate)}</span>
                          <Link href={`/prescriptions/${rx.id}`} className="text-teal-700 hover:underline dark:text-teal-400">open</Link>
                          <Link href={`/prescriptions/${rx.id}/edit`} className="text-slate-400 hover:text-teal-700 dark:text-slate-500 dark:hover:text-teal-400">edit</Link>
                        </span>
                      </div>

                      {written.length > 0 && (
                        <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          {written.map((f) => (
                            <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                              <dt className="text-xs text-slate-400 dark:text-slate-500">{f.label}</dt>
                              <dd className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{f.value as string}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {rx.drugs.length > 0 && (
                        <ol className="mt-3 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                          {rx.drugs.map((d, i) => (
                            <li key={d.id} className="flex flex-wrap gap-x-3 text-sm text-slate-700 dark:text-slate-300">
                              <span className="w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}.</span>
                              <span className="font-medium">{d.drug}</span>
                              {d.dose && <span className="text-slate-500 dark:text-slate-400">{d.dose}</span>}
                              {d.meal && <span className="text-slate-500 dark:text-slate-400">· {d.meal}</span>}
                              {d.duration && <span className="text-slate-500 dark:text-slate-400">· {d.duration}</span>}
                            </li>
                          ))}
                        </ol>
                      )}

                      {rx.followUpDate && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Follow-up: <span className="font-medium">{fmtDate(rx.followUpDate)}</span>
                        </p>
                      )}

                      {written.length === 0 && rx.drugs.length === 0 && (
                        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">This prescription is empty.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* side column */}
        <div className="space-y-6">
          {(p.medicalHistory || p.drugHistory || p.note) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">History & notes</h2>
              <div className="space-y-3 text-sm">
                <HistoryBlock label="Medical history" value={p.medicalHistory} />
                <HistoryBlock label="Drug history" value={p.drugHistory} />
                <HistoryBlock label="Note" value={p.note} />
              </div>
            </section>
          )}

          {/* health records / vitals */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Health records</h2>
            {healthRecords.length > 0 && (
              <ul className="mb-3 space-y-2">
                {healthRecords.map((h) => (
                  <li key={h.id} className="rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{fmtDate(h.recordedAt)}</span>
                      <form action={deleteHealthRecord.bind(null, h.id, p.id)}><button className="text-xs text-slate-300 hover:text-rose-600">✕</button></form>
                    </div>
                    <div className="mt-0.5 text-slate-700 dark:text-slate-300">
                      {[h.bloodPressure && `BP ${h.bloodPressure}`, h.pulse && `Pulse ${h.pulse}`, h.weightKg && `${h.weightKg}kg`, h.bloodGroup && `Grp ${h.bloodGroup}`].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {(h.allergies || h.conditions || h.note) && (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{[h.allergies && `Allergies: ${h.allergies}`, h.conditions && `Conditions: ${h.conditions}`, h.note].filter(Boolean).join(" · ")}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form action={addHealthRecord.bind(null, p.id)} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input name="bloodPressure" placeholder="BP e.g. 120/80" className={vitalsInput} />
                <input name="pulse" placeholder="Pulse" className={vitalsInput} />
                <input name="weightKg" placeholder="Weight (kg)" className={vitalsInput} />
                <input name="bloodGroup" placeholder="Blood group" className={vitalsInput} />
              </div>
              <input name="allergies" placeholder="Allergies" className={vitalsInput} />
              <input name="conditions" placeholder="Conditions" className={vitalsInput} />
              <button className="w-full rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">+ Add record</button>
            </form>
          </section>

          {/* family connections */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Family &amp; connections</h2>
            {connections.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {connections.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      {c.relatedPatient
                        ? <Link href={`/patients/${c.relatedPatient.id}`} className="hover:text-teal-700 dark:hover:text-teal-400">{c.relatedPatient.fullName}</Link>
                        : c.relatedName}
                      {c.relation && <span className="text-slate-400"> · {c.relation}</span>}
                    </span>
                    <form action={deleteConnection.bind(null, c.id, p.id)}><button className="text-xs text-slate-300 hover:text-rose-600">✕</button></form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addConnection.bind(null, p.id)} className="flex gap-2">
              <input name="relatedName" placeholder="Name" className={`flex-1 ${vitalsInput}`} />
              <input name="relation" placeholder="Relation" className={`w-28 ${vitalsInput}`} />
              <button className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">Add</button>
            </form>
          </section>

          <Timeline events={events} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className={`text-slate-800 dark:text-slate-200 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  }[tone];
  return (
    <div className={`min-w-24 rounded-xl px-4 py-2 text-right ${tones}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}


function HistoryBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{label}</div>
      <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{value}</p>
    </div>
  );
}
