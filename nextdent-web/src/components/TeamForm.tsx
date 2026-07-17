"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { saveStaff, type StaffFormState } from "@/lib/actions/team";

type Staff = {
  id: number; fullName: string; nickName: string | null; primaryPhone: string | null; email: string | null; activeStatus: boolean;
  user: { username: string; role: string; activeStatus: boolean } | null;
  doctor: { degree: string | null; designation1: string | null; regNo: string | null; consultantSharePct: number; operatorSharePct: number; deductLabBeforeSplit: boolean } | null;
};

const ROLES = ["OWNER", "DOCTOR", "RECEPTIONIST", "ASSISTANT"];
const initial: StaffFormState = {};
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function TeamForm({ staff }: { staff?: Staff }) {
  const [state, action, pending] = useActionState(saveStaff, initial);
  const [wantLogin, setWantLogin] = useState<boolean>(!!staff?.user);
  const [isDoctor, setIsDoctor] = useState<boolean>(!!staff?.doctor);
  const editing = !!staff;

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={staff!.id} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">Person</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Full name <span className="text-rose-500">*</span></span>
            <input name="fullName" defaultValue={staff?.fullName ?? ""} required className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nickname</span>
            <input name="nickName" defaultValue={staff?.nickName ?? ""} className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
            <input name="primaryPhone" defaultValue={staff?.primaryPhone ?? ""} className={inputCls} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <input type="email" name="email" defaultValue={staff?.email ?? ""} className={inputCls} /></label>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="activeStatus" defaultChecked={staff ? staff.activeStatus : true} /> Active
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <input type="checkbox" checked={wantLogin} onChange={(e) => setWantLogin(e.target.checked)} /> Has a login account
        </label>
        {wantLogin && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</span>
              <input name="username" defaultValue={staff?.user?.username ?? ""} className={inputCls} /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
              <select name="role" defaultValue={staff?.user?.role ?? "RECEPTIONIST"} className={inputCls}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select></label>
            <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{editing ? "New password" : "Password"}</span>
              <input type="password" name="password" autoComplete="new-password" placeholder={editing ? "leave blank to keep" : ""} className={inputCls} /></label>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <input type="checkbox" name="isDoctor" checked={isDoctor} onChange={(e) => setIsDoctor(e.target.checked)} /> Is a doctor (for Rx letterhead)
        </label>
        {isDoctor && (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Degree</span>
                <input name="degree" defaultValue={staff?.doctor?.degree ?? ""} className={inputCls} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Designation</span>
                <input name="designation" defaultValue={staff?.doctor?.designation1 ?? ""} className={inputCls} /></label>
              <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">BMDC Reg No</span>
                <input name="regNo" defaultValue={staff?.doctor?.regNo ?? ""} className={inputCls} /></label>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenue contract</div>
              <p className="mt-0.5 text-xs text-slate-400">Their cut of a treatment; the clinic (chamber) keeps the remainder.</p>
              <div className="mt-2 grid gap-4 sm:grid-cols-3">
                <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Consultant share %</span>
                  <input type="number" step="0.5" min="0" max="100" name="consultantSharePct" defaultValue={staff?.doctor?.consultantSharePct ?? 20} className={inputCls} /></label>
                <label className="block"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Operator share %</span>
                  <input type="number" step="0.5" min="0" max="100" name="operatorSharePct" defaultValue={staff?.doctor?.operatorSharePct ?? 40} className={inputCls} /></label>
                <label className="flex items-center gap-2 pt-7 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" name="deductLabBeforeSplit" defaultChecked={staff?.doctor?.deductLabBeforeSplit ?? true} /> Deduct lab cost first
                </label>
              </div>
            </div>
          </>
        )}
      </section>

      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {pending ? "Saving…" : editing ? "Save changes" : "Add staff"}
        </button>
        <Link href="/team" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Link>
      </div>
    </form>
  );
}
