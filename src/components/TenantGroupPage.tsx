"use client";

import Link from "next/link";
import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Eye, Loader2, Pencil, Plus, Search, Store, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { TenantCategory, TenantGroup } from "@/lib/tenant-groups";
import { useAuth } from "@/context/AuthContext";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

type Size = "small" | "big";
type Status = "active" | "inactive";
type ApplicationStatus = "pending" | "approved" | "rejected";

type Tenant = {
  id: number;
  category: TenantCategory;
  permit_number: string | null;
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
  contact_number: string;
  stall_no: string;
  address: string;
  application_status: ApplicationStatus;
  status: Status;
  remarks: string;
};

const emptyForm: FormState = {
  permit_number: "",
  broker_size: "small",
  business_name: "",
  owner_name: "",
  contact_number: "",
  stall_no: "",
  address: "",
  application_status: "pending",
  status: "active",
  remarks: "",
};

const card = "rounded-xl border border-slate-200 bg-white shadow-sm";

export default function TenantGroupPage({ group }: { group: TenantGroup }) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "encoder";
  const canDelete = user?.role === "admin";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let ignore = false;
    api<Tenant[]>(`tenants.php?category=${encodeURIComponent(group.category)}`)
      .then((rows) => { if (!ignore) { setTenants(rows); setError(""); } })
      .catch((err) => { if (!ignore) setError(err instanceof Error ? err.message : "Could not load tenant records"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [group.category, reload]);

  const visible = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) => [
      tenant.permit_number, tenant.business_name, tenant.owner_name, tenant.contact_number,
      tenant.stall_no, tenant.address, tenant.remarks,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [deferredSearch, tenants]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openTenant(tenant: Tenant, readOnly: boolean) {
    setEditingId(tenant.id);
    setViewOnly(readOnly);
    setForm({
      permit_number: tenant.permit_number ?? "",
      broker_size: tenant.broker_size ?? "small",
      business_name: tenant.business_name,
      owner_name: tenant.owner_name ?? "",
      contact_number: tenant.contact_number ?? "",
      stall_no: tenant.stall_no ?? "",
      address: tenant.address ?? "",
      application_status: tenant.application_status,
      status: tenant.status,
      remarks: tenant.remarks ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function saveTenant(event: FormEvent) {
    event.preventDefault();
    if (viewOnly || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await api(editingId ? `tenants.php?id=${editingId}` : "tenants.php", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          category: group.category,
          broker_size: group.category === "fish_broker" ? form.broker_size : null,
        }),
      });
      setModalOpen(false);
      setLoading(true);
      setReload((value) => value + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save tenant");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant(tenant: Tenant) {
    if (!confirm(`Delete "${tenant.business_name}"? This cannot be undone.`)) return;
    try {
      await api(`tenants.php?id=${tenant.id}`, { method: "DELETE" });
      setTenants((rows) => rows.filter((row) => row.id !== tenant.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete tenant");
    }
  }

  const modalTitle = viewOnly ? "Tenant details" : editingId ? "Edit tenant" : `Add ${group.label}`;
  const showBrokerSize = group.category === "fish_broker";
  const showStall = group.category !== "commercial_vessel_above_3t" && group.category !== "commercial_vessel_below_3t";
  const columnCount = 8 + Number(showBrokerSize) + Number(showStall);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[#12344d] p-6 text-white">
        <Link href="/dashboard/tenants" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={15} /> All tenant groups</Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10"><Store size={22} /></span>
            <div className="min-w-0"><h1 className="text-2xl font-semibold leading-tight">{group.label}</h1><p className="mt-1 text-sm text-slate-300">Tenant records for this group only</p></div>
          </div>
          {canEdit && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-[#12344d] hover:bg-slate-100"><Plus size={16} /> Add tenant</button>}
        </div>
      </section>

      <section className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div><p className="font-medium text-slate-900">{tenants.length} {tenants.length === 1 ? "record" : "records"}</p><p className="text-xs text-slate-500">Only {group.label} records are shown.</p></div>
        <div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search tenant records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, owner, stall..." className={`${inputCls} pl-10`} /></div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} />{error}</div>}

      <section className={`${card} overflow-hidden`}>
        <div className="max-h-[590px] overflow-auto">
          <table className={`w-full ${showBrokerSize ? "min-w-[1480px]" : showStall ? "min-w-[1360px]" : "min-w-[1220px]"} text-left text-sm`}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Permit Number</th><th className="px-4 py-3 font-semibold">Business Name</th><th className="px-4 py-3 font-semibold">Owner Name</th>{showBrokerSize && <th className="px-4 py-3 font-semibold">Broker Size</th>}<th className="px-4 py-3 font-semibold">Contact Number</th>{showStall && <th className="px-4 py-3 font-semibold">Stall No.</th>}<th className="px-4 py-3 font-semibold">Address</th><th className="px-4 py-3 font-semibold">Application Status</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={columnCount} className="px-4 py-12 text-center text-slate-500"><Loader2 size={20} className="mx-auto animate-spin" /></td></tr>
                : visible.length === 0 ? <tr><td colSpan={columnCount} className="px-4 py-12 text-center text-slate-500">{tenants.length ? "No records match your search." : `No ${group.label} records have been added yet.`}</td></tr>
                : visible.map((tenant) => <tr key={tenant.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{tenant.permit_number || "—"}</td><td className="px-4 py-3 font-medium text-slate-900">{tenant.business_name}</td><td className="px-4 py-3 text-slate-700">{tenant.owner_name || "—"}</td>{showBrokerSize && <td className="px-4 py-3 capitalize text-slate-700">{tenant.broker_size || "—"}</td>}<td className="whitespace-nowrap px-4 py-3 text-slate-700">{tenant.contact_number || "—"}</td>{showStall && <td className="px-4 py-3 text-slate-700">{tenant.stall_no || "—"}</td>}<td className="px-4 py-3 text-slate-700">{tenant.address || "—"}</td><td className="px-4 py-3"><span className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${tenant.application_status === "approved" ? "bg-emerald-50 text-emerald-700" : tenant.application_status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{tenant.application_status}</span></td><td className="px-4 py-3"><span className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${tenant.status === "active" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{tenant.status}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => openTenant(tenant, true)} aria-label={`View ${tenant.business_name}`} className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>{canEdit && <button type="button" onClick={() => openTenant(tenant, false)} aria-label={`Edit ${tenant.business_name}`} className="rounded-md p-2 text-sky-700 hover:bg-sky-50"><Pencil size={16} /></button>}{canDelete && <button type="button" onClick={() => deleteTenant(tenant)} aria-label={`Delete ${tenant.business_name}`} className="rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>}</div></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !saving && setModalOpen(false)}><form role="dialog" aria-modal="true" aria-label={modalTitle} onSubmit={saveTenant} className={`${card} max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto p-6`}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{modalTitle}</h2><p className="text-sm text-slate-500">{group.label}</p></div><button type="button" disabled={saving} onClick={() => setModalOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
        <label className="block text-sm font-medium text-slate-700">Permit number<input disabled={viewOnly} value={form.permit_number} onChange={(event) => setField("permit_number", event.target.value)} className={`${inputCls} mt-1.5`} /></label>
        {showBrokerSize && <label className="block text-sm font-medium text-slate-700">Broker size<select disabled={viewOnly} value={form.broker_size} onChange={(event) => setField("broker_size", event.target.value as Size)} className={`${inputCls} mt-1.5`}><option value="small">Small</option><option value="big">Big</option></select></label>}
        <label className="block text-sm font-medium text-slate-700">Business / tenant name<input disabled={viewOnly} required value={form.business_name} onChange={(event) => setField("business_name", event.target.value)} className={`${inputCls} mt-1.5`} /></label>
        <label className="block text-sm font-medium text-slate-700">Owner name<input disabled={viewOnly} value={form.owner_name} onChange={(event) => setField("owner_name", event.target.value)} className={`${inputCls} mt-1.5`} /></label>
        <div className={`grid gap-4 ${showStall ? "sm:grid-cols-2" : ""}`}>{showStall && <label className="block text-sm font-medium text-slate-700">Stall / space number<input disabled={viewOnly} value={form.stall_no} onChange={(event) => setField("stall_no", event.target.value)} className={`${inputCls} mt-1.5`} /></label>}<label className="block text-sm font-medium text-slate-700">Contact number<input disabled={viewOnly} value={form.contact_number} onChange={(event) => setField("contact_number", event.target.value)} className={`${inputCls} mt-1.5`} /></label></div>
        <label className="block text-sm font-medium text-slate-700">Address<input disabled={viewOnly} value={form.address} onChange={(event) => setField("address", event.target.value)} className={`${inputCls} mt-1.5`} /></label>
        <label className="block text-sm font-medium text-slate-700">Application status<select disabled={viewOnly} value={form.application_status} onChange={(event) => setField("application_status", event.target.value as ApplicationStatus)} className={`${inputCls} mt-1.5`}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Status<select disabled={viewOnly} value={form.status} onChange={(event) => setField("status", event.target.value as Status)} className={`${inputCls} mt-1.5`}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Remarks<textarea disabled={viewOnly} rows={3} value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} className={`${inputCls} mt-1.5`} /></label>
        {formError && <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle size={16} />{formError}</div>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setModalOpen(false)} className={ghostBtn}>{viewOnly ? "Close" : "Cancel"}</button>{!viewOnly && <button disabled={saving} className={primaryBtn}>{saving && <Loader2 size={16} className="animate-spin" />}{saving ? "Saving..." : "Save tenant"}</button>}</div>
      </form></div>}
    </div>
  );
}
