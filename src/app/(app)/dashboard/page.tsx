"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Wallet, Clock, Plus, Fish, Ship, Truck, X, LoaderCircle,
} from "lucide-react";
import { api, formatDate, formatKg, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import ExportMenu, { type ExportKind } from "@/components/ExportMenu";
import AnimatedSelect from "@/components/AnimatedSelect";
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

const card = "surface-glass rounded-xl border border-slate-200";
const num = (v: unknown) => Number(v ?? 0);
const formatSummaryPeso = (value: unknown) => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
}).format(num(value));
const formatCompactPeso = (value: unknown) => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
}).format(num(value));
const SPECIES_COLORS = ["#0875d1", "#1a8cc7", "#34b981", "#f4b740", "#64748b", "#ef5d50"];

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
  by_route: {
    land: { landings: number | string; value: number | string; weight: number | string };
    sea: { landings: number | string; value: number | string; weight: number | string };
  };
  period_days: number | string;
}

type SpeciesRow = { name: string; volume: number };
type MonthPoint = { label: string; full: string; volume: number; landings: number; amount: number };
type SpeciesSlice = SpeciesRow & { percentage: number; color: string };

type RouteTotals = { landings: number; value: number; weight: number };
type ComparisonMetric = "landings" | "value" | "weight";

const routeNumber = (route: DashboardData["by_route"]["land"] | undefined, key: ComparisonMetric) =>
  Number(route?.[key] ?? 0) || 0;

