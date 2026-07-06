"use client";

import { useEffect, useRef, useState } from "react";

export type Drug = {
  id: number;
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
};

export default function DrugPicker({ onPick }: { onPick: (d: Drug) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Drug[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(d: Drug) {
    onPick(d);
    setQ("");
    setHits([]);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">💊</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search 46,000 drugs by brand or generic…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500" />
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {hits.length === 0 && !loading ? (
            <div className="px-4 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No drugs match “{q}”.</div>
          ) : (
            <ul className="max-h-72 overflow-auto py-1">
              {hits.map((d, i) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(d)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left ${i === active ? "bg-teal-50 dark:bg-teal-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.brandName ?? d.genericName}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{d.genericName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {[d.dosageForm, d.strength].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
