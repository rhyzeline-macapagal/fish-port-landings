"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export const TONES = {
  blue:   { icon: "from-sky-500 to-blue-600",       bar: "from-sky-400 to-blue-600",       hex: "#0ea5e9" },
  green:  { icon: "from-emerald-500 to-teal-600",   bar: "from-emerald-400 to-teal-600",   hex: "#10b981" },
  yellow: { icon: "from-amber-400 to-orange-500",   bar: "from-amber-300 to-orange-500",   hex: "#f59e0b" },
  violet: { icon: "from-violet-500 to-fuchsia-600", bar: "from-violet-400 to-fuchsia-600", hex: "#8b5cf6" },
} as const;
export type Tone = keyof typeof TONES;

const card = "glass rounded-lg";

/* "5.2% higher" / "3.1% lower" pill */
export function Trend({ current, previous, dark = false }: { current: number; previous?: number | null; dark?: boolean }) {
  if (previous == null) return null;

  let kind: "up" | "down" | "flat";
  let text: string;
  if (previous === 0) {
    if (current === 0) { kind = "flat"; text = "No change"; }
    else { kind = "up"; text = "New activity"; }
  } else {
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.05) { kind = "flat"; text = "No change"; }
    else if (pct > 0) { kind = "up"; text = `${pct.toFixed(1)}% higher`; }
    else { kind = "down"; text = `${Math.abs(pct).toFixed(1)}% lower`; }
  }

  const styles = dark
    ? { up: "bg-emerald-400/20 text-emerald-200", down: "bg-rose-400/20 text-rose-200", flat: "bg-white/15 text-slate-200" }
    : { up: "bg-emerald-100 text-emerald-700", down: "bg-rose-100 text-rose-700", flat: "bg-slate-100 text-slate-600" };
  const Icon = kind === "up" ? ArrowUpRight : kind === "down" ? ArrowDownRight : Minus;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[kind]}`}>
      <Icon size={13} /> {text}
    </span>
  );
}

function Sparkline({ data, color, id }: { data: { v: number }[]; color: string; id: string }) {
  if (data.length < 2 || !data.some((d) => d.v > 0)) return null;
  return (
    <div className="mt-3 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function KpiCard({
  label, value, icon: Icon, tone, hint, loading, current, previous, compareLabel, spark, highlight,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  hint: string;
  loading?: boolean;
  current?: number;
  previous?: number | null;
  compareLabel?: string;
  spark?: { v: number }[];
  highlight?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className={`${card} relative h-full overflow-hidden p-5 ${highlight ? "ring-2 ring-amber-400/70" : ""}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl"
        style={{ background: t.hex }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${t.icon} text-white shadow-md`}>
            <Icon size={20} />
          </span>
        </div>

        {loading ? (
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-900/10" />
        ) : (
          <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        )}

        {!loading && current !== undefined && previous != null && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Trend current={current} previous={previous} />
            {compareLabel && <span className="text-xs text-slate-600">{compareLabel}</span>}
          </div>
        )}

        <p className="mt-2 text-xs text-slate-600">{hint}</p>
        {!loading && spark && <Sparkline data={spark} color={t.hex} id={`spark-${tone}`} />}
      </div>
    </div>
  );
}