"use client";

import { useEffect, useMemo, useState } from "react";
import { Dna, Eye, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { inputCls } from "@/components/ui";
import ExportMenu, { type ExportKind } from "@/components/ExportMenu";
import Modal from "@/components/Modal";
import { useAuth } from "@/context/AuthContext";

type SpeciesRecord = {
  id?: number | string;
  local_name: string | null;
  other_names: string | null;
  common_name: string | null;
  scientific_name: string | null;
  notes: string | null;
};

type SpeciesResponse = SpeciesRecord[] | { species?: SpeciesRecord[]; records?: SpeciesRecord[] };
type SpeciesLookupResponse = { names?: string[] };

const card = "surface-glass rounded-xl border border-slate-200";
const text = (value: string | null | undefined) => value?.trim() || "-";
const emptyForm = { local_name: "", other_names: "", common_name: "", scientific_name: "", notes: "" };

function recordsFromResponse(response: SpeciesResponse): SpeciesRecord[] {
  if (Array.isArray(response)) return response;
  return response.species ?? response.records ?? [];
}

function loadSpecies(signal: AbortSignal) {
  return api<SpeciesResponse>("species.php", { signal }).catch(() =>
    api<SpeciesLookupResponse>("lookups.php?type=species", { signal }).then((response) =>
      (response.names ?? []).map((name) => ({
        local_name: name,
        other_names: null,
        common_name: null,
        scientific_name: null,
        notes: null,
      }))
    )
  );
}

export default function SpeciesPage() {
  const { user } = useAuth();
  const canAdd = user?.role === "admin" || user?.role === "encoder";
  const canEdit = user?.role === "admin";
  const canDelete = user?.role === "admin";
  const [records, setRecords] = useState<SpeciesRecord[]>([]);
  const [selected, setSelected] = useState<SpeciesRecord | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<SpeciesRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<SpeciesRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadSpecies(controller.signal)
      .then((response) => setRecords(Array.isArray(response) ? response : recordsFromResponse(response)))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load species.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => [record.local_name, record.other_names, record.common_name, record.scientific_name, record.notes]
      .some((value) => text(value).toLowerCase().includes(query)));
  }, [records, search]);

  function openForm(record?: SpeciesRecord) {
    setEditing(record ?? null);
    setForm({
      local_name: record?.local_name ?? "",
      other_names: record?.other_names ?? "",
      common_name: record?.common_name ?? "",
      scientific_name: record?.scientific_name ?? "",
      notes: record?.notes ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function saveSpecies(event: React.FormEvent) {
    event.preventDefault();
    if (!form.local_name.trim() || saving) {
      setFormError("Local name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const saved = await api<SpeciesRecord>(editing?.id ? `species.php?id=${editing.id}` : "species.php", {
        method: editing?.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setRecords((current) => editing?.id
        ? current.map((record) => record.id === saved.id ? saved : record)
        : [...current, saved].sort((a, b) => (a.local_name ?? "").localeCompare(b.local_name ?? "")));
      setFormOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not save species.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting?.id || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api(`species.php?id=${deleting.id}`, { method: "DELETE" });
      setRecords((current) => current.filter((record) => record.id !== deleting.id));
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Could not delete species.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function exportSpecies(kind: ExportKind) {
    const { exportPdf, exportXlsx, stamp } = await import("@/lib/export");
    const report = {
      title: "Species Reference Records",
      subtitle: `${filtered.length} matching record${filtered.length === 1 ? "" : "s"} | Exported ${stamp()}`,
      tables: [
        {
          name: "Species",
          columns: [
            { header: "Local name" },
            { header: "Other names" },
            { header: "Common name" },
            { header: "Scientific name" },
            { header: "Notes" },
          ],
          rows: filtered.map((record) => [
            text(record.local_name),
            text(record.other_names),
            text(record.common_name),
            text(record.scientific_name),
            text(record.notes),
          ]),
        },
      ],
    };
    const filename = `species_reference_${stamp()}`;
    if (kind === "xlsx") await exportXlsx(filename, report);
    else await exportPdf(filename, report, { landscape: true });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0875d1]">FishPort reference data</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#14263d]">Species</h1>
          <p className="mt-1 text-sm text-slate-500">Reference names for local, common, and scientific species records.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-slate-400" />
            <input
              aria-label="Search species"
              className={`${inputCls} pl-10`}
              placeholder="Search species"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ExportMenu onExport={exportSpecies} disabled={loading || filtered.length === 0} title="Export species reference records" />
          {canAdd && <button type="button" onClick={() => openForm()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0875d1] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#0764b3]" title="Add species"><Plus size={16} /> Add species</button>}
        </div>
      </section>

      <section className={`${card} overflow-hidden`}>
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 size={17} className="animate-spin" /> Loading species...
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-red-700">Could not load species.</p>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-sky-50 text-[#0875d1]"><Dna size={21} /></span>
            <p className="mt-3 text-sm font-medium text-slate-800">{records.length ? "No species match your search" : "No species uploaded yet"}</p>
            <p className="mt-1 text-sm text-slate-500">{records.length ? "Try a different local, common, or scientific name." : "Species records will appear here when species.php is populated."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Local name</th>
                  <th className="px-4 py-3 font-semibold">Other names</th>
                  <th className="px-4 py-3 font-semibold">Common name</th>
                  <th className="px-4 py-3 font-semibold">Scientific name</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record, index) => (
                  <tr key={String(record.id ?? `${record.local_name}-${record.common_name}-${index}`)} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-medium text-[#14263d]">{text(record.local_name)}</td>
                    <td className="px-4 py-3.5 text-slate-700">{text(record.other_names)}</td>
                    <td className="px-4 py-3.5 text-slate-700">{text(record.common_name)}</td>
                    <td className="px-4 py-3.5 italic text-slate-600">{text(record.scientific_name)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{text(record.notes)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setSelected(record)} className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-3 py-2 text-xs font-semibold text-[#0875d1] hover:bg-sky-100" title="View species">
                        <Eye size={14} /> View
                        </button>
                        {canEdit && <button type="button" onClick={() => openForm(record)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" title="Edit species" aria-label="Edit species"><Pencil size={15} /></button>}
                        {canDelete && <button type="button" onClick={() => { setDeleting(record); setDeleteError(""); }} className="grid h-8 w-8 place-items-center rounded-md text-red-500 hover:bg-red-50" title="Delete species" aria-label="Delete species"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setSelected(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="species-details-title" className={`${card} w-full max-w-md p-6 shadow-xl`} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="species-details-title" className="text-lg font-semibold text-[#14263d]">Species details</h2><p className="mt-1 text-sm text-slate-500">Reference information</p></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close species details" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <dl className="mt-5 divide-y divide-slate-100 rounded-lg bg-slate-50 px-4">
              <div className="py-3"><dt className="text-xs text-slate-500">Local name</dt><dd className="mt-1 font-medium text-slate-900">{text(selected.local_name)}</dd></div>
              <div className="py-3"><dt className="text-xs text-slate-500">Other names</dt><dd className="mt-1 font-medium text-slate-900">{text(selected.other_names)}</dd></div>
              <div className="py-3"><dt className="text-xs text-slate-500">Common name</dt><dd className="mt-1 font-medium text-slate-900">{text(selected.common_name)}</dd></div>
              <div className="py-3"><dt className="text-xs text-slate-500">Scientific name</dt><dd className="mt-1 font-medium italic text-slate-900">{text(selected.scientific_name)}</dd></div>
              <div className="py-3"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-1 font-medium text-slate-900">{text(selected.notes)}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {formOpen && (
        <Modal
          title={editing ? "Edit species" : "Add species"}
          subtitle="Maintain the species reference information used throughout FishPort."
          icon={<Dna size={20} />}
          onClose={() => !saving && setFormOpen(false)}
          closeDisabled={saving}
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={saveSpecies} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["local_name", "Local name", true],
                ["other_names", "Other names", false],
                ["common_name", "Common name", false],
                ["scientific_name", "Scientific name", false],
              ] as const).map(([key, label, required]) => (
                <label key={key} className="block text-sm font-medium text-slate-700">
                  {label}{required && <span className="ml-1 text-red-500">*</span>}
                  <input
                    required={Boolean(required)}
                    className={`${inputCls} mt-1.5 ${key === "scientific_name" ? "italic" : ""}`}
                    value={form[key as keyof typeof form]}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Notes
                <textarea
                  rows={3}
                  className={`${inputCls} mt-1.5 resize-none`}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
            {formError && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{formError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-[#0875d1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0764b3] disabled:opacity-50">{saving ? "Saving..." : editing ? "Save changes" : "Add species"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete species" subtitle="This action cannot be undone." icon={<Trash2 size={20} />} onClose={() => !deleteBusy && setDeleting(null)} closeDisabled={deleteBusy} maxWidthClassName="max-w-md">
          <div className="space-y-5 p-5 sm:p-6">
            <p className="text-sm text-slate-600">Delete <strong className="text-slate-900">{deleting.local_name || "this species"}</strong> from the reference list?</p>
            {deleteError && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{deleteError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setDeleting(null)} disabled={deleteBusy} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleteBusy} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{deleteBusy ? "Deleting..." : "Delete species"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}