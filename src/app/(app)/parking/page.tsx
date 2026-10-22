"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3, CalendarDays, Car, Eye, Loader2, Pencil, Plus, Search, Settings2, Trash2, Wallet, X,
} from "lucide-react";
import { api, formatDate, formatPeso } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ExportMenu, { type ExportKind } from "@/components/ExportMenu";
import type { Report } from "@/lib/export";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

type VehicleType = { id: number; name: string; is_active: number | boolean };
type Recorder = { id: number; full_name: string };
type ParkingRecord = {
  id: number; collection_date: string; vehicle_type_id: number; vehicle_type: string;
  custom_vehicle_type: string | null; vehicle_count: number | string | null;
  rate_per_vehicle: number | string | null; total_collection: number | string;
  is_manual_total: number | boolean; or_number: string | null; remarks: string | null;
  recorded_by_name: string; updated_by_name: string | null; created_at: string; updated_at: string;
};
type MonthRow = { month: number; vehicles: number | string; collection: number | string };
type DayRow = { date: string; collection: number | string };
type TypeRow = { vehicle_type: string; vehicles: number | string; collection: number | string };
type Comparison = { month: number; current: number | string; previous: number | string; difference: number | string; percent: number | null };
type ParkingData = {
  records: ParkingRecord[]; total: number; page: number; limit: number;
  cards: { today_collection: number | string; today_vehicles: number | string; month_collection: number | string; year_collection: number | string };
  summary: {
    entries: number | string; vehicles: number | string; collection: number | string; active_days: number | string;
    average_daily: number | string; highest_day: DayRow | null; lowest_day: DayRow | null;
  };
  monthly: MonthRow[]; comparison: Comparison; by_type: TypeRow[]; daily: DayRow[];
  types: VehicleType[]; recorders: Recorder[]; years: number[]; year: number;
};
type Filters = { year: string; month: string; date: string; from: string; to: string; vehicle_type_id: string; recorded_by: string; q: string };
type FormState = {
  collection_date: string; vehicle_type_id: string; custom_vehicle_type: string;
  vehicle_count: string; rate_per_vehicle: string; total_collection: string;
  is_manual_total: boolean; or_number: string; remarks: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const card = "rounded-xl border border-slate-200 bg-white shadow-sm";
const emptyFilters = (): Filters => ({ year: "", month: "", date: "", from: "", to: "", vehicle_type_id: "", recorded_by: "", q: "" });
const emptyForm: FormState = {
  collection_date: "", vehicle_type_id: "", custom_vehicle_type: "", vehicle_count: "",
  rate_per_vehicle: "", total_collection: "", is_manual_total: false, or_number: "", remarks: "",
};
const localDate = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const num = (value: unknown) => Number(value) || 0;

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${card} max-h-[92vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto p-6 shadow-xl`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BarList({ rows }: { rows: TypeRow[] }) {
  const max = Math.max(...rows.map((r) => num(r.collection)), 0);
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-500">No collection data for these filters.</p>;
  return <div className="space-y-3">{rows.map((r) => {
    const amount = num(r.collection);
    return <div key={r.vehicle_type}>
      <div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{r.vehicle_type}</span><span className="font-semibold tabular-nums">{formatPeso(amount)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${max ? Math.max(2, amount / max * 100) : 0}%` }} /></div>
    </div>;
  })}</div>;
}

