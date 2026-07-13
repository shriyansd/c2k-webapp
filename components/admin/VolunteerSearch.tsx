"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Spinner from "@/components/ui/Spinner";

type VolunteerRow = { id: string; display_name: string | null };
type VolunteerStat = {
  part_id: string;
  name: string;
  is_active: boolean;
  total: number;
};

// Admin tool: search volunteers by username and view their per-part stats.
// Search runs on submit (Enter / button) — no per-keystroke queries, no polling.
export default function VolunteerSearch() {
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VolunteerRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState<VolunteerRow | null>(null);
  const [stats, setStats] = useState<VolunteerStat[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setSelected(null);
    setStats(null);

    const { data, error: searchError } = await supabase
      .from("volunteers")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .order("display_name")
      .limit(25);

    if (searchError) {
      setError("Search failed. Please try again.");
      setResults(null);
    } else {
      setResults((data ?? []) as VolunteerRow[]);
    }
    setSearching(false);
  }

  async function loadStats(volunteer: VolunteerRow) {
    setSelected(volunteer);
    setStats(null);
    setLoadingStats(true);
    setError(null);

    const { data, error: statsError } = await supabase.rpc(
      "get_volunteer_part_totals",
      { v_id: volunteer.id }
    );

    if (statsError) {
      setError("Could not load stats. Please try again.");
    } else {
      setStats((data ?? []) as VolunteerStat[]);
    }
    setLoadingStats(false);
  }

  const grandTotal = (stats ?? []).reduce((sum, s) => sum + s.total, 0);

  return (
    <section
      aria-label="Volunteer stats"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Volunteer Stats
      </h2>

      <form onSubmit={runSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {searching && (
            <Spinner label="Searching" className="border-white/40 border-t-white" />
          )}
          Search
        </button>
      </form>

      <div className="mb-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>

      {/* Results list */}
      {results !== null && !selected && (
        <>
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">No volunteers found.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => loadStats(v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">
                      {v.display_name ?? "Unnamed"}
                    </span>
                    <span className="text-xs text-brand">View stats →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Selected volunteer's stats */}
      {selected && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">
                {selected.display_name ?? "Unnamed"}
              </div>
              {stats && (
                <div className="text-xs text-slate-500">
                  {grandTotal} total part{grandTotal === 1 ? "" : "s"} logged
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setStats(null);
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ← Back
            </button>
          </div>

          {loadingStats ? (
            <div className="flex justify-center py-6">
              <Spinner label="Loading stats" />
            </div>
          ) : stats && stats.length === 0 ? (
            <p className="text-sm text-slate-500">
              This volunteer hasn&apos;t logged any parts yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(stats ?? []).map((s) => (
                <div
                  key={s.part_id}
                  className="rounded-xl bg-slate-50 p-3 text-center"
                >
                  <div className="text-xl font-bold tabular-nums text-slate-900">
                    {s.total}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {s.name}
                    {!s.is_active && (
                      <span className="ml-1 text-slate-400">(inactive)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
