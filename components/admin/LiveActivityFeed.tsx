"use client";

import type { ActivityEntry } from "@/lib/types";
import { relativeTime } from "@/lib/time";

// Live activity stream — 20 most recent contributions across all volunteers,
// newest first. Fed by the parent's real-time subscription. No pagination.
export default function LiveActivityFeed({
  activity,
  live,
}: {
  activity: ActivityEntry[];
  live: boolean;
}) {
  return (
    <section
      aria-label="Live activity"
      className="rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-20"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Live Activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>

      {activity.length === 0 ? (
        <p className="text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ul className="space-y-1">
          {activity.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="font-medium text-slate-800">
                  {entry.volunteer_name}
                </span>{" "}
                <span className="text-slate-500">
                  added {entry.part_name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-400">
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
