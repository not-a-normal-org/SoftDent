"use client";

import { useActionState, useState } from "react";
import { sendPatientSms, type SmsState } from "@/lib/actions/sms";
import { countSegments, renderTemplate, missingPlaceholders, type SmsValues } from "@/lib/sms-text";
import { fmtDateTime } from "@/lib/format";
import Combo from "@/components/Combo";

type Template = { key: string | null; name: string; body: string | null };
type LogRow = {
  id: number;
  body: string;
  status: string;
  gatewayCode: string | null;
  error: string | null;
  segments: number;
  sentAt: Date | string;
};

const initial: SmsState = {};

// what each placeholder is called in the UI, and where staff would go to fill it
const FIELD_LABEL: Record<string, string> = {
  name: "patient name",
  clinic: "clinic name",
  phone: "clinic phone",
  date: "appointment date",
  time: "appointment time",
  total: "total billed",
  paid: "amount paid",
  due: "amount due",
};

/**
 * Sending is always an explicit action. The Access app wired the SMS table to the
 * appointment status list, so changing a status could fire a message as a side effect;
 * nothing here sends without someone pressing the button.
 *
 * The body is shown merged and editable before sending, because the merge can only
 * fill what the record holds — a reminder for an appointment that isn't booked yet
 * has no {date}, and the receptionist types it rather than being blocked.
 */
export default function PatientSms({
  patientId,
  hasPhone,
  phone,
  templates,
  values,
  booked,
  log,
}: {
  patientId: number;
  hasPhone: boolean;
  phone: string | null;
  templates: Template[];
  values: SmsValues;
  /** false when nothing is booked, so {date} is a suggested next open day */
  booked: boolean;
  log: LogRow[];
}) {
  const [state, action, pending] = useActionState(sendPatientSms, initial);
  const [key, setKey] = useState("");
  const [body, setBody] = useState("");
  const [edited, setEdited] = useState(false);

  const template = templates.find((t) => t.key === key) ?? null;
  const missing = template?.body ? missingPlaceholders(template.body, values) : [];
  // the date is filled in but guessed, not booked — worth saying out loud before the
  // clinic promises a patient a day
  const usesDate = Boolean(template?.body?.includes("{date}"));
  const suggestedDate = !booked && usesDate && !edited;
  const { segments, chars } = countSegments(body);
  const stillHasPlaceholder = /\{\w+\}/.test(body);

  // clear the box once a send lands, so the next message starts from the template
  const [lastSent, setLastSent] = useState(state.sent);
  if (state.sent !== lastSent) {
    setLastSent(state.sent);
    setKey("");
    setBody("");
    setEdited(false);
  }

  function pick(k: string) {
    setKey(k);
    setEdited(false);
    const t = templates.find((x) => x.key === k);
    setBody(t?.body ? renderTemplate(t.body, values) : "");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">SMS</h2>
        {phone && <span className="text-xs text-slate-400 dark:text-slate-500">to {phone}</span>}
      </div>

      {!hasPhone ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No valid mobile number on file for this patient.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="patientId" value={patientId} />
          <Combo
            name="templateKey"
            options={templates.map((t) => ({ value: t.key ?? "", label: t.name }))}
            value={key} onChange={pick}
            placeholder="Choose a message…" emptyLabel="—" aria-label="Message template"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          {key && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Preview — this exact text is sent{edited && <span className="ml-1 text-amber-600 dark:text-amber-400">· edited</span>}
                </label>
                <textarea
                  name="body"
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setEdited(true); }}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {suggestedDate && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
                  No appointment booked — the date above is a suggestion:{" "}
                  <span className="font-medium">{String(values.date)}</span>, the next day the clinic
                  is open. Change it in the box if that is not the day.
                </p>
              )}

              {missing.length > 0 && !edited && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  Nothing on file for{" "}
                  <span className="font-medium">
                    {missing.map((m) => FIELD_LABEL[m] ?? m).join(", ")}
                  </span>{" "}
                  — those came out blank. Type them in above before sending.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {chars} characters · <span className="font-medium">{segments} SMS</span>
                  <span className="text-slate-400 dark:text-slate-500"> · Bangla, 70 per SMS</span>
                </span>
                <button
                  disabled={pending || !body.trim() || stillHasPlaceholder}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {pending ? "Sending…" : `Send (${segments} SMS)`}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {state.error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>
      )}
      {state.sent && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          Sent: {state.sent}
        </p>
      )}

      {log.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {log.map((m) => (
            <li key={m.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className={m.status === "SENT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {m.status === "SENT" ? "✓" : "✕"}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{fmtDateTime(m.sentAt)}</span>
                <span className="text-slate-400">· {m.segments} SMS</span>
                {m.error && <span className="text-rose-500">· {m.error}</span>}
              </div>
              <div className="ml-5 text-slate-600 dark:text-slate-300">{m.body}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
