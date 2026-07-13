"use client";

import type { PartTotal } from "@/lib/types";

// Personal stat cards — one per active part, showing the volunteer's all-time
// total for that part. These are the numbers volunteers use for service records.
export default function PersonalTotals({ totals }: { totals: PartTotal[] }) {
  return (
    <section aria-label="Your totals">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Your Totals</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {totals.map((t) => (
          <div
            key={t.part_id}
            className="rounded-xl border border-slate-200 bg-white p-4"
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