function percentage(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function RouteComparison({
  title, land, sea, format,
}: {
  title: string;
  land: number;
  sea: number;
  format: (value: number) => string;
}) {
  const total = land + sea;
  const landPct = percentage(land, total);
  const seaPct = percentage(sea, total);
  const hasData = total > 0;

  return (
    <article className="border-b border-slate-200 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-[#14263d]">{title}</h3>
        {hasData && <span className="text-xs tabular-nums text-slate-500">Combined: {format(total)}</span>}
      </div>
      {hasData ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#34b981]" />
              Land <strong className="tabular-nums text-[#14263d]">{landPct.toFixed(1)}%</strong> <span className="tabular-nums text-slate-500">- {format(land)}</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#0875d1]" />
              Sea <strong className="tabular-nums text-[#14263d]">{seaPct.toFixed(1)}%</strong> <span className="tabular-nums text-slate-500">- {format(sea)}</span>
            </span>
          </div>
          <div
            className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner"
            role="img"
            aria-label={`${title}: Land ${landPct.toFixed(1)} percent, Sea ${seaPct.toFixed(1)} percent`}
          >
            <div className="bg-[#34b981] transition-[width] duration-500 ease-out" style={{ width: `${landPct}%` }} />
            <div className="bg-[#0875d1] transition-[width] duration-500 ease-out" style={{ width: `${seaPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Combined total: <strong className="font-semibold tabular-nums text-[#14263d]">{format(total)}</strong></p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No land or sea landings in this period.</p>
      )}
    </article>
  );
}

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

// Pure-CSS monthly bars. Each bar is a button: click to filter by that month.
const MonthlyBars = memo(function MonthlyBars({
  data, selected, onSelect,
}: {
  data: MonthPoint[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  const rawMax = Math.max(...data.map((d) => d.volume), 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const normalized = rawMax / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const max = nice * magnitude;
  const tickLabels = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const compact = (value: number) => {
    if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
    if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
    return Math.round(value).toLocaleString();
  };

  return (
    <div className="flex h-full min-w-0" role="group" aria-label="Monthly landing volume in kilograms">
      <div className="flex w-10 shrink-0 flex-col justify-between pb-7 pr-2 text-right text-[9px] tabular-nums text-slate-400 sm:w-12 sm:text-[10px]">
        {tickLabels.map((tick) => <span key={tick}>{compact(tick)}</span>)}
      </div>
      <div className="relative flex min-w-0 flex-1 gap-1 sm:gap-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-7 top-0 flex flex-col justify-between" aria-hidden="true">
          {tickLabels.map((tick) => <span key={tick} className="border-t border-dashed border-slate-200" />)}
        </div>
        {data.map((d, i) => {
          const active = selected === i + 1;
          const dim = selected !== 0 && !active;
          const percentage = d.volume > 0 ? Math.max((d.volume / max) * 100, 2) : 0;
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => onSelect(i + 1)}
              aria-pressed={active}
              aria-label={`${d.full}: ${formatKg(d.volume)} across ${d.landings.toLocaleString()} landings`}
              className="group relative z-10 flex min-w-0 flex-1 flex-col focus-visible:outline-none"
            >
              <span className="relative flex flex-1 items-end justify-center">
                <span
                  className={`relative w-[72%] max-w-8 rounded-t-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-[#0875d1] ${
                    d.volume === 0
                      ? "h-px bg-slate-300"
                      : dim
                        ? "bg-sky-200 group-hover:bg-sky-300"
                        : "bg-[#48aaf0] group-hover:bg-[#0875d1]"
                  }`}
                  style={d.volume > 0 ? { height: `${percentage}%` } : undefined}
                >
                  {d.volume > 0 && (
                    <span className="pointer-events-none absolute -top-11 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#12344d] px-2 py-1 text-[9px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 group-focus-visible:block group-focus-visible:opacity-100 sm:text-[10px]">
                      {formatKg(d.volume)}
                    </span>
                  )}
                </span>
              </span>
              <span className={`flex h-7 items-end justify-center text-[9px] sm:text-[10px] ${active ? "font-semibold text-[#0875d1]" : "text-slate-500"}`}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
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

function DashboardSkeleton({ className = "h-64" }: { className?: string }) {
  return (
    <div className={`${className} animate-pulse rounded-lg bg-slate-100`} aria-label="Loading dashboard data" />
  );
}

function SpeciesDonut({ slices, total }: { slices: SpeciesSlice[]; total: number }) {
  const gradient = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((sum, item) => sum + item.percentage, 0);
    const end = start + slice.percentage;
    return `${slice.color} ${start}% ${end}%`;
  }).join(", ");

  return (
    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div
        role="img"
        aria-label={`Species share chart. ${slices.map((slice) => `${slice.name} ${slice.percentage.toFixed(1)} percent`).join(", ")}`}
        className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <p className="text-sm font-semibold tabular-nums text-[#14263d]">{Math.round(total).toLocaleString()}</p>
            <p className="text-[9px] text-slate-500">kg total</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{slice.name}</span>
            <span className="shrink-0 tabular-nums text-slate-500">{slice.percentage.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
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
        if (!d.by_route?.land || !d.by_route?.sea || !d.period_days) {
          throw new Error("Dashboard analytics data is unavailable. Please deploy the latest dashboard API.");
        }
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
  const latestLandingDate = (data?.recent ?? []).reduce((latest, record) => (
    !latest || record.landing_date > latest ? record.landing_date : latest
  ), "");
  const latestDateNote = latestLandingDate ? `As of ${formatDate(latestLandingDate)}` : "No landing date yet";

  // Derived data (memoized so month/year toggles don't recompute everything)
  const species = useMemo<SpeciesRow[]>(
    () => (data?.by_species ?? []).map((s) => ({ name: s.species, volume: Number(s.volume) })),
    [data]
  );
  const speciesTotal = useMemo(() => species.reduce((sum, s) => sum + s.volume, 0), [species]);
  const speciesSlices = useMemo<SpeciesSlice[]>(() => {
    if (!speciesTotal) return [];
    const visible = species.slice(0, 5).map((item, index) => ({
      ...item,
      percentage: (item.volume / speciesTotal) * 100,
      color: SPECIES_COLORS[index],
    }));
    if (species.length > 5) {
      const otherVolume = species.slice(5).reduce((sum, item) => sum + item.volume, 0);
      visible.push({
        name: "Others",
        volume: otherVolume,
        percentage: (otherVolume / speciesTotal) * 100,
        color: SPECIES_COLORS[5],
      });
    }
    return visible;
  }, [species, speciesTotal]);
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
  const noMonthlyData = monthly.every((r) => r.volume === 0);

  const recent = data?.recent ?? [];
  const pending = num(data?.pending_review);
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const now = new Date();
  const today = now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
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
  const landRoute: RouteTotals = {
    landings: routeNumber(data?.by_route?.land, "landings"),
    value: routeNumber(data?.by_route?.land, "value"),
    weight: routeNumber(data?.by_route?.land, "weight"),
  };
  const seaRoute: RouteTotals = {
    landings: routeNumber(data?.by_route?.sea, "landings"),
    value: routeNumber(data?.by_route?.sea, "value"),
    weight: routeNumber(data?.by_route?.sea, "weight"),
  };
  const periodDays = Math.max(1, num(data?.period_days));
  const averageDaily = (value: number) => value / periodDays;

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
    { v: "0", l: "All months" },
    ...MONTHS.map((label, index) => ({ v: String(index + 1), l: label })),
  ];

  return (
    <div className="space-y-5" aria-busy={fetching}>
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#14263d] sm:text-2xl">{greeting}, {firstName}!</h2>
            {fetching && data && <LoaderCircle size={16} className="animate-spin text-[#1a8cc7]" aria-label="Updating dashboard" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening at Mercedes FishPort today.</p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center xl:justify-end">
          <p className="whitespace-nowrap text-xs font-medium text-slate-500">{today}</p>
          <div className="flex flex-wrap items-center gap-2">
            <AnimatedSelect
              label="Reporting year"
              value={year}
              options={yearOptions.map((option) => ({ value: String(option), label: String(option) }))}
              onChange={setYear}
              className="min-w-28"
              align="right"
            />
            <AnimatedSelect
              label="Reporting month"
              value={month}
              options={monthOptions.map((option) => ({ value: option.v, label: option.l }))}
              onChange={setMonth}
              className="min-w-32"
              align="right"
            />
            <ExportMenu onExport={exportDashboard} disabled={!data} title={`Download the ${periodLabel} dashboard`} />
            {canAdd && (
              <button
                type="button"
                onClick={openNewEntry}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0875d1] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1a8cc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40"
              >
                <Plus size={15} /> Record a Landing
              </button>
            )}
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section aria-label="Dashboard summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Total landings"
          value={cur.landings.toLocaleString()}
          icon={Ship}
          tone="blue"
          hint={latestDateNote}
          loading={loading}
          current={cur.landings}
          previous={prev?.landings}
          compareLabel={compareLabel}
          spark={sparks.landings}
        />
        <KpiCard
          label="Total value"
          value={formatSummaryPeso(data?.total_value)}
          compactValue={formatCompactPeso(data?.total_value)}
          icon={Wallet}
          tone="green"
          hint={latestDateNote}
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

      <section aria-label="Land versus sea landing distribution" className={`${card} p-5`}>
        <CardHeader
          title="Land vs. Sea Landing Distribution"
          subtitle={`How ${periodLabel} landings compare by records, value, and weight`}
        />
        {loading ? (
          <div className="mt-4 space-y-4"><DashboardSkeleton className="h-20" /><DashboardSkeleton className="h-20" /><DashboardSkeleton className="h-20" /></div>
        ) : (
          <div className="mt-4">
            <RouteComparison
              title="Total Landings"
              land={landRoute.landings}
              sea={seaRoute.landings}
              format={(value) => value.toLocaleString()}
            />
            <RouteComparison
              title="Total Landing Value"
              land={landRoute.value}
              sea={seaRoute.value}
              format={(value) => formatSummaryPeso(value)}
            />
            <RouteComparison
              title="Total Weight"
              land={landRoute.weight}
              sea={seaRoute.weight}
              format={(value) => formatKg(value)}
            />
          </div>
        )}
      </section>

      <section aria-label="Average daily landing value">
        <CardHeader title="Average Daily Landing Value" subtitle={`Based on ${periodDays.toLocaleString()} calendar days in ${periodLabel}`} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
          <KpiCard
            label="Average Daily Value - Combined"
            value={`${formatSummaryPeso(averageDaily(landRoute.value + seaRoute.value))}/day`}
            compactValue={`${formatCompactPeso(averageDaily(landRoute.value + seaRoute.value))}/day`}
            icon={Wallet}
            tone="green"
            hint={data ? "Land and Sea landing value" : "No data for this period"}
            loading={loading}
          />
          <KpiCard
            label="Average Daily Value - Land"
            value={`${formatSummaryPeso(averageDaily(landRoute.value))}/day`}
            compactValue={`${formatCompactPeso(averageDaily(landRoute.value))}/day`}
            icon={Truck}
            tone="blue"
            hint={data ? "Land landing value only" : "No data for this period"}
            loading={loading}
          />
          <KpiCard
            label="Average Daily Value - Sea"
            value={`${formatSummaryPeso(averageDaily(seaRoute.value))}/day`}
            compactValue={`${formatCompactPeso(averageDaily(seaRoute.value))}/day`}
            icon={Ship}
            tone="green"
            hint={data ? "Sea landing value only" : "No data for this period"}
            loading={loading}
          />
        </div>
      </section>

      <section aria-label="Landing analytics" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className={`${card} p-5 lg:col-span-2 xl:col-span-6`}>
          <CardHeader
            title={`Monthly Landing Volume (${year})`}
            subtitle="Volume in kilograms. Select a bar to filter the dashboard."
            right={
              m ? (
                <button onClick={() => setMonth("0")} className="shrink-0 text-xs font-semibold text-[#0875d1] hover:text-[#1a8cc7]">Clear {MONTHS_SHORT[m - 1]}</button>
              ) : undefined
            }
          />
          <div className="mt-5 h-56 sm:h-64">
            {loading ? (
              <DashboardSkeleton className="h-full" />
            ) : noMonthlyData ? (
              <Empty icon={Fish} title="No landings yet" text={`Nothing recorded in ${year}.`} height="h-full" />
            ) : (
              <MonthlyBars data={monthly} selected={m} onSelect={toggleMonth} />
            )}
          </div>
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <CardHeader
            title="Species Share"
            subtitle={`Share of ${periodLabel} volume`}
          />
          {loading ? (
            <DashboardSkeleton className="mt-4 h-56" />
          ) : species.length === 0 ? (
            <Empty icon={Fish} title="Nothing to show" text="Shares appear after the first landing." height="h-56" />
          ) : (
            <SpeciesDonut slices={speciesSlices} total={speciesTotal} />
          )}
        </div>

        <div className={`${card} p-5 xl:col-span-3`}>
          <CardHeader
            title="Top 6 Species"
            subtitle={`Highest volume in ${periodLabel}`}
            right={species.length > 6 ? (
              <button type="button" onClick={() => setShowAllSpecies(true)} className="shrink-0 text-xs font-semibold text-[#0875d1] hover:text-[#1a8cc7]">View all</button>
            ) : undefined}
          />
          {loading ? (
            <DashboardSkeleton className="mt-4 h-56" />
          ) : species.length === 0 ? (
            <Empty icon={Fish} title="No species yet" text="Rankings appear after landings are recorded." height="h-56" />
          ) : (
            <ol className="mt-3 divide-y divide-slate-100">
              {species.slice(0, 6).map((item, index) => (
                <li key={item.name} className="flex items-center gap-3 py-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${index < 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>
                  <Fish size={17} className="shrink-0 text-[#1a8cc7]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{item.name}</span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#14263d]">{Math.round(item.volume).toLocaleString()} kg</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <CardHeader title="Recent landings" subtitle={`The latest entries in ${periodLabel}`} />
          {canAdd && <Link href="/landings" className="shrink-0 text-xs font-semibold text-[#0875d1] hover:text-[#1a8cc7]">View all landings</Link>}
        </div>

        {loading ? (
          <div className="space-y-3 border-t border-slate-200 p-5">
            {[0, 1, 2].map((row) => <DashboardSkeleton key={row} className="h-10" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="border-t border-slate-200">
            <Empty icon={Ship} title="No landings recorded yet" text="New entries show up here as soon as they are saved." />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Supplier</th>
                    <th className="px-3 py-2.5 font-semibold">Origin</th>
                    <th className="px-3 py-2.5 font-semibold">Species</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Volume</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total Value</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((record) => (
                    <tr key={record.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(record.landing_date)}</td>
                      <td className="px-3 py-3 font-medium text-[#14263d]">{record.boat_name}</td>
                      <td className="px-3 py-3 text-slate-600">{record.origin || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">{record.species}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{Number(record.volume).toLocaleString()} {record.unit}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-[#14263d]">{formatPeso(record.total_value)}</td>
                      <td className="px-5 py-3"><StatusBadge status={record.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
              {recent.map((record) => (
                <li key={record.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#14263d]">{record.boat_name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(record.landing_date)}</p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div><dt className="text-slate-400">Species</dt><dd className="mt-0.5 truncate font-medium text-slate-700">{record.species}</dd></div>
                    <div><dt className="text-slate-400">Origin</dt><dd className="mt-0.5 truncate font-medium text-slate-700">{record.origin || "-"}</dd></div>
                    <div><dt className="text-slate-400">Volume</dt><dd className="mt-0.5 font-medium tabular-nums text-slate-700">{Number(record.volume).toLocaleString()} {record.unit}</dd></div>
                    <div><dt className="text-slate-400">Total value</dt><dd className="mt-0.5 font-semibold tabular-nums text-[#14263d]">{formatPeso(record.total_value)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
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
