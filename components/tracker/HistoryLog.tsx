"use client";

import type { HistoryEntry } from "@/lib/types";
import { relativeTime } from "@/lib/time";

// Compact list of the volunteer's most recent contributions.
export default function HistoryLog({ entries }: { entries: HistoryEntry[] }) {
  return (
    <section aria-label="Recent activity">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Recent Activity
      </h2>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Nothing logged yet. Tap a part above to get started.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-800">
                {entry.part_name}
              </span>
              <span className="text-slate-400">
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
