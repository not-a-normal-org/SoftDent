import Link from "next/link";
import { requireRole } from "@/lib/auth";

const CARDS = [
  { href: "/settings/treatments", icon: "🦷", title: "Treatment catalog", desc: "Procedures & default prices used across billing" },
  { href: "/settings/lists", icon: "📋", title: "Lookup lists", desc: "Occupations, relations, chairs, shades, categories…" },
  { href: "/settings/rx-templates", icon: "℞", title: "Rx templates", desc: "Reusable prescription templates with drugs" },
  { href: "/settings/sms", icon: "💬", title: "SMS templates", desc: "Bangla appointment & payment messages, gateway balance" },
  { href: "/settings/sms/test", icon: "📲", title: "SMS test", desc: "Send a real message to check the gateway, and see recent sends" },
  { href: "/settings/clinic", icon: "🏥", title: "Clinic & letterhead", desc: "Schedule, Rx defaults, automation, prescription header/footer" },
  { href: "/settings/calendar", icon: "📆", title: "Google Calendar", desc: "Connect a Google account to sync appointments" },
  { href: "/audit", icon: "🛡", title: "Audit log", desc: "Who changed what, and when" },
];

export default async function SettingsPage() {
  await requireRole("OWNER");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xl dark:bg-slate-800">{c.icon}</span>
            <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{c.title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.desc}</p>
            <span className="mt-3 text-sm font-medium text-teal-700 dark:text-teal-400">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
