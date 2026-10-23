"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TenantCategory, TenantGroup } from "@/lib/tenant-groups";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/Modal";
import AnimatedSelect from "@/components/AnimatedSelect";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

type Size = "small" | "big";
type Status = "active" | "inactive";
type ApplicationStatus = string;

type Tenant = {
  id: number;
  category: TenantCategory;
  permit_number: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  broker_size: Size | null;
  business_name: string;
  owner_name: string | null;
  contact_number: string | null;
  stall_no: string | null;
  address: string | null;
  application_status: ApplicationStatus;
  status: Status;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  permit_number: string;
  broker_size: Size;
  business_name: string;
  owner_name: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  contact_number: string;
  stall_no: string;
  address: string;
  application_status: ApplicationStatus;
  status: Status;
  remarks: string;
};

type DialogMode = "add" | "view" | "edit";

const PAGE_SIZE = 10;
const BASE_APPLICATION_STATUSES = ["New", "Renew"];
const card = "surface-glass rounded-xl border border-slate-200";
const disabledField = "disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-600 disabled:opacity-100";

const emptyForm: FormState = {
  permit_number: "",
  broker_size: "small",
  business_name: "",
  owner_name: "",
  last_name: "",
  first_name: "",
  middle_name: "",
  contact_number: "",
  stall_no: "",
  address: "",
  application_status: "New",
  status: "active",
  remarks: "",
};

function sortTenants(rows: Tenant[]) {
  return [...rows].sort((a, b) => a.business_name.localeCompare(b.business_name));
}

function firstValue(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return null;
}

function normalizeTenant(raw: Tenant): Tenant {
  const source = raw as unknown as Record<string, unknown>;
  const normalizedKeys = Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key.replace(/([A-Z])/g, "_$1").toLowerCase(),
    value,
  ]));
  const values = { ...source, ...normalizedKeys };
  const applicationStatus = firstValue(values, "application_status", "permit_status", "application_state", "application");
  const status = firstValue(values, "status", "tenant_status")?.toLowerCase();

  return {
    ...raw,
    permit_number: firstValue(values, "permit_number", "permit_no", "permit_id", "permit") ?? raw.permit_number ?? null,
    application_status: applicationStatus || "—",
    status: status === "inactive" ? "inactive" : "active",
    last_name: firstValue(values, "last_name") ?? raw.last_name ?? null,
    first_name: firstValue(values, "first_name") ?? raw.first_name ?? null,
    middle_name: firstValue(values, "middle_name") ?? raw.middle_name ?? null,
  };
}

function tenantRows(payload: unknown): Tenant[] {
  if (Array.isArray(payload)) return payload as Tenant[];
  if (!payload || typeof payload !== "object") return [];
  const source = payload as Record<string, unknown>;
  for (const key of ["data", "rows", "tenants", "records"]) {
    if (Array.isArray(source[key])) return source[key] as Tenant[];
  }
  return [];
}

/** Raw name parts ("" when missing). Falls back to parsing owner_name for legacy records. */
function splitOwner(tenant: Tenant) {
  if (tenant.last_name || tenant.first_name || tenant.middle_name) {
    return {
      lastName: tenant.last_name || "",
      firstName: tenant.first_name || "",
      middleName: tenant.middle_name || "",
    };
  }

  const owner = (tenant.owner_name || "").trim();
  if (!owner) return { lastName: "", firstName: "", middleName: "" };

  const [lastNamePart, givenNames = ""] = owner.split(",", 2).map((part) => part.trim());
  if (givenNames) {
    const [firstName, ...middleNames] = givenNames.split(/\s+/);
    return { lastName: lastNamePart, firstName, middleName: middleNames.join(" ") };
  }

  const names = owner.split(/\s+/);
  if (names.length === 1) return { lastName: "", firstName: names[0], middleName: "" };
  return {
    lastName: names[names.length - 1],
    firstName: names[0],
    middleName: names.slice(1, -1).join(" "),
  };
}

/** Display version of the name parts ("—" when missing). */
function ownerNameParts(tenant: Tenant) {
  const parts = splitOwner(tenant);
  return {
    lastName: parts.lastName || "—",
    firstName: parts.firstName || "—",
    middleName: parts.middleName || "—",
  };
}

