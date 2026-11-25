"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { placeId: string; text: string; main: string; secondary: string };

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

/**
 * The patient's address, with Google's suggestions for addresses in Bangladesh as
 * you type. A suggestion only fills the box: the address is still free text, so a
 * house number or a landmark ("beside Press Club") can be added, and an address
 * Google does not know can be typed in full.
 *
 * `suggest` is false when the server has no Google key; the field is then a plain
 * text box and makes no requests at all.
 */
export default function AddressField({
  name, defaultValue, suggest, className = "", placeholder,
}: {
  name: string; defaultValue?: string | null; suggest: boolean; className?: string; placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  // One token per address entry: Google groups the keystrokes of one search under it
  // for billing. A new one is minted after each pick, for the next search.
  const session = useRef<string | undefined>(undefined);
  const inflight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort();
  }, []);

  function newSession() {
    session.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
  }

  function lookup(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (!suggest || q.trim().length < MIN_CHARS) {
      inflight.current?.abort();
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      // a slower, older answer must never overwrite a newer one
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      if (!session.current) newSession();
      const qs = new URLSearchParams({ q: q.trim() });
      if (session.current) qs.set("s", session.current);
      try {
        const res = await fetch(`/api/places/autocomplete?${qs}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results?: Suggestion[] };
        const results = data.results ?? [];
        setItems(results);
        setActive(-1);
        setOpen(results.length > 0);
      } catch {
        // aborted or offline: keep typing, no suggestions
      }
    }, DEBOUNCE_MS);
  }

  function choose(s: Suggestion) {
    setValue(s.text);
    setItems([]);
    setOpen(false);
    setActive(-1);
    newSession();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // picking a suggestion must not submit the patient form
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => { setValue(e.target.value); lookup(e.target.value); }}
        onKeyDown={onKeyDown}
        onFocus={() => { if (items.length) setOpen(true); }}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        autoComplete={suggest ? "off" : "street-address"}
        role={suggest ? "combobox" : undefined}
        aria-autocomplete={suggest ? "list" : undefined}
        aria-expanded={suggest ? open : undefined}
        aria-controls={suggest ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className={className}
      />
      {suggest && open && items.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <ul id={listId} role="listbox" aria-label="Address suggestions" className="max-h-72 overflow-y-auto py-1">
            {items.map((s, i) => (
              <li
                key={s.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: a click would blur the input and close the list first
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-teal-50 dark:bg-teal-500/15" : ""}`}
              >
                <span className="block text-slate-900 dark:text-slate-100">{s.main}</span>
                {s.secondary && <span className="block text-xs text-slate-500 dark:text-slate-400">{s.secondary}</span>}
              </li>
            ))}
          </ul>
          {/* Google's terms require attribution where its suggestions appear without a map */}
          <div className="border-t border-slate-100 px-3 py-1 text-right text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
