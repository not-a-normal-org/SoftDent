// Odontogram (permanent dentition, FDI notation). Teeth that appear in the
// patient's treatment history are highlighted; hover shows the procedures.

const Q1 = [18, 17, 16, 15, 14, 13, 12, 11]; // upper right
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28]; // upper left
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41]; // lower right
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38]; // lower left

function Tooth({ fdi, labels }: { fdi: number; labels?: string[] }) {
  const treated = !!labels?.length;
  return (
    <div
      title={treated ? `Tooth ${fdi}: ${labels!.join(", ")}` : `Tooth ${fdi}`}
      className={`flex w-7 shrink-0 flex-col items-center gap-0.5 ${treated ? "" : "opacity-70"}`}
    >
      <div
        className={`grid h-8 w-7 place-items-center rounded-md border text-[10px] font-semibold ${
          treated
            ? "border-teal-500 bg-teal-500 text-white shadow-sm"
            : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
        }`}
      >
        🦷
      </div>
      <span className={`text-[10px] ${treated ? "font-semibold text-teal-700 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`}>{fdi}</span>
    </div>
  );
}

function Row({ left, right, teeth }: { left: number[]; right: number[]; teeth: Record<string, string[]> }) {
  return (
    <div className="flex items-start justify-center gap-1">
      <div className="flex gap-1">{left.map((f) => <Tooth key={f} fdi={f} labels={teeth[String(f)]} />)}</div>
      <div className="mx-1 self-stretch border-l border-dashed border-slate-300 dark:border-slate-600" />
      <div className="flex gap-1">{right.map((f) => <Tooth key={f} fdi={f} labels={teeth[String(f)]} />)}</div>
    </div>
  );
}

export default function DentalChart({ teeth }: { teeth: Record<string, string[]> }) {
  const count = Object.keys(teeth).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dental chart</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {count ? `${count} tooth${count > 1 ? "/teeth" : ""} with recorded work` : "no charted work yet"}
        </span>
      </div>
      <div className="space-y-2 overflow-x-auto">
        <Row left={Q1} right={Q2} teeth={teeth} />
        <div className="mx-auto h-px w-full max-w-md bg-slate-100 dark:bg-slate-800" />
        <Row left={Q4} right={Q3} teeth={teeth} />
      </div>
      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
        FDI notation · derived from treatment records (parsed from case & procedure names).
      </p>
    </div>
  );
}
