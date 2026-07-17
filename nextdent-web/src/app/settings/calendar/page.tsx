import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { googleConfigured, getCalendarConnection } from "@/lib/google";
import { disconnectCalendar } from "@/lib/actions/calendar";
import { fmtDate } from "@/lib/format";

export default async function CalendarSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const { ok, err } = await searchParams;
  const configured = googleConfigured();
  const connection = await getCalendarConnection(user.id);

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Google Calendar</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Each staff member connects their own Google account — appointments can sync to whichever calendar they choose.</p>
      </div>

      {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">✓ Google Calendar connected.</p>}
      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Couldn&apos;t complete the connection ({err}). Please try again.</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {!configured ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Not configured</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">The app needs one-time Google credentials before anyone can connect.</span>
            </div>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>In Google Cloud Console, create an <b>OAuth 2.0 Client ID</b> (type: Web application).</li>
              <li>Add the redirect URI: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{`{APP_URL}`}/api/google/callback</code></li>
              <li>Enable the <b>Google Calendar API</b>.</li>
              <li>Set <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GOOGLE_CLIENT_SECRET</code> and <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">APP_URL</code> in the environment, then restart.</li>
            </ol>
            <p className="text-xs text-slate-400">Once set, every user sees a &ldquo;Connect&rdquo; button here and links their own Google account — no per-user credentials needed.</p>
          </div>
        ) : connection ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Connected</span>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{connection.googleEmail ?? "Google account"} · since {fmtDate(connection.createdAt)}</div>
            </div>
            <form action={disconnectCalendar}>
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-500/10">Disconnect</button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">Connect your Google account to sync appointments to your calendar.</span>
            <a href="/api/google/connect" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">Connect Google Calendar</a>
          </div>
        )}
      </section>
    </div>
  );
}
