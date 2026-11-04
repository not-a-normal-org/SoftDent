"use client";

import { useActionState, useState } from "react";
import { sendTestSms, type SmsTestState } from "@/lib/actions/sms";
import Combo from "@/components/Combo";

type Template = { key: string | null; name: string; body: string | null };

const initial: SmsTestState = {};

function segmentsOf(body: string) {
  const unicode = /[^\u0000-\u007F]/.test(body);
  const chars = [...body].length;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return { chars, unicode, limit: chars <= single ? single : multi, segments: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi) };
}

/**
 * Sends a real message to a real number and bills real credit — hence the warning and
 * the owner-only action behind it. The gateway's numeric code is shown as well as its
 * meaning, because when this fails the code is the diagnosis.
 */
export default function SmsTestForm({ templates }: { templates: Template[] }) {
  const [state, action, pending] = useActionState(sendTestSms, initial);
  // Placeholders are left as-is: this proves the gateway, not the merge.
  const [body, setBody] = useState(templates.find((t) => t.body)?.body ?? "");
  const { segments, chars, limit, unicode } = segmentsOf(body);
  const hasBangla = /[ঀ-৿]/.test(body);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-500/5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Send a test message</h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        This sends a real SMS and spends real credit. Use your own number.
      </p>

      <form action={action} className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            name="to"
            placeholder="01XXXXXXXXX"
            className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="min-w-0 flex-1">
            <Combo
              options={templates.filter((t) => t.body).map((t) => ({ value: t.key ?? "", label: t.name }))}
              value=""
              onChange={(v) => {
                const t = templates.find((x) => x.key === v);
                if (t?.body) setBody(t.body);
              }}
              placeholder="Load a template…" aria-label="Load a template"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 dark:text-slate-400">
            {chars}/{limit} characters · <span className="font-medium">{segments} SMS</span>
            {unicode && <span className="text-slate-400"> · Bangla (70 per SMS)</span>}
            {!hasBangla && chars > 0 && (
              <span className="ml-2 text-rose-600 dark:text-rose-400">needs Bangla (code 1012)</span>
            )}
          </span>
          <button
            disabled={pending}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Sending…" : `Send test (${segments} SMS)`}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {state.error}
        </p>
      )}

      {state.code && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          }`}
        >
          <div className="font-medium">
            {state.ok ? "Delivered to the gateway" : "Gateway refused it"} — code {state.code}
          </div>
          <div className="mt-0.5">{state.message}</div>
          {!state.ok && state.code === "1007" && (
            <div className="mt-1 text-xs">Top up the BulkSMS BD account, then try again.</div>
          )}
          {!state.ok && state.code === "1032" && (
            <div className="mt-1 text-xs">
              The gateway is allowlisting IPs. Cloud Run&rsquo;s egress addresses are dynamic, so this
              needs a VPC connector with a reserved static IP.
            </div>
          )}
          <div className="mt-1 text-xs opacity-80">
            {state.segments} segment{state.segments === 1 ? "" : "s"} billed · logged in the patient SMS history
          </div>
        </div>
      )}
    </section>
  );
}
