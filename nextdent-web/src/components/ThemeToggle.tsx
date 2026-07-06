"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.documentElement;
  // briefly enable color transitions so the switch animates smoothly
  el.classList.add("theme-transition");
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => el.classList.remove("theme-transition"), 320);
  el.classList.toggle("dark", dark);
}

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const ICON: Record<Theme, string> = { system: "🌓", light: "☀️", dark: "🌙" };

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(stored);
  }, []);

  // when following the system, react to OS theme changes live
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function set(t: Theme) {
    setTheme(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  }

  return (
    <button
      onClick={() => set(NEXT[theme])}
      title={`Theme: ${theme} — click for ${NEXT[theme]}`}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-base text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <span suppressHydrationWarning>{ICON[theme]}</span>
    </button>
  );
}
