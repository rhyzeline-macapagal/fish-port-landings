const STYLES = {
  pending: { wrap: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  approved: { wrap: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  rejected: { wrap: "bg-red-50 text-red-800", dot: "bg-red-500" },
};

export default function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${s.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}