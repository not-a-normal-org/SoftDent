import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listSmsTemplates, getBalance } from "@/lib/sms";
import SmsTemplateForm from "@/components/SmsTemplateForm";

export default async function SmsSettingsPage() {
  await requireRole("OWNER");
  const [templates, balance] = await Promise.all([listSmsTemplates(), getBalance()]);
  const configured = Boolean(process.env.BULKSMS_API_KEY);

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">SMS templates</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Messages must be written in Bangla — the gateway rejects English on a masked sender ID.{" "}
            <Link href="/settings/sms/test" className="text-teal-700 hover:underline dark:text-teal-400">Send a test →</Link>
          </p>
        </div>
        {/* Balance matters: when credit runs out the gateway fails silently from the
            clinic's point of view (code 1007), so it is surfaced here. */}
        <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
          {!configured ? (
            <span className="text-amber-700 dark:text-amber-400">Gateway not configured</span>
          ) : balance === null ? (
            <span className="text-slate-500 dark:text-slate-400">Balance unavailable</span>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400">Balance </span>
              <span className={`font-semibold tabular-nums ${balance < 100 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}>
                ৳{balance}
              </span>
            </>
          )}
        </div>
      </div>

      {!configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Set <code>BULKSMS_API_KEY</code> to enable sending. Templates can be edited meanwhile.
        </p>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <SmsTemplateForm key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
