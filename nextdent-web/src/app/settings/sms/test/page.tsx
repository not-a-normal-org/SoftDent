import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listSmsTemplates, getBalance } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import SmsTestForm from "@/components/SmsTestForm";
import { fmtDateTime } from "@/lib/format";

export default async function SmsTestPage() {
  await requireRole("OWNER");
  const configured = Boolean(process.env.BULKSMS_API_KEY);
  const [templates, balance, recent] = await Promise.all([
    listSmsTemplates(),
    getBalance(),
    // every attempt is logged, so the last few tests double as a gateway health check
    prisma.smsLog.findMany({ orderBy: { sentAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">SMS test</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Send a real message to check the gateway. <Link href="/settings/sms" className="text-teal-700 hover:underline dark:text-teal-400">Edit templates →</Link>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
          {!configured ? (
            <span className="text-amber-700 dark:text-amber-400">Gateway not configured</span>
          ) : balance === null ? (
            <span className="text-slate-500 dark:text-slate-400">Balance unavailable</span>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400">Balance </span>
              <span className={`font-semibold tabular-nums ${balance < 100 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}>৳{balance}</span>
            </>
          )}
        </div>
      </div>

      {!configured ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Set <code>BULKSMS_API_KEY</code> to enable sending.
        </p>
      ) : (
        <SmsTestForm templates={templates} />
      )}

      {recent.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Recent sends</h2>
          <ul className="space-y-2 text-xs">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-2">
                <span className={m.status === "SENT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {m.status === "SENT" ? "✓" : "✕"}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{fmtDateTime(m.sentAt)}</span>
                <span className="font-mono text-slate-400">{m.phone}</span>
                {m.gatewayCode && <span className="text-slate-400">· code {m.gatewayCode}</span>}
                <span className="text-slate-400">· {m.segments} SMS</span>
                {m.error && <span className="text-rose-500">· {m.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
