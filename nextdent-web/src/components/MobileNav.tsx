"use client";

import { useEffect, useState } from "react";
import NavLinks from "./NavLinks";
import PatientSearch from "./PatientSearch";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/format";

export default function MobileNav({ user }: { user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);

  // lock scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-80 max-w-[85%] flex-col bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white">🦷</span>
                NextDent
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <PatientSearch placeholder="Search patients…" />
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              <NavLinks variant="mobile" role={user.role} onNavigate={() => setOpen(false)} />
            </nav>

            <div className="flex items-center gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {initials(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{user.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{user.role}</div>
              </div>
              <form action={logout}>
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
