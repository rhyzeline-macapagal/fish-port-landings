"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Category = "fish_broker" | "fish_dealer" | "retailer";
type Size = "small" | "big";

interface Tenant {
  id: number;
  category: Category;
  broker_size: Size | null;
  business_name: string;
  owner_name: string | null;
  contact_number: string | null;
  stall_no: string | null;
  address: string | null;
  status: "active" | "inactive";
  remarks: string | null;
}

interface FormState {
  category: Category;
  broker_size: Size;
  business_name: string;
  owner_name: string;
  contact_number: string;
  stall_no: string;
  address: string;
  status: "active" | "inactive";
  remarks: string;
}

const CATEGORY_LABEL: Record<Category, string> = {
  fish_broker: "Fish Broker",
  fish_dealer: "Fish Dealer",
  retailer: "Retailer",
};

const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "broker_small", label: "Small Brokers", match: (t: Tenant) => t.category === "fish_broker" && t.broker_size === "small" },
  { key: "broker_big", label: "Big Brokers", match: (t: Tenant) => t.category === "fish_broker" && t.broker_size === "big" },
  { key: "dealer", label: "Fish Dealers", match: (t: Tenant) => t.category === "fish_dealer" },
  { key: "retailer", label: "Retailers", match: (t: Tenant) => t.category === "retailer" },
];

const emptyForm: FormState = {
  category: "fish_broker",
  broker_size: "small",
  business_name: "",
  owner_name: "",
  contact_number: "",
  stall_no: "",
  address: "",
  status: "active",
  remarks: "",
};

const card = "glass rounded-lg";

const inputCls =
  "w-full rounded-md border border-slate-300/70 bg-white/70 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-[#1a8cc7] focus:bg-white focus:ring-2 focus:ring-[#1a8cc7]/20";

export default function TenantsPage() {
  const { user } = useAuth();
  // Viewers get a read-only page. The server enforces this too.
  const canEdit = user?.role === "admin" || user?.role === "encoder";
  const canDelete = user?.role === "admin";

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setTenants(await api<Tenant[]>("tenants.php"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, tenants.filter(t.match).length])),
    [tenants]
  );

  const visible = useMemo(() => {
    const active = TABS.find((t) => t.key === tab) ?? TABS[0];
    const q = search.trim().toLowerCase();
    return tenants.filter(active.match).filter((t) => {
      if (!q) return true;
      return [t.business_name, t.owner_name, t.stall_no, t.contact_number, t.address]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [tenants, tab, search]);

  function openAdd() {
    // Pre-fill the category from the tab the admin/encoder is currently on
    const next: FormState = { ...emptyForm };
    if (tab === "broker_small") { next.category = "fish_broker"; next.broker_size = "small"; }
    if (tab === "broker_big") { next.category = "fish_broker"; next.broker_size = "big"; }
    if (tab === "dealer") next.category = "fish_dealer";
    if (tab === "retailer") next.category = "retailer";
    setForm(next);
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(t: Tenant) {
    setForm({
      category: t.category,
      broker_size: t.broker_size ?? "small",
      business_name: t.business_name,
      owner_name: t.owner_name ?? "",
      contact_number: t.contact_number ?? "",
      stall_no: t.stall_no ?? "",
      address: t.address ?? "",
      status: t.status,
      remarks: t.remarks ?? "",
    });
    setEditingId(t.id);
    setFormError("");
    setModalOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const path = editingId ? `tenants.php?id=${editingId}` : "tenants.php";
      await api<Tenant>(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save tenant");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(t: Tenant) {
    if (!confirm(`Delete "${t.business_name}"? This cannot be undone.`)) return;
    try {
      await api<{ ok: boolean }>(`tenants.php?id=${t.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete tenant");
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-6 py-5`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Fishport Tenants</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fish brokers, fish dealers, and retailers operating in the port.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-md bg-[#1a8cc7] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#157bb0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40"
          >
            <Plus size={16} />
            Add tenant
          </button>
        )}
      </div>

      {/* Tabs + search */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-[#1a8cc7] text-white"
                  : "bg-white/50 text-slate-700 hover:bg-white/80"
              }`}
            >
              {t.label} <span className="opacity-70">({counts[t.key] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, owner, stall..."
            className={`${inputCls} pl-10`}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/40 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Stall</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/40">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 size={18} className="mx-auto animate-spin" />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                  {tenants.length === 0 ? "No tenants have been added yet." : "No tenants match your filters."}
                </td>
              </tr>
            ) : (
              visible.map((t) => (
                <tr key={t.id} className="hover:bg-white/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{t.business_name}</p>
                    {t.owner_name && <p className="text-xs text-slate-600">{t.owner_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {CATEGORY_LABEL[t.category]}
                    {t.category === "fish_broker" && t.broker_size && (
                      <span className="ml-2 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium capitalize text-[#157bb0]">
                        {t.broker_size}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{t.stall_no || "—"}</td>
                  <td className="px-4 py-3 text-slate-800">{t.contact_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2.5 py-0.5 text-xs font-medium capitalize ${
                        t.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-white/70 text-slate-600"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          aria-label={`Edit ${t.business_name}`}
                          className="rounded-md p-2 text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
                        >
                          <Pencil size={16} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => onDelete(t)}
                            aria-label={`Delete ${t.business_name}`}
                            className="rounded-md p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <form
            onSubmit={onSave}
            className={`${card} max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto bg-white/90 p-6`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit tenant" : "Add tenant"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={form.category === "fish_broker" ? "" : "col-span-2"}>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value as Category)}
                  className={inputCls}
                >
                  <option value="fish_broker">Fish Broker</option>
                  <option value="fish_dealer">Fish Dealer</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>
              {form.category === "fish_broker" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Broker size</label>
                  <select
                    value={form.broker_size}
                    onChange={(e) => set("broker_size", e.target.value as Size)}
                    className={inputCls}
                  >
                    <option value="small">Small</option>
                    <option value="big">Big</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Business name</label>
              <input
                required
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Owner name</label>
              <input
                value={form.owner_name}
                onChange={(e) => set("owner_name", e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Stall no.</label>
                <input
                  value={form.stall_no}
                  onChange={(e) => set("stall_no", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Contact number</label>
                <input
                  value={form.contact_number}
                  onChange={(e) => set("contact_number", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
              <input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as "active" | "inactive")}
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                className={inputCls}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-300/70 bg-white/60 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="flex items-center gap-2 rounded-md bg-[#1a8cc7] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#157bb0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Saving..." : "Save tenant"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}