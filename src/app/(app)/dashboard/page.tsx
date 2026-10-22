"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Package, Wallet, Clock, Plus, Fish, Ship, X,
  ArrowUpRight, ArrowDownRight, Minus, CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, formatDate, formatKg, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatusBadge from "@/components/StatusBadge";
import { ghostBtn } from "@/components/ui";
import ExportMenu, { type ExportKind } from "@/components/ExportMenu";
import type { Report } from "@/lib/export"; // type only: the export library itself loads on demand

/* ------------------------------------------------------------------ */
/* Performance notes                                                   */
/* - No chart library: bars and sparklines are plain CSS / tiny SVG.   */
/* - No blur blobs, backdrop-filter or gradients: cheap to paint.      */
/* - PDF/Excel export code is loaded only when someone clicks Export.  */
/* - Responses are cached per year/month, so revisiting is instant.    */
/* - Derived data is memoized; cards only re-render when props change. */
/* ------------------------------------------------------------------ */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const TONES = {
  blue:   { chip: "bg-sky-50 text-sky-600",         hex: "#0ea5e9" },
  green:  { chip: "bg-emerald-50 text-emerald-600", hex: "#10b981" },
  yellow: { chip: "bg-amber-50 text-amber-600",     hex: "#f59e0b" },
  violet: { chip: "bg-violet-50 text-violet-600",   hex: "#8b5cf6" },
} as const;
type Tone = keyof typeof TONES;

const card = "rounded-xl border border-slate-200 bg-white shadow-sm";
const num = (v: unknown) => Number(v ?? 0);

interface PrevTotals {
  total_landings: number | string;
  total_volume: number | string;
  total_value: number | string;
  species_count: number | string;
}

interface MonthRow {
  month: number;
  landings: number | string;
  volume: number | string;
  amount: number | string;
}

interface DashboardData {
  total_landings: number | string;
  total_volume: number | string;
  total_value: number | string;
  pending_review: number | string;
  by_species: { species: string; volume: number | string }[];
  by_month: MonthRow[];
  prev: PrevTotals;
  compare_label: string;
  recent: Landing[];
  year: number;
  month: number;
  years: number[];
}

type SpeciesRow = { name: string; volume: number };
type MonthPoint = { label: string; full: string; volume: number; landings: number; amount: number };

/* ----------------------------- small pieces ----------------------------- */

const CardHeader = memo(function CardHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
      </div>
      {right}
    </div>
  );
});

