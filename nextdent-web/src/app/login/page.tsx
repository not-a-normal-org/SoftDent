import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/patients");

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-600 text-white">🦷</span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">NextDent</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Practice Manager — sign in</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
