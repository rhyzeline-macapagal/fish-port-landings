"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download,
  FileSpreadsheet, FileText, Layers, Loader2, Package, Pencil, Plus, RotateCcw, Scale, Search, Ship,
  SlidersHorizontal, Trash2, Trophy, Truck, Wallet, X,
} from "lucide-react";
import { api, formatDate, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatusBadge from "@/components/StatusBadge";
import KpiCard from "@/components/KpiCard";
import AnimatedSelect from "@/components/AnimatedSelect";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";
import type { Col, ExportCell, Report } from "@/lib/export";
import ExportMenu, { type ExportKind } from "@/components/ExportMenu";

/* Same simple look as the dashboard: solid colours, thin borders, no blur layers, no gradients. */
const card = "surface-glass rounded-xl border border-slate-200";
const EditLandingModal = dynamic(() => import("@/components/EditLandingModal"));

const THIS_YEAR = String(new Date().getFullYear());

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* Every key here is sent to landings.php as a query-string parameter when it has a value. */
const EMPTY = {
  status: "", species: "", from: "", to: "", q: "",
  delivery: "", period: "", year: THIS_YEAR,
  vessel: "", broker: "", owner: "", origin: "", plate: "", gear: "", ground: "", quality: "",
  min_volume: "", max_volume: "", min_value: "", max_value: "",
  reviewed: "", sort: "", dir: "",
};
type Filters = Record<keyof typeof EMPTY, string>;

type Options = {
  species: string[]; vessels: string[]; owners: string[]; brokers: string[];
  origins: string[]; plates: string[]; gears: string[]; grounds: string[]; qualities: string[];
  years: number[];
};
const NO_OPTIONS: Options = {
  species: [], vessels: [], owners: [], brokers: [], origins: [], plates: [], gears: [], grounds: [], qualities: [],
  years: [],
};

type TopRow = {
  label: string;
  trips: number | string;
  total_volume_kg: number | string | null;
  total_value: number | string | null;
  avg_price_per_kg: number | string | null;
};
type TopResult = { group: string; by: string; rows: TopRow[] };
type LandingSummary = { count: number | string; volume: number | string; value: number | string; pending: number | string };

type ExportScope = "all" | "year" | "range" | "shown";
type RouteFilter = "" | "sea" | "land";
type RecordCardFilters = { search: string; route: RouteFilter; status: string; species: string; sort: string };
const EMPTY_CARD_FILTERS: RecordCardFilters = { search: "", route: "", status: "", species: "", sort: "newest" };

const TABS = [
  { label: "All", value: "", dot: "" },
  { label: "Pending", value: "pending", dot: "bg-amber-500" },
  { label: "Approved", value: "approved", dot: "bg-emerald-500" },
];

const PERIODS = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "week" },
  { label: "30 days", value: "month" },
  { label: "12 months", value: "year" },
];

const SORTS = [
  { label: "Newest first", sort: "", dir: "" },
  { label: "Oldest first", sort: "landing_date", dir: "asc" },
  { label: "Highest value", sort: "total_value", dir: "desc" },
  { label: "Lowest value", sort: "total_value", dir: "asc" },
  { label: "Largest volume", sort: "volume", dir: "desc" },
  { label: "Smallest volume", sort: "volume", dir: "asc" },
  { label: "Highest price per kg", sort: "price_per_kg", dir: "desc" },
  { label: "Supplier A to Z", sort: "boat_name", dir: "asc" },
  { label: "Broker A to Z", sort: "broker", dir: "asc" },
  { label: "Plate number A to Z", sort: "plate_number", dir: "asc" },
];

/* Leaderboard: `key` is the ?top= value, `filter` is the filter it applies when a row is clicked. */
const TOP_GROUPS: { key: string; label: string; filter: keyof Filters }[] = [
  { key: "vessel", label: "Producer", filter: "vessel" },
  { key: "species", label: "Species", filter: "species" },
  { key: "origin", label: "Origin", filter: "origin" },
  { key: "broker", label: "Broker", filter: "broker" },
];

const TOP_METRICS = [
  { key: "value", label: "Total value" },
  { key: "volume", label: "Volume" },
  { key: "trips", label: "No. of landings" },
  { key: "price", label: "Avg price per kg" },
];

const FILTER_LABELS: Record<string, string> = {
  status: "Status", species: "Species", from: "From", to: "To", q: "Search",
  delivery: "Route", period: "Period", year: "Year", vessel: "Vessel", broker: "Broker", owner: "Owner",
  origin: "Origin", plate: "Plate", gear: "Gear", ground: "Ground", quality: "Quality",
  min_volume: "Min kg", max_volume: "Max kg", min_value: "Min value", max_value: "Max value",
  reviewed: "Review",
};

const ADVANCED_KEYS: (keyof Filters)[] = [
  "vessel", "broker", "owner", "origin", "plate", "gear", "ground", "quality",
  "min_volume", "max_volume", "min_value", "max_value", "reviewed", "sort",
];

/* Columns of the records export (same order as the By Sea table) */
const RECORD_COLS: Col[] = [
  { header: "Date", format: "date" },
  { header: "Time" },
  { header: "Supplier" },
  { header: "Fishing gear" },
  { header: "Delivery" },
  { header: "Origin" },
  { header: "Plate number" },
  { header: "Registered owner" },
  { header: "Species" },
  { header: "Volume", format: "decimal" },
  { header: "Unit" },
  { header: "Price per kg", format: "money" },
  { header: "Total value", format: "money" },
  { header: "Broker" },
  { header: "Status" },
];

function chipText(k: string, v: string) {
  if (k === "delivery") return v === "land" ? "By land" : "By sea";
  if (k === "period") return PERIODS.find((p) => p.value === v)?.label ?? v;
  if (k === "reviewed") return v === "yes" ? "Reviewed" : "Not reviewed yet";
  return v;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
type GroupScope = "view" | "all" | "range";

function buildQs(f: Filters) {
  const qs = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
  return qs;
}

function metricNum(by: string, r: TopRow) {
  if (by === "volume") return Number(r.total_volume_kg) || 0;
  if (by === "trips") return Number(r.trips) || 0;
  if (by === "price") return Number(r.avg_price_per_kg) || 0;
  return Number(r.total_value) || 0;
}

function metricText(by: string, r: TopRow) {
  const n = metricNum(by, r);
  if (by === "volume") return `${n.toLocaleString()} kg`;
  if (by === "trips") return `${n.toLocaleString()} ${n === 1 ? "landing" : "landings"}`;
  if (by === "price") return `${formatPeso(n)} / kg`;
  return formatPeso(n);
}

/* ---------- Dates, month filter and previous-period comparison ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function monthBounds(year: number, month: number): [string, string] {
  return [`${year}-${pad(month)}-01`, iso(new Date(year, month, 0))];
}

type PrevRange = { from: string; to: string; label: string };

/* The period right before the one being viewed. Returns null when there is nothing sensible to compare against. */
function previousRange(f: Filters, month: string): PrevRange | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // One month of a year -> previous month (capped at the same day while the month is still running)
  if (month !== "0" && f.year) {
    const y = Number(f.year);
    const m = Number(month);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const prevStart = new Date(y, m - 2, 1);
    const prevFullEnd = new Date(y, m - 1, 0);
    const curEnd = new Date(Math.max(start.getTime(), Math.min(end.getTime(), today.getTime())));
    const partial = curEnd < end;
    const prevEnd = partial
      ? new Date(Math.min(addDays(prevStart, daysBetween(start, curEnd)).getTime(), prevFullEnd.getTime()))
      : prevFullEnd;
    return {
      from: iso(prevStart),
      to: iso(prevEnd),
      label: partial
        ? `vs ${prevStart.toLocaleDateString("en-US", { month: "short" })} 1-${prevEnd.getDate()}`
        : `vs ${prevStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
    };
  }

  // Rolling period -> the window of the same length just before it
  if (f.period) {
    const n = ({ today: 1, week: 7, month: 30, year: 365 } as Record<string, number>)[f.period];
    if (!n) return null;
    const curStart = addDays(today, -(n - 1));
    const prevTo = addDays(curStart, -1);
    const prevFrom = addDays(prevTo, -(n - 1));
    return {
      from: iso(prevFrom),
      to: iso(prevTo),
      label: f.period === "today" ? "vs yesterday" : f.period === "year" ? "vs previous 12 months" : `vs previous ${n} days`,
    };
  }

  // Custom date range -> the range of the same length just before it
  if (f.from && f.to && f.from <= f.to) {
    const a = parseDate(f.from);
    const b = parseDate(f.to);
    const n = daysBetween(a, b) + 1;
    const prevTo = addDays(a, -1);
    const prevFrom = addDays(prevTo, -(n - 1));
    return { from: iso(prevFrom), to: iso(prevTo), label: `vs ${shortDate(prevFrom)} - ${shortDate(prevTo)}` };
  }

  // Whole year -> previous year (same day cut-off while the year is still running)
  if (f.year) {
    const y = Number(f.year);
    const partial = y === today.getFullYear();
    return {
      from: `${y - 1}-01-01`,
      to: partial ? iso(new Date(y - 1, today.getMonth(), today.getDate())) : `${y - 1}-12-31`,
      label: partial ? `vs same period in ${y - 1}` : `vs ${y - 1}`,
    };
  }

  return null;
}

const kg = (r: Landing) => Number(r.volume || 0) * (r.unit === "ton" ? 1000 : 1);
const compactNumber = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function summarize(list: Landing[], skipRejected: boolean) {
  const c = skipRejected ? list.filter((r) => r.status !== "rejected") : list;
  return {
    count: c.length,
    value: c.reduce((s, r) => s + Number(r.total_value || 0), 0),
    volume: c.reduce((s, r) => s + kg(r), 0),
  };
}

function normalizedSummary(summary: LandingSummary) {
  return {
    count: Number(summary.count) || 0,
    value: Number(summary.value) || 0,
    volume: Number(summary.volume) || 0,
  };
}

function uniqueNames(values: Array<string | null | undefined>) {
  const names = new Map<string, string>();
  values.forEach((value) => {
    const name = String(value ?? "").trim();
    if (name && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name);
  });
  return Array.from(names.values()).toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/* ---------- Small pieces ---------- */

// Solid colours only (no gradients)
const AVATARS = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-rose-500",
  "bg-teal-600",
];
const CHIPS = [
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
  "bg-amber-50 text-amber-800",
  "bg-violet-50 text-violet-800",
  "bg-pink-50 text-pink-800",
  "bg-teal-50 text-teal-800",
];

const RANK_BADGES = [
  "bg-amber-500 text-white",
  "bg-slate-400 text-white",
  "bg-orange-400 text-white",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const dash = <span className="text-slate-500">-</span>;
const val = (x: ReactNode) => (x ? x : dash);

function formatTime(t: string | null) {
  if (!t) return dash;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Avatar({ name }: { name: string }) {
  const words = name.replace(/^f\/b\s*/i, "").trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
  return (
    <div
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white ${AVATARS[hash(name) % AVATARS.length]}`}
    >
      {initials}
    </div>
  );
}

