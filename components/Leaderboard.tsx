"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Spinner from "@/components/ui/Spinner";

type Period = "all" | "week" | "today";
type Row = { volunteer_id: string; display_name: string | null; total: number };

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "week", label: "This Week" },
  { key: "today", label: "Today" },
];

const RANK_BADGE = ["🥇", "🥈", "🥉"];

// Leaderboard ranking volunteers by parts logged. Filter by time period (tabs)
// and by part (dropdown). Data comes from the get_leaderboard RPC, which returns
// only usernames + counts. Fetches on filter change — user-driven, no polling.
export default function Leaderboard({
  parts,
  highlightId,
}: {
  parts: { id: string; name: string }[];
  highlightId?: string;
}) {
  const supabase = createClient();

  const [period, setPeriod] = useState<Period>("all");
  const [partId, setPartId] = useState<string>(""); // "" = all parts
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("get_leaderboard", {
        period,
        p_part_id: partId === "" ? null : partId,
      });

      if (cancelled) return;
      if (rpcError) {
        setError("Could not load the leaderboard. Please try again.");
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, period, partId]);

  return (
    <section
      aria-label="Leaderboard"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Leaderboard</h2>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Period tabs */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:inline-flex">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                period === p.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Part dropdown */}
        <select
          value={partId}
          onChange={(e) => setPartId(e.target.value)}
          aria-label="Filter by part"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All parts</option>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Loading leaderboard" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">
          No contributions logged for this filter yet.
        </p>
      ) : (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map((row, i) => {
            const isMe = row.volunteer_id === highlightId;
            return (
              <li
                key={row.volunteer_id}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                  isMe ? "bg-brand/5" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-7 shrink-0 text-center text-base">
                    {RANK_BADGE[i] ?? (
                      <span className="text-slate-400">{i + 1}</span>
                    )}
                  </span>
                  <span className="truncate font-medium text-slate-800">
                    {row.display_name ?? "Unnamed"}
                    {isMe && (
                      <span className="ml-1.5 text-xs font-normal text-brand">
                        (you)
                      </span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {row.total}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
