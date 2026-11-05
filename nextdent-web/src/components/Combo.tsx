"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A searchable dropdown, used everywhere the app used to have a bare <select> or an
 * <input list="…"> datalist.
 *
 * Why not either of those:
 *   - <select> cannot be typed into. Fine for three options, useless for the lookup
 *     lists this clinic actually has (64 addresses, 19 relations, 76 treatments) and
 *     hopeless for the ones coming.
 *   - <datalist> can, but the browser decides how it filters and how much it shows,
 *     Safari and Firefox disagree with Chrome, and it cannot show a secondary label.
 *
 * It posts through a hidden input, so every server action keeps receiving the same
 * field under the same name and nothing on the server had to change.
 *
 * Built for lists that grow: matching is scored rather than a plain substring test,
 * and only `maxRender` rows are ever put in the DOM — the rest are counted, not
 * rendered, so a 35,000-entry list opens as fast as a three-entry one.
 */

export type ComboOption = { value: string; label: string; hint?: string };
type Input = readonly (string | ComboOption)[];

const normalise = (o: Input): ComboOption[] =>
  o.map((x) => (typeof x === "string" ? { value: x, label: x } : x));

/**
 * Lower is better; -1 means no match. Ranked so that what you typed at the start of
 * a word beats a hit buried in the middle, and a subsequence ("amx" → "Amoxicillin")
 * still matches but comes last.
 */