export default function ParkingPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "encoder";
  const canDelete = user?.role === "admin";
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ParkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [typesOpen, setTypesOpen] = useState(false);
  const [allTypes, setAllTypes] = useState<VehicleType[]>([]);
  const [newType, setNewType] = useState("");
  const [typeError, setTypeError] = useState("");

  const query = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "50" });
    Object.entries(filters).forEach(([key, value]) => value && qs.set(key, value));
    return qs.toString();
  }, [filters, page]);

  useEffect(() => {
    let ignore = false;
    api<ParkingData>(`parking.php?${query}`)
      .then((result) => { if (!ignore) { setData(result); setError(""); } })
      .catch((err) => !ignore && setError(err instanceof Error ? err.message : "Could not load parking collections"))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [query, reload]);

  const types = data?.types ?? [];
  const otherType = types.find((t) => t.name.toLowerCase() === "other");
  const calculatedTotal = form.is_manual_total
    ? num(form.total_collection)
    : num(form.vehicle_count) * num(form.rate_per_vehicle);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 50)));
  const annualVehicles = (data?.monthly ?? []).reduce((sum, row) => sum + num(row.vehicles), 0);
  const annualCollection = (data?.monthly ?? []).reduce((sum, row) => sum + num(row.collection), 0);
  const maxMonth = Math.max(...(data?.monthly ?? []).map((r) => num(r.collection)), 0);
  const recentDays = (data?.daily ?? []).slice(-31);
  const maxDay = Math.max(...recentDays.map((r) => num(r.collection)), 0);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setLoading(true); setError(""); setPage(1); setFilters((current) => ({ ...current, [key]: value }));
  }

  function openAdd() {
    setEditingId(null); setViewOnly(false); setFormError("");
    setForm({ ...emptyForm, collection_date: localDate(), vehicle_type_id: types[0] ? String(types[0].id) : "" });
    setFormOpen(true);
  }

  function openRecord(record: ParkingRecord, readOnly: boolean) {
    setEditingId(record.id); setViewOnly(readOnly); setFormError("");
    setForm({
      collection_date: record.collection_date, vehicle_type_id: String(record.vehicle_type_id ?? ""),
      custom_vehicle_type: record.custom_vehicle_type ?? "", vehicle_count: record.vehicle_count == null ? "" : String(record.vehicle_count),
      rate_per_vehicle: record.rate_per_vehicle == null ? "" : String(record.rate_per_vehicle),
      total_collection: String(record.total_collection), is_manual_total: Boolean(Number(record.is_manual_total)),
      or_number: record.or_number ?? "", remarks: record.remarks ?? "",
    });
    setFormOpen(true);
  }

  async function saveRecord(e: FormEvent) {
    e.preventDefault(); if (viewOnly || saving) return;
    setSaving(true); setFormError("");
    try {
      await api("parking.php", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({ ...form, id: editingId, total_collection: calculatedTotal }),
      });
      setFormOpen(false); setLoading(true); setReload((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the parking record");
    } finally { setSaving(false); }
  }

  async function deleteRecord(record: ParkingRecord) {
    if (!confirm(`Delete the ${record.vehicle_type} collection for ${formatDate(record.collection_date)}?`)) return;
    try { await api(`parking.php?id=${record.id}`, { method: "DELETE" }); setLoading(true); setReload((n) => n + 1); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete the record"); }
  }

  async function openTypes() {
    setTypesOpen(true); setTypeError("");
    try { setAllTypes(await api<VehicleType[]>("parking.php?resource=types")); }
    catch (err) { setTypeError(err instanceof Error ? err.message : "Could not load vehicle types"); }
  }

  async function addType(e: FormEvent) {
    e.preventDefault(); if (!newType.trim()) return;
    try {
      await api("parking.php?resource=types", { method: "POST", body: JSON.stringify({ name: newType }) });
      setNewType(""); setAllTypes(await api<VehicleType[]>("parking.php?resource=types")); setLoading(true); setReload((n) => n + 1);
    } catch (err) { setTypeError(err instanceof Error ? err.message : "Could not add vehicle type"); }
  }

  async function updateType(type: VehicleType, patch: Partial<VehicleType>) {
    const next = { ...type, ...patch };
    try {
      await api("parking.php?resource=types", { method: "PUT", body: JSON.stringify(next) });
      setAllTypes((items) => items.map((item) => item.id === type.id ? next : item)); setLoading(true); setReload((n) => n + 1);
    } catch (err) { setTypeError(err instanceof Error ? err.message : "Could not update vehicle type"); }
  }

  async function exportReport(kind: ExportKind) {
    const qs = new URLSearchParams({ page: "1", limit: "5000" });
    Object.entries(filters).forEach(([key, value]) => value && qs.set(key, value));
    const full = await api<ParkingData>(`parking.php?${qs.toString()}`);
    const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
    const report: Report = {
      title: "Parking Collection Report",
      subtitle: `Filtered records and ${full.year} monthly summary | Exported ${stamp()}`,
      tables: [
        {
          name: "Parking records",
          columns: [
            { header: "Date", format: "date" }, { header: "Vehicle type" }, { header: "Vehicles", format: "int" },
            { header: "Rate", format: "money" }, { header: "Total", format: "money" }, { header: "Manual total" },
            { header: "OR / Reference" }, { header: "Recorded by" }, { header: "Remarks" },
          ],
          rows: full.records.map((r) => [r.collection_date, r.vehicle_type, r.vehicle_count, r.rate_per_vehicle, r.total_collection, Number(r.is_manual_total) ? "Yes" : "No", r.or_number, r.recorded_by_name, r.remarks]),
          totals: ["Filtered total", "", full.summary.vehicles, "", full.summary.collection, "", "", "", ""],
        },
        {
          name: `${full.year} monthly summary`,
          columns: [{ header: "Month" }, { header: "Total vehicles", format: "int" }, { header: "Total collection", format: "money" }],
          rows: full.monthly.map((r) => [MONTHS[r.month - 1], r.vehicles, r.collection]),
          totals: ["Annual total", full.monthly.reduce((s, r) => s + num(r.vehicles), 0), full.monthly.reduce((s, r) => s + num(r.collection), 0)],
        },
      ],
    };
    const filename = `parking-collections_${full.year}_${stamp()}`;
    if (kind === "xlsx") await exportXlsx(filename, report); else await exportPdf(filename, report, { landscape: true });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#12344d] p-6 text-white">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-white/10"><Car size={23} /></span>
          <div><h1 className="text-2xl font-semibold">Parking Collection</h1><p className="mt-1 text-sm text-slate-300">Daily parking income and monthly analytics</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu onExport={exportReport} disabled={!data || loading} variant="glass" title="Export parking report" />
          {canEdit && <button type="button" onClick={openTypes} className="inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-2.5 text-sm font-medium hover:bg-white/10"><Settings2 size={16} /> Vehicle types</button>}
          {canEdit && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-[#12344d] hover:bg-slate-100"><Plus size={16} /> Add collection</button>}
        </div>
      </section>

      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Today's collection", formatPeso(data?.cards.today_collection), Wallet, "bg-emerald-50 text-emerald-600"],
          ["Today's vehicles", num(data?.cards.today_vehicles).toLocaleString(), Car, "bg-sky-50 text-sky-600"],
          ["This month", formatPeso(data?.cards.month_collection), CalendarDays, "bg-violet-50 text-violet-600"],
          ["This year", formatPeso(data?.cards.year_collection), BarChart3, "bg-amber-50 text-amber-600"],
        ].map(([label, value, Icon, tone]) => <div key={String(label)} className={`${card} p-5`}>
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{String(label)}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon size={18} /></span></div>
          {loading && !data ? <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-100" /> : <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{String(value)}</p>}
        </div>)}
      </section>

      <form onSubmit={(e) => { e.preventDefault(); setFilter("q", searchDraft.trim()); }} className={`${card} grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4`}>
        <select aria-label="Year" className={inputCls} value={filters.year} onChange={(e) => setFilter("year", e.target.value)}><option value="">All years</option>{(data?.years ?? []).map((y) => <option key={y}>{y}</option>)}</select>
        <select aria-label="Month" className={inputCls} value={filters.month} onChange={(e) => setFilter("month", e.target.value)}><option value="">All months</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select aria-label="Vehicle type" className={inputCls} value={filters.vehicle_type_id} onChange={(e) => setFilter("vehicle_type_id", e.target.value)}><option value="">All vehicle types</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select aria-label="Recorded by" className={inputCls} value={filters.recorded_by} onChange={(e) => setFilter("recorded_by", e.target.value)}><option value="">All recorders</option>{(data?.recorders ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select>
        <input type="date" aria-label="Specific collection date" title="Specific collection date" className={inputCls} value={filters.date} onChange={(e) => setFilter("date", e.target.value)} />
        <input type="date" aria-label="From date" className={inputCls} value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        <input type="date" aria-label="To date" className={inputCls} value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        <div className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" /><input className={`${inputCls} pl-10`} placeholder="Search OR / reference" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} /></div><button className={primaryBtn}>Search</button></div>
        <div className="sm:col-span-2 xl:col-span-4"><button type="button" onClick={() => { setLoading(true); setFilters(emptyFilters()); setSearchDraft(""); setPage(1); }} className={ghostBtn}>Clear filters</button></div>
      </form>

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="font-semibold text-slate-900">Collection records</h2><p className="text-xs text-slate-500">{data?.total ?? 0} matching entries</p></div>{loading && <Loader2 size={18} className="animate-spin text-sky-600" />}</div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[1050px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600"><tr>
            {["Collection date", "Vehicle type", "Vehicles", "Rate", "Total collection", "OR / Reference", "Recorded by", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
          </tr></thead><tbody className="divide-y divide-slate-100">
            {!loading && !(data?.records.length) ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No parking collections match these filters.</td></tr> : (data?.records ?? []).map((r) => <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.collection_date)}</td><td className="px-4 py-3 font-medium">{r.vehicle_type}</td>
              <td className="px-4 py-3 tabular-nums">{r.vehicle_count == null ? "Unknown" : num(r.vehicle_count).toLocaleString()}</td>
              <td className="px-4 py-3 tabular-nums">{r.rate_per_vehicle == null ? "—" : formatPeso(r.rate_per_vehicle)}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{formatPeso(r.total_collection)}{Number(r.is_manual_total) ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">Manual</span> : null}</td>
              <td className="px-4 py-3">{r.or_number || "—"}</td><td className="px-4 py-3">{r.recorded_by_name}</td>
              <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openRecord(r, true)} title="View" className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><Eye size={15} /></button>{canEdit && <button onClick={() => openRecord(r, false)} title="Edit" className="rounded-md p-2 text-sky-700 hover:bg-sky-50"><Pencil size={15} /></button>}{canDelete && <button onClick={() => deleteRecord(r)} title="Delete" className="rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></td>
            </tr>)}</tbody></table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm"><span>Page {page} of {pages}</span><div className="flex gap-2"><button className={ghostBtn} disabled={page <= 1} onClick={() => { setLoading(true); setPage((p) => p - 1); }}>Previous</button><button className={ghostBtn} disabled={page >= pages} onClick={() => { setLoading(true); setPage((p) => p + 1); }}>Next</button></div></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Filtered collection", formatPeso(data?.summary.collection)], ["Vehicles recorded", num(data?.summary.vehicles).toLocaleString()],
          ["Average per active day", formatPeso(data?.summary.average_daily)], ["Entries", num(data?.summary.entries).toLocaleString()],
        ].map(([label, value]) => <div key={label} className={`${card} p-4`}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p></div>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} p-4`}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Highest collection day</p><p className="mt-1 text-lg font-semibold text-slate-900">{data?.summary.highest_day ? formatPeso(data.summary.highest_day.collection) : "No data"}</p>{data?.summary.highest_day && <p className="text-sm text-slate-500">{formatDate(data.summary.highest_day.date)}</p>}</div>
        <div className={`${card} p-4`}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lowest collection day</p><p className="mt-1 text-lg font-semibold text-slate-900">{data?.summary.lowest_day ? formatPeso(data.summary.lowest_day.collection) : "No data"}</p>{data?.summary.lowest_day && <p className="text-sm text-slate-500">{formatDate(data.summary.lowest_day.date)}</p>}</div>
        <div className={`${card} p-4`}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Previous month comparison</p><p className={`mt-1 text-lg font-semibold ${num(data?.comparison.difference) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{num(data?.comparison.difference) >= 0 ? "+" : ""}{formatPeso(data?.comparison.difference)}</p><p className="text-sm text-slate-500">{data?.comparison ? `${MONTHS[data.comparison.month - 1]} vs previous month${data.comparison.percent == null ? "" : ` (${data.comparison.percent > 0 ? "+" : ""}${data.comparison.percent}%)`}` : "No data"}</p></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Monthly collection trend</h2><p className="mb-5 text-sm text-slate-500">All 12 months for {data?.year ?? "the selected year"}</p><div className="flex h-56 items-end gap-2">{(data?.monthly ?? []).map((r) => { const amount = num(r.collection); return <div key={r.month} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${MONTHS[r.month - 1]}: ${formatPeso(amount)}`}><span className="hidden text-[10px] tabular-nums text-slate-500 2xl:block">{amount ? Math.round(amount / 1000) + "k" : ""}</span><div className="w-full rounded-t bg-sky-500" style={{ height: `${maxMonth ? Math.max(2, amount / maxMonth * 170) : 2}px` }} /><span className="text-[10px] text-slate-500">{MONTHS[r.month - 1].slice(0, 3)}</span></div>; })}</div></div>
        <div className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Collection by vehicle type</h2><p className="mb-5 text-sm text-slate-500">Contribution to the filtered collection</p><BarList rows={data?.by_type ?? []} /></div>
      </section>

      <section className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Daily collection trend</h2><p className="mb-5 text-sm text-slate-500">Most recent 31 active days in the selected filters</p>{recentDays.length ? <div className="overflow-x-auto"><div className="flex h-48 min-w-[620px] items-end gap-1 overflow-hidden">{recentDays.map((r) => { const amount = num(r.collection); return <div key={r.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end" title={`${formatDate(r.date)}: ${formatPeso(amount)}`}><div className="w-full rounded-t bg-emerald-500" style={{ height: `${maxDay ? Math.max(3, amount / maxDay * 150) : 3}px` }} /><span className="mt-2 hidden text-[9px] text-slate-500 sm:block">{r.date.slice(8)}</span></div>; })}</div></div> : <p className="py-8 text-center text-sm text-slate-500">No daily collection data for these filters.</p>}</section>

      <section className={`${card} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Monthly collection summary</h2><p className="text-sm text-slate-500">Generated from saved records for {data?.year}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-3">Month</th><th className="px-5 py-3 text-right">Total vehicles</th><th className="px-5 py-3 text-right">Total collection</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.monthly ?? []).map((r) => <tr key={r.month}><td className="px-5 py-3">{MONTHS[r.month - 1]}</td><td className="px-5 py-3 text-right tabular-nums">{num(r.vehicles).toLocaleString()}</td><td className="px-5 py-3 text-right font-medium tabular-nums">{formatPeso(r.collection)}</td></tr>)}<tr className="bg-slate-50 font-semibold"><td className="px-5 py-3">Annual total</td><td className="px-5 py-3 text-right">{annualVehicles.toLocaleString()}</td><td className="px-5 py-3 text-right">{formatPeso(annualCollection)}</td></tr></tbody></table></div></section>

      {formOpen && <Modal title={viewOnly ? "Parking collection details" : editingId ? "Edit parking collection" : "Add parking collection"} onClose={() => !saving && setFormOpen(false)} wide><form onSubmit={saveRecord} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Collection date<input disabled={viewOnly} required type="date" className={`${inputCls} mt-1.5`} value={form.collection_date} onChange={(e) => setForm({ ...form, collection_date: e.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Vehicle type<select disabled={viewOnly} required className={`${inputCls} mt-1.5`} value={form.vehicle_type_id} onChange={(e) => setForm({ ...form, vehicle_type_id: e.target.value })}><option value="">Select vehicle type</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {String(otherType?.id) === form.vehicle_type_id && <label className="text-sm font-medium text-slate-700 sm:col-span-2">Custom vehicle type<input disabled={viewOnly} required className={`${inputCls} mt-1.5`} value={form.custom_vehicle_type} onChange={(e) => setForm({ ...form, custom_vehicle_type: e.target.value })} /></label>}
        <label className="text-sm font-medium text-slate-700">Number of vehicles<input disabled={viewOnly} type="number" min="0" step="1" required={!form.is_manual_total} className={`${inputCls} mt-1.5`} value={form.vehicle_count} onChange={(e) => setForm({ ...form, vehicle_count: e.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Rate per vehicle<input disabled={viewOnly} type="number" min="0" step="0.01" required={!form.is_manual_total} className={`${inputCls} mt-1.5`} value={form.rate_per_vehicle} onChange={(e) => setForm({ ...form, rate_per_vehicle: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input disabled={viewOnly} type="checkbox" checked={form.is_manual_total} onChange={(e) => setForm({ ...form, is_manual_total: e.target.checked })} /> Enter total collection manually</label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Total collection<input disabled={viewOnly || !form.is_manual_total} type="number" min="0" step="0.01" required={form.is_manual_total} className={`${inputCls} mt-1.5 font-semibold`} value={form.is_manual_total ? form.total_collection : calculatedTotal || ""} onChange={(e) => setForm({ ...form, total_collection: e.target.value })} /><span className="mt-1 block text-xs text-slate-500">{form.is_manual_total ? "Manual total will be retained." : "Automatically calculated from vehicles × rate."}</span></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">OR / Reference number<input disabled={viewOnly} className={`${inputCls} mt-1.5`} value={form.or_number} onChange={(e) => setForm({ ...form, or_number: e.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Remarks<textarea disabled={viewOnly} rows={3} className={`${inputCls} mt-1.5`} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
        {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formError}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={ghostBtn} onClick={() => setFormOpen(false)}>{viewOnly ? "Close" : "Cancel"}</button>{!viewOnly && <button disabled={saving} className={primaryBtn}>{saving && <Loader2 size={15} className="animate-spin" />}{saving ? "Saving..." : "Save record"}</button>}</div>
      </form></Modal>}

      {typesOpen && <Modal title="Vehicle types" onClose={() => setTypesOpen(false)}><form onSubmit={addType} className="mb-4 flex gap-2"><input className={inputCls} placeholder="New vehicle type" value={newType} onChange={(e) => setNewType(e.target.value)} /><button className={primaryBtn}>Add</button></form>{typeError && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{typeError}</p>}<div className="space-y-2">{allTypes.map((type) => <div key={type.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2"><input className={inputCls} value={type.name} onChange={(e) => setAllTypes((items) => items.map((item) => item.id === type.id ? { ...item, name: e.target.value } : item))} /><button type="button" className={ghostBtn} onClick={() => updateType(type, {})}>Save</button><button type="button" onClick={() => updateType(type, { is_active: Number(type.is_active) ? 0 : 1 })} className={`rounded-md px-3 py-2 text-xs font-medium ${Number(type.is_active) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{Number(type.is_active) ? "Active" : "Inactive"}</button></div>)}</div></Modal>}
    </div>
  );
}
