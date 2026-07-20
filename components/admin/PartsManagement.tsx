"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Spinner from "@/components/ui/Spinner";

// Row shape returned by the get_all_part_totals() RPC.
export interface AdminPartRow {
  part_id: string;
  name: string;
  total: number;
  is_active: boolean;
  created_at: string;
}

// Parts catalog management: add new parts, and toggle active/inactive.
// Deactivating a part removes it from the volunteer interface immediately but
// preserves its historical count (shown greyed out here).
export default function PartsManagement({
  initialParts,
  onPartsChange,
}: {
  initialParts: AdminPartRow[];
  onPartsChange?: (parts: AdminPartRow[]) => void;
}) {
  const supabase = createClient();

  const [parts, setParts] = useState<AdminPartRow[]>(initialParts);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The part pending a delete confirmation, and the in-flight delete state.
  const [deleteTarget, setDeleteTarget] = useState<AdminPartRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Functional-update style (like setState's updater form) so concurrent
  // add/toggle/delete calls never clobber each other with a stale `parts`
  // closure — each update is derived from the latest state, not from
  // whatever `parts` looked like when the async handler started.
  function updateParts(updater: (prev: AdminPartRow[]) => AdminPartRow[]) {
    setParts((prev) => {
      const next = updater(prev);
      onPartsChange?.(next);
      return next;
    });
  }

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setAdding(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("parts")
      .insert({ name })
      .select("id, name, is_active, created_at")
      .single();

    if (insertError || !data) {
      setError(
        insertError?.code === "23505"
          ? `A part named "${name}" already exists.`
          : insertError?.message ?? "Could not add the part."
      );
      setAdding(false);
      return;
    }

    updateParts((prev) =>
      [
        {
          part_id: data.id,
          name: data.name,
          total: 0,
          is_active: data.is_active,
          created_at: data.created_at,
        },
        ...prev,
      ].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewName("");
    setAdding(false);
  }

  async function toggleActive(part: AdminPartRow) {
    setTogglingId(part.part_id);
    setError(null);

    const next = !part.is_active;
    const { error: updateError } = await supabase
      .from("parts")
      .update({ is_active: next })
      .eq("id", part.part_id);

    if (updateError) {
      setError(updateError.message ?? "Could not update the part.");
      setTogglingId(null);
      return;
    }

    updateParts((prev) =>
      prev.map((p) =>
        p.part_id === part.part_id ? { ...p, is_active: next } : p
      )
    );
    setTogglingId(null);
  }

  // Permanently delete a part. Only reachable for parts with no contributions;
  // the DB's ON DELETE RESTRICT is the backstop if a contribution was logged
  // between page load and this action.
  async function deletePart(part: AdminPartRow) {
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("parts")
      .delete()
      .eq("id", part.part_id);

    if (deleteError) {
      // 23503 = foreign_key_violation: contributions still reference this part.
      setError(
        deleteError.code === "23503"
          ? `Can't delete "${part.name}" — it has logged contributions. Deactivate it instead.`
          : deleteError.message ?? "Could not delete the part."
      );
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    updateParts((prev) => prev.filter((p) => p.part_id !== part.part_id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <section
      aria-label="Parts management"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Parts Management
      </h2>

      <form onSubmit={addPart} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New part name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {adding && (
            <Spinner label="Adding" className="border-white/40 border-t-white" />
          )}
          Add Part
        </button>
      </form>

      <div className="mb-4">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-medium">Part</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Created</th>
              <th className="px-2 py-2 text-right font-medium">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr
                key={part.part_id}
                className={`border-b border-slate-100 last:border-0 ${
                  part.is_active ? "" : "text-slate-400"
                }`}
              >
                <td className="px-2 py-3 font-medium">{part.name}</td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {part.total}
                </td>
                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(part)}
                    disabled={togglingId === part.part_id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                      part.is_active
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {togglingId === part.part_id
                      ? "…"
                      : part.is_active
                      ? "Active"
                      : "Inactive"}
                  </button>
                </td>
                <td className="px-2 py-3 text-slate-400">
                  {/* Pinned to UTC so the server render (Vercel, UTC) and the
                      client hydration render (the admin's local timezone)
                      always produce the same string — otherwise a part
                      created near UTC midnight renders a different calendar
                      date on each side and React throws a hydration-mismatch
                      error. */}
                  {new Date(part.created_at).toLocaleDateString(undefined, {
                    timeZone: "UTC",
                  })}
                </td>
                <td className="px-2 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setDeleteTarget(part);
                    }}
                    aria-label={`Delete ${part.name}`}
                    title={`Delete ${part.name}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1a1 1 0 0 0-.96.71L7.42 3H4a1 1 0 0 0 0 2h.06l.81 11.32A2 2 0 0 0 6.87 18h6.26a2 2 0 0 0 2-1.68L15.94 5H16a1 1 0 1 0 0-2h-3.42l-.37-1.29A1 1 0 0 0 11.25 1h-2.5ZM9 7a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 9 7Zm2.75.75a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="delete-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete {deleteTarget.name}?
            </h3>

            {deleteTarget.total > 0 ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  This part has {deleteTarget.total} logged contribution
                  {deleteTarget.total === 1 ? "" : "s"}, so it can&apos;t be
                  deleted — that would erase volunteers&apos; records. Deactivate
                  it instead to hide it from volunteers while keeping the history.
                </p>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  This permanently removes the part from the application. This
                  can&apos;t be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePart(deleteTarget)}
                    disabled={deleting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting && (
                      <Spinner
                        label="Deleting"
                        className="border-white/40 border-t-white"
                      />
                    )}
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
