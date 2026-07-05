import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatientProfile } from "@/lib/patients";
import { taka, fmtDate, age, initials } from "@/lib/format";
import DentalChart from "@/components/DentalChart";
import Timeline from "@/components/Timeline";

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();

  const data = await getPatientProfile(pid);
  if (!data) notFound();

  const { patient: p, cases, prescriptions, events, teeth, billing } = data;
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
              <Stat label="Due" value={taka(billing.due)} tone={billing.due > 0 ? "rose" : "emerald"} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          <DentalChart teeth={teeth} />

          {/* treatment cases */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Treatment cases</h2>
              <Link href={`/patients/${p.id}/cases/new`} className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400">+ New case</Link>
            </div>
            {cases.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No treatment cases recorded.</p>
            ) : (
              <div className="space-y-4">
                {cases.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                      <Link href={`/cases/${c.id}`} className="font-medium text-slate-800 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-400">{c.name || `Case #${c.id}`}</Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <Link href={`/cases/${c.id}`} className="text-xs text-teal-700 hover:underline dark:text-teal-400">manage</Link>
                      </div>
                    </div>
                    {c.lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400 dark:text-slate-500">
                              <th className="px-4 py-2 font-medium">Date</th>
                              <th className="px-4 py-2 font-medium">Procedure</th>
                              <th className="px-4 py-2 text-right font-medium">Amount</th>
                              <th className="px-4 py-2 text-right font-medium">Paid</th>
                              <th className="px-4 py-2 text-right font-medium">Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.lines.map((l) => {
                              const due = l.afterDiscountAmount - l.amountPaid;
                              return (
                                <tr key={l.id} className="border-t border-slate-50 dark:border-slate-800/60">
                                  <td className="whitespace-nowrap px-4 py-2 text-slate-500 dark:text-slate-400">{fmtDate(l.treatmentDate)}</td>
                                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{l.treatmentName || "—"}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{taka(l.afterDiscountAmount)}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{taka(l.amountPaid)}</td>
                                  <td className={`px-4 py-2 text-right tabular-nums ${due > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>{taka(due)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* prescriptions */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Prescriptions</h2>
            {prescriptions.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No prescriptions issued.</p>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Rx #{rx.id}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(rx.rxDate)}</span>
                    </div>
                    {rx.complaints && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300"><span className="text-slate-400 dark:text-slate-500">Complaints: </span>{rx.complaints}</p>}
                    {rx.drugs.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {rx.drugs.map((d) => (
                          <li key={d.id} className="flex flex-wrap gap-x-3 text-sm text-slate-700 dark:text-slate-300">
                            <span className="font-medium">{d.drug}</span>
                            {d.dose && <span className="text-slate-500 dark:text-slate-400">{d.dose}</span>}
                            {d.meal && <span className="text-slate-500 dark:text-slate-400">· {d.meal}</span>}
                            {d.duration && <span className="text-slate-500 dark:text-slate-400">· {d.duration}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
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

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls = s === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : s === "active" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status || "—"}</span>;
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
