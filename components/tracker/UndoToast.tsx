"use client";

// Transient toast with an Undo action. Fixed to the bottom of the viewport so
// it's thumb-reachable on a phone. The parent controls the 5-second lifetime.
export default function UndoToast({
  partName,
  onUndo,
  undoing,
}: {
  partName: string;
  onUndo: () => void;
  undoing: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-slate-900 py-3 pl-5 pr-3 text-sm text-white shadow-lg">
        <span>Added 1 {partName}</span>
        <button
          type="button"
          onClick={onUndo}
          disabled={undoing}
          className="rounded-full bg-white/15 px-4 py-1.5 font-semibold text-white transition hover:bg-white/25 disabled:opacity-60"
        >
          {undoing ? "Undoing…" : "Undo"}
        </button>
      </div>
    </div>
  );
}
