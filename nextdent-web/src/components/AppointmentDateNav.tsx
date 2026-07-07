"use client";

import { useRouter } from "next/navigation";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AppointmentDateNav({ date }: { date: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/appointments?date=${d}`);
  const shift = (days: number) => {
    const d = new Date(`${date}T00:00`);
    d.setDate(d.getDate() + days);
    go(iso(d));
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} aria-label="Previous day"
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">◀</button>
      <button onClick={() => go(iso(new Date()))}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Today</button>
      <button onClick={() => shift(1)} aria-label="Next day"
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">▶</button>
      <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
    </div>
  );
}