function SpeciesChip({ species }: { species: string }) {
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${CHIPS[hash(species.toLowerCase()) % CHIPS.length]}`}>
      {species}
    </span>
  );
}

/* Truck plate, shown only for land deliveries that have one */
function PlateChip({ plate }: { plate: string | null }) {
  if (!plate) return dash;
  return (
    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-slate-700 ring-1 ring-slate-300">
      {plate}
    </span>
  );
}

/* Shown on rows that belong to a trip with more than one species */
function TripChip({ items }: { items?: number | string }) {
  const n = Number(items) || 1;
  if (n < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
      <Layers size={11} />
      {n} species
    </span>
  );
}

function Delivery({ truck }: { truck: boolean }) {
  const Icon = truck ? Truck : Ship;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
        truck ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"
      }`}
    >
      <Icon size={13} />
      {truck ? "By land" : "By sea"}
    </span>
  );
}

function ReviewActions({
  status,
  onApprove,
  onEdit,
  onDelete,
  labelled,
}: {
  status: Landing["status"];
  onApprove?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  labelled?: boolean;
}) {
  const base = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
    labelled ? "px-3.5" : "w-8"
  }`;
  return (
    <div className="flex justify-end gap-1.5">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          aria-label="Edit landing"
          className={`${base} bg-slate-100 text-slate-700 hover:bg-slate-200`}
        >
          <Pencil size={15} />
          {labelled && "Edit"}
        </button>
      )}
      {onApprove && status !== "approved" && (
        <button
          onClick={onApprove}
          title="Approve"
          aria-label="Approve landing"
          className={`${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <Check size={16} />
          {labelled && "Approve"}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete permanently"
          aria-label="Delete landing"
          className={`${base} bg-red-600 text-white hover:bg-red-700`}
        >
          <Trash2 size={15} />
          {labelled && "Delete"}
        </button>
      )}
    </div>
  );
}

/* ---------- Sortable table headers (client-side) ---------- */

type SortKey =
  | "landing_date" | "landing_time" | "boat_name" | "fishing_gear" | "truck_delivery"
  | "origin" | "plate_number" | "boat_owner" | "species" | "volume" | "price_per_kg" | "total_value"
  | "broker" | "status";
type TableSort = { key: SortKey; dir: "asc" | "desc" } | null;

const NUMERIC_COLS: SortKey[] = ["truck_delivery", "volume", "price_per_kg", "total_value"];

function compareBy(key: SortKey, dir: "asc" | "desc") {
  return (a: Landing, b: Landing) => {
    const av = (a as unknown as Record<string, unknown>)[key];
    const bv = (b as unknown as Record<string, unknown>)[key];
    const aEmpty = av === null || av === undefined || av === "";
    const bEmpty = bv === null || bv === undefined || bv === "";
    // Empty values always go last, whichever direction is active.
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const res = NUMERIC_COLS.includes(key)
      ? Number(av) - Number(bv)
      : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    return dir === "asc" ? res : -res;
  };
}

function filterCardRows(list: Landing[], f: RecordCardFilters) {
  const q = f.search.trim().toLowerCase();
  const filtered = list.filter((r) => {
    const matchesSearch = !q || [r.boat_name, r.boat_owner, r.broker, r.species, r.origin, r.plate_number, r.fishing_gear]
      .some((v) => String(v ?? "").toLowerCase().includes(q));
    const matchesRoute = !f.route || (f.route === "land") === (Number(r.truck_delivery) === 1);
    return matchesSearch && matchesRoute
      && (!f.status || String(r.status).toLowerCase() === f.status)
      && (!f.species || String(r.species ?? "") === f.species);
  });
  const sorters: Record<string, (a: Landing, b: Landing) => number> = {
    newest: (a, b) => `${b.landing_date} ${b.landing_time ?? ""}`.localeCompare(`${a.landing_date} ${a.landing_time ?? ""}`),
    oldest: (a, b) => `${a.landing_date} ${a.landing_time ?? ""}`.localeCompare(`${b.landing_date} ${b.landing_time ?? ""}`),
    value_desc: (a, b) => Number(b.total_value || 0) - Number(a.total_value || 0),
    value_asc: (a, b) => Number(a.total_value || 0) - Number(b.total_value || 0),
    volume_desc: (a, b) => Number(b.volume || 0) - Number(a.volume || 0),
    volume_asc: (a, b) => Number(a.volume || 0) - Number(b.volume || 0),
    supplier: (a, b) => String(a.boat_name ?? "").localeCompare(String(b.boat_name ?? "")),
  };
  return filtered.toSorted(sorters[f.sort] ?? sorters.newest);
}

// Keep keystrokes local to this small component. The large records table only
// re-renders after the user pauses, instead of once for every typed character.
function RecordSearchInput({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function update(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), 180);
  }

  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
      <input
        aria-label="Search records"
        aria-busy={draft !== value}
        className={`${inputCls} pl-9 pr-9`}
        placeholder="Search records"
        value={draft}
        onChange={(e) => update(e.target.value)}
      />
      {draft !== value && (
        <Loader2 size={14} className="pointer-events-none absolute right-3 top-3 animate-spin text-sky-600" />
      )}
    </div>
  );
}

function SortTh({
  label, k, sort, onSort, className, text,
}: {
  label: string;
  k: SortKey;
  sort: TableSort;
  onSort: (k: SortKey) => void;
  className: string;
  text?: boolean; // true = A-Z / Z-A wording in the tooltip
}) {
  const active = sort?.key === k;
  const Icon = !active ? ArrowUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
  const hint = text ? "Sort A to Z / Z to A" : "Sort ascending / descending";
  return (
    <th className={className} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(k)}
        title={hint}
        className={`group inline-flex items-center gap-1.5 transition-colors hover:text-slate-900 ${active ? "text-sky-700" : ""}`}
      >
        {label}
        <Icon size={13} className={active ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"} />
      </button>
    </th>
  );
}

/* ---------- Table columns (each table lists the columns it shows, in order) ---------- */

