"use client";

// Soft abuse-prevention confirm modal. Shown when a volunteer logs more than 10
// of the same part within 60 seconds. Confirm proceeds with the insert; Cancel
// aborts it.
export default function AbuseModal({
  partName,
  onConfirm,
  onCancel,
}: {
  partName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abuse-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 id="abuse-title" className="text-lg font-semibold text-slate-900">
          Just checking
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve added 10 {partName} in under a minute. Are you sure?
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
