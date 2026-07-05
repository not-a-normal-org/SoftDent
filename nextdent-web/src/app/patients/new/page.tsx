import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPatientFormLists } from "@/lib/lookups";
import PatientForm from "@/components/PatientForm";

export default async function NewPatientPage() {
  await requireUser();
  const lists = await getPatientFormLists();

  return (
    <div className="space-y-6">
      <Link href="/patients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400">
        ← All patients
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">New patient</h1>
      <PatientForm lists={lists} />
    </div>
  );
}
