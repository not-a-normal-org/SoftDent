"use client";

import { useActionState, useState } from "react";
import { saveSmsTemplate, type SmsState } from "@/lib/actions/sms";

type Template = { id: number; key: string | null; name: string; body: string | null; statusKey: string | null };

const initial: SmsState = {};

/**
 * Billable segments. Any non-Latin character forces UCS-2, which holds 70 characters
 * in one message and 67 per part once concatenated, against 160/153 for Latin. A
 * Bangla message therefore costs roughly twice a Latin one, and the counter exists so
 * staff can see when an edit tips a message into another segment.
 */
function segmentsOf(body: string) {
  const unicode = /[^\u0000-\u007F]/.test(body);
  const chars = [...body].length;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return {
    unicode,
    chars,
    segments: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi),
    limit: chars <= single ? single : multi,
  };
}

export default function SmsTemplateForm({ template }: { template: Template }) {
  const [state, action, pending] = useActionState(saveSmsTemplate, initial);
  const [body, setBody] = useState(template.body ?? "");
  const { segments, chars, unicode, limit } = segmentsOf(body);
  const hasBangla = /[ঀ-৿]/.test(body);

  return (
    <form action={action} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <input type="hidden" name="id" value={template.id} />
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{template.name}</span>
          {template.statusKey && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
              {template.statusKey}
            </span>
          )}
        </div>
        <code className="text-[11px] text-slate-400">{template.key}</code>
      </div>

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          {chars}/{limit} characters ·{" "}
          <span className={segments > 2 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
            {segments} SMS
          </span>
          {unicode && <span className="text-slate-400"> · Bangla (70 per SMS)</span>}
          {!hasBangla && body.length > 0 && (
            <span className="ml-2 text-rose-600 dark:text-rose-400">
              needs Bangla — the gateway rejects English on a masked sender
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          {state.error && <span className="text-rose-600 dark:text-rose-400">{state.error}</span>}
          {state.savedAt && !state.error && <span className="text-emerald-600 dark:text-emerald-400">Saved</span>}
          <button
            disabled={pending}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Save
          </button>
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Placeholders: {"{name} {clinic} {phone} {date} {time} {total} {paid} {due}"}
      </p>
    </form>
  );
}
