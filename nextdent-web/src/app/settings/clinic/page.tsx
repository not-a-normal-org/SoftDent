import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getClinicConfig } from "@/lib/settings";
import ClinicConfigForm from "@/components/ClinicConfigForm";

export default async function ClinicSettingsPage() {
  await requireRole("OWNER");
  const { settings, rxDoc } = await getClinicConfig();

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Settings</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Clinic & letterhead</h1>
      <ClinicConfigForm settings={settings} rxDoc={rxDoc} />
    </div>
  );
}
