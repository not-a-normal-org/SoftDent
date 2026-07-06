"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_MODULES, canAccessModule } from "@/lib/modules";

export default function NavLinks({
  variant = "desktop",
  role,
  onNavigate,
}: {
  variant?: "desktop" | "mobile";
  role?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const base =
    variant === "mobile"
      ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]"
      : "rounded-lg px-3 py-1.5 text-sm";

  return (
    <>
      {NAV_MODULES.filter((m) => canAccessModule(m, role)).map((m) => {
        if (m.status === "soon") {
          return (
            <span key={m.key} className={`${base} cursor-default text-slate-400 dark:text-slate-500`}>
              {variant === "mobile" && <span>{m.icon}</span>}
              {m.label}
              <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                soon
              </span>
            </span>
          );
        }
        const on = active(m.href);
        return (
          <Link
            key={m.key}
            href={m.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={`${base} font-medium transition ${
              on
                ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {variant === "mobile" && <span>{m.icon}</span>}
            {m.label}
          </Link>
        );
      })}
    </>
  );
}
