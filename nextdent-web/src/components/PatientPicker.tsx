"use client";

import { useEffect, useRef, useState } from "react";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

// Type-ahead patient search in *select* mode (calls onPick instead of navigating).
export default function PatientPicker({
  onPick,
  placeholder = "Search patient by name or phone…",
}: {
  onPick: (p: { id: number; name: string }) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: number; fullName: string; primaryPhone: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const data = await res.json();
        setHits(data.results ?? []);
        setOpen(true);
      } catch { /* ignore */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)} placeholder={placeholder} className={inputCls} />
      {open && q.trim().length >= 2 && hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <ul className="max-h-64 overflow-auto py-1">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => { onPick({ id: h.id, name: h.fullName }); setOpen(false); setQ(""); }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{h.fullName}</span>
                  {h.primaryPhone && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{h.primaryPhone}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
