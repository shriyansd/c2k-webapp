"use client";

import type { PartTotal } from "@/lib/types";

// All-time totals across every volunteer, one tile per active part. Updated in
// real time by the parent's subscription. `live` indicates connection status.
export default function AggregateTotals({
  totals,
  live,
}: {
  totals: PartTotal[];
  live: boolean;
}) {
  return (
    <section
      aria-label="Aggregate totals"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">All-Time Totals</h2>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <div
            key={t.part_id}
            className="rounded-xl bg-slate-50 p-4 text-center"
          >
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {t.total}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">{t.name}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
