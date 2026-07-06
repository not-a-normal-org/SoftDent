"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
    >
      🖨 Print / PDF
    </button>
  );
}
