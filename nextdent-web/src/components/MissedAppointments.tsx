"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { DateRangeControl } from "@/components/DateRangePicker";
import { CLOSED_STATUSES, STATUSES, statusMeta, type StatusKey } from "@/lib/appointment-constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { rangeLabel, type DateRange } from "@/lib/date-range";

type Sort = "date" | "patient" | "doctor" | "status";
type Dir = "asc" | "desc";
type Row = {
  id: number; appointmentDate: string | null; startsAt: string | null; endsAt: string | null;
  status: StatusKey; allocatedUnit: string | null; note: string | null;
  patientId: number; patientName: string; phone: string | null; doctorId: number | null; doctorName: string | null;
};
type Result = { rows: Row[]; total: number; all: number; counts: Partial<Record<StatusKey, number>>; page: number; pages: number };
type Query = { q: string; range: DateRange | null; doctor: string; status: StatusKey | ""; sort: Sort; dir: Dir; page: number };

const PAGE_SIZE = 25; // MISSED_PAGE_SIZE in lib/appointments (server-only, so not imported)
const OPEN = STATUSES.filter((s) => !CLOSED_STATUSES.includes(s.key));
const SORT_LABEL: Record<Sort, string> = { date: "Date", patient: "Patient", doctor: "Doctor", status: "Status" };
// the direction a column sorts in the first time it is chosen: newest first, names A→Z
const FIRST_DIR: Record<Sort, Dir> = { date: "desc", patient: "asc", doctor: "asc", status: "asc" };

