import type { LucideIcon } from "lucide-react";

const CHIP = {
  blue: "bg-sky-50 text-sky-700",
  green: "bg-emerald-50 text-emerald-700",
  yellow: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  red: "bg-red-50 text-red-700",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: keyof typeof CHIP;
  hint?: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`glass @container h-full min-w-0 rounded-lg p-5 ${
        highlight ? "border-amber-300 bg-amber-100/70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${CHIP[tone]}`}>
          <Icon size={16} />
        </div>
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-900/10" />
      ) : (
        <p
          className="mt-3 whitespace-nowrap font-semibold tabular-nums text-slate-900"
          style={{ fontSize: "clamp(1.25rem, 9cqw, 1.875rem)" }}
        >
          {value}
        </p>
      )}
      {hint && (
        <p className={`mt-1 text-sm ${highlight ? "text-amber-800" : "text-slate-600"}`}>{hint}</p>
      )}
    </div>
  );
}