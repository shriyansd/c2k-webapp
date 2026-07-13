"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Spinner from "@/components/ui/Spinner";

type AdminRow = { volunteer_id: string; display_name: string | null };
type VolunteerRow = { id: string; display_name: string | null };

// Manage which volunteers are admins — no SQL required. Existing admins can
// promote a volunteer or revoke admin (RLS on the admins table enforces that
// only admins may do this). You cannot remove your own admin access here, to
// avoid accidentally locking yourself out.
export default function AdminManagement({
  currentVolunteerId,
}: {
  currentVolunteerId: string;
}) {
  const supabase = createClient();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VolunteerRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAdmins() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("admins")
      .select("volunteer_id, volunteers(display_name)");
    if (loadError) {
      setError("Could not load admins.");
    } else {
      const rows = (data ?? []) as unknown as {
        volunteer_id: string;
        volunteers: { display_name: string | null } | null;
      }[];
      setAdmins(
        rows
          .map((r) => ({
            volunteer_id: r.volunteer_id,
            display_name: r.volunteers?.display_name ?? null,
          }))
          .sort((a, b) =>
            (a.display_name ?? "").localeCompare(b.display_name ?? "")
          )
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adminIds = new Set(admins.map((a) => a.volunteer_id));

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    const { data, error: searchError } = await supabase
      .from("volunteers")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .order("display_name")
      .limit(25);
    if (searchError) {
      setError("Search failed.");
      setResults(null);
    } else {
      setResults((data ?? []) as VolunteerRow[]);
    }
    setSearching(false);
  }

  async function promote(v: VolunteerRow) {
    setBusyId(v.id);
    setError(null);
    const { error: insErr } = await supabase
      .from("admins")
      .insert({ volunteer_id: v.id });
    if (insErr && insErr.code !== "23505") {
      // 23505 = already an admin; treat as success.
      setError(insErr.message ?? "Could not grant admin.");
      setBusyId(null);
      return;
    }
    setAdmins((prev) =>
      adminIds.has(v.id)
        ? prev
        : [...prev, { volunteer_id: v.id, display_name: v.display_name }].sort(
            (a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "")
          )
    );
    setBusyId(null);
  }

  async function revoke(a: AdminRow) {
    setBusyId(a.volunteer_id);
    setError(null);
    const { error: delErr } = await supabase
      .from("admins")
      .delete()
      .eq("volunteer_id", a.volunteer_id);
    if (delErr) {
      setError(delErr.message ?? "Could not revoke admin.");
      setBusyId(null);
      return;
    }
    setAdmins((prev) => prev.filter((x) => x.volunteer_id !== a.volunteer_id));
    setBusyId(null);
  }

  return (
    <section
      aria-label="Manage admins"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Manage Admins
      </h2>

      <div className="mb-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>

      {/* Current admins */}
      <div className="mb-5">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Current admins
        </h3>
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner label="Loading admins" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-500">No admins yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {admins.map((a) => {
              const isSelf = a.volunteer_id === currentVolunteerId;
              return (
                <li
                  key={a.volunteer_id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-800">
                    {a.display_name ?? "Unnamed"}
                    {isSelf && (
                      <span className="ml-1.5 text-xs font-normal text-brand">
                        (you)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke(a)}
                    disabled={isSelf || busyId === a.volunteer_id}
                    title={
                      isSelf ? "You can't remove your own admin access" : "Revoke admin"
                    }
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                  >
                    {busyId === a.volunteer_id ? "…" : "Revoke"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Search + promote */}
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Add an admin
      </h3>
      <form onSubmit={runSearch} className="mb-3 flex gap-2">
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

      {results !== null &&
        (results.length === 0 ? (
          <p className="text-sm text-slate-500">No volunteers found.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {results.map((v) => {
              const already = adminIds.has(v.id);
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-800">
                    {v.display_name ?? "Unnamed"}
                  </span>
                  {already ? (
                    <span className="text-xs font-medium text-slate-400">
                      Already admin
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => promote(v)}
                      disabled={busyId === v.id}
                      className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand/20 disabled:opacity-60"
                    >
                      {busyId === v.id ? "…" : "Make admin"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
