"use client";

import { useEffect, useRef } from "react";

const KEY = "nd.rx.bodyOnly";
const STYLE_ID = "rx-page-margins";

/**
 * The reserved space must be an @page margin, not padding on the article: padding is
 * applied once to the element box, so a prescription running onto a second sheet would
 * print over the letterhead on page 2. @page applies to every page.
 *
 * Injected as literal millimetres rather than var(), because Chrome does not reliably
 * resolve custom properties inside @page descriptors.
 *
 * The sides are always zero, and Full prints get no margin at all: the sheet is a
 * copy of the clinic's stationery, laid out from the paper's edge (.rx-paper in
 * globals.css), so a browser margin would shift it off the pre-printed rules or clip
 * it. Set here rather than globally so other printable pages (invoices) keep the
 * default margins.
 */
function applyPrintMode(on: boolean, topMm: number, bottomMm: number) {
  document.documentElement.classList.toggle("rx-body-only", on);
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = on
    ? `@page { size: A4; margin: ${topMm}mm 0 ${bottomMm}mm 0; }`
    : "@page { size: A4; margin: 0; }";
}

/**
 * Chooses between the two prescription print formats the clinic has always had:
 *
 *   Body / Short — prints the prescription only, for paper that already carries the
 *                  clinic letterhead. Blank space is reserved top and bottom so the
 *                  content clears what is pre-printed (tunable in Settings → Clinic).
 *   Full         — prints the letterhead too, for plain paper.
 *
 * The choice sticks per browser; the clinic-wide default (ClinicSetting.defaultRxType)
 * is only used until the operator picks for themselves.
 *
 * Deliberately uncontrolled: the stored preference can only be read after mount, and
 * mirroring it into React state would mean setting state from an effect. Writing to
 * the input ref and to <html> keeps that out of the render path and avoids a
 * server/client hydration mismatch on the checkbox.
 */
export default function RxPrintMode({
  defaultBodyOnly,
  topMm,
  bottomMm,
}: {
  defaultBodyOnly: boolean;
  topMm: number;
  bottomMm: number;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // private window or blocked storage — fall back to the clinic default
    }
    const on = stored === null ? defaultBodyOnly : stored === "1";
    if (ref.current) ref.current.checked = on;
    applyPrintMode(on, topMm, bottomMm);

    return () => {
      document.documentElement.classList.remove("rx-body-only");
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [defaultBodyOnly, topMm, bottomMm]);

  function onToggle(on: boolean) {
    applyPrintMode(on, topMm, bottomMm);
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // not being able to remember the choice must not stop them printing
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label
        className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
        title="Leave the header and footer off, for paper that already has the letterhead printed on it"
      >
        <input
          ref={ref}
          type="checkbox"
          defaultChecked={defaultBodyOnly}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-teal-600"
        />
        Pre-printed letterhead
      </label>
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
      >
        🖨 Print / PDF
      </button>
    </div>
  );
}
