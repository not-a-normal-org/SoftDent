import Link from "next/link";
import { requireRole } from "@/lib/auth";
import TeamForm from "@/components/TeamForm";

export default async function NewStaffPage() {
  await requireRole("OWNER");
  return (
    <div className="space-y-6">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Team</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Add staff member</h1>
      <TeamForm />
    </div>
  );
}