function Empty({ icon: Icon, title, text, height = "h-56" }: { icon: typeof Fish; title: string; text: string; height?: string }) {
  return (
    <div className={`grid ${height} place-items-center text-center`}>
      <div>
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={20} />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}

// "5.2% higher" / "3.1% lower" pill
function Trend({ current, previous, dark = false }: { current: number; previous?: number | null; dark?: boolean }) {
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
    : { up: "bg-emerald-50 text-emerald-700", down: "bg-rose-50 text-rose-700", flat: "bg-slate-100 text-slate-600" };
  const Icon = kind === "up" ? ArrowUpRight : kind === "down" ? ArrowDownRight : Minus;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[kind]}`}>
      <Icon size={13} /> {text}
    </span>
  );
}

// Tiny inline-SVG sparkline (replaces a full chart instance per card)
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  if (max <= 0) return null;
  const w = 100, h = 28;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-8 w-full" aria-hidden="true">
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
  spark?: number[];
  highlight?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className={`${card} h-full p-5 ${highlight ? "border-amber-300 ring-1 ring-amber-300" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.chip}`}>
          <Icon size={18} />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      )}

      {!loading && current !== undefined && previous !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Trend current={current} previous={previous} />
          {compareLabel && <span className="text-xs text-slate-600">{compareLabel}</span>}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-600">{hint}</p>
      {!loading && spark && <Sparkline values={spark} color={t.hex} />}
    </div>
  );
});

// Pure-CSS monthly bars. Each bar is a button: click to filter by that month.
const MonthlyBars = memo(function MonthlyBars({
  data, selected, onSelect,
}: {
  data: MonthPoint[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  const max = Math.max(...data.map((d) => d.volume), 1);
  return (
    <div className="flex h-full items-stretch gap-1.5 sm:gap-2" role="group" aria-label="Monthly volume">
      {data.map((d, i) => {
        const active = selected === i + 1;
        const dim = selected !== 0 && !active;
        const pct = d.volume > 0 ? Math.max((d.volume / max) * 100, 3) : 0;
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onSelect(i + 1)}
            aria-pressed={active}
            aria-label={`${d.full}: ${formatKg(d.volume)}`}
            title={`${d.full}: ${formatKg(d.volume)}`}
            className="group flex min-w-0 flex-1 flex-col focus-visible:outline-none"
          >
            <span className="flex flex-1 items-end">
              <span
                className={`w-full rounded-t-md transition-colors group-focus-visible:ring-2 group-focus-visible:ring-sky-500 ${
                  d.volume === 0
                    ? "h-0.5 bg-slate-200"
                    : dim
                      ? "bg-slate-200 group-hover:bg-sky-300"
                      : "bg-sky-500 group-hover:bg-sky-600"
                }`}
                style={d.volume > 0 ? { height: `${pct}%` } : undefined}
              />
            </span>
            <span className={`mt-2 text-xs ${active ? "font-semibold text-slate-900" : "text-slate-600"}`}>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
});

function SpeciesBar({ name, volume, pct, rank }: { name: string; volume?: number; pct: number; rank?: number }) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-slate-800">
          {rank !== undefined && <span className="w-5 shrink-0 text-xs tabular-nums text-slate-500">{rank}</span>}
          <span className="truncate font-medium">{name}</span>
        </span>
        <span className="shrink-0 tabular-nums text-slate-600">
          {volume !== undefined && <span className="mr-3">{Math.round(volume).toLocaleString()} kg</span>}
          <span className="inline-block w-12 text-right font-semibold text-slate-900">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/* -------------------------------- page --------------------------------- */

export default function DashboardPage() {
  const { user } = useAuth();
  const { openNewEntry, version } = useEntryModal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [month, setMonth] = useState("0"); // "0" = all months
  const [years, setYears] = useState<number[]>([]);
  const [showAllSpecies, setShowAllSpecies] = useState(false);

  // Cache responses per year+month. Cleared whenever a landing is added/edited (version changes).
  const cache = useRef(new Map<string, DashboardData>());
  const cachedVersion = useRef(version);

  useEffect(() => {
    if (cachedVersion.current !== version) {
      cache.current.clear();
      cachedVersion.current = version;
    }

    const key = `${year}:${month}`;
    const hit = cache.current.get(key);
    if (hit) {
      setData(hit);
      setError("");
      setFetching(false);
      return;
    }

    let ignore = false;
    setError("");
    setFetching(true);
    api<DashboardData>(`dashboard.php?year=${year}&month=${month}`)
      .then((d) => {
        if (ignore) return;
        cache.current.set(key, d);
        setData(d);
        if (d.years?.length) setYears(d.years);
      })
      .catch((e) => !ignore && setError(e.message))
      .finally(() => !ignore && setFetching(false));
    return () => { ignore = true; };
  }, [version, year, month]);

  // Close the species popup with Esc
  useEffect(() => {
    if (!showAllSpecies) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowAllSpecies(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAllSpecies]);

  const m = Number(month);
  const periodLabel = m ? `${MONTHS[m - 1]} ${year}` : year;
  const yearOptions = years.length ? years : [Number(year)];
  const loading = !data && !error;

  // Derived data (memoized so month/year toggles don't recompute everything)
  const species = useMemo<SpeciesRow[]>(
    () => (data?.by_species ?? []).map((s) => ({ name: s.species, volume: Number(s.volume) })),
    [data]
  );
  const speciesTotal = useMemo(() => species.reduce((sum, s) => sum + s.volume, 0), [species]);
  const topSpecies = species.length
    ? species.reduce((best, s) => (s.volume > best.volume ? s : best))
    : null;

  const monthly = useMemo<MonthPoint[]>(() => {
    const byMonth = data?.by_month ?? [];
    return MONTHS_SHORT.map((label, i) => {
      const r = byMonth.find((b) => Number(b.month) === i + 1);
      return { label, full: MONTHS[i], volume: num(r?.volume), landings: num(r?.landings), amount: num(r?.amount) };
    });
  }, [data]);

  const sparks = useMemo(
    () => ({
      landings: monthly.map((r) => r.landings),
      amount: monthly.map((r) => r.amount),
    }),
    [monthly]
  );
  const peak = useMemo(
    () => monthly.reduce((best, r) => (r.volume > best.volume ? r : best), monthly[0]),
    [monthly]
  );
  const noMonthlyData = monthly.every((r) => r.volume === 0);

  const recent = data?.recent ?? [];
  const pending = num(data?.pending_review);
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const canAdd = user?.role !== "viewer";

  // Current vs previous period
  const cur = {
    landings: num(data?.total_landings),
    volume: num(data?.total_volume),
    value: num(data?.total_value),
    species: species.length,
  };
  const prev = data?.prev
    ? {
        landings: Number(data.prev.total_landings),
        volume: Number(data.prev.total_volume),
        value: Number(data.prev.total_value),
        species: Number(data.prev.species_count),
      }
    : null;
  const compareLabel = data?.compare_label ?? "";

  const toggleMonth = (n: number) => setMonth((prevMonth) => (prevMonth === String(n) ? "0" : String(n)));

  // Exports what the dashboard shows. The export library (PDF/Excel) is loaded only now.
  async function exportDashboard(kind: ExportKind) {
    if (!data) return;
    const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
    const pct = (v: number) => (speciesTotal ? (v / speciesTotal) * 100 : 0);
    const report: Report = {
      title: `FishPort Statistics - Dashboard ${periodLabel}`,
      subtitle: `Period: ${periodLabel}  |  Exported ${stamp()}`,
      tables: [
        {
          name: "Summary",
          filter: false,
          columns: [
            { header: "Total landings", format: "int" },
            { header: "Total volume (kg)", format: "decimal" },
            { header: "Total value", format: "money" },
            { header: "Pending review", format: "int" },
            { header: "Species recorded", format: "int" },
          ],
          rows: [[cur.landings, cur.volume, cur.value, pending, species.length]],
        },
        {
          name: "Species",
          columns: [
            { header: "Species" },
            { header: "Volume (kg)", format: "decimal" },
            { header: "Share", format: "percent" },
          ],
          rows: species.map((s) => [s.name, s.volume, pct(s.volume)]),
          totals: ["Total", speciesTotal, species.length ? 100 : 0],
        },
        {
          name: "Recent landings",
          columns: [
            { header: "Date", format: "date" },
            { header: "Supplier" },
            { header: "Origin" },
            { header: "Species" },
            { header: "Volume", format: "decimal" },
            { header: "Unit" },
            { header: "Total value", format: "money" },
            { header: "Status" },
          ],
          rows: recent.map((r) => [
            r.landing_date, r.boat_name, r.origin, r.species,
            Number(r.volume), r.unit, Number(r.total_value),
            r.status.charAt(0).toUpperCase() + r.status.slice(1),
          ]),
        },
      ],
    };
    const name = `dashboard_${year}${m ? "_" + String(m).padStart(2, "0") : ""}_${stamp()}`;
    if (kind === "xlsx") await exportXlsx(name, report);
    else await exportPdf(name, report);
  }

  const monthOptions = [
    { v: "0", l: "All months", has: true },
    ...MONTHS_SHORT.map((l, i) => ({ v: String(i + 1), l, has: monthly[i].landings > 0 })),
  ];

  return (
    <div className={`space-y-6 transition-opacity ${fetching && data ? "opacity-70" : ""}`}>
      {/* Header: solid colour, no blur layers */}
      <section className="flex flex-wrap items-end justify-between gap-5 rounded-xl bg-[#12344d] p-6 text-white">
        <div>
          <p className="text-sm text-slate-300">{today}. Welcome back, {firstName}.</p>
          <p className="mt-5 text-sm text-slate-300">Total volume landed in {periodLabel}</p>
          {loading ? (
            <div className="mt-2 h-10 w-56 animate-pulse rounded bg-white/10" />
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-4xl font-semibold tabular-nums">{formatKg(data?.total_volume ?? 0)}</p>
              <Trend current={cur.volume} previous={prev?.volume} dark />
              <span className="text-xs text-slate-300">{compareLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border border-white/25 bg-transparent px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus-visible:border-white/60 [&>option]:text-slate-900"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <ExportMenu
            variant="glass"
            up
            onExport={exportDashboard}
            disabled={!data}
            title={`Download the ${periodLabel} dashboard`}
          />

          {canAdd && (
            <button
              onClick={openNewEntry}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-[#12344d] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Plus size={16} /> Record a landing
            </button>
          )}
        </div>
      </section>

      {/* Month filter */}
      <section className={`${card} flex items-center gap-2 p-2`}>
        <span className="ml-2 hidden shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700 sm:inline-flex">
          <CalendarDays size={16} /> Month
        </span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="group" aria-label="Filter by month">
          {monthOptions.map((o) => {
            const active = month === o.v;
            return (
              <button
                key={o.v}
                onClick={() => setMonth(o.v)}
                aria-pressed={active}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sky-600 text-white"
                    : `text-slate-700 hover:bg-slate-100 ${o.has ? "" : "opacity-50"}`
                }`}
              >
                {o.l}
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total landings"
          value={String(cur.landings)}
          icon={Package}
          tone="blue"
          hint={`Recorded in ${periodLabel}`}
          loading={loading}
          current={cur.landings}
          previous={prev?.landings}
          compareLabel={compareLabel}
          spark={sparks.landings}
        />
        <KpiCard
          label="Total value"
          value={formatPeso(data?.total_value ?? 0)}
          icon={Wallet}
          tone="green"
          hint={`Across all ${periodLabel} landings`}
          loading={loading}
          current={cur.value}
          previous={prev?.value}
          compareLabel={compareLabel}
          spark={sparks.amount}
        />
        {canAdd ? (
          <Link
            href={`/landings?status=pending&year=${year}`}
            aria-label="Go to pending landings"
            className="block h-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <KpiCard
              label="Pending review"
              value={String(pending)}
              icon={Clock}
              tone="yellow"
              hint={pending > 0 ? "Waiting for admin approval" : "All caught up"}
              highlight={pending > 0}
              loading={loading}
            />
          </Link>
        ) : (
          // Viewers can't open /landings, so no link for them.
          <KpiCard
            label="Pending review"
            value={String(pending)}
            icon={Clock}
            tone="yellow"
            hint={pending > 0 ? "Waiting for admin approval" : "All caught up"}
            highlight={pending > 0}
            loading={loading}
          />
        )}
        <KpiCard
          label="Species recorded"
          value={String(cur.species)}
          icon={Fish}
          tone="violet"
          hint={topSpecies ? `Most landed: ${topSpecies.name}` : "No landings yet"}
          loading={loading}
          current={cur.species}
          previous={prev?.species}
          compareLabel={compareLabel}
        />
      </section>

      {/* Monthly volume + species share (one row, no chart library) */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className={`${card} p-6 lg:col-span-3`}>
          <CardHeader
            title="Monthly volume"
            subtitle={
              !noMonthlyData && peak
                ? `Peak in ${year}: ${peak.full}, ${formatKg(peak.volume)}. Click a bar to filter.`
                : `Kilograms landed per month in ${year}.`
            }
            right={
              m ? (
                <button onClick={() => setMonth("0")} className={ghostBtn}>Clear {MONTHS_SHORT[m - 1]}</button>
              ) : undefined
            }
          />
          <div className="mt-5 h-60">
            {noMonthlyData ? (
              <Empty icon={Fish} title="No landings yet" text={`Nothing recorded in ${year}.`} height="h-full" />
            ) : (
              <MonthlyBars data={monthly} selected={m} onSelect={toggleMonth} />
            )}
          </div>
        </div>

        <div className={`${card} p-6 lg:col-span-2`}>
          <CardHeader
            title="Species share"
            subtitle={`Percent of ${periodLabel} volume`}
            right={
              species.length > 0 ? (
                <span className="text-xs tabular-nums text-slate-600">{Math.round(speciesTotal).toLocaleString()} kg</span>
              ) : undefined
            }
          />
          {species.length === 0 ? (
            <Empty icon={Fish} title="Nothing to show" text="Shares appear after the first landing." />
          ) : (
            <>
              <ul className="mt-5 space-y-4">
                {species.slice(0, 6).map((s) => (
                  <SpeciesBar
                    key={s.name}
                    name={s.name}
                    pct={speciesTotal ? (s.volume / speciesTotal) * 100 : 0}
                  />
                ))}
              </ul>
              {species.length > 6 && (
                <button onClick={() => setShowAllSpecies(true)} className={`${ghostBtn} mt-5 w-full justify-center`}>
                  View all {species.length} species
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Recent landings */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <CardHeader title="Recent landings" subtitle={`The latest entries in ${periodLabel}`} />
          {canAdd && <Link href="/landings" className={`${ghostBtn} shrink-0`}>View all</Link>}
        </div>

        {recent.length === 0 ? (
          <div className="border-t border-slate-200">
            <Empty icon={Ship} title="No landings recorded yet" text="New entries show up here as soon as they are saved." />
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 font-medium">Origin</th>
                  <th className="px-3 py-2.5 font-medium">Species</th>
                  <th className="px-3 py-2.5 text-right font-medium">Volume</th>
                  <th className="px-3 py-2.5 text-right font-medium">Value</th>
                  <th className="px-6 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-3 text-slate-700">{formatDate(r.landing_date)}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{r.boat_name}</td>
                    <td className="px-3 py-3 text-slate-700">{r.origin || "-"}</td>
                    <td className="px-3 py-3 text-slate-800">{r.species}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-900">
                      {Number(r.volume).toLocaleString()} {r.unit}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatPeso(r.total_value)}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All species popup (only mounted while open) */}
      {showAllSpecies && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => setShowAllSpecies(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`All species in ${periodLabel}`}
            className={`${card} flex max-h-[85vh] w-full max-w-lg flex-col shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="font-semibold text-slate-900">All species in {periodLabel}</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  {species.length} species, {Math.round(speciesTotal).toLocaleString()} kg total
                </p>
              </div>
              <button
                onClick={() => setShowAllSpecies(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="space-y-4 overflow-y-auto px-6 py-5">
              {species.map((s, i) => (
                <SpeciesBar
                  key={s.name}
                  name={s.name}
                  volume={s.volume}
                  pct={speciesTotal ? (s.volume / speciesTotal) * 100 : 0}
                  rank={i + 1}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}