const url = (q: Query) => {
  const u = new URLSearchParams();
  if (q.q.trim()) u.set("q", q.q.trim());
  if (q.range) { u.set("from", q.range.from); u.set("to", q.range.to); }
  if (q.doctor) u.set("doctor", q.doctor);
  if (q.status) u.set("status", q.status);
  u.set("sort", q.sort);
  u.set("dir", q.dir);
  u.set("page", String(q.page));
  return `/api/appointments/missed?${u}`;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const control =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
const chip = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition ${active
    ? "bg-teal-600 text-white"
    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`;
// one grid for the header and every row: on a phone a row stacks (when / patient +
// status / doctor); from sm up it lines up as four columns under the sort headers
const cols = "sm:grid-cols-[11rem_minmax(0,1fr)_minmax(0,12rem)_9rem]";

/**
 * "Show all missed appointments": a button that opens every missed appointment in a
 * dialog — newest first, searchable, sortable and filterable, a page at a time from
 * /api/appointments/missed. The dialog's state is its own and starts afresh each time
 * it opens (from `range`, if given): it is a look-up, not a view worth bookmarking.
 *
 * A native <dialog> opened with showModal(): the page behind it is inert and Esc
 * closes it. Tab is also wrapped by hand, so focus cannot leave for the browser's
 * toolbar, and on close focus goes back to the button that opened it.
 */
export default function MissedAppointments({ doctors, today, range = null, label, variant = "button" }: {
  doctors: { id: number; name: string }[];
  today: string;
  /** open filtered to these dates; null (the default) is every missed appointment */
  range?: DateRange | null;
  label: string;
  variant?: "button" | "link";
}) {
  const initial: Query = { q: "", range, doctor: "", status: "", sort: "date", dir: "desc", page: 1 };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<Query>(initial);
  const [result, setResult] = useState<{ url: string; data?: Result; error?: boolean } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  // Following a link out of the open dialog unmounts it without a close event, which
  // would leave the next page unable to scroll.
  useEffect(() => () => { document.documentElement.style.overflow = ""; }, []);

  const current = url(query);
  const loading = open && result?.url !== current;
  const data = result?.data;

  // Fetch whenever the query changes while open. Every change waits a moment, which is
  // the type-ahead debounce for the search box, and a newer query aborts an older one
  // so a slow response cannot overwrite a fresh one.
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetch(current, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: Result) => setResult({ url: current, data: d }))
        .catch(() => { if (!ac.signal.aborted) setResult((prev) => ({ url: current, data: prev?.data, error: true })); });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [open, current]);

  const set = (change: Partial<Query>) => setQuery((q) => ({ ...q, page: 1, ...change }));
  const sortBy = (s: Sort) => set({ sort: s, dir: query.sort === s ? (query.dir === "asc" ? "desc" : "asc") : FIRST_DIR[s] });

  const show = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setQuery(initial);
    setOpen(true);
    dialog.current?.showModal();
    // the page behind should not scroll under the dialog's own list
    document.documentElement.style.overflow = "hidden";
    search.current?.focus();
  };
  // runs however the dialog closed: the ✕, Esc (native), or a click on the backdrop
  const onClose = () => {
    setOpen(false);
    document.documentElement.style.overflow = "";
    opener.current?.focus();
  };
  const hide = () => dialog.current?.close();

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const shownFrom = data && data.total > 0 ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const shownTo = data ? Math.min(data.page * PAGE_SIZE, data.total) : 0;
  const statusChips = OPEN.filter((s) => (data?.counts[s.key] ?? 0) > 0 || s.key === query.status);

  return (
    <>
      <button type="button" onClick={show}
        className={variant === "button"
          ? "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          : "font-medium text-teal-700 hover:underline dark:text-teal-400"}>
        {label}
      </button>

      <dialog ref={dialog} onClose={onClose} onKeyDown={trapTab}
        onClick={(e) => { if (e.target === dialog.current) hide(); }}
        aria-labelledby={titleId}
        className="m-auto hidden h-[min(92dvh,56rem)] max-h-none w-[min(64rem,calc(100vw-1rem))] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl open:flex backdrop:bg-slate-950/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-base font-semibold">Missed appointments</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Booked for a time that has passed and never marked done or cancelled.
            </p>
          </div>
          <button type="button" onClick={hide} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">✕</button>
        </header>

        <div className="space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
          <input ref={search} type="search" value={query.q} onChange={(e) => set({ q: e.target.value })}
            placeholder="Search by name, phone or patient ID…" aria-label="Search missed appointments"
            className={`${control} w-full`} />
          <DateRangeControl value={query.range} today={today} allowAll label="Appointment dates"
            onChange={(r) => set({ range: r })} />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select value={query.doctor} onChange={(e) => set({ doctor: e.target.value })} aria-label="Doctor"
              className={`${control} col-span-2 min-w-0 sm:w-56`}>
              <option value="">All doctors</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={query.sort} onChange={(e) => set({ sort: e.target.value as Sort, dir: FIRST_DIR[e.target.value as Sort] })}
              aria-label="Sort by" className={`${control} min-w-0 sm:w-40`}>
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => <option key={s} value={s}>Sort: {SORT_LABEL[s]}</option>)}
            </select>
            <button type="button" onClick={() => set({ dir: query.dir === "asc" ? "desc" : "asc" })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {query.sort === "date"
                ? (query.dir === "desc" ? "Newest first" : "Oldest first")
                : (query.dir === "asc" ? "A → Z" : "Z → A")}
            </button>
          </div>
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={query.status === ""} className={chip(query.status === "")} onClick={() => set({ status: "" })}>
              All <span className="tabular-nums opacity-75">{data ? data.all.toLocaleString() : "…"}</span>
            </button>
            {statusChips.map((s) => (
              <button key={s.key} type="button" aria-pressed={query.status === s.key} className={chip(query.status === s.key)}
                onClick={() => set({ status: s.key })}>
                {s.label} <span className="tabular-nums opacity-75">{(data?.counts[s.key] ?? 0).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`hidden border-b border-slate-100 px-5 py-2 text-xs text-slate-400 sm:grid sm:gap-x-4 dark:border-slate-800 dark:text-slate-500 ${cols}`}>
          {(["date", "patient", "doctor", "status"] as Sort[]).map((s) => {
            const active = query.sort === s;
            return (
              <button key={s} type="button" onClick={() => sortBy(s)}
                aria-label={`Sort by ${SORT_LABEL[s].toLowerCase()}`}
                className={`inline-flex items-center gap-1 justify-self-start font-medium hover:text-slate-700 dark:hover:text-slate-200 ${active ? "text-slate-700 dark:text-slate-200" : ""}`}>
                {SORT_LABEL[s]}
                <span aria-hidden className={active ? "" : "opacity-0"}>{active && query.dir === "asc" ? "▲" : "▼"}</span>
              </button>
            );
          })}
        </div>

        <div aria-live="polite" aria-busy={loading} className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${loading && data ? "opacity-60" : ""}`}>
          {!data ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {result?.error ? "Could not load the list. Close and try again." : "Loading…"}
            </p>
          ) : data.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {query.q.trim() ? <>No missed appointments match “{query.q.trim()}”.</> : "No missed appointments here."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rows.map((r) => {
                const m = statusMeta(r.status);
                return (
                  <li key={r.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 sm:px-5 ${cols}`}>
                    <div className="col-span-2 whitespace-nowrap text-xs tabular-nums text-slate-500 sm:col-span-1 sm:text-sm sm:text-slate-700 dark:text-slate-400 sm:dark:text-slate-300">
                      {fmtDate(r.appointmentDate ?? r.startsAt)}
                      {r.startsAt && <span className="text-slate-400 dark:text-slate-500"> · {fmtTime(r.startsAt)}</span>}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/patients/${r.patientId}`} className="block truncate text-sm font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400">
                        {r.patientName}
                      </Link>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        #{r.patientId}
                        {r.phone && <> · <a href={`tel:${r.phone}`} className="hover:text-teal-700 dark:hover:text-teal-400">{r.phone}</a></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-self-end sm:order-last sm:justify-self-start">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m.chip}`}>{m.label}</span>
                      <Link href={`/appointments/${r.id}/edit`} aria-label={`Edit appointment for ${r.patientName}`}
                        className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</Link>
                    </div>
                    <div className="col-span-2 truncate text-xs text-slate-500 sm:col-span-1 sm:text-sm sm:text-slate-600 dark:text-slate-400 sm:dark:text-slate-300">
                      {r.doctorName ?? "No doctor"}{r.allocatedUnit ? <span className="text-slate-400 dark:text-slate-500"> · {r.allocatedUnit}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">
          <span>
            {data ? <>Showing <span className="tabular-nums">{shownFrom.toLocaleString()}–{shownTo.toLocaleString()}</span> of <span className="tabular-nums">{data.total.toLocaleString()}</span> · {rangeLabel(query.range, today)}</> : " "}
          </span>
          {data && data.pages > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-1">
              <button type="button" disabled={data.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: data.page - 1 }))}
                className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
                aria-label="Previous page">‹</button>
              <span className="tabular-nums">Page {data.page} of {data.pages}</span>
              <button type="button" disabled={data.page >= data.pages} onClick={() => setQuery((q) => ({ ...q, page: data.page + 1 }))}
                className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
                aria-label="Next page">›</button>
            </nav>
          )}
        </footer>
      </dialog>
    </>
  );
}
