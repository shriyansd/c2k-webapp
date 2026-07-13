"use client";

import type { Part, PartTotal } from "@/lib/types";

// One stepper per active part: a large minus on the left, the part name in the
// middle, and a large plus on the right. Plus logs a contribution; minus removes
// the most recent one. Big tap targets for one-handed phone use.
export default function PartButtonGrid({
  parts,
  totals,
  onAdd,
  onRemove,
  busy,
}: {
  parts: Part[];
  totals: PartTotal[];
  onAdd: (part: Part) => void;
  onRemove: (part: Part) => void;
  busy: boolean;
}) {
  return (
    <section aria-label="Log a part">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Log a Part</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {parts.map((part) => {
          const total = totals.find((t) => t.part_id === part.id)?.total ?? 0;
          return (
            <div
              key={part.id}
              className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => onRemove(part)}
                disabled={busy || total <= 0}
                aria-label={`Remove one ${part.name}`}
                className="flex w-16 shrink-0 items-center justify-center bg-slate-100 text-3xl font-bold text-slate-600 transition active:scale-95 hover:bg-slate-200 disabled:opacity-40"
              >
                −
              </button>

              <div className="flex flex-1 flex-col items-center justify-center px-2 py-4 text-center">
                <span className="text-base font-semibold text-slate-900">
                  {part.name}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {total}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onAdd(part)}
                disabled={busy}
                aria-label={`Add one ${part.name}`}
                className="flex w-16 shrink-0 items-center justify-center bg-brand text-3xl font-bold text-white transition active:scale-95 hover:bg-brand-dark disabled:opacity-60"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
      {parts.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No parts are available right now. Check back later.
        </p>
      )}
    </section>
  );
}
