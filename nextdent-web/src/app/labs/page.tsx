import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLabOrders, getLabEditorData } from "@/lib/labs";
import { setLabOrderStatus, deleteLabOrder } from "@/lib/actions/labs";
import { taka, fmtDate } from "@/lib/format";
import { labStatusMeta } from "@/lib/lab-constants";
import LabOrderForm from "@/components/LabOrderForm";

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireUser();
  const { all } = await searchParams;
  const showAll = all === "1";
  const [orders, editor] = await Promise.all([listLabOrders(!showAll), getLabEditorData()]);
  const today = new Date();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lab work</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{orders.length} {showAll ? "orders" : "open orders"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={showAll ? "/labs" : "/labs?all=1"} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            {showAll ? "Show open only" : "Show all"}
          </Link>
          <Link href="/labs/providers" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Labs →</Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No lab orders{showAll ? "" : " open"} — send one below.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((o) => {
              const overdue = o.expectedAt && !o.receivedAt && new Date(o.expectedAt) < today;
              const st = labStatusMeta(o.status);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/patients/${o.patient.id}`} className="font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400">{o.patient.fullName}</Link>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {o.workType ?? "Lab work"}{o.toothFdi ? ` · tooth ${o.toothFdi}` : ""}{o.shade ? ` · shade ${o.shade}` : ""} · {o.lab.name}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <div>sent {fmtDate(o.sentAt)}</div>
                    <div className={overdue ? "font-medium text-rose-600 dark:text-rose-400" : ""}>
                      due {fmtDate(o.expectedAt)}{overdue ? " · overdue" : ""}
                    </div>
                  </div>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">{taka(o.cost)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.chip}`}>{st.label}</span>
                  <div className="flex items-center gap-1">
                    <form action={setLabOrderStatus.bind(null, o.id, "RECEIVED")}>
                      <button className="rounded-md px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-500/10">Received</button>
                    </form>
                    <form action={setLabOrderStatus.bind(null, o.id, "FITTED")}>
                      <button className="rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">Fitted</button>
                    </form>
                    <Link href={`/labs/orders/${o.id}/edit`} className="px-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</Link>
                    <form action={deleteLabOrder.bind(null, o.id)}><button className="px-1 text-xs text-slate-300 hover:text-rose-600">✕</button></form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Send work to a lab</h2>
        {editor.labs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Add a lab first under <Link href="/labs/providers" className="text-teal-700 hover:underline dark:text-teal-400">Labs</Link>.</p>
        ) : <LabOrderForm labs={editor.labs} shades={editor.shades} />}
      </section>
    </div>
  );
}
