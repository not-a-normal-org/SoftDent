import Link from "next/link";
import PatientSearch from "./PatientSearch";
import NavLinks from "./NavLinks";
import MobileNav from "./MobileNav";
import ThemeToggle from "./ThemeToggle";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/format";

export default async function NavBar() {
  const user = await getCurrentUser();
  if (!user) return null; // no chrome on the login screen

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-white">🦷</span>
          <span className="text-lg tracking-tight">NextDent</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <NavLinks variant="desktop" role={user.role} />
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block">
          <PatientSearch />
        </div>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <ThemeToggle />
          <div className="text-right">
            <div className="text-sm font-medium leading-tight text-slate-800 dark:text-slate-200">{user.name}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{user.role}</div>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" title={user.name}>
            {initials(user.name)}
          </span>
          <form action={logout}>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Sign out
            </button>
          </form>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:hidden">
          <ThemeToggle />
          <MobileNav user={{ name: user.name, role: user.role }} />
        </div>
      </div>
    </header>
  );
}
