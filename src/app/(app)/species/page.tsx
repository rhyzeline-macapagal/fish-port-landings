"use client";

import { useEffect, useMemo, useState } from "react";
import { Dna, Eye, Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { inputCls } from "@/components/ui";

type SpeciesRecord = {
  id?: number | string;
  local_name: string | null;
  common_name: string | null;
  scientific_name: string | null;
};

type SpeciesResponse = SpeciesRecord[] | { species?: SpeciesRecord[]; records?: SpeciesRecord[] };

const card = "surface-glass rounded-xl border border-slate-200";
const text = (value: string | null | undefined) => value?.trim() || "-";

function recordsFromResponse(response: SpeciesResponse): SpeciesRecord[] {
  if (Array.isArray(response)) return response;
  return response.species ?? response.records ?? [];
}

export default function SpeciesPage() {
  const [records, setRecords] = useState<SpeciesRecord[]>([]);
  const [selected, setSelected] = useState<SpeciesRecord | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<SpeciesResponse>("species.php", { signal: controller.signal })
      .then((response) => setRecords(recordsFromResponse(response)))
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
    return records.filter((record) => [record.local_name, record.common_name, record.scientific_name]
      .some((value) => text(value).toLowerCase().includes(query)));
  }, [records, search]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0875d1]">FishPort reference data</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#14263d]">Species</h1>
          <p className="mt-1 text-sm text-slate-500">Reference names for local, common, and scientific species records.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-slate-400" />
          <input
            aria-label="Search species"
            className={`${inputCls} pl-10`}
            placeholder="Search species"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Local name</th>
                  <th className="px-4 py-3 font-semibold">Common name</th>
                  <th className="px-4 py-3 font-semibold">Scientific name</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record, index) => (
                  <tr key={String(record.id ?? `${record.local_name}-${record.common_name}-${index}`)} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-medium text-[#14263d]">{text(record.local_name)}</td>
                    <td className="px-4 py-3.5 text-slate-700">{text(record.common_name)}</td>
                    <td className="px-4 py-3.5 italic text-slate-600">{text(record.scientific_name)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button type="button" onClick={() => setSelected(record)} className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-3 py-2 text-xs font-semibold text-[#0875d1] hover:bg-sky-100" title="View species">
                        <Eye size={14} /> View
                      </button>
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
              <div className="py-3"><dt className="text-xs text-slate-500">Common name</dt><dd className="mt-1 font-medium text-slate-900">{text(selected.common_name)}</dd></div>
              <div className="py-3"><dt className="text-xs text-slate-500">Scientific name</dt><dd className="mt-1 font-medium italic text-slate-900">{text(selected.scientific_name)}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}