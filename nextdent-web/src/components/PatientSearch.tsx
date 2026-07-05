"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  id: number;
  fullName: string;
  primaryPhone: string | null;
  gender: string | null;
  dob: string | null;
};

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-teal-200/70 text-inherit dark:bg-teal-500/40 dark:text-teal-100">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function PatientSearch({
  size = "md",
  autoFocus = false,
  placeholder = "Search patients by name or phone…",
}: {
  size?: "md" | "lg";
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // debounced + stale-cancelling fetch
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const data = await res.json();
        setHits(data.results ?? []);
        setActive(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  // close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    router.push(`/patients/${hit.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const big = size === "lg";

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <svg className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${big ? "h-5 w-5" : "h-4 w-4"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${big ? "py-3.5 text-lg" : "py-2 text-sm"}`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500" />
          </span>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {hits.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No patients match “{q}”.</div>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {hits.map((h, i) => (
                <li key={h.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === active ? "bg-teal-50 dark:bg-teal-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{highlight(h.fullName, q)}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        #{h.id}{h.gender ? ` · ${h.gender}` : ""}
                      </span>
                    </span>
                    {h.primaryPhone && (
                      <span className="shrink-0 font-mono text-xs text-slate-600 dark:text-slate-300">{highlight(h.primaryPhone, q)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
            ↑↓ navigate · ↵ open · esc close
          </div>
        </div>
      )}
    </div>
  );
}
