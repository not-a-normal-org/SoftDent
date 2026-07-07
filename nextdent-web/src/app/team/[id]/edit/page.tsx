import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getStaff } from "@/lib/team";
import TeamForm from "@/components/TeamForm";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("OWNER");
  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (Number.isNaN(pid)) notFound();
  const staff = await getStaff(pid);
  if (!staff) notFound();

  return (
    <div className="space-y-6">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">← Team</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Edit — {staff.fullName}</h1>
      <TeamForm staff={staff} />
    </div>
  );
}
