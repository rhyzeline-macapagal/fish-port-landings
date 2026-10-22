"use client";

import { memo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

const TONES = {
  blue: { chip: "bg-sky-50 text-[#0875d1]", line: "#0875d1" },
  green: { chip: "bg-emerald-50 text-emerald-600", line: "#10b981" },
  yellow: { chip: "bg-amber-50 text-amber-600", line: "#f59e0b" },
  violet: { chip: "bg-violet-50 text-violet-600", line: "#8b5cf6" },
} as const;

export type KpiTone = keyof typeof TONES;

export function Trend({ current, previous }: { current: number; previous?: number | null }) {
  if (previous == null) return null;

  let kind: "up" | "down" | "flat";
  let text: string;
  if (previous === 0) {
    if (current === 0) {
      kind = "flat";
      text = "No change";
    } else {
      kind = "up";
      text = "New activity";
    }
  } else {
    const percentage = ((current - previous) / previous) * 100;
    if (Math.abs(percentage) < 0.05) {
      kind = "flat";
      text = "No change";
    } else if (percentage > 0) {
      kind = "up";
      text = `${percentage.toFixed(1)}%`;
    } else {
      kind = "down";
      text = `${Math.abs(percentage).toFixed(1)}%`;
    }
  }

  const styles = {
    up: "text-emerald-600",
    down: "text-red-600",
    flat: "text-slate-500",
  };
  const Icon = kind === "up" ? ArrowUpRight : kind === "down" ? ArrowDownRight : Minus;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${styles[kind]}`}>
      <Icon size={13} aria-hidden="true" /> {text}
    </span>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  if (values.length < 2 || max <= 0) return null;

  const width = 100;
  const height = 22;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - (value / max) * (height - 4)).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-5 w-16 shrink-0 sm:w-20" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const KpiCard = memo(function KpiCard({
  label,
  value,
  compactValue,
  icon: Icon,
  tone,
  hint,
  loading,
  current,
  previous,
  compareLabel,
  spark,
  highlight,
}: {
  label: string;
  value: string;
  compactValue?: string;
  icon: LucideIcon;
  tone: KpiTone;
  hint?: string;
  loading?: boolean;
  current?: number;
  previous?: number | null;
  compareLabel?: string;
  spark?: number[];
  highlight?: boolean;
}) {
  const colors = TONES[tone];

  return (
    <article
      className={`@container flex h-full min-h-32 min-w-0 flex-col rounded-xl border bg-white p-4 shadow-[0_2px_10px_rgba(18,52,77,0.05)] ${
        highlight ? "border-amber-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10 ${colors.chip}`}>
          <Icon size={19} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-600 sm:truncate sm:text-xs">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-1 truncate font-semibold tabular-nums tracking-tight text-[#14263d]" style={{ fontSize: "clamp(1.1rem, 10cqw, 1.65rem)" }}>
              {compactValue ? <><span className="sm:hidden">{compactValue}</span><span className="hidden sm:inline">{value}</span></> : value}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex min-h-6 items-end justify-between gap-2 pt-3">
        <div className="min-w-0 leading-tight">
          {!loading && current !== undefined && previous != null ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Trend current={current} previous={previous} />
              {compareLabel && <span className="hidden truncate text-[10px] text-slate-500 sm:inline">{compareLabel}</span>}
            </div>
          ) : hint ? (
            <p className="truncate text-[10px] text-slate-500">{hint}</p>
          ) : null}
        </div>
        {!loading && spark && <Sparkline values={spark} color={colors.line} />}
      </div>
    </article>
  );
});

export default KpiCard;