type Column = {
  label: string;
  k: SortKey;
  text?: boolean;   // A-Z wording in the sort tooltip
  right?: boolean;  // right-aligned numeric column
  cellCls?: string; // extra classes for the cell
  cell: (r: Landing) => ReactNode;
};

const COL: Record<string, Column> = {
  date:     { label: "Date", k: "landing_date", cellCls: "text-slate-700", cell: (r) => formatDate(r.landing_date) },
  time:     { label: "Time", k: "landing_time", cellCls: "text-slate-700", cell: (r) => formatTime(r.landing_time) },
  supplier: {
    label: "Supplier", k: "boat_name", text: true,
    cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar name={r.boat_name} />
        <span className="font-medium text-slate-900">{r.boat_name}</span>
        <TripChip items={r.trip_items} />
      </div>
    ),
  },
  gear:     { label: "Fishing gear", k: "fishing_gear", text: true, cellCls: "text-slate-700", cell: (r) => val(r.fishing_gear) },
  delivery: { label: "Delivery", k: "truck_delivery", text: true, cell: (r) => <Delivery truck={Number(r.truck_delivery) === 1} /> },
  origin:   { label: "Origin", k: "origin", text: true, cellCls: "text-slate-700", cell: (r) => val(r.origin) },
  plate:    { label: "Plate number", k: "plate_number", text: true, cell: (r) => <PlateChip plate={r.plate_number} /> },
  owner:    { label: "Registered owner", k: "boat_owner", text: true, cellCls: "text-slate-700", cell: (r) => val(r.boat_owner) },
  species:  { label: "Species", k: "species", text: true, cell: (r) => <SpeciesChip species={r.species} /> },
  // Land table has no Supplier column, so the multi-species badge sits next to the species instead
  speciesLand: {
    label: "Species", k: "species", text: true,
    cell: (r) => (
      <div className="flex items-center gap-2">
        <SpeciesChip species={r.species} />
        <TripChip items={r.trip_items} />
      </div>
    ),
  },
  volume:   { label: "Volume", k: "volume", right: true, cell: (r) => `${Number(r.volume).toLocaleString()} ${r.unit}` },
  price:    { label: "Price per kg", k: "price_per_kg", right: true, cellCls: "text-slate-700", cell: (r) => (r.price_per_kg ? formatPeso(r.price_per_kg) : dash) },
  total:    { label: "Total value", k: "total_value", right: true, cellCls: "font-semibold text-slate-900", cell: (r) => formatPeso(r.total_value) },
  broker:   { label: "Broker", k: "broker", text: true, cellCls: "text-slate-700", cell: (r) => val(r.broker) },
  status:   { label: "Status", k: "status", text: true, cell: (r) => <StatusBadge status={r.status} /> },
};

// All records / By Sea
const SEA_COLUMNS: Column[] = [
  COL.date, COL.time, COL.supplier, COL.gear, COL.delivery, COL.origin, COL.plate, COL.owner,
  COL.species, COL.volume, COL.price, COL.total, COL.broker, COL.status,
];

// By Land: Date, Time, Registered owner, Origin, Plate number, Species, Volume, Price per kg, Total value, Broker, Status (+ Actions)
const LAND_COLUMNS: Column[] = [
  COL.date, COL.time, COL.owner, COL.origin, COL.plate,
  COL.speciesLand, COL.volume, COL.price, COL.total, COL.broker, COL.status,
];

/* Lets other pages link here with ?status=pending&year=2026 */
function filtersFromUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const status = p.get("status") ?? "";
  const year = p.get("year");
  return {
    ...EMPTY,
    status: ["pending", "approved"].includes(status) ? status : "",
    year: year !== null && /^\d{4}$/.test(year) ? year : EMPTY.year,
  };
}

