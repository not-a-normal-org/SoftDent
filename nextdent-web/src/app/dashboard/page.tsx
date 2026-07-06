import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard";
import { CARD_MODULES, canAccessModule } from "@/lib/modules";
import { taka, fmtDate } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function metricFor(key: string, s: DashboardStats): string {
  switch (key) {
    case "patients": return `${s.patients.toLocaleString()} registered`;
    case "appointments": return `${s.appointmentsUpcoming} upcoming · ${s.appointmentsTotal} total`;
    case "prescriptions": return `${s.prescriptions} issued · ${s.rxTemplates} templates`;
    case "billing": return `${taka(s.due)} due · ${taka(s.billed)} billed`;
    case "finance": return `${taka(s.paid)} collected`;
    case "inventory": return s.vendors ? `${s.vendors} vendors` : "not in use yet";
    case "labs": return `${s.labs} lab${s.labs === 1 ? "" : "s"}`;
    case "team": return `${s.doctors} doctor${s.doctors === 1 ? "" : "s"} · ${s.staff} user${s.staff === 1 ? "" : "s"}`;
    case "settings": return `${s.drugs.toLocaleString()} drugs · catalogs`;
    default: return "";
  }
}

export default async function DashboardPage() {
  const user = await requireUser();
  const s = await getDashboardStats();

  const kpis = [
    { label: "Patients", value: s.patients.toLocaleString(), tone: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", href: "/patients" },
    { label: "Upcoming appointments", value: String(s.appointmentsUpcoming), tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
    { label: "Outstanding dues", value: taka(s.due), tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
    { label: "Prescriptions", value: String(s.prescriptions), tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {greeting()}, {user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{fmtDate(new Date())} · clinic overview</p>
      </header>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const tile = (
            <div className={`rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800 ${k.tone}`}>
              <div className="text-xs font-medium uppercase tracking-wide opacity-70">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</div>
            </div>
          );
          return k.href ? <Link key={k.label} href={k.href}>{tile}</Link> : <div key={k.label}>{tile}</div>;
        })}
      </section>

      {/* module cards */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_MODULES.filter((m) => canAccessModule(m, user.role)).map((m) => {
            const ready = m.status === "ready";
            const inner = (
              <div className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${ready ? "hover:border-teal-300 hover:shadow dark:hover:border-teal-700" : "opacity-75"}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${m.chip}`}>{m.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{m.label}</h3>
                      {!ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">Coming soon</span>}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{metricFor(m.key, s)}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{m.desc}</p>
                <div className={`mt-4 text-sm font-medium ${ready ? "text-teal-700 dark:text-teal-400" : "text-slate-300 dark:text-slate-600"}`}>
                  {ready ? "Open →" : "Not available yet"}
                </div>
              </div>
            );
            return ready
              ? <Link key={m.key} href={m.href} className="block">{inner}</Link>
              : <div key={m.key}>{inner}</div>;
          })}
        </div>
      </section>
    </div>
  );
}