function score(label: string, q: string): number {
  if (!q) return 0;
  const l = label.toLowerCase();
  const i = l.indexOf(q);
  if (i === 0) return 0;
  if (i > 0) return /[\s\-/(]/.test(l[i - 1]) ? 1 : 2;
  // subsequence: every character of the query appears in order
  let k = 0;
  for (const ch of l) if (ch === q[k] && ++k === q.length) return 3;
  return -1;
}

export default function Combo({
  options,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  emptyLabel,
  allowCustom = false,
  disabled = false,
  required = false,
  className = "",
  maxRender = 100,
  search,
  "aria-label": ariaLabel,
}: {
  options?: Input;
  /** renders a hidden input, so the value posts with the surrounding form */
  name?: string;
  /** controlled value; omit for uncontrolled and pass defaultValue instead */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** label for the "no selection" row; omit to make clearing impossible */
  emptyLabel?: string;
  /** keep whatever was typed even when it matches nothing — replaces a datalist */
  allowCustom?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  maxRender?: number;
  /**
   * Fetch candidates from the server instead of filtering a list held in the browser.
   * For catalogues too big to ship — the drug table alone is 34,914 rows, about 2 MB
   * of JSON, which no form should be sending to a phone on a Barishal connection.
   */
  search?: (query: string) => Promise<readonly (string | ComboOption)[]>;
  "aria-label"?: string;
}) {
  const opts = useMemo(() => normalise(options ?? []), [options]);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = not being typed in
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<ComboOption[]>([]);
  // which query `remote` actually answers. Without this the list keeps showing the
  // PREVIOUS query's rows for the debounce plus the round trip, with row 0
  // highlighted — long enough for Enter to commit "Paracetamol" into a field the
  // user had just retyped as "insulin".
  const [remoteFor, setRemoteFor] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = opts.find((o) => o.value === current) ?? null;
  // what the box shows: the typed query while typing, otherwise the chosen label.
  // A custom value that matches no option still shows itself rather than vanishing.
  // Show the stored value even when it is not one of the options. 480 patients hold
  // marital status "Unmarried", which no list offered — the box rendered empty while
  // the hidden input still posted it, so the field looked unset on a third of the
  // records and one careless click would overwrite it.
  const shown = query ?? selected?.label ?? current;

  const matches = useMemo(() => {
    // The server already ranked a remote search; re-sorting it here would only
    // second-guess a better-informed ordering (the drug search weights by usage).
    if (search) {
      const q = (query ?? "").trim();
      // nothing typed, or the results on hand answer a different query: show no rows
      // rather than rows that do not match what is in the box
      if (!q || remoteFor !== q) return { rows: [], total: 0 };
      return { rows: remote.slice(0, maxRender), total: remote.length };
    }
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return { rows: opts.slice(0, maxRender), total: opts.length };
    const scored: { o: ComboOption; s: number }[] = [];
    for (const o of opts) {
      const s = score(o.label, q);
      if (s >= 0) scored.push({ o, s });
    }
    scored.sort((a, b) => a.s - b.s || a.o.label.length - b.o.label.length);
    return { rows: scored.slice(0, maxRender).map((x) => x.o), total: scored.length };
  }, [opts, query, maxRender, search, remote, remoteFor]);

  // debounced remote lookup; the last response wins, earlier ones are discarded
  const seq = useRef(0);
  useEffect(() => {
    if (!search) return;
    const q = (query ?? "").trim();
    if (!q) return; // nothing to fetch; `matches` ignores stale results when empty
    const mine = ++seq.current;
    // every setState sits inside the timeout, never in the effect body, so this
    // cannot cascade a render the moment the query changes
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search(q);
        if (mine === seq.current) { setRemote(normalise(r)); setRemoteFor(q); }
      } catch {
        if (mine === seq.current) { setRemote([]); setRemoteFor(q); }
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, search]);

  // A new query means the old highlight is meaningless. Adjusted during render
  // rather than in an effect, so the list never paints with a stale row highlighted.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) { setLastQuery(query); setActive(0); }

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      // close(true): a click on Save is the commonest way to leave this box, and
      // discarding what was typed there loses the custom term the picker exists to
      // allow. Where free text is not allowed, close() still snaps back.
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close(true);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, current]);

  function commit(v: string) {
    if (!controlled) setInner(v);
    onChange?.(v);
    setQuery(null);
    setOpen(false);
  }

  /** Leaving the box: keep free text where that is allowed, otherwise snap back. */
  function close(keepTyped: boolean) {
    if (keepTyped && allowCustom && query !== null) commit(query.trim());
    else { setQuery(null); setOpen(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const n = matches.rows.length;
      if (!n) return;
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Enter") {
      // Only swallow Enter while the list is open, so the key still submits the form
      // the rest of the time.
      if (!open) return;
      e.preventDefault();
      const hit = matches.rows[active];
      if (hit) commit(hit.value);
      else close(true);
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); }
      setQuery(null);
      setOpen(false);
    } else if (e.key === "Tab") {
      close(true);
    }
  }

  const base =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <div ref={boxRef} className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches.rows[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        // `required` lives on the visible box so the browser can focus it; the hidden
        // input cannot be focused and would make the form unsubmittable in silence.
        // Validity is mirrored from `current` (what actually posts), not from the text
        // on screen — otherwise typing something that matches nothing satisfies the
        // browser while an empty value is submitted.
        required={required}
        ref={(el) => {
          inputRef.current = el;
          el?.setCustomValidity(required && !current ? "Choose one of the options." : "");
        }}
        value={shown}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        className={`${className || base} pr-8 ${allowCustom ? "" : "cursor-pointer"}`}
      />

      {loading && (
        <span className="pointer-events-none absolute right-7 top-1/2 block h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500" />
      )}

      {/* clear, when there is something to clear and a blank is a legal value */}
      {emptyLabel && current && !disabled ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          onClick={() => { commit(""); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ✕
        </button>
      ) : (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">▾</span>
      )}

      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <ul id={listId} role="listbox" className="max-h-64 overflow-auto py-1">
            {emptyLabel && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit("")}
                  className="w-full px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-700/50"
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {matches.rows.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === current}
                  onMouseEnter={() => setActive(i)}
                  // keep focus in the input so blur does not fire before the click
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(o.value)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                    i === active ? "bg-teal-50 dark:bg-teal-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  } ${o.value === current ? "font-medium" : ""} text-slate-900 dark:text-slate-100`}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{o.hint}</span>}
                </button>
              </li>
            ))}

            {matches.rows.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                {loading || (search && (query ?? "").trim() !== "" && remoteFor !== (query ?? "").trim())
                  ? "Searching…"
                  : search && !(query ?? "").trim()
                    ? "Type to search"
                    : allowCustom
                      ? `Press Enter to use “${(query ?? "").trim()}”`
                      : "Nothing matches"}
              </li>
            )}
          </ul>

          {matches.total > matches.rows.length && (
            <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              Showing {matches.rows.length} of {matches.total.toLocaleString()} — keep typing to narrow
            </div>
          )}
        </div>
      )}
    </div>
  );
}
