"use client";

import { useRef, useState } from "react";
import type { DayRange, Granularity } from "@/lib/payout-period";

/**
 * "Export" button and its dialog. A native <dialog> opened with showModal(), so the
 * browser traps focus inside it, Esc closes it, and the page behind is inert; focus
 * goes back to the button on close. The form is a plain GET to the export route, which
 * answers with a file, so the page stays where it is.
 */
export default function PayoutExport({ range, doctors, member = "all", by = "month" }: {
  range: DayRange;
  doctors: { id: number; name: string }[];
  /** preselected for the line-item export: a doctor's id, or "all" */
  member?: string;
  by?: Granularity;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<"summary" | "detail">("summary");
  const close = () => dialog.current?.close();

  const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]";
  const option = (active: boolean) =>
    `flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition ${active
      ? "border-teal-500 bg-teal-50/60 dark:border-teal-500/70 dark:bg-teal-500/10"
      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"}`;

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M10 3v10m0 0-4-4m4 4 4-4M4 15v1.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="payout-export-title"
        onClose={() => opener.current?.focus()}
        // a click on the backdrop lands on the dialog element itself
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <form
          key={`${range.from}|${range.to}|${member}`}
          method="get"
          action="/team/payouts/export"
          // the response is a download, so close once the browser has taken the request
          onSubmit={() => setTimeout(close, 0)}
          className="max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto p-5"
        >
          <div>
            <h2 id="payout-export-title" className="text-base font-semibold">Export payouts</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A CSV file that opens in Excel, Bangla names included.</p>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">Dates paid</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">From
                <input type="date" name="from" defaultValue={range.from ?? ""} className={field} />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">To
                <input type="date" name="to" defaultValue={range.to ?? ""} className={field} />
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-400">Leave both empty for all time.</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">What to export</legend>
            <label className={option(kind === "summary")}>
              <input type="radio" name="kind" value="summary" checked={kind === "summary"} onChange={() => setKind("summary")} className="mt-0.5 accent-teal-600" />
              <span>
                <span className="font-medium">Summary</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">One row per period, a column for each doctor and the chamber, and a total row. For paying people.</span>
              </span>
            </label>
            <label className={option(kind === "detail")}>
              <input type="radio" name="kind" value="detail" checked={kind === "detail"} onChange={() => setKind("detail")} className="mt-0.5 accent-teal-600" />
              <span>
                <span className="font-medium">Line items</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Every payment: date, patient, procedure, and each person&apos;s %, share and role. For checking a figure.</span>
              </span>
            </label>
          </fieldset>

          {kind === "summary" ? (
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">One row per
              <select name="by" defaultValue={by} className={field}>
                <option value="month">Month</option>
                <option value="day">Day</option>
                <option value="year">Year</option>
              </select>
            </label>
          ) : (
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Payments involving
              <select name="member" defaultValue={member} className={field}>
                <option value="all">Everyone (all payments)</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Download CSV</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