function ApplicationBadge({ status }: { status: string }) {
  if (!status || status === "—") return <span className="text-slate-400">—</span>;
  const key = status.trim().toLowerCase();
  const tone =
    key === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : key === "rejected" ? "bg-red-50 text-red-700 ring-red-200"
    : key === "pending" ? "bg-amber-50 text-amber-700 ring-amber-200"
    : key === "renew" ? "bg-sky-50 text-sky-700 ring-sky-200"
    : key === "new" ? "bg-violet-50 text-violet-700 ring-violet-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {status}
    </span>
  );
}

function FormField({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span id={errorId} className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-700">{value || "—"}</dd>
    </div>
  );
}

function TenantActions({
  tenant,
  canEdit,
  canDelete,
  openUp = false,
  onView,
  onEdit,
  onDelete,
}: {
  tenant: Tenant;
  canEdit: boolean;
  canDelete: boolean;
  openUp?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeMenu(event: MouseEvent) {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={menu} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Actions for ${tenant.business_name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/35"
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div role="menu" className={`absolute right-0 z-30 w-36 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <button type="button" role="menuitem" onClick={() => choose(onView)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Eye size={15} /> View
          </button>
          {canEdit && (
            <button type="button" role="menuitem" onClick={() => choose(onEdit)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Pencil size={15} /> Edit
            </button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" onClick={() => choose(onDelete)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  pages,
  total,
  from,
  to,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of {total} records
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-24 text-center text-xs font-medium text-slate-600">Page {page} of {pages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TenantGroupPage({ group }: { group: TenantGroup }) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "encoder";
  const canDelete = user?.role === "admin";
  const showBrokerSize = group.category === "fish_broker";
  const showStall = group.category !== "commercial_vessel_above_3t" && group.category !== "commercial_vessel_below_3t";
  const columnCount = 7;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [applicationFilter, setApplicationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<unknown>(`tenants.php?category=${encodeURIComponent(group.category)}`, { signal: controller.signal })
      .then((payload) => {
        const rows = tenantRows(payload);
        setTenants(sortTenants(rows.map(normalizeTenant)));
        setError("");
      })
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Could not load tenant records");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [group.category, requestVersion]);

  // Application status options come from the data, so values like "Renew" always work.
  const applicationOptions = useMemo(() => {
    const values = new Set<string>(BASE_APPLICATION_STATUSES);
    tenants.forEach((tenant) => {
      if (tenant.application_status && tenant.application_status !== "—") values.add(tenant.application_status);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [tenants]);

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    return tenants.filter((tenant) => {
      if (applicationFilter && tenant.application_status !== applicationFilter) return false;
      if (statusFilter && tenant.status !== statusFilter) return false;
      if (!query) return true;
      return [
        tenant.permit_number,
        tenant.business_name,
        tenant.owner_name,
        tenant.last_name,
        tenant.first_name,
        tenant.middle_name,
        tenant.contact_number,
        tenant.stall_no,
        tenant.address,
        tenant.remarks,
        tenant.broker_size,
        tenant.application_status,
        tenant.status,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
    });
  }, [applicationFilter, deferredSearch, statusFilter, tenants]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = filtered.length ? Math.min(currentPage * PAGE_SIZE, filtered.length) : 0;
  const filtersActive = Boolean(search || applicationFilter || statusFilter);

  // Form dropdown: all known options, plus the record's own value if it isn't listed yet.
  const formApplicationOptions = Array.from(
    new Set([...applicationOptions, form.application_status].filter((value) => value && value !== "—")),
  );

  function retry() {
    setLoading(true);
    setError("");
    setRequestVersion((value) => value + 1);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setApplicationFilter("");
    setStatusFilter("");
    setPage(1);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function openAdd() {
    setEditingId(null);
    setDialogMode("add");
    setForm(emptyForm);
    setFieldErrors({});
    setFormError("");
  }

  function openTenant(tenant: Tenant, mode: "view" | "edit") {
    const parts = splitOwner(tenant);
    setEditingId(tenant.id);
    setDialogMode(mode);
    setForm({
      permit_number: tenant.permit_number ?? "",
      broker_size: tenant.broker_size ?? "small",
      business_name: tenant.business_name,
      owner_name: tenant.owner_name ?? "",
      last_name: parts.lastName,
      first_name: parts.firstName,
      middle_name: parts.middleName,
      contact_number: tenant.contact_number ?? "",
      stall_no: tenant.stall_no ?? "",
      address: tenant.address ?? "",
      application_status: tenant.application_status === "—" ? "New" : tenant.application_status,
      status: tenant.status,
      remarks: tenant.remarks ?? "",
    });
    setFieldErrors({});
    setFormError("");
  }

  function closeDialog() {
    if (!saving) setDialogMode(null);
  }

  async function saveTenant(event: FormEvent) {
    event.preventDefault();
    if (dialogMode === "view" || saving) return;

    if (!form.business_name.trim()) {
      setFieldErrors({ business_name: "Business or tenant name is required." });
      document.getElementById("tenant-business-name")?.focus();
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const saved = await api<Tenant>(editingId ? `tenants.php?id=${editingId}` : "tenants.php", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          business_name: form.business_name.trim(),
          category: group.category,
          broker_size: showBrokerSize ? form.broker_size : null,
          stall_no: showStall ? form.stall_no : "",
        }),
      });
      const normalizedSaved = normalizeTenant(saved);
      setTenants((rows) => sortTenants(editingId ? rows.map((row) => row.id === normalizedSaved.id ? normalizedSaved : row) : [...rows, normalizedSaved]));
      setDialogMode(null);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "Could not save tenant");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(tenant: Tenant) {
    setDeleting(tenant);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api(`tenants.php?id=${deleting.id}`, { method: "DELETE" });
      setTenants((rows) => rows.filter((row) => row.id !== deleting.id));
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(deleting.id);
        return next;
      });
      setDeleting(null);
    } catch (requestError) {
      setDeleteError(requestError instanceof Error ? requestError.message : "Could not delete tenant");
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dialogTitle = dialogMode === "view" ? "Tenant details" : dialogMode === "edit" ? "Edit tenant" : `Add ${group.label}`;
  const viewOnly = dialogMode === "view";

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-[#12344d] p-5 text-white sm:p-6">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
            <li>
              <Link href="/dashboard/tenants" className="inline-flex items-center gap-1.5 rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-sky-300">
                <ArrowLeft size={14} /> FishPort Tenants
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-500">/</li>
            <li aria-current="page" className="truncate text-slate-200">{group.label}</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10"><Store size={22} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{group.label}</h1>
                {!loading && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200">{tenants.length} {tenants.length === 1 ? "record" : "records"}</span>}
              </div>
              <p className="mt-1 text-sm text-slate-300">Manage permits, ownership, status, and tenant details.</p>
            </div>
          </div>
          {canEdit && (
            <button type="button" onClick={openAdd} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#12344d] shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:w-auto">
              <Plus size={16} /> Add Tenant
            </button>
          )}
        </div>
      </section>

      <section className={`${card} relative z-30 overflow-visible p-4`} aria-label="Tenant filters">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_11rem_10rem_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Search records</span>
            <span className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search tenant records"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Business, owner, permit, stall..."
                className={`${inputCls} pl-10`}
              />
            </span>
          </label>
          <div className="block text-xs font-semibold text-slate-600">
            <span>Application status</span>
            <AnimatedSelect
              label="Filter by application status"
              value={applicationFilter}
              onChange={(value) => { setApplicationFilter(value); setPage(1); }}
              options={[{ value: "", label: "All applications" }, ...applicationOptions.map((value) => ({ value, label: value }))]}
              className="mt-1.5"
            />
          </div>
          <div className="block text-xs font-semibold text-slate-600">
            <span>Operational status</span>
            <AnimatedSelect
              label="Filter by operational status"
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              className="mt-1.5"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="h-[42px] rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{filtered.length} matching {filtered.length === 1 ? "record" : "records"}</span>
          {filtersActive && <span>Filters remain applied after viewing or editing a record.</span>}
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
          <button type="button" onClick={retry} className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-red-100">
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}

      <section className={`${card} relative z-0 overflow-hidden`} aria-label={`${group.label} records`}>
        <div className="hidden max-h-[650px] overflow-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3 font-semibold">Permit Number</th>
                <th className="px-4 py-3 font-semibold">Application Status</th>
                <th className="px-4 py-3 font-semibold">Last Name</th>
                <th className="px-4 py-3 font-semibold">First Name</th>
                <th className="px-4 py-3 font-semibold">Middle Name</th>
                <th className="px-4 py-3 font-semibold">Business Name</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} aria-hidden="true">
                    <td colSpan={columnCount} className="px-4 py-3"><div className="h-8 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none" /></td>
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-14 text-center">
                    <Building2 size={24} className="mx-auto text-slate-300" />
                    <p className="mt-3 font-medium text-slate-700">{tenants.length ? "No records match your filters" : `No ${group.label} records yet`}</p>
                    <p className="mt-1 text-xs text-slate-500">{tenants.length ? "Try changing or clearing the current filters." : canEdit ? "Add the first tenant record to get started." : "Records will appear here when they are added."}</p>
                  </td>
                </tr>
              ) : (
                pageRows.map((tenant, index) => {
                  const owner = ownerNameParts(tenant);
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{tenant.permit_number || "—"}</td>
                      <td className="px-4 py-3"><ApplicationBadge status={tenant.application_status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{owner.lastName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{owner.firstName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{owner.middleName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{tenant.business_name}</td>
                      <td className="px-4 py-3 text-right">
                        <TenantActions
                          tenant={tenant}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          openUp={index >= pageRows.length - 2}
                          onView={() => openTenant(tenant, "view")}
                          onEdit={() => openTenant(tenant, "edit")}
                          onDelete={() => requestDelete(tenant)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 p-4" aria-hidden="true">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                <div className="h-8 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              </div>
            ))
          ) : pageRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Building2 size={24} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">{tenants.length ? "No records match your filters" : `No ${group.label} records yet`}</p>
              <p className="mt-1 text-xs text-slate-500">{tenants.length ? "Try changing or clearing the current filters." : "Records will appear here when they are added."}</p>
            </div>
          ) : (
            pageRows.map((tenant) => {
              const isExpanded = expanded.has(tenant.id);
              const owner = ownerNameParts(tenant);
              return (
                <article key={tenant.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(tenant.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`tenant-details-${tenant.id}`}
                      className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/35"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{tenant.business_name}</span>
                        <span className="mt-1 block text-xs text-slate-500">{tenant.permit_number || "No permit number"}</span>
                      </span>
                      <ChevronDown size={17} className={`mt-1 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <TenantActions
                      tenant={tenant}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onView={() => openTenant(tenant, "view")}
                      onEdit={() => openTenant(tenant, "edit")}
                      onDelete={() => requestDelete(tenant)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ApplicationBadge status={tenant.application_status} />
                  </div>
                  {isExpanded && (
                    <div id={`tenant-details-${tenant.id}`} className="animate-fade mt-4 border-t border-slate-100 pt-4">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <Detail label="Last name" value={owner.lastName} />
                        <Detail label="First name" value={owner.firstName} />
                        <Detail label="Middle name" value={owner.middleName} />
                      </dl>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {!loading && (
          <Pagination
            page={currentPage}
            pages={pages}
            total={filtered.length}
            from={rangeStart}
            to={rangeEnd}
            onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), pages))}
          />
        )}
      </section>

      {dialogMode && (
        <Modal
          title={dialogTitle}
          subtitle={group.label}
          icon={<Building2 size={19} />}
          onClose={closeDialog}
          closeDisabled={saving}
          maxWidthClassName="max-w-3xl"
        >
          <form noValidate onSubmit={saveTenant}>
            <div className="space-y-6 p-5 sm:p-6">
              <section aria-labelledby="business-details-heading">
                <div className="mb-4">
                  <h3 id="business-details-heading" className="text-sm font-semibold text-slate-900">Business details</h3>
                  <p className="mt-1 text-xs text-slate-500">Permit and ownership information for this tenant.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Permit number">
                    <input disabled={viewOnly} value={form.permit_number} onChange={(event) => setField("permit_number", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                  </FormField>
                  {showBrokerSize && (
                    <FormField label="Broker size">
                      <select disabled={viewOnly} value={form.broker_size} onChange={(event) => setField("broker_size", event.target.value as Size)} className={`${inputCls} ${disabledField} mt-1.5`}>
                        <option value="small">Small</option>
                        <option value="big">Big</option>
                      </select>
                    </FormField>
                  )}
                  <div className={showBrokerSize ? "sm:col-span-2" : ""}>
                    <FormField label="Business / tenant name" required error={fieldErrors.business_name} errorId="tenant-business-name-error">
                      <input
                        id="tenant-business-name"
                        disabled={viewOnly}
                        aria-invalid={Boolean(fieldErrors.business_name)}
                        aria-describedby={fieldErrors.business_name ? "tenant-business-name-error" : undefined}
                        value={form.business_name}
                        onChange={(event) => setField("business_name", event.target.value)}
                        className={`${inputCls} ${disabledField} mt-1.5 ${fieldErrors.business_name ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                      />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                    <FormField label="Last name">
                      <input disabled={viewOnly} value={form.last_name} onChange={(event) => setField("last_name", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                    </FormField>
                    <FormField label="First name">
                      <input disabled={viewOnly} value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                    </FormField>
                    <FormField label="Middle name">
                      <input disabled={viewOnly} value={form.middle_name} onChange={(event) => setField("middle_name", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                    </FormField>
                  </div>
                </div>
              </section>

              <section aria-labelledby="contact-details-heading" className="border-t border-slate-200 pt-5">
                <div className="mb-4">
                  <h3 id="contact-details-heading" className="text-sm font-semibold text-slate-900">Contact and location</h3>
                  <p className="mt-1 text-xs text-slate-500">How to contact and locate the tenant within the port.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Contact number">
                    <input disabled={viewOnly} inputMode="tel" value={form.contact_number} onChange={(event) => setField("contact_number", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                  </FormField>
                  {showStall && (
                    <FormField label="Stall / space number">
                      <input disabled={viewOnly} value={form.stall_no} onChange={(event) => setField("stall_no", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                    </FormField>
                  )}
                  <div className="sm:col-span-2">
                    <FormField label="Address">
                      <input disabled={viewOnly} value={form.address} onChange={(event) => setField("address", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`} />
                    </FormField>
                  </div>
                </div>
              </section>

              <section aria-labelledby="tenant-status-heading" className="border-t border-slate-200 pt-5">
                <div className="mb-4">
                  <h3 id="tenant-status-heading" className="text-sm font-semibold text-slate-900">Status and notes</h3>
                  <p className="mt-1 text-xs text-slate-500">Application review, operating status, and internal remarks.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Application status">
                    <select disabled={viewOnly} value={form.application_status} onChange={(event) => setField("application_status", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5`}>
                      {formApplicationOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Operational status">
                    <select disabled={viewOnly} value={form.status} onChange={(event) => setField("status", event.target.value as Status)} className={`${inputCls} ${disabledField} mt-1.5`}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Remarks">
                      <textarea disabled={viewOnly} rows={3} value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} className={`${inputCls} ${disabledField} mt-1.5 resize-y`} />
                    </FormField>
                  </div>
                </div>
              </section>

              {formError && (
                <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={16} />{formError}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" disabled={saving} onClick={closeDialog} className={ghostBtn}>{viewOnly ? "Close" : "Cancel"}</button>
              {!viewOnly && (
                <button type="submit" disabled={saving} className={primaryBtn}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Saving..." : editingId ? "Save changes" : "Add tenant"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Delete tenant record?"
          subtitle={deleting.business_name}
          icon={<Trash2 size={19} />}
          onClose={() => !deleteBusy && setDeleting(null)}
          closeDisabled={deleteBusy}
          maxWidthClassName="max-w-md"
        >
          <div className="p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-slate-600">This permanently removes the tenant record. This action cannot be undone.</p>
            {deleteError && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{deleteError}</div>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" disabled={deleteBusy} onClick={() => setDeleting(null)} className={ghostBtn}>Cancel</button>
            <button type="button" disabled={deleteBusy} onClick={confirmDelete} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
              {deleteBusy && <Loader2 size={16} className="animate-spin" />}
              {deleteBusy ? "Deleting..." : "Delete tenant"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
