"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Part, PartTotal, HistoryEntry } from "@/lib/types";
import PersonalTotals from "./PersonalTotals";
import PartButtonGrid from "./PartButtonGrid";
import HistoryLog from "./HistoryLog";
import UndoToast from "./UndoToast";
import AbuseModal from "./AbuseModal";
import ErrorBanner from "@/components/ui/ErrorBanner";

const UNDO_MS = 5000;
const ABUSE_WINDOW_MS = 60_000;
const ABUSE_THRESHOLD = 10; // >10 of the same part within the window triggers the modal

// Client orchestrator for the volunteer tracker. Owns optimistic totals/history
// updates, the 5-second undo, and the soft abuse check. Never polls — all data
// changes are driven by taps.
export default function Tracker({
  volunteerId,
  initialParts,
  initialTotals,
  initialHistory,
}: {
  volunteerId: string;
  initialParts: Part[];
  initialTotals: PartTotal[];
  initialHistory: HistoryEntry[];
}) {
  const supabase = createClient();

  // Parts are cached from the server render; they change infrequently.
  const [parts] = useState<Part[]>(initialParts);
  const [totals, setTotals] = useState<PartTotal[]>(initialTotals);
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Undo toast state: the contribution we can still cancel.
  const [undo, setUndo] = useState<{
    id: string;
    partId: string;
    partName: string;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abuse modal state: a pending add awaiting confirmation.
  const [pendingPart, setPendingPart] = useState<Part | null>(null);

  // Per-part timestamps of recent successful adds, for the abuse window check.
  const tapTimes = useRef<Map<string, number[]>>(new Map());

  const clearUndoTimer = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  };

  // Adjust one part's optimistic total by `delta`.
  const bumpTotal = (partId: string, delta: number) =>
    setTotals((prev) =>
      prev.map((t) =>
        t.part_id === partId ? { ...t, total: t.total + delta } : t
      )
    );

  const insertContribution = useCallback(
    async (part: Part) => {
      setBusy(true);
      setError(null);
      clearUndoTimer();

      const { data, error: insertError } = await supabase
        .from("contributions")
        .insert({ volunteer_id: volunteerId, part_id: part.id, quantity: 1 })
        .select("id, created_at")
        .single();

      if (insertError || !data) {
        setError(
          insertError?.message ?? "Could not save that. Please try again."
        );
        setBusy(false);
        return;
      }

      // Record the tap time for abuse detection.
      const times = tapTimes.current.get(part.id) ?? [];
      times.push(Date.now());
      tapTimes.current.set(part.id, times);

      // Optimistically update totals + history (no extra queries).
      bumpTotal(part.id, 1);
      setHistory((prev) =>
        [
          { id: data.id, created_at: data.created_at, part_name: part.name },
          ...prev,
        ].slice(0, 20)
      );

      // Show the undo toast for 5 seconds.
      setUndo({ id: data.id, partId: part.id, partName: part.name });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);

      setBusy(false);
    },
    [supabase, volunteerId]
  );

  // Entry point for a button tap: run the abuse check, then insert (or prompt).
  const handleAdd = useCallback(
    (part: Part) => {
      const now = Date.now();
      const recent = (tapTimes.current.get(part.id) ?? []).filter(
        (t) => now - t < ABUSE_WINDOW_MS
      );
      tapTimes.current.set(part.id, recent);

      if (recent.length >= ABUSE_THRESHOLD) {
        setPendingPart(part); // ask for confirmation before inserting
        return;
      }
      void insertContribution(part);
    },
    [insertContribution]
  );

  // Minus button: delete this volunteer's most recent contribution for the part
  // and roll the optimistic total/history back by one.
  const handleRemove = useCallback(
    async (part: Part) => {
      setBusy(true);
      setError(null);
      clearUndoTimer();
      setUndo(null);

      const { data, error: findError } = await supabase
        .from("contributions")
        .select("id")
        .eq("volunteer_id", volunteerId)
        .eq("part_id", part.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        setError("Could not remove that. Please try again.");
        setBusy(false);
        return;
      }
      if (!data) {
        // Nothing left to remove for this part.
        setBusy(false);
        return;
      }

      const { error: delError } = await supabase
        .from("contributions")
        .delete()
        .eq("id", data.id);

      if (delError) {
        setError("Could not remove that. Please try again.");
        setBusy(false);
        return;
      }

      bumpTotal(part.id, -1);
      setHistory((prev) => prev.filter((h) => h.id !== data.id));

      // Keep the abuse window count in sync.
      const times = tapTimes.current.get(part.id) ?? [];
      times.pop();
      tapTimes.current.set(part.id, times);

      setBusy(false);
    },
    [supabase, volunteerId]
  );

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    setUndoing(true);
    setError(null);

    const { error: delError } = await supabase
      .from("contributions")
      .delete()
      .eq("id", undo.id);

    if (delError) {
      setError("Could not undo. Please try again.");
      setUndoing(false);
      return;
    }

    // Roll back the optimistic updates.
    bumpTotal(undo.partId, -1);
    setHistory((prev) => prev.filter((h) => h.id !== undo.id));

    // Drop the most recent tap timestamp for this part.
    const times = tapTimes.current.get(undo.partId) ?? [];
    times.pop();
    tapTimes.current.set(undo.partId, times);

    clearUndoTimer();
    setUndo(null);
    setUndoing(false);
  }, [undo, supabase]);

  return (
    <div className="space-y-8 pb-24">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <PersonalTotals totals={totals} />
      <PartButtonGrid
        parts={parts}
        totals={totals}
        onAdd={handleAdd}
        onRemove={handleRemove}
        busy={busy}
      />
      <HistoryLog entries={history} />

      {undo && (
        <UndoToast
          partName={undo.partName}
          onUndo={handleUndo}
          undoing={undoing}
        />
      )}

      {pendingPart && (
        <AbuseModal
          partName={pendingPart.name}
          onConfirm={() => {
            const part = pendingPart;
            setPendingPart(null);
            void insertContribution(part);
          }}
          onCancel={() => setPendingPart(null)}
        />
      )}
    </div>
  );
}