export default function LandingsPage() {
  const { user } = useAuth();
  const { openNewEntry, version } = useEntryModal();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [month, setMonth] = useState("0"); // "0" = whole year / no month filter
  const [rows, setRows] = useState<Landing[]>([]);
  const [prev, setPrev] = useState<{ label: string; stats: ReturnType<typeof normalizedSummary> } | null>(null);
  const prevReq = useRef(0);
  // Totals for the cards come straight from the database (same rules as the dashboard)
  const [totals, setTotals] = useState<ReturnType<typeof normalizedSummary> | null>(null);
  const totalsReq = useRef(0);
  const topReq = useRef(0);
  const listReq = useRef(0);
  const listAbort = useRef<AbortController | null>(null);
  const [cardFilters, setCardFilters] = useState<RecordCardFilters>(EMPTY_CARD_FILTERS);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(25);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const [options, setOptions] = useState<Options>(NO_OPTIONS);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [topGroup, setTopGroup] = useState("vessel");
  const [topBy, setTopBy] = useState("value");
  const [topN, setTopN] = useState(5);
  const [top, setTop] = useState<TopResult | null>(null);
  const [topLoading, setTopLoading] = useState(true);
  const recordsRef = useRef<HTMLDivElement>(null);

  // Export dialog (all / per year / date range / current view)
  const [exportOpen, setExportOpen] = useState(false);
  const [exScope, setExScope] = useState<ExportScope>("all");
  const [exYear, setExYear] = useState(THIS_YEAR);
  const [exFrom, setExFrom] = useState("");
  const [exTo, setExTo] = useState("");
  const [exBusy, setExBusy] = useState<ExportKind | null>(null);
  const [exError, setExError] = useState("");

  const start = useRef<{ version: number; filters: Filters } | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>(null);
  const [editing, setEditing] = useState<Landing | null>(null);

  // Delete (admin only)
  const [deleting, setDeleting] = useState<Landing | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Export for the records list: a route, and optionally a single supplier or owner
  const [gxOpen, setGxOpen] = useState(false);
  const [gxRoute, setGxRoute] = useState<RouteFilter>("");
  const [gxVessel, setGxVessel] = useState("");
  const [gxOwner, setGxOwner] = useState("");
  const [gxScope, setGxScope] = useState<GroupScope>("view");
  const [gxFrom, setGxFrom] = useState("");
  const [gxTo, setGxTo] = useState("");
  const [gxBusy, setGxBusy] = useState<ExportKind | null>(null);
  const [gxError, setGxError] = useState("");

  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "encoder";

  async function loadTop(f: Filters, group = topGroup, by = topBy, n = topN) {
    const id = ++topReq.current;
    setTopLoading(true);
    try {
      const qs = buildQs(f);
      // Rank the whole group even when one of its members is selected as a filter.
      const own = TOP_GROUPS.find((g) => g.key === group)?.filter;
      if (own) qs.delete(own);
      qs.set("top", group);
      qs.set("by", by);
      qs.set("n", String(n));
      const result = await api<TopResult>(`landings.php?${qs.toString()}`);
      if (id === topReq.current) setTop(result);
    } catch {
      if (id === topReq.current) setTop(null);
    } finally {
      if (id === topReq.current) setTopLoading(false);
    }
  }

  // Loads the previous period (same filters, different dates) for the "x% higher / lower" pills
  async function loadPrev(f: Filters, m: string) {
    const id = ++prevReq.current;
    const range = previousRange(f, m);
    if (!range) {
      setPrev(null);
      return;
    }
    try {
      const params: Record<string, string> = Object.fromEntries(buildQs(f));
      delete params.year;
      delete params.period;
      params.from = range.from;
      params.to = range.to;
      params.summary = "1";
      if (!f.status) params.exclude_rejected = "1";
      const summary = await api<LandingSummary | Landing[]>(`landings.php?${new URLSearchParams(params).toString()}`);
      if (id !== prevReq.current) return;
      // Keep the frontend compatible while an older hosted PHP API is being
      // replaced: old versions ignore ?summary=1 and return a row array.
      const stats = Array.isArray(summary)
        ? summarize(summary, !f.status)
        : normalizedSummary(summary);
      setPrev({ label: range.label, stats });
    } catch {
      if (id === prevReq.current) setPrev(null);
    }
  }

  // Loads the card totals straight from the database, so they match the dashboard
  // no matter how many rows the list itself managed to load.
  async function loadTotals(f: Filters, m: string) {
    const id = ++totalsReq.current;
    try {
      const hasExtraFilters = Object.entries(f).some(([key, value]) =>
        value && key !== "year" && key !== "from" && key !== "to"
      );
      const isDashboardScope = !hasExtraFilters && (!m || m === "0" || (!!f.from && !!f.to));
      if (isDashboardScope) {
        const monthParam = m && m !== "0" ? `&month=${m}` : "&month=0";
        const dashboard = await api<{ total_landings: number | string; total_volume: number | string; total_value: number | string }>(
          `dashboard.php?year=${encodeURIComponent(f.year || THIS_YEAR)}${monthParam}`
        );
        if (id !== totalsReq.current) return;
        setTotals({
          count: Number(dashboard.total_landings) || 0,
          volume: Number(dashboard.total_volume) || 0,
          value: Number(dashboard.total_value) || 0,
        });
        return;
      }
      const params: Record<string, string> = Object.fromEntries(buildQs(f));
      params.summary = "1";
      if (!f.status) params.exclude_rejected = "1";
      const res = await api<LandingSummary | Landing[]>(`landings.php?${new URLSearchParams(params).toString()}`);
      if (id !== totalsReq.current) return;
      setTotals(Array.isArray(res) ? summarize(res, !f.status) : normalizedSummary(res));
    } catch {
      if (id === totalsReq.current) setTotals(null);
    }
  }

  function goToRecords(status?: "pending") {
    if (status) apply({ status });
    // The container stays mounted while loading, so it's safe to scroll right away.
    recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSort(key: SortKey) {
    setRecordPage(1);
    setTableSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears the sort
    });
  }

  function updateCardFilters(patch: Partial<RecordCardFilters>) {
    setRecordPage(1);
    setCardFilters((current) => ({ ...current, ...patch }));
  }

  function toggleExpanded(id: number) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---------- Export (Excel / PDF) ---------- */

  // "Year: 2026 | Status: pending | ..." line printed under the report title
  function filterSummary(exportedAt: string) {
    return [
      applied.year ? `Year: ${applied.year}` : "All years",
      ...(month !== "0" ? [`Month: ${MONTHS[Number(month) - 1]}`] : []),
      ...activeChips.map(([k, v]) => `${FILTER_LABELS[k] ?? k}: ${chipText(k, v)}`),
      `Exported ${exportedAt}`,
    ].join("  |  ");
  }

  // Fetch in pages until the server returns nothing new, whatever its page-size cap is.
  async function fetchAllLandings(params: Record<string, string>, signal?: AbortSignal) {
    const PAGE = 5000;
    const out: Landing[] = [];
    const seen = new Set<number>();
    let offset = 0;
    for (let guard = 0; guard < 50; guard++) {
      const qs = new URLSearchParams({ ...params, limit: String(PAGE), offset: String(offset) });
      const chunk = await api<Landing[]>(`landings.php?${qs.toString()}`, { signal });
      if (chunk.length === 0) break;
      let added = 0;
      for (const r of chunk) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          out.push(r);
          added++;
        }
      }
      if (added === 0) break; // server ignored the offset, avoid looping forever
      offset += chunk.length;
    }
    return out;
  }

  function buildRecordsReport(list: Landing[], title: string, subtitle: string, skipRejected: boolean): Report {
    // The total skips rejected rows (same rule as the dashboard), so say so in the label.
    const counted = skipRejected ? list.filter((r) => r.status !== "rejected") : list;
    const rejected = list.length - counted.length;
    const total = counted.reduce((s, r) => s + Number(r.total_value || 0), 0);
    const body: ExportCell[][] = list.map((r) => [
      r.landing_date,
      r.landing_time ? r.landing_time.slice(0, 5) : "",
      r.boat_name,
      r.fishing_gear,
      Number(r.truck_delivery) === 1 ? "By land" : "By sea",
      r.origin || "",
      r.plate_number || "",
      r.boat_owner,
      r.species,
      Number(r.volume),
      r.unit,
      r.price_per_kg ? Number(r.price_per_kg) : "",
      Number(r.total_value),
      r.broker,
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
    ]);
    const totalLabel =
      rejected > 0 ? `Total excl. ${rejected} rejected (${counted.length})` : `Total (${counted.length})`;
    return {
      title,
      subtitle,
      tables: [
        {
          name: "Landings",
          columns: RECORD_COLS,
          rows: body,
          totals: RECORD_COLS.map((c, i): ExportCell =>
            i === 0 ? totalLabel : c.header === "Total value" ? total : ""
          ),
        },
      ],
    };
  }

  async function runExport(kind: ExportKind, scopeOverride?: ExportScope) {
    const scope = scopeOverride ?? exScope;
    setExError("");
    if (scope === "range") {
      if (!exFrom || !exTo) return setExError("Choose both dates.");
      if (exFrom > exTo) return setExError("The 'From' date must be before 'To'.");
    }

    setExBusy(kind);
    try {
      const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
      let list: Landing[];
      let label: string;
      let slug: string;
      let subtitle: string;
      let skipRejected = true;

      if (scope === "shown") {
        list = sortedRows;
        label = month !== "0" ? `${MONTHS[Number(month) - 1]} ${applied.year}` : applied.year || "All years";
        slug = `current-view_${applied.year || "all-years"}${month !== "0" ? "_" + pad(Number(month)) : ""}`;
        subtitle = filterSummary(stamp());
        skipRejected = applied.status === "";
      } else {
        const params: Record<string, string> = { sort: "landing_date", dir: "asc" };
        if (scope === "year") {
          params.year = exYear;
          label = exYear;
          slug = exYear;
        } else if (scope === "range") {
          params.from = exFrom;
          params.to = exTo;
          label = `${exFrom} to ${exTo}`;
          slug = `${exFrom}_to_${exTo}`;
        } else {
          label = "All years";
          slug = "all";
        }
        list = await fetchAllLandings(params);
        subtitle = `${label}  |  ${list.length} records  |  Exported ${stamp()}`;
      }

      if (list.length === 0) {
        setExError("No landings found for that selection.");
        return;
      }

      const report = buildRecordsReport(list, `Fish landings - ${label}`, subtitle, skipRejected);
      const name = `fish-landings_${slug}_${stamp()}`;
      if (kind === "xlsx") await exportXlsx(name, report);
      else await exportPdf(name, report, { landscape: true });
      setExportOpen(false);
    } catch (e) {
      console.error(e);
      setExError("Could not create the file. Please try again.");
    } finally {
      setExBusy(null);
    }
  }

  function openGroupExport() {
    setGxOpen(true);
    setGxRoute(cardFilters.route); // start from whatever route the card is showing
    setGxVessel("");
    setGxOwner("");
    setGxScope("view");
    setGxFrom("");
    setGxTo("");
    setGxError("");
  }

  async function runGroupExport(kind: ExportKind) {
    setGxError("");
    if (gxScope === "range") {
      if (!gxFrom || !gxTo) return setGxError("Choose both dates.");
      if (gxFrom > gxTo) return setGxError("The 'From' date must be before 'To'.");
    }

    setGxBusy(kind);
    try {
      const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
      const picked = [
        gxVessel && `Supplier: ${gxVessel}`,
        gxOwner && `Owner: ${gxOwner}`,
      ].filter(Boolean) as string[];
      const routeTitle = gxRoute === "sea" ? "By sea" : gxRoute === "land" ? "By land" : "All routes";

      let list: Landing[];
      let period: string;
      let skipRejected = true;

      if (gxScope === "view") {
        // Exactly what the card lists, narrowed to the chosen supplier / owner / plate
        list = gxList;
        period = month !== "0" ? `${MONTHS[Number(month) - 1]} ${applied.year}` : applied.year || "All years";
        skipRejected = applied.status !== "rejected" && cardFilters.status !== "rejected";
      } else {
        // Ignores the page filters, so a full history can be exported
        const params: Record<string, string> = { sort: "landing_date", dir: "asc" };
        if (gxRoute) params.delivery = gxRoute;
        if (gxVessel) params.vessel = gxVessel;
        if (gxOwner) params.owner = gxOwner;
        if (gxScope === "range") {
          params.from = gxFrom;
          params.to = gxTo;
          period = `${gxFrom} to ${gxTo}`;
        } else {
          period = "All years";
        }
        list = await fetchAllLandings(params);
      }

      if (list.length === 0) {
        setGxError("No landings found for that selection.");
        return;
      }

      const what = picked.length ? picked.join(", ") : "All suppliers";
      const subtitle = [routeTitle, ...picked, period, `${list.length} records`, `Exported ${stamp()}`].join("  |  ");
      const report = buildRecordsReport(list, `${routeTitle} landings - ${what}`, subtitle, skipRejected);
      const who = slugify([gxVessel, gxOwner].filter(Boolean).join(" ")) || "all";
      const name = `fish-landings_${gxRoute || "all"}_${who}_${slugify(period)}_${stamp()}`;

      if (kind === "xlsx") await exportXlsx(name, report);
      else await exportPdf(name, report, { landscape: true });
      setGxOpen(false);
    } catch (e) {
      console.error(e);
      setGxError("Could not create the file. Please try again.");
    } finally {
      setGxBusy(null);
    }
  }

  async function load(f: Filters = filters, m: string = month) {
    const id = ++listReq.current;
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    const keepCurrentRows = rows.length > 0;
    setLoading(!keepCurrentRows);
    setRefreshing(keepCurrentRows);
    setError("");
    setApplied(f);
    setPrev(null);
    if (f.q.trim()) {
      // Free-text LIKE searches are the most expensive database operation.
      // Keep them to one query; rankings, totals and historical comparisons
      // can load again as soon as the search is cleared. While searching, the
      // cards fall back to the loaded rows.
      topReq.current += 1;
      prevReq.current += 1;
      totalsReq.current += 1;
      setTop(null);
      setTopLoading(false);
      setTotals(null);
    } else {
      loadTop(f);
      loadPrev(f, m);
      loadTotals(f, m);
    }
    try {
      const params: Record<string, string> = Object.fromEntries(buildQs(f));
      if (!f.status) params.exclude_rejected = "1";
      const all = await fetchAllLandings(params, controller.signal);
      if (id !== listReq.current) return;
      // Guard against a row appearing on two pages
      setRows(Array.from(new Map(all.map((r) => [r.id, r])).values()));
    } catch (e) {
      if (id === listReq.current && !(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Could not load landings.");
      }
    } finally {
      if (id === listReq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function loadOptions() {
    try {
      setOptions(await api<Options>("landings.php?meta=options"));
    } catch {
      /* dropdowns simply stay empty */
    }
  }

  // load on first open (using any ?status / ?year from the URL) and again whenever a new entry is saved
  useEffect(() => {
    if (!start.current) start.current = { version, filters: filtersFromUrl() };
    const isStart = start.current.version === version;
    const f = isStart ? start.current.filters : filters;

    setFilters(f);
    load(f).then(() => {
      // Arrived from a link with a status: jump straight to the records
      if (isStart && f.status) {
        recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => () => listAbort.current?.abort(), []);

  // Close the "Approve all" dialog with Esc
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !bulkBusy && setConfirmOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, bulkBusy]);

  // Close the export dialog with Esc
  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !exBusy && setExportOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen, exBusy]);

  // Close the delete dialog with Esc
  useEffect(() => {
    if (!deleting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !deleteBusy && setDeleting(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, deleteBusy]);

  // Close the records export dialog with Esc
  useEffect(() => {
    if (!gxOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !gxBusy && setGxOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gxOpen, gxBusy]);

  async function approve(r: Landing) {
    try {
      await api("landing_review.php", {
        method: "POST",
        body: JSON.stringify(r.trip_id ? { trip_id: r.trip_id, status: "approved" } : { id: r.id, status: "approved" }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the landing.");
    }
  }

  // Permanently deletes a landing. A multi-species trip is deleted as a whole,
  // the same way approval already works on the whole trip.
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError("");
    try {
      await api("landing_delete.php", {
        method: "POST",
        body: JSON.stringify(deleting.trip_id ? { trip_id: deleting.trip_id } : { id: deleting.id }),
      });
      setDeleting(null);
      await load();
      loadOptions();
    } catch (e) {
      setDeleting(null);
      setError(e instanceof Error ? e.message : "Could not delete the landing.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function approveAll() {
    if (pendingCount > 0) setConfirmOpen(true);
  }

  async function confirmApproveAll() {
    const ids = rows.filter((r) => r.status === "pending").map((r) => r.id);
    if (ids.length === 0) {
      setConfirmOpen(false);
      return;
    }

    setBulkBusy(true);
    setError("");
    try {
      await api("landing_review.php", {
        method: "POST",
        body: JSON.stringify({ ids, status: "approved" }),
      });
      setConfirmOpen(false);
      await load();
    } catch (e) {
      setConfirmOpen(false);
      setError(e instanceof Error ? e.message : "Could not approve the landings.");
    } finally {
      setBulkBusy(false);
    }
  }

  // Tabs, chips and dropdowns apply straight away; text, dates and numbers wait for Apply / Enter.
  // `m` is the month filter that goes with this change (defaults to the current one).
  function apply(patch: Partial<Filters>, m: string = month) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setMonth(m);
    load(next, m);
  }

  // Month chips: a month is just a from/to date range inside the selected year.
  function selectMonth(v: string) {
    if (v === "0") {
      apply({ from: "", to: "" }, "0");
      return;
    }
    const y = filters.year || THIS_YEAR;
    const [from, to] = monthBounds(Number(y), Number(v));
    apply({ year: y, period: "", from, to }, v);
  }

  function changeYear(y: string) {
    if (month !== "0" && y) {
      const [from, to] = monthBounds(Number(y), Number(month));
      apply({ year: y, period: "", from, to });
    } else {
      apply({ year: y, period: "", from: "", to: "" }, "0");
    }
  }

  function reset() {
    setFilters(EMPTY);
    setMonth("0");
    setTableSort(null);
    load(EMPTY, "0");
  }

  // Clears every filter and shows the list of all landings (all years)
  function showAll() {
    setTableSort(null);
    apply({ ...EMPTY, year: "" }, "0");
  }

  function changeTop(patch: { group?: string; by?: string; n?: number }) {
    const group = patch.group ?? topGroup;
    const by = patch.by ?? topBy;
    const n = patch.n ?? topN;
    setTopGroup(group);
    setTopBy(by);
    setTopN(n);
    loadTop(applied, group, by, n);
  }

  function pickTop(label: string) {
    const g = TOP_GROUPS.find((x) => x.key === topGroup);
    if (!g) return;
    const v = g.key === "delivery" ? label.toLowerCase() : label;
    apply({ [g.filter]: applied[g.filter] === v ? "" : v } as Partial<Filters>);
  }

  const pending = useMemo(() => {
    const items = rows.filter((r) => r.status === "pending");
    return {
      count: items.length,
      value: items.reduce((sum, r) => sum + Number(r.total_value || 0), 0),
    };
  }, [rows]);
  const pendingCount = pending.count;
  const pendingValue = pending.value;

  // Same rule as the dashboard: rejected entries are not counted unless the Rejected tab is chosen.
  const skipRejected = applied.status === "";
  const countable = useMemo(
    () => skipRejected ? rows.filter((r) => r.status !== "rejected") : rows,
    [rows, skipRejected],
  );
  const rejectedCount = rows.length - countable.length;
  const rowTotals = useMemo(() => summarize(rows, skipRejected), [rows, skipRejected]);
  const cur = totals ?? rowTotals; // database totals first, loaded rows as a fallback
  const prevStats = prev?.stats ?? null;
  const totalValue = cur.value;
  const tripCount = cur.count;

  // Mini trend lines for the cards (per day, or per month when the view spans a long time)
  const sparks = useMemo(() => {
    const dates = new Set(countable.map((r) => r.landing_date));
    const bucket = (d: string) => (dates.size > 60 ? d.slice(0, 7) : d);
    const build = (pick: (r: Landing) => number) => {
      const values = new Map<string, number>();
      countable.forEach((r) => values.set(bucket(r.landing_date), (values.get(bucket(r.landing_date)) ?? 0) + pick(r)));
      const result = Array.from(values.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
      return result.length > 1 ? result : undefined;
    };
    return { count: build(() => 1), value: build((r) => Number(r.total_value || 0)), volume: build(kg) };
  }, [countable]);

  const sortedRows = tableSort ? rows.toSorted(compareBy(tableSort.key, tableSort.dir)) : rows;
  // The year and month have their own selectors, so they are not shown as chips.
  const activeChips = Object.entries(applied).filter(
    ([k, v]) => v && k !== "sort" && k !== "dir" && k !== "year" && !(month !== "0" && (k === "from" || k === "to"))
  );
  const advancedCount = ADVANCED_KEYS.filter((k) => applied[k]).length;
  const topDef = TOP_GROUPS.find((g) => g.key === topGroup);
  const topMax = top ? Math.max(...top.rows.map((r) => metricNum(top.by, r)), 0) : 0;
  const yearOptions = options.years.length ? options.years : [Number(THIS_YEAR)];

  // Export choices come from the actual Landing Records as well as API metadata.
  // This keeps the dropdowns complete even if the metadata request is delayed.
  const exportSuppliers = useMemo(
    () => uniqueNames([...options.vessels, ...rows.map((r) => r.boat_name)]),
    [options.vessels, rows],
  );
  const exportOwners = useMemo(
    () => uniqueNames([...options.owners, ...rows.map((r) => r.boat_owner)]),
    [options.owners, rows],
  );

  const recordList = filterCardRows(sortedRows, cardFilters);
  const recordPages = Math.max(1, Math.ceil(recordList.length / recordPageSize));
  const safeRecordPage = Math.min(recordPage, recordPages);
  const pageStart = (safeRecordPage - 1) * recordPageSize;
  const visibleRecords = recordList.slice(pageStart, pageStart + recordPageSize);
  const seaCount = useMemo(() => rows.filter((r) => Number(r.truck_delivery) !== 1).length, [rows]);
  const landCount = rows.length - seaCount;
  // Land-only view drops the Supplier / Gear columns; everything else shows all columns
  const recordCols = cardFilters.route === "land" ? LAND_COLUMNS : SEA_COLUMNS;
  const recordMinW = cardFilters.route === "land" ? "min-w-[1100px]" : "min-w-[1450px]";

  const gxList = filterCardRows(sortedRows, { ...cardFilters, route: gxRoute }).filter((r) =>
    (!gxVessel || r.boat_name === gxVessel) &&
    (!gxOwner || r.boat_owner === gxOwner)
  );
  const gxViewCount = gxList.length;

  const periodLabel = month !== "0" ? `${MONTHS[Number(month) - 1]} ${filters.year}` : filters.year || "all years";

  const cardBtn =
    "block h-full w-full min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";
  const th = "whitespace-nowrap px-3 py-3.5 text-xs font-semibold text-slate-600";
  const td = "whitespace-nowrap px-3 py-4";
  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-sky-600 text-white" : "text-slate-600 hover:text-slate-900"
    }`;
  const segmented = "inline-flex rounded-md bg-slate-100 p-1";
  const selectOptions = (list: string[]) => list.map((s) => <option key={s}>{s}</option>);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0875d1]">Landing operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#14263d] sm:text-[28px]">Fish Landings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review, record and export every sea and land delivery
            {month !== "0" ? ` for ${periodLabel}` : filters.year ? ` for ${filters.year}` : " across all years"}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatedSelect
            label="Year"
            value={filters.year}
            onChange={changeYear}
            options={[
              { value: "", label: "All years" },
              ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
            ]}
            className="min-w-28"
            align="right"
          />

          <AnimatedSelect
            label="Month"
            value={month}
            onChange={selectMonth}
            options={[
              { value: "0", label: "All months" },
              ...MONTHS.map((name, index) => ({ value: String(index + 1), label: name })),
            ]}
            className="min-w-32"
            align="right"
          />

          <button
            type="button"
            onClick={showAll}
            className={ghostBtn}
            title="Clear every filter and show all landings from all years"
          >
            Show all
          </button>

          <ExportMenu
            disabled={loading}
            title="Export landings"
            onExport={(kind) => runExport(kind, "shown")}
            onMoreOptions={() => {
              setExError("");
              setExYear(filters.year || THIS_YEAR);
              setExportOpen(true);
            }}
          />

          <button
            onClick={openNewEntry}
            className={primaryBtn}
          >
            <Plus size={16} /> Record a landing
          </button>
        </div>
      </section>

      {/* Summary of what is currently shown, compared with the previous period */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <button type="button" onClick={() => goToRecords()} className={cardBtn} aria-label="Go to landing records">
          <KpiCard
            label="Landings shown"
            value={String(tripCount)}
            icon={Package}
            tone="blue"
            hint={rejectedCount > 0 ? `Excludes ${rejectedCount} rejected` : "Matching the filters below"}
            loading={loading}
            current={cur.count}
            previous={prevStats?.count}
            compareLabel={prev?.label}
            spark={sparks.count}
          />
        </button>

        <button type="button" onClick={() => goToRecords()} className={cardBtn} aria-label="Go to landing records">
          <KpiCard
            label="Value shown"
            value={formatPeso(totalValue)}
            compactValue={`₱${compactNumber(totalValue)}`}
            icon={Wallet}
            tone="green"
            hint={rejectedCount > 0 ? "Excludes rejected" : "Sum of total value"}
            loading={loading}
            current={cur.value}
            previous={prevStats?.value}
            compareLabel={prev?.label}
            spark={sparks.value}
          />
        </button>

        <button type="button" onClick={() => goToRecords()} className={cardBtn} aria-label="Go to landing records">
          <KpiCard
            label="Volume shown"
            value={`${Math.round(cur.volume).toLocaleString()} kg`}
            compactValue={`${compactNumber(cur.volume)} kg`}
            icon={Scale}
            tone="violet"
            hint={rejectedCount > 0 ? "Excludes rejected" : "Total landed volume"}
            loading={loading}
            current={cur.volume}
            previous={prevStats?.volume}
            compareLabel={prev?.label}
            spark={sparks.volume}
          />
        </button>

        <button type="button" onClick={() => goToRecords("pending")} className={cardBtn} aria-label="Go to pending landings">
          <KpiCard
            label="Pending in view"
            value={String(pendingCount)}
            icon={Clock}
            tone="yellow"
            hint={pendingCount > 0 ? "Waiting for admin approval" : "Nothing waiting"}
            highlight={pendingCount > 0}
            loading={loading}
          />
        </button>
      </section>

      {/* Top performers: ranked within the current filters */}
      <section className={`${card} order-last overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Top performers</h2>
              <p className="text-xs text-slate-600">Ranked within the current filters. Click a row to filter by it.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Rank by" className={`${inputCls} !w-auto`} value={topBy} onChange={(e) => changeTop({ by: e.target.value })}>
              {TOP_METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <select aria-label="How many" className={`${inputCls} !w-auto`} value={topN} onChange={(e) => changeTop({ n: Number(e.target.value) })}>
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>Top {n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className={`${segmented} max-w-full flex-wrap gap-1`}>
            {TOP_GROUPS.map((g) => (
              <button key={g.key} onClick={() => changeTop({ group: g.key })} className={pill(topGroup === g.key)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 p-3">
          {topLoading ? (
            <div className="space-y-2 p-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : !top || top.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">Nothing to rank for these filters.</p>
          ) : (
            <ul className="space-y-1">
              {top.rows.map((r, i) => {
                const n = metricNum(top.by, r);
                const pct = topMax > 0 ? Math.max(4, (n / topMax) * 100) : 0;
                const filterValue = topGroup === "delivery" ? r.label.toLowerCase() : r.label;
                const active = !!topDef && applied[topDef.filter] === filterValue;
                const name = topGroup === "delivery" ? (r.label === "Land" ? "By land" : "By sea") : r.label;
                return (
                  <li key={r.label}>
                    <button
                      onClick={() => pickTop(r.label)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-sky-50 ring-1 ring-sky-300" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-semibold ${
                          RANK_BADGES[i] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium text-slate-900">{name}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{metricText(top.by, r)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {Number(r.trips).toLocaleString()} {Number(r.trips) === 1 ? "landing" : "landings"}
                          {" · "}
                          {(Number(r.total_volume_kg) || 0).toLocaleString()} kg
                          {" · "}
                          {formatPeso(Number(r.total_value) || 0)}
                          {" · "}
                          {formatPeso(Number(r.avg_price_per_kg) || 0)} / kg
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Landing records: filters card */}
      <div ref={recordsRef} className={`${card} scroll-mt-4 overflow-hidden`}>
        {/* Status, route and period shortcuts */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className={segmented}>
            {TABS.map((t) => (
              <button key={t.label} onClick={() => apply({ status: t.value })} className={pill(filters.status === t.value)}>
                {t.dot && <span className={`h-2 w-2 rounded-full ${t.dot}`} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* Rolling periods can cross a year boundary, so picking one switches to all years */}
          <div className={segmented}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  const next = filters.period === p.value ? "" : p.value;
                  apply({ period: next, year: next ? "" : THIS_YEAR, from: "", to: "" }, "0");
                }}
                className={pill(filters.period === p.value)}
              >
                {p.label}
              </button>
            ))}
            {isAdmin && pendingCount > 0 && (
              <button
                type="button"
                onClick={approveAll}
                disabled={bulkBusy}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={16} />
                {bulkBusy ? "Approving..." : `Approve all (${pendingCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          className="border-t border-slate-200 bg-slate-50 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
            <select className={inputCls} value={filters.species} onChange={(e) => apply({ species: e.target.value })}>
              <option value="">All species</option>
              {selectOptions(options.species)}
            </select>
            <input
              type="date"
              aria-label="From date"
              className={inputCls}
              value={filters.from}
              onChange={(e) => { setFilters({ ...filters, from: e.target.value, period: "" }); setMonth("0"); }}
            />
            <input
              type="date"
              aria-label="To date"
              className={inputCls}
              value={filters.to}
              onChange={(e) => { setFilters({ ...filters, to: e.target.value, period: "" }); setMonth("0"); }}
            />
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" />
              <input
                className={`${inputCls} pl-10 pr-10`}
                placeholder="Search supplier, owner, broker, species, origin or plate"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                aria-busy={refreshing}
              />
              {refreshing && <Loader2 size={16} className="pointer-events-none absolute right-3.5 top-3.5 animate-spin text-sky-600" />}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                className={`${ghostBtn} relative`}
                title="More filters"
              >
                <SlidersHorizontal size={15} />
                {advancedCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-sky-600 px-1 text-[11px] font-semibold text-white">
                    {advancedCount}
                  </span>
                )}
              </button>
              <button type="button" onClick={reset} aria-label="Reset filters" className={ghostBtn}>
                <RotateCcw size={15} />
              </button>
              <button className={primaryBtn}>Apply</button>
            </div>
          </div>

          {showMore && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <select aria-label="Supplier" className={inputCls} value={filters.vessel} onChange={(e) => apply({ vessel: e.target.value })}>
                <option value="">All suppliers / vessels</option>
                {selectOptions(options.vessels)}
              </select>
              <select aria-label="Broker" className={inputCls} value={filters.broker} onChange={(e) => apply({ broker: e.target.value })}>
                <option value="">All brokers</option>
                {selectOptions(options.brokers)}
              </select>
              <select aria-label="Registered owner" className={inputCls} value={filters.owner} onChange={(e) => apply({ owner: e.target.value })}>
                <option value="">All owners</option>
                {selectOptions(options.owners)}
              </select>
              <select aria-label="Origin" className={inputCls} value={filters.origin} onChange={(e) => apply({ origin: e.target.value })}>
                <option value="">All origins</option>
                {selectOptions(options.origins)}
              </select>
              <select aria-label="Plate number" className={inputCls} value={filters.plate} onChange={(e) => apply({ plate: e.target.value })}>
                <option value="">All plate numbers</option>
                {selectOptions(options.plates)}
              </select>
              <select aria-label="Fishing gear" className={inputCls} value={filters.gear} onChange={(e) => apply({ gear: e.target.value })}>
                <option value="">All fishing gear</option>
                {selectOptions(options.gears)}
              </select>
              <select aria-label="Fishing ground" className={inputCls} value={filters.ground} onChange={(e) => apply({ ground: e.target.value })}>
                <option value="">All fishing grounds</option>
                {selectOptions(options.grounds)}
              </select>
              <select aria-label="Quality" className={inputCls} value={filters.quality} onChange={(e) => apply({ quality: e.target.value })}>
                <option value="">Any quality</option>
                {selectOptions(options.qualities)}
              </select>
              <select aria-label="Review state" className={inputCls} value={filters.reviewed} onChange={(e) => apply({ reviewed: e.target.value })}>
                <option value="">Reviewed or not</option>
                <option value="yes">Reviewed</option>
                <option value="no">Not reviewed yet</option>
              </select>

              <input type="number" min={0} inputMode="decimal" aria-label="Minimum volume in kg" placeholder="Min volume (kg)" className={inputCls} value={filters.min_volume} onChange={(e) => setFilters({ ...filters, min_volume: e.target.value })} />
              <input type="number" min={0} inputMode="decimal" aria-label="Maximum volume in kg" placeholder="Max volume (kg)" className={inputCls} value={filters.max_volume} onChange={(e) => setFilters({ ...filters, max_volume: e.target.value })} />
              <input type="number" min={0} inputMode="decimal" aria-label="Minimum total value" placeholder="Min total value" className={inputCls} value={filters.min_value} onChange={(e) => setFilters({ ...filters, min_value: e.target.value })} />
              <input type="number" min={0} inputMode="decimal" aria-label="Maximum total value" placeholder="Max total value" className={inputCls} value={filters.max_value} onChange={(e) => setFilters({ ...filters, max_value: e.target.value })} />

              <select
                aria-label="Sort"
                className={`${inputCls} lg:col-span-2`}
                value={`${filters.sort}:${filters.dir}`}
                onChange={(e) => {
                  const [sort, dir] = e.target.value.split(":");
                  setTableSort(null);
                  apply({ sort, dir });
                }}
              >
                {SORTS.map((s) => (
                  <option key={s.label} value={`${s.sort}:${s.dir}`}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </form>

        {/* What is currently applied */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
            <span className="text-xs font-medium text-slate-600">Filtering by</span>
            {activeChips.map(([k, v]) => (
              <button
                key={k}
                onClick={() => apply({ [k]: "" } as Partial<Filters>)}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100"
                title="Remove this filter"
              >
                <span className="text-sky-600">{FILTER_LABELS[k] ?? k}:</span> {chipText(k, v)}
                <X size={12} />
              </button>
            ))}
            <button onClick={reset} className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline">
              Clear all
            </button>
          </div>
        )}

        {error && <p className="m-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      </div>

      {/* Loading / empty states get their own card */}
      {loading ? (
        <div className={`${card} space-y-3 p-6`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={`${card} py-16 text-center`}>
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Ship size={20} />
          </div>
          <p className="mt-3 font-medium text-slate-900">
            {month !== "0" ? `No landings found in ${periodLabel}` : filters.year ? `No landings found in ${filters.year}` : "No landings found"}
          </p>
          <p className="mt-1 text-sm text-slate-600">Change the filters or record a new landing.</p>
          <button onClick={openNewEntry} className={`${primaryBtn} mt-5`}>
            <Plus size={16} /> New entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* One records card with a route filter (All / By sea / By land) */}
          <section className={`${card} flex h-[640px] min-w-0 flex-col overflow-hidden`}>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-600">
                  <Package size={17} />
                </span>
                <h3 className="font-semibold text-slate-900">Landing records</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Route filter */}
                <div className={segmented} role="group" aria-label="Filter by route">
                  {([
                    ["", "All", rows.length, null],
                    ["sea", "By sea", seaCount, Ship],
                    ["land", "By land", landCount, Truck],
                  ] as const).map(([v, label, count, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={cardFilters.route === v}
                      onClick={() => updateCardFilters({ route: v })}
                      className={pill(cardFilters.route === v)}
                    >
                      {Icon && <Icon size={14} />}
                      {label}
                      <span className="text-xs opacity-70">{count}</span>
                    </button>
                  ))}
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {recordList.length} {recordList.length === 1 ? "record" : "records"}
                </span>
                <button
                  type="button"
                  onClick={openGroupExport}
                  title="Export these records"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_150px_180px_180px]">
              <RecordSearchInput
                value={cardFilters.search}
                onSearch={(search) => updateCardFilters({ search })}
              />
              <select aria-label="Status filter" className={inputCls} value={cardFilters.status} onChange={(e) => updateCardFilters({ status: e.target.value })}>
                <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option>
              </select>
              <select aria-label="Species filter" className={inputCls} value={cardFilters.species} onChange={(e) => updateCardFilters({ species: e.target.value })}>
                <option value="">All species</option>{selectOptions(options.species)}
              </select>
              <select aria-label="Sort records" className={inputCls} value={cardFilters.sort} onChange={(e) => updateCardFilters({ sort: e.target.value })}>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="value_desc">Highest value</option><option value="value_asc">Lowest value</option><option value="volume_desc">Largest volume</option><option value="volume_asc">Smallest volume</option><option value="supplier">Supplier A–Z</option>
              </select>
            </div>

            {recordList.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No landings match the current filters.</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {/* Mobile cards */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {visibleRecords.map((r) => {
                    const expanded = expandedRows.has(r.id);
                    return (
                    <li key={r.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={r.boat_name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{r.boat_name}</p>
                            <p className="text-xs text-slate-600">{formatDate(r.landing_date)} {formatTime(r.landing_time)}</p>
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SpeciesChip species={r.species} />
                        <TripChip items={r.trip_items} />
                        <Delivery truck={Number(r.truck_delivery) === 1} />
                        {r.origin && <span className="text-xs text-slate-600">from {r.origin}</span>}
                        {r.plate_number && <PlateChip plate={r.plate_number} />}
                      </div>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggleExpanded(r.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700"
                      >
                        {expanded ? "Hide details" : "View details"}
                        <ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
                        <div><p className="text-xs text-slate-500">Volume</p><p className="font-medium">{Number(r.volume).toLocaleString()} {r.unit}</p></div>
                        <div><p className="text-xs text-slate-500">Total value</p><p className="font-semibold">{formatPeso(r.total_value)}</p></div>
                        <div><p className="text-xs text-slate-500">Price per kg</p><p className="font-medium">{r.price_per_kg ? formatPeso(r.price_per_kg) : dash}</p></div>
                        <div><p className="text-xs text-slate-500">Broker</p><p className="break-words font-medium">{val(r.broker)}</p></div>
                        <div><p className="text-xs text-slate-500">Registered owner</p><p className="break-words font-medium">{val(r.boat_owner)}</p></div>
                        <div><p className="text-xs text-slate-500">Fishing gear</p><p className="break-words font-medium">{val(r.fishing_gear)}</p></div>
                      </div>}
                      {canEdit && <ReviewActions status={r.status} onEdit={() => setEditing(r)} onApprove={isAdmin ? () => approve(r) : undefined} onDelete={isAdmin ? () => setDeleting(r) : undefined} labelled />}
                    </li>
                    );
                  })}
                </ul>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className={`w-full ${recordMinW} text-left text-sm`}>
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
                      <tr>
                        {recordCols.map((c, i) => (
                          <SortTh
                            key={c.label}
                            label={c.label}
                            k={c.k}
                            text={c.text}
                            sort={tableSort}
                            onSort={toggleSort}
                            className={`${th} ${i === 0 ? "pl-6" : ""} ${c.right ? "text-right" : ""}`}
                          />
                        ))}
                        {canEdit && <th className={`${th} pr-6 text-right`}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          {recordCols.map((c, i) => (
                            <td
                              key={c.label}
                              className={`${td} ${i === 0 ? "pl-6" : ""} ${c.right ? "text-right tabular-nums" : ""} ${c.cellCls ?? ""}`}
                            >
                              {c.cell(r)}
                            </td>
                          ))}
                          {canEdit && (
                            <td className={`${td} pr-6 text-right`}>
                              <ReviewActions
                                status={r.status}
                                onEdit={() => setEditing(r)}
                                onApprove={isAdmin ? () => approve(r) : undefined}
                                onDelete={isAdmin ? () => setDeleting(r) : undefined}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {recordList.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {pageStart + 1}-{Math.min(pageStart + recordPageSize, recordList.length)} of {recordList.length}
                  </span>
                  <select
                    aria-label="Rows per page"
                    value={recordPageSize}
                    onChange={(e) => { setRecordPageSize(Number(e.target.value)); setRecordPage(1); }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    {[25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>Page {safeRecordPage} of {recordPages}</span>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safeRecordPage === 1}
                    onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safeRecordPage === recordPages}
                    onClick={() => setRecordPage((page) => Math.min(recordPages, page + 1))}
                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </section>

          <p className="px-2 text-sm text-slate-600">
            Showing {rows.length} {rows.length === 1 ? "landing" : "landings"}
            {rejectedCount > 0 ? ` (${rejectedCount} rejected, not counted in the totals above)` : ""}
          </p>
        </div>
      )}

      {editing && (
        <EditLandingModal
          landing={editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            loadOptions();
          }}
        />
      )}

      {/* Export dialog */}
      {exportOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => !exBusy && setExportOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            className={`${card} w-full max-w-md p-6 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="export-title" className="text-lg font-semibold text-slate-900">Export landings</h2>
                <p className="mt-1 text-sm text-slate-600">Choose what to include, then pick a format.</p>
              </div>
              <button
                onClick={() => setExportOpen(false)}
                disabled={!!exBusy}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {([
                ["all", "All landings", "Every record, all years"],
                ["year", "Landings per year", "One calendar year"],
                ["range", "Date range", "Between two dates (inclusive)"],
                ["shown", "Current view", "Exactly what is filtered on the page"],
              ] as const).map(([v, t, d]) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 transition-colors ${
                    exScope === v ? "bg-sky-50 ring-sky-300" : "ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-scope"
                    checked={exScope === v}
                    onChange={() => setExScope(v)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{t}</span>
                    <span className="block text-xs text-slate-600">{d}</span>

                    {v === "year" && exScope === "year" && (
                      <select
                        aria-label="Export year"
                        className={`${inputCls} mt-2`}
                        value={exYear}
                        onChange={(e) => setExYear(e.target.value)}
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    )}

                    {v === "range" && exScope === "range" && (
                      <span className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          aria-label="Export from date"
                          className={inputCls}
                          value={exFrom}
                          onChange={(e) => setExFrom(e.target.value)}
                        />
                        <input
                          type="date"
                          aria-label="Export to date"
                          className={inputCls}
                          value={exTo}
                          onChange={(e) => setExTo(e.target.value)}
                        />
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {exError && (
              <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{exError}</p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => runExport("xlsx")}
                disabled={!!exBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exBusy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                Excel
              </button>
              <button
                type="button"
                onClick={() => runExport("pdf")}
                disabled={!!exBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exBusy === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export the records list, optionally for one route, supplier or owner */}
      {gxOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => !gxBusy && setGxOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gx-title"
            className={`${card} max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="gx-title" className="text-lg font-semibold text-slate-900">Export landing records</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pick a route, supplier or owner to report on just that one.
                  Leave them blank to export the whole list.
                </p>
              </div>
              <button
                onClick={() => setGxOpen(false)}
                disabled={!!gxBusy}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <select aria-label="Route" className={inputCls} value={gxRoute} onChange={(e) => setGxRoute(e.target.value as RouteFilter)}>
                <option value="">All routes (sea and land)</option>
                <option value="sea">By sea only</option>
                <option value="land">By land only</option>
              </select>
              <select aria-label="Supplier" className={inputCls} value={gxVessel} onChange={(e) => setGxVessel(e.target.value)}>
                <option value="">All suppliers / boats</option>
                {selectOptions(exportSuppliers)}
              </select>
              <select aria-label="Registered owner" className={inputCls} value={gxOwner} onChange={(e) => setGxOwner(e.target.value)}>
                <option value="">All registered owners</option>
                {selectOptions(exportOwners)}
              </select>
            </div>

            <div className="mt-5 space-y-2">
              {([
                ["view", "This list as shown", `${gxViewCount} ${gxViewCount === 1 ? "record matches" : "records match"} right now`],
                ["all", "All years", "Every matching landing, ignoring the page filters"],
                ["range", "Date range", "Between two dates (inclusive)"],
              ] as const).map(([v, t, d]) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 transition-colors ${
                    gxScope === v ? "bg-sky-50 ring-sky-300" : "ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="gx-scope"
                    checked={gxScope === v}
                    onChange={() => setGxScope(v)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{t}</span>
                    <span className="block text-xs text-slate-600">{d}</span>
                    {v === "range" && gxScope === "range" && (
                      <span className="mt-2 grid grid-cols-2 gap-2">
                        <input type="date" aria-label="Export from date" className={inputCls} value={gxFrom} onChange={(e) => setGxFrom(e.target.value)} />
                        <input type="date" aria-label="Export to date" className={inputCls} value={gxTo} onChange={(e) => setGxTo(e.target.value)} />
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {gxError && (
              <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{gxError}</p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => runGroupExport("xlsx")}
                disabled={!!gxBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gxBusy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                Excel
              </button>
              <button
                type="button"
                onClick={() => runGroupExport("pdf")}
                disabled={!!gxBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gxBusy === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => !deleteBusy && setDeleting(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className={`${card} w-full max-w-md p-6 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-600">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0">
                <h2 id="delete-title" className="text-lg font-semibold text-slate-900">
                  Delete this landing?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {Number(deleting.trip_items) > 1
                    ? `This removes all ${deleting.trip_items} species on this trip.`
                    : "This removes the record."}{" "}
                  It cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-slate-600">Supplier</p>
                <p className="break-words font-semibold text-slate-900">{deleting.boat_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Date</p>
                <p className="font-semibold text-slate-900">{formatDate(deleting.landing_date)}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleting(null)} disabled={deleteBusy} className={ghostBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteBusy}
                autoFocus
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve all confirmation */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => !bulkBusy && setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-all-title"
            className={`${card} w-full max-w-md p-6 shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                <Check size={20} />
              </div>
              <div className="min-w-0">
                <h2 id="approve-all-title" className="text-lg font-semibold text-slate-900">
                  Approve all pending landings?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Only the pending landings currently shown will be approved. Landings that are already
                  approved or rejected are not changed.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-600">Landings to approve</p>
                <p className="font-semibold tabular-nums text-slate-900">{pendingCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Total value</p>
                <p className="font-semibold tabular-nums text-slate-900">{formatPeso(pendingValue)}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={bulkBusy} className={ghostBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApproveAll}
                disabled={bulkBusy}
                autoFocus
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={16} />
                {bulkBusy ? "Approving..." : `Approve ${pendingCount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}