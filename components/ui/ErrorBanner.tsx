// Inline error message. Renders nothing when `message` is falsy so callers can
// pass state directly: <ErrorBanner message={error} />
export default function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-medium text-red-600 hover:text-red-800"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
