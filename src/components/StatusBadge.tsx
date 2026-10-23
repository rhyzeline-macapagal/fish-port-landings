const STYLES = {
  pending: { wrap: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  approved: { wrap: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  rejected: { wrap: "bg-red-50 text-red-800", dot: "bg-red-500" },
  active: { wrap: "bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  inactive: { wrap: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};
const FALLBACK_STYLE = { wrap: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };

export default function StatusBadge({ status }: { status?: string | null }) {
  const label = status || "unknown";
  const s = STYLES[label as keyof typeof STYLES] ?? FALLBACK_STYLE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${s.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}
