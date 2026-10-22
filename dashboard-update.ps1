$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-File($path, $content) {
  $full = Join-Path (Get-Location).Path $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

# ---------- components/StatCard.tsx ----------
Write-File "src/components/StatCard.tsx" @'
import type { LucideIcon } from "lucide-react";

const CHIP = {
  blue: "bg-[linear-gradient(135deg,#38bdf8,#0284c7)] shadow-sky-500/30",
  green: "bg-[linear-gradient(135deg,#34d399,#059669)] shadow-emerald-500/30",
  yellow: "bg-[linear-gradient(135deg,#fbbf24,#d97706)] shadow-amber-500/30",
  violet: "bg-[linear-gradient(135deg,#a78bfa,#7c3aed)] shadow-violet-500/30",
  red: "bg-[linear-gradient(135deg,#f87171,#dc2626)] shadow-red-500/30",
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
      className={`rounded-2xl p-5 ring-1 shadow-[0_1px_2px_rgba(15,42,61,0.04),0_12px_32px_-16px_rgba(15,42,61,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,42,61,0.05),0_18px_36px_-14px_rgba(15,42,61,0.25)] ${
        highlight ? "bg-amber-50/80 ring-amber-200" : "bg-white ring-slate-900/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-lg ${CHIP[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-28 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      )}
      {hint && <p className={`mt-1.5 text-xs ${highlight ? "text-amber-700" : "text-slate-500"}`}>{hint}</p>}
    </div>
  );
}
'@

# ---------- app/(app)/dashboard/page.tsx ----------
Write-File "src/app/(app)/dashboard/page.tsx" @'
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Package, Wallet, Clock, Plus, Fish, Ship, TrendingUp } from "lucide-react";
import { api, formatDate, formatKg, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { ghostBtn } from "@/components/ui";

const COLORS = ["#1a8cc7", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b", "#22c55e", "#0ea5e9", "#f97316"];

const card =
  "rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,42,61,0.04),0_12px_32px_-16px_rgba(15,42,61,0.18)]";

interface DashboardData {
  total_landings: number | string;
  total_volume: number | string;
  total_value: number | string;
  pending_review: number | string;
  by_species: { species: string; volume: number | string }[];
  recent: Landing[];
}

const tooltipStyle = {
  borderRadius: 12,
  border: "none",
  boxShadow: "0 12px 32px rgba(15,42,61,0.18)",
  fontSize: 13,
  padding: "8px 12px",
};

function CardHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function Empty({ icon: Icon, title, text, height = "h-56" }: { icon: typeof Fish; title: string; text: string; height?: string }) {
  return (
    <div className={`grid ${height} place-items-center text-center`}>
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon size={22} />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { openNewEntry, version } = useEntryModal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("dashboard.php")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [version]);

  const loading = !data && !error;
  const species = (data?.by_species ?? []).map((s) => ({ name: s.species, volume: Number(s.volume) }));
  const speciesTotal = species.reduce((sum, s) => sum + s.volume, 0);
  const topSpecies = species.reduce<{ name: string; volume: number } | null>(
    (best, s) => (!best || s.volume > best.volume ? s : best),
    null
  );
  const recent = data?.recent ?? [];
  const pending = Number(data?.pending_review ?? 0);
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const canAdd = user?.role !== "viewer";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f2a3d_0%,#12405c_60%,#17608a_100%)] p-7 text-white shadow-[0_20px_40px_-20px_rgba(15,42,61,0.6)] sm:p-9">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            WebkitMaskImage: "linear-gradient(to left, black, transparent 70%)",
            maskImage: "linear-gradient(to left, black, transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-sky-100/80">{today}. Welcome back, {firstName}.</p>
            <p className="mt-6 text-sm text-sky-100/70">Total volume landed</p>
            {loading ? (
              <div className="mt-2 h-14 w-64 animate-pulse rounded-xl bg-white/10" />
            ) : (
              <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
                {formatKg(data?.total_volume ?? 0)}
              </p>
            )}
          </div>
          {canAdd && (
            <button
              onClick={openNewEntry}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f2a3d] shadow-lg shadow-black/10 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              <Plus size={18} /> Record a landing
            </button>
          )}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total landings"
          value={String(Number(data?.total_landings ?? 0))}
          icon={Package}
          tone="blue"
          hint="All recorded entries"
          loading={loading}
        />
        <StatCard
          label="Total value"
          value={formatPeso(data?.total_value ?? 0)}
          icon={Wallet}
          tone="green"
          hint="Across all landings"
          loading={loading}
        />
        <StatCard
          label="Pending review"
          value={String(pending)}
          icon={Clock}
          tone="yellow"
          hint={pending > 0 ? "Waiting for admin approval" : "All caught up"}
          highlight={pending > 0}
          loading={loading}
        />
        <StatCard
          label="Species recorded"
          value={String(species.length)}
          icon={Fish}
          tone="violet"
          hint={topSpecies ? `Most landed: ${topSpecies.name}` : "No landings yet"}
          loading={loading}
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className={`${card} p-6 lg:col-span-3`}>
          <CardHeader
            title="Volume by species"
            subtitle="Kilograms landed per species"
            right={
              topSpecies && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                  <TrendingUp size={13} /> Top: {topSpecies.name}
                </span>
              )
            }
          />
          <div className="mt-5 h-64">
            {species.length === 0 ? (
              <Empty icon={Fish} title="No landings yet" text="Record a landing to see the chart." height="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={species} margin={{ left: -10, top: 6 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0369a1" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8edf2" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9", radius: 8 }} contentStyle={tooltipStyle} formatter={(v) => formatKg(Number(v))} />
                  <Bar dataKey="volume" fill="url(#barFill)" radius={[10, 10, 4, 4]} maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`${card} p-6 lg:col-span-2`}>
          <CardHeader title="Species share" subtitle="Percent of total volume" />
          {species.length === 0 ? (
            <Empty icon={Fish} title="Nothing to show" text="Shares appear after the first landing." />
          ) : (
            <>
              <div className="relative mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={species} dataKey="volume" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={3} cornerRadius={6} stroke="none">
                      {species.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatKg(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{Math.round(speciesTotal).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">kg total</p>
                  </div>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {species.slice(0, 5).map((s, i) => {
                  const pct = speciesTotal ? (s.volume / speciesTotal) * 100 : 0;
                  return (
                    <li key={s.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="tabular-nums text-slate-500">{Math.round(pct)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </li>
                  );
                })}
                {species.length > 5 && <li className="text-xs text-slate-500">and {species.length - 5} more</li>}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Recent landings */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <CardHeader title="Recent landings" subtitle="The latest entries from the port" />
          {user?.role !== "viewer" && (
            <Link href="/landings" className={`${ghostBtn} shrink-0`}>View all</Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="border-t border-slate-100">
            <Empty icon={Ship} title="No landings recorded yet" text="New entries show up here as soon as they are saved." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-4 transition hover:bg-slate-50/70">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <Ship size={20} />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium text-slate-900">{r.boat_name}</p>
                  <p className="text-sm text-slate-500">{formatDate(r.landing_date)} from {r.origin}</p>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{r.species}</span>
                <div className="w-28 text-right">
                  <p className="text-sm font-medium tabular-nums text-slate-900">{Number(r.volume).toLocaleString()} {r.unit}</p>
                  <p className="text-xs text-slate-500">volume</p>
                </div>
                <div className="w-32 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{formatPeso(r.total_value)}</p>
                  <p className="text-xs text-slate-500">value</p>
                </div>
                <div className="w-24 sm:text-right">
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
'@

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "Done. Now run: npm run dev"
