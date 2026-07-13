// Minimal loading spinner. `label` is read by screen readers.
export default function Spinner({
  label = "Loading",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand ${className}`}
    />
  );
}
