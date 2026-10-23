"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, CalendarDays, Car, ChevronDown, ChevronLeft, ChevronRight, Download, Eye,
  FileSpreadsheet, FileText, Loader2, MoreHorizontal, Pencil, Plus, ReceiptText, Search,
  Settings2, SlidersHorizontal, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from "lucide-react";
import { api, formatDate, formatPeso } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import KpiCard from "@/components/KpiCard";
import type { ExportKind } from "@/components/ExportMenu";
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
const card = "rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(18,52,77,0.05)]";
const emptyFilters = (): Filters => ({ year: "", month: "", date: "", from: "", to: "", vehicle_type_id: "", recorded_by: "", q: "" });
const emptyForm: FormState = {
  collection_date: "", vehicle_type_id: "", custom_vehicle_type: "", vehicle_count: "",
  rate_per_vehicle: "", total_collection: "", is_manual_total: false, or_number: "", remarks: "",
};
const FILTER_LABELS: Record<keyof Filters, string> = {
  year: "Year", month: "Month", date: "Date", from: "From", to: "To",
  vehicle_type_id: "Vehicle", recorded_by: "Recorder", q: "Reference",
};
const num = (value: unknown) => Number(value) || 0;
const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const compactPeso = (value: unknown) => `₱${compact(num(value))}`;
const localDate = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function ParkingModal({ title, subtitle, onClose, children, wide = false }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-[#0b2233]/55" onMouseDown={onClose} />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`${card} animate-pop relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-b-none outline-none sm:rounded-xl ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-semibold text-[#14263d]">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function RecordSearch({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function update(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next.trim()), 220);
  }
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-slate-400" />
      <input aria-label="Search OR or reference" aria-busy={draft.trim() !== value} className={`${inputCls} pl-10 pr-9`}
        placeholder="Search OR / reference" value={draft} onChange={(event) => update(event.target.value)} />
      {draft.trim() !== value && <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-[#0875d1]" />}
    </div>
  );
}

function ActionMenu({ record, canEdit, canDelete, onView, onEdit, onDelete }: {
  record: ParkingRecord; canEdit: boolean; canDelete: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const choose = (action: () => void) => { setOpen(false); action(); };
  return (
    <div ref={box} className="relative inline-flex">
      <button type="button" aria-label={`Actions for ${record.vehicle_type} on ${record.collection_date}`} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((current) => !current)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"><MoreHorizontal size={17} /></button>
      {open && <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl">
        <button type="button" role="menuitem" onClick={() => choose(onView)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Eye size={15} /> View</button>
        {canEdit && <button type="button" role="menuitem" onClick={() => choose(onEdit)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Edit</button>}
        {canDelete && <button type="button" role="menuitem" onClick={() => choose(onDelete)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={15} /> Delete</button>}
      </div>}
    </div>
  );
}

function BarList({ rows }: { rows: TypeRow[] }) {
  const maximum = Math.max(...rows.map((row) => num(row.collection)), 0);
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-500">No collection data for these filters.</p>;
  return <div className="space-y-3" role="img" aria-label="Collection totals by vehicle type">{rows.map((row) => {
    const amount = num(row.collection);
    return <div key={row.vehicle_type} aria-label={`${row.vehicle_type}, ${formatPeso(amount)}, ${num(row.vehicles)} vehicles`}>
      <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-700">{row.vehicle_type}</span><span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatPeso(amount)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0875d1]" style={{ width: `${maximum ? Math.max(2, amount / maximum * 100) : 0}%` }} /></div>
    </div>;
  })}</div>;
}

export default function ParkingPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "encoder";
  const canDelete = user?.role === "admin";
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ParkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
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
  const [deleting, setDeleting] = useState<ParkingRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters, page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    api<ParkingData>(`parking.php?${query}`, { signal: controller.signal })
      .then((result) => { setData(result); setError(""); })
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Could not load parking collections");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, reload]);

  const types = data?.types ?? [];
  const otherType = types.find((type) => type.name.toLowerCase() === "other");
  const calculatedTotal = form.is_manual_total ? num(form.total_collection) : num(form.vehicle_count) * num(form.rate_per_vehicle);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? pageSize)));
  const annualVehicles = (data?.monthly ?? []).reduce((sum, row) => sum + num(row.vehicles), 0);
  const annualCollection = (data?.monthly ?? []).reduce((sum, row) => sum + num(row.collection), 0);
  const maxMonth = Math.max(...(data?.monthly ?? []).map((row) => num(row.collection)), 0);
  const recentDays = (data?.daily ?? []).slice(-31);
  const maxDay = Math.max(...recentDays.map((row) => num(row.collection)), 0);
  const activeFilters = Object.entries(filters).filter(([, value]) => value) as Array<[keyof Filters, string]>;
  const advancedCount = [filters.vehicle_type_id, filters.recorded_by, filters.date, filters.from, filters.to].filter(Boolean).length;

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setLoading(true); setError(""); setPage(1); setFilters((current) => ({ ...current, [key]: value }));
  }
  function clearFilters() { setLoading(true); setFilters(emptyFilters()); setPage(1); }
  function filterValue(key: keyof Filters, value: string) {
    if (key === "month") return MONTHS[Number(value) - 1] ?? value;
    if (key === "vehicle_type_id") return types.find((type) => String(type.id) === value)?.name ?? value;
    if (key === "recorded_by") return data?.recorders.find((recorder) => String(recorder.id) === value)?.full_name ?? value;
    return value;
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
      rate_per_vehicle: record.rate_per_vehicle == null ? "" : String(record.rate_per_vehicle), total_collection: String(record.total_collection),
      is_manual_total: Boolean(Number(record.is_manual_total)), or_number: record.or_number ?? "", remarks: record.remarks ?? "",
    });
    setFormOpen(true);
  }
  function validateForm() {
    if (!form.collection_date) return "Choose the collection date.";
    if (!form.vehicle_type_id) return "Choose a vehicle type.";
    if (String(otherType?.id) === form.vehicle_type_id && !form.custom_vehicle_type.trim()) return "Enter the custom vehicle type.";
    if (form.is_manual_total) {
      if (form.total_collection === "" || num(form.total_collection) < 0) return "Enter a valid total collection.";
    } else {
      if (form.vehicle_count === "" || !Number.isInteger(Number(form.vehicle_count)) || num(form.vehicle_count) < 0) return "Enter a nonnegative whole number of vehicles.";
      if (form.rate_per_vehicle === "" || num(form.rate_per_vehicle) < 0) return "Enter a valid rate per vehicle.";
    }
    return "";
  }
  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (viewOnly || saving) return;
    const validation = validateForm();
    if (validation) { setFormError(validation); return; }
    setSaving(true); setFormError("");
    try {
      await api("parking.php", { method: editingId ? "PUT" : "POST", body: JSON.stringify({ ...form, id: editingId, total_collection: calculatedTotal }) });
      setFormOpen(false); setLoading(true); setReload((value) => value + 1);
    } catch (saveError) { setFormError(saveError instanceof Error ? saveError.message : "Could not save the parking record"); }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`parking.php?id=${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setLoading(true); setReload((value) => value + 1);
    } catch (deleteError) { setDeleting(null); setError(deleteError instanceof Error ? deleteError.message : "Could not delete the record"); }
    finally { setDeleteBusy(false); }
  }
  async function openTypes() {
    setTypesOpen(true); setTypeError("");
    try { setAllTypes(await api<VehicleType[]>("parking.php?resource=types")); }
    catch (typesError) { setTypeError(typesError instanceof Error ? typesError.message : "Could not load vehicle types"); }
  }
  async function addType(event: FormEvent) {
    event.preventDefault();
    if (!newType.trim()) return;
    try {
      await api("parking.php?resource=types", { method: "POST", body: JSON.stringify({ name: newType }) });
      setNewType(""); setAllTypes(await api<VehicleType[]>("parking.php?resource=types")); setLoading(true); setReload((value) => value + 1);
    } catch (addError) { setTypeError(addError instanceof Error ? addError.message : "Could not add vehicle type"); }
  }
  async function updateType(type: VehicleType, patch: Partial<VehicleType>) {
    const next = { ...type, ...patch };
    try {
      await api("parking.php?resource=types", { method: "PUT", body: JSON.stringify(next) });
      setAllTypes((items) => items.map((item) => item.id === type.id ? next : item)); setLoading(true); setReload((value) => value + 1);
    } catch (updateError) { setTypeError(updateError instanceof Error ? updateError.message : "Could not update vehicle type"); }
  }
  async function exportReport(kind: ExportKind) {
    const params = new URLSearchParams({ page: "1", limit: "5000" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const full = await api<ParkingData>(`parking.php?${params.toString()}`);
    const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
    const report: Report = {
      title: "Parking Collection Report", subtitle: `Filtered records and ${full.year} monthly summary | Exported ${stamp()}`,
      tables: [
        {
          name: "Parking records",
          columns: [{ header: "Date", format: "date" }, { header: "Vehicle type" }, { header: "Vehicles", format: "int" }, { header: "Rate", format: "money" }, { header: "Total", format: "money" }, { header: "Manual total" }, { header: "OR / Reference" }, { header: "Recorded by" }, { header: "Remarks" }],
          rows: full.records.map((record) => [record.collection_date, record.vehicle_type, record.vehicle_count, record.rate_per_vehicle, record.total_collection, Number(record.is_manual_total) ? "Yes" : "No", record.or_number, record.recorded_by_name, record.remarks]),
          totals: ["Filtered total", "", full.summary.vehicles, "", full.summary.collection, "", "", "", ""],
        },
        {
          name: `${full.year} monthly summary`,
          columns: [{ header: "Month" }, { header: "Total vehicles", format: "int" }, { header: "Total collection", format: "money" }],
          rows: full.monthly.map((row) => [MONTHS[row.month - 1], row.vehicles, row.collection]),
          totals: ["Annual total", full.monthly.reduce((sum, row) => sum + num(row.vehicles), 0), full.monthly.reduce((sum, row) => sum + num(row.collection), 0)],
        },
      ],
    };
    const filename = `parking-collections_${full.year}_${stamp()}`;
    if (kind === "xlsx") await exportXlsx(filename, report); else await exportPdf(filename, report, { landscape: true });
  }
  async function runExport(kind: ExportKind) {
    setExportBusy(kind); setExportError("");
    try { await exportReport(kind); setExportOpen(false); }
    catch (exportFailure) { console.error(exportFailure); setExportError("Could not create the report. Please try again."); }
    finally { setExportBusy(null); }
  }
  function toggleExpanded(id: number) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0875d1]">Revenue operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#14263d] sm:text-[28px]">Parking Collection</h1><p className="mt-1 text-sm text-slate-500">Track daily vehicle collections, receipts and annual performance.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Reporting year" className={`${inputCls} !w-auto min-w-28`} value={filters.year} onChange={(event) => setFilter("year", event.target.value)}><option value="">All years</option>{(data?.years ?? []).map((year) => <option key={year}>{year}</option>)}</select>
          <select aria-label="Reporting month" className={`${inputCls} !w-auto min-w-32`} value={filters.month} onChange={(event) => setFilter("month", event.target.value)}><option value="">All months</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
          <button type="button" onClick={() => { setExportError(""); setExportOpen(true); }} disabled={!data || loading} className={ghostBtn}><Download size={16} /> Export report</button>
          {canEdit && <button type="button" onClick={openTypes} className={ghostBtn}><Settings2 size={16} /> Manage vehicle types</button>}
          {canEdit && <button type="button" onClick={openAdd} className={primaryBtn}><Plus size={16} /> Add collection</button>}
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Today's Collection" value={formatPeso(data?.cards.today_collection)} compactValue={compactPeso(data?.cards.today_collection)} icon={Wallet} tone="green" hint="Collected today" loading={loading && !data} />
        <KpiCard label="Today's Vehicles" value={num(data?.cards.today_vehicles).toLocaleString()} icon={Car} tone="blue" hint="Vehicles recorded today" loading={loading && !data} />
        <KpiCard label="This Month's Collection" value={formatPeso(data?.cards.month_collection)} compactValue={compactPeso(data?.cards.month_collection)} icon={CalendarDays} tone="violet" hint="Current calendar month" loading={loading && !data} />
        <KpiCard label="This Year's Collection" value={formatPeso(data?.cards.year_collection)} compactValue={compactPeso(data?.cards.year_collection)} icon={BarChart3} tone="yellow" hint="Current calendar year" loading={loading && !data} />
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><RecordSearch key={filters.q} value={filters.q} onSearch={(value) => setFilter("q", value)} /></div>
          <button type="button" onClick={() => setShowAdvanced((current) => !current)} aria-expanded={showAdvanced} className={`${ghostBtn} relative`}><SlidersHorizontal size={16} /> Filters{advancedCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0875d1] px-1 text-[11px] font-semibold text-white">{advancedCount}</span>}</button>
          {activeFilters.length > 0 && <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Clear all</button>}
          {loading && data && <Loader2 size={18} aria-label="Refreshing records" className="animate-spin text-[#0875d1]" />}
        </div>
        {showAdvanced && <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label="Vehicle type" className={inputCls} value={filters.vehicle_type_id} onChange={(event) => setFilter("vehicle_type_id", event.target.value)}><option value="">All vehicle types</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
          <select aria-label="Recorded by" className={inputCls} value={filters.recorded_by} onChange={(event) => setFilter("recorded_by", event.target.value)}><option value="">All recorders</option>{(data?.recorders ?? []).map((recorder) => <option key={recorder.id} value={recorder.id}>{recorder.full_name}</option>)}</select>
          <input type="date" aria-label="Specific collection date" className={inputCls} value={filters.date} onChange={(event) => setFilter("date", event.target.value)} />
          <input type="date" aria-label="From date" className={inputCls} value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
          <input type="date" aria-label="To date" className={inputCls} value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
        </div>}
        {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3"><span className="text-xs font-medium text-slate-500">Filtering by</span>{activeFilters.map(([key, value]) => <button key={key} type="button" onClick={() => setFilter(key, "")} className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100"><span className="text-sky-600">{FILTER_LABELS[key]}:</span> {filterValue(key, value)} <X size={12} /></button>)}</div>}
      </section>

      <section className={`${card} flex h-[620px] min-w-0 flex-col overflow-hidden`}>
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-[#0875d1]"><ReceiptText size={17} /></span><div><h2 className="font-semibold text-slate-900">Collection records</h2><p className="text-xs text-slate-500">{data?.total ?? 0} matching entries</p></div></div>{loading && <Loader2 size={18} className="animate-spin text-[#0875d1]" />}</div>
        {!loading && !(data?.records.length) ? <div className="grid flex-1 place-items-center p-6 text-center"><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><Car size={20} /></span><p className="mt-3 font-medium text-slate-900">No parking collections found</p><p className="mt-1 text-sm text-slate-500">Change the filters or add a collection.</p></div></div> : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul className="divide-y divide-slate-100 md:hidden">{(data?.records ?? []).map((record) => {
            const isExpanded = expanded.has(record.id);
            return <li key={record.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{record.vehicle_type}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(record.collection_date)} · {record.or_number || "No reference"}</p></div><div className="flex items-center gap-2"><span className="font-semibold tabular-nums text-slate-900">{formatPeso(record.total_collection)}</span><ActionMenu record={record} canEdit={canEdit} canDelete={canDelete} onView={() => openRecord(record, true)} onEdit={() => openRecord(record, false)} onDelete={() => setDeleting(record)} /></div></div>
              <div className="flex items-center gap-2 text-xs"><span className="rounded-md bg-sky-50 px-2.5 py-1 font-medium text-sky-700">{record.vehicle_count == null ? "Unknown vehicles" : `${num(record.vehicle_count).toLocaleString()} vehicles`}</span>{Number(record.is_manual_total) ? <span className="rounded-md bg-amber-50 px-2.5 py-1 font-medium text-amber-700">Manual total</span> : null}</div>
              <button type="button" aria-expanded={isExpanded} onClick={() => toggleExpanded(record.id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">{isExpanded ? "Hide details" : "View details"}<ChevronDown size={15} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} /></button>
              {isExpanded && <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">Rate</dt><dd className="mt-0.5 font-medium">{record.rate_per_vehicle == null ? "—" : formatPeso(record.rate_per_vehicle)}</dd></div><div><dt className="text-xs text-slate-500">Recorded by</dt><dd className="mt-0.5 font-medium">{record.recorded_by_name}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Remarks</dt><dd className="mt-0.5 break-words font-medium">{record.remarks || "No remarks"}</dd></div></dl>}
            </li>;
          })}</ul>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600 shadow-[0_1px_0_#e2e8f0]"><tr><th className="px-4 py-3 font-semibold">Collection date</th><th className="px-4 py-3 font-semibold">Vehicle type</th><th className="px-4 py-3 text-right font-semibold">Vehicles</th><th className="px-4 py-3 text-right font-semibold">Rate</th><th className="px-4 py-3 text-right font-semibold">Total collection</th><th className="px-4 py-3 font-semibold">OR / Reference</th><th className="px-4 py-3 font-semibold">Recorded by</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(data?.records ?? []).map((record) => <tr key={record.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3.5 text-slate-700">{formatDate(record.collection_date)}</td><td className="px-4 py-3.5 font-medium text-slate-900">{record.vehicle_type}</td><td className="px-4 py-3.5 text-right tabular-nums">{record.vehicle_count == null ? "Unknown" : num(record.vehicle_count).toLocaleString()}</td><td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{record.rate_per_vehicle == null ? "—" : formatPeso(record.rate_per_vehicle)}</td><td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatPeso(record.total_collection)}{Number(record.is_manual_total) ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">Manual</span> : null}</td><td className="px-4 py-3.5 text-slate-700">{record.or_number || "—"}</td><td className="px-4 py-3.5 text-slate-700">{record.recorded_by_name}</td><td className="px-4 py-3.5 text-right"><ActionMenu record={record} canEdit={canEdit} canDelete={canDelete} onView={() => openRecord(record, true)} onEdit={() => openRecord(record, false)} onDelete={() => setDeleting(record)} /></td></tr>)}</tbody>
          </table></div>
        </div>}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"><div className="flex items-center gap-2"><span>Page {page} of {pages}</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); setLoading(true); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">{[25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}</select></div><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1); }}><ChevronLeft size={15} /></button><button type="button" aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40" disabled={page >= pages} onClick={() => { setLoading(true); setPage((current) => current + 1); }}><ChevronRight size={15} /></button></div></div>
      </section>

      <section><div className="mb-3"><h2 className="text-lg font-semibold text-slate-900">Parking analytics</h2><p className="text-sm text-slate-500">Performance for the current record filters.</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
        ["Filtered collection", formatPeso(data?.summary.collection), Wallet], ["Vehicles recorded", num(data?.summary.vehicles).toLocaleString(), Car],
        ["Average per active day", formatPeso(data?.summary.average_daily), CalendarDays], ["Number of entries", num(data?.summary.entries).toLocaleString(), ReceiptText],
      ].map(([label, value, Icon]) => <article key={String(label)} className={`${card} flex min-h-24 items-center gap-3 p-4`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-[#0875d1]"><Icon size={17} /></span><div className="min-w-0"><p className="text-[11px] font-medium text-slate-500 sm:text-xs">{String(label)}</p><p className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900">{String(value)}</p></div></article>)}</div></section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={`${card} p-4`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-600"><TrendingUp size={17} /></span><div><p className="text-xs font-medium text-slate-500">Highest collection day</p><p className="mt-0.5 text-lg font-semibold text-slate-900">{data?.summary.highest_day ? formatPeso(data.summary.highest_day.collection) : "No data"}</p></div></div>{data?.summary.highest_day && <p className="mt-2 text-xs text-slate-500">{formatDate(data.summary.highest_day.date)}</p>}</article>
        <article className={`${card} p-4`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-50 text-violet-600"><TrendingDown size={17} /></span><div><p className="text-xs font-medium text-slate-500">Lowest collection day</p><p className="mt-0.5 text-lg font-semibold text-slate-900">{data?.summary.lowest_day ? formatPeso(data.summary.lowest_day.collection) : "No data"}</p></div></div>{data?.summary.lowest_day && <p className="mt-2 text-xs text-slate-500">{formatDate(data.summary.lowest_day.date)}</p>}</article>
        <article className={`${card} p-4`}><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-full ${num(data?.comparison.difference) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{num(data?.comparison.difference) >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</span><div><p className="text-xs font-medium text-slate-500">Previous month comparison</p><p className={`mt-0.5 text-lg font-semibold ${num(data?.comparison.difference) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{num(data?.comparison.difference) >= 0 ? "+" : ""}{formatPeso(data?.comparison.difference)}</p></div></div><p className="mt-2 text-xs text-slate-500">{data?.comparison ? `${MONTHS[data.comparison.month - 1]} vs previous month${data.comparison.percent == null ? "" : ` (${data.comparison.percent > 0 ? "+" : ""}${data.comparison.percent}%)`}` : "No data"}</p></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Twelve-month collection trend</h2><p className="mb-5 text-sm text-slate-500">Monthly totals for {data?.year ?? "the selected year"}</p><div className="flex h-52 items-end gap-2" role="img" aria-label={`Monthly parking collection totals for ${data?.year ?? "the selected year"}`}>{(data?.monthly ?? []).map((row) => { const amount = num(row.collection); return <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${MONTHS[row.month - 1]}: ${formatPeso(amount)}`}><span className="hidden text-[10px] tabular-nums text-slate-500 2xl:block">{amount ? compact(amount) : ""}</span><div className="w-full rounded-t bg-[#0875d1]" style={{ height: `${maxMonth ? Math.max(2, amount / maxMonth * 150) : 2}px` }} /><span className="text-[10px] text-slate-500">{MONTHS[row.month - 1].slice(0, 3)}</span></div>; })}</div></article>
        <article className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Collection by vehicle type</h2><p className="mb-5 text-sm text-slate-500">Contribution to the filtered collection</p><BarList rows={data?.by_type ?? []} /></article>
      </section>

      <section className={`${card} p-5`}><h2 className="font-semibold text-slate-900">Latest 31 active days</h2><p className="mb-5 text-sm text-slate-500">Daily collection trend within the current filters</p>{recentDays.length ? <div className="overflow-x-auto"><div className="flex h-44 min-w-[620px] items-end gap-1" role="img" aria-label="Parking collection totals for the latest 31 active days">{recentDays.map((row) => { const amount = num(row.collection); return <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${formatDate(row.date)}: ${formatPeso(amount)}`}><div className="w-full rounded-t bg-emerald-500" style={{ height: `${maxDay ? Math.max(3, amount / maxDay * 125) : 3}px` }} /><span className="mt-2 hidden text-[9px] text-slate-500 sm:block">{row.date.slice(8)}</span></div>; })}</div></div> : <p className="py-8 text-center text-sm text-slate-500">No daily collection data for these filters.</p>}</section>

      <section className={`${card} overflow-hidden`}><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Monthly collection summary</h2><p className="text-sm text-slate-500">Saved records for {data?.year}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-3">Month</th><th className="px-5 py-3 text-right">Total vehicles</th><th className="px-5 py-3 text-right">Total collection</th></tr></thead><tbody className="divide-y divide-slate-100">{(data?.monthly ?? []).map((row) => <tr key={row.month}><td className="px-5 py-3">{MONTHS[row.month - 1]}</td><td className="px-5 py-3 text-right tabular-nums">{num(row.vehicles).toLocaleString()}</td><td className="px-5 py-3 text-right font-medium tabular-nums">{formatPeso(row.collection)}</td></tr>)}<tr className="bg-slate-50 font-semibold"><td className="px-5 py-3">Annual total</td><td className="px-5 py-3 text-right">{annualVehicles.toLocaleString()}</td><td className="px-5 py-3 text-right">{formatPeso(annualCollection)}</td></tr></tbody></table></div></section>

      {formOpen && <ParkingModal title={viewOnly ? "Parking collection details" : editingId ? "Edit parking collection" : "Add parking collection"} subtitle={viewOnly ? "Review the saved collection details." : "Enter the receipt and vehicle information below."} onClose={() => !saving && setFormOpen(false)} wide>
        <form onSubmit={saveRecord} noValidate><div className="grid gap-4 bg-slate-50/50 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-medium text-slate-700">Collection date<span className="text-red-500"> *</span><input disabled={viewOnly} type="date" className={`${inputCls} mt-1.5`} value={form.collection_date} onChange={(event) => setForm({ ...form, collection_date: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">Vehicle type<span className="text-red-500"> *</span><select disabled={viewOnly} className={`${inputCls} mt-1.5`} value={form.vehicle_type_id} onChange={(event) => setForm({ ...form, vehicle_type_id: event.target.value })}><option value="">Select vehicle type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
          {String(otherType?.id) === form.vehicle_type_id && <label className="text-sm font-medium text-slate-700 sm:col-span-2">Custom vehicle type<span className="text-red-500"> *</span><input disabled={viewOnly} className={`${inputCls} mt-1.5`} value={form.custom_vehicle_type} onChange={(event) => setForm({ ...form, custom_vehicle_type: event.target.value })} /></label>}
          <label className="text-sm font-medium text-slate-700">Number of vehicles{!form.is_manual_total && <span className="text-red-500"> *</span>}<input disabled={viewOnly} type="number" min="0" step="1" inputMode="numeric" className={`${inputCls} mt-1.5 tabular-nums`} value={form.vehicle_count} onChange={(event) => setForm({ ...form, vehicle_count: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">Rate per vehicle{!form.is_manual_total && <span className="text-red-500"> *</span>}<div className="relative mt-1.5"><span className="absolute left-3.5 top-2.5 text-sm text-slate-500">₱</span><input disabled={viewOnly} type="number" min="0" step="0.01" inputMode="decimal" className={`${inputCls} pl-8 tabular-nums`} value={form.rate_per_vehicle} onChange={(event) => setForm({ ...form, rate_per_vehicle: event.target.value })} /></div></label>
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input disabled={viewOnly} type="checkbox" checked={form.is_manual_total} onChange={(event) => setForm({ ...form, is_manual_total: event.target.checked, total_collection: event.target.checked && !form.total_collection ? String(calculatedTotal || "") : form.total_collection })} /> Enter total collection manually</label><label className="mt-3 block text-sm font-medium text-slate-700">Total collection<div className="relative mt-1.5"><span className="absolute left-3.5 top-2.5 text-sm text-slate-500">₱</span><input disabled={viewOnly || !form.is_manual_total} type="number" min="0" step="0.01" inputMode="decimal" className={`${inputCls} pl-8 font-semibold tabular-nums disabled:bg-slate-50`} value={form.is_manual_total ? form.total_collection : calculatedTotal || ""} onChange={(event) => setForm({ ...form, total_collection: event.target.value })} /></div><span className="mt-1.5 block text-xs font-normal text-slate-500">{form.is_manual_total ? "Manual total will be retained." : "Automatically calculated from vehicles × rate."}</span></label></div>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">OR / Reference number<input disabled={viewOnly} className={`${inputCls} mt-1.5`} value={form.or_number} onChange={(event) => setForm({ ...form, or_number: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Remarks<textarea disabled={viewOnly} rows={3} className={`${inputCls} mt-1.5 resize-none`} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></label>
          {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 sm:col-span-2">{formError}</p>}
        </div><div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"><button type="button" className={ghostBtn} onClick={() => setFormOpen(false)}>{viewOnly ? "Close" : "Cancel"}</button>{!viewOnly && <button disabled={saving} className={primaryBtn}>{saving && <Loader2 size={15} className="animate-spin" />}{saving ? "Saving..." : editingId ? "Save changes" : "Add collection"}</button>}</div></form>
      </ParkingModal>}

      {typesOpen && <ParkingModal title="Manage vehicle types" subtitle="Rename categories or control which types are available when recording collections." onClose={() => setTypesOpen(false)}><div className="p-5 sm:p-6">
        <form onSubmit={addType} className="flex gap-2"><input autoFocus aria-label="New vehicle type" className={inputCls} placeholder="New vehicle type" value={newType} onChange={(event) => setNewType(event.target.value)} /><button className={primaryBtn}><Plus size={15} /> Add</button></form><p className="mt-2 text-xs text-slate-500">Default categories remain available unless they are marked inactive.</p>
        {typeError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{typeError}</p>}
        <div className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto pr-1">{allTypes.map((type) => <div key={type.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center"><input aria-label={`Vehicle type ${type.name}`} className={inputCls} value={type.name} onChange={(event) => setAllTypes((items) => items.map((item) => item.id === type.id ? { ...item, name: event.target.value } : item))} /><div className="flex shrink-0 gap-2"><button type="button" className={ghostBtn} onClick={() => updateType(type, {})}>Save</button><button type="button" onClick={() => updateType(type, { is_active: Number(type.is_active) ? 0 : 1 })} className={`rounded-lg px-3 py-2 text-xs font-semibold ${Number(type.is_active) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{Number(type.is_active) ? "Active" : "Inactive"}</button></div></div>)}</div>
      </div></ParkingModal>}

      {exportOpen && <ParkingModal title="Export parking report" subtitle="The report includes filtered records and the selected year's monthly summary." onClose={() => !exportBusy && setExportOpen(false)}><div className="p-5 sm:p-6">
        <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current selection</p><p className="mt-1 font-semibold text-slate-900">{data?.total ?? 0} matching records</p><p className="mt-1 text-sm text-slate-500">{activeFilters.length ? activeFilters.map(([key, value]) => `${FILTER_LABELS[key]}: ${filterValue(key, value)}`).join(" · ") : "All available records"}</p></div>
        {exportError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={!!exportBusy} onClick={() => runExport("xlsx")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{exportBusy === "xlsx" ? <Loader2 size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />} Excel</button><button type="button" disabled={!!exportBusy} onClick={() => runExport("pdf")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{exportBusy === "pdf" ? <Loader2 size={17} className="animate-spin" /> : <FileText size={17} />} PDF</button></div>
      </div></ParkingModal>}

      {deleting && <ParkingModal title="Delete parking collection?" subtitle="This action removes the selected record from active reports." onClose={() => !deleteBusy && setDeleting(null)}><div className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm"><div><p className="text-xs text-slate-500">Vehicle type</p><p className="mt-1 font-semibold text-slate-900">{deleting.vehicle_type}</p></div><div><p className="text-xs text-slate-500">Collection date</p><p className="mt-1 font-semibold text-slate-900">{formatDate(deleting.collection_date)}</p></div><div><p className="text-xs text-slate-500">Reference</p><p className="mt-1 font-semibold text-slate-900">{deleting.or_number || "None"}</p></div><div><p className="text-xs text-slate-500">Total</p><p className="mt-1 font-semibold text-slate-900">{formatPeso(deleting.total_collection)}</p></div></div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleteBusy} onClick={() => setDeleting(null)} className={ghostBtn}>Cancel</button><button type="button" disabled={deleteBusy} onClick={confirmDelete} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deleteBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete record</button></div>
      </div></ParkingModal>}
    </div>
  );
}
