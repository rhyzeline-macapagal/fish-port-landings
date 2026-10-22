$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-File($path, $content) {
  $full = Join-Path (Get-Location).Path $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

Write-File "src/app/(app)/landings/page.tsx" @'
"use client";

import { ReactNode, useEffect, useState } from "react";
import { Check, Clock, Package, Plus, RotateCcw, Search, Ship, Truck, Wallet, X } from "lucide-react";
import { api, formatDate, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

const card =
  "rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,42,61,0.04),0_12px_32px_-16px_rgba(15,42,61,0.18)]";

const EMPTY = { status: "", species: "", from: "", to: "", q: "" };
const TABS = [
  { label: "All", value: "", dot: "" },
  { label: "Pending", value: "pending", dot: "bg-amber-500" },
  { label: "Approved", value: "approved", dot: "bg-emerald-500" },
  { label: "Rejected", value: "rejected", dot: "bg-red-500" },
];

const AVATARS = [
  "bg-[linear-gradient(135deg,#38bdf8,#0284c7)]",
  "bg-[linear-gradient(135deg,#34d399,#059669)]",
  "bg-[linear-gradient(135deg,#fbbf24,#d97706)]",
  "bg-[linear-gradient(135deg,#a78bfa,#7c3aed)]",
  "bg-[linear-gradient(135deg,#f472b6,#db2777)]",
  "bg-[linear-gradient(135deg,#2dd4bf,#0d9488)]",
];
const CHIPS = [
  "bg-sky-50 text-sky-800",
  "bg-emerald-50 text-emerald-800",
  "bg-amber-50 text-amber-800",
  "bg-violet-50 text-violet-800",
  "bg-pink-50 text-pink-800",
  "bg-teal-50 text-teal-800",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const dash = <span className="text-slate-400">-</span>;
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
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold text-white shadow-sm ${AVATARS[hash(name) % AVATARS.length]}`}
    >
      {initials}
    </div>
  );
}

function SpeciesChip({ species }: { species: string }) {
  return (
    <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${CHIPS[hash(species.toLowerCase()) % CHIPS.length]}`}>
      {species}
    </span>
  );
}

function Delivery({ truck }: { truck: boolean }) {
  const Icon = truck ? Truck : Ship;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
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
  onReview,
  labelled,
}: {
  status: Landing["status"];
  onReview: (s: "approved" | "rejected") => void;
  labelled?: boolean;
}) {
  const base = `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition ${
    labelled ? "px-3.5" : "w-8"
  }`;
  return (
    <div className="flex justify-end gap-1.5">
      {status !== "approved" && (
        <button
          onClick={() => onReview("approved")}
          title="Approve"
          aria-label="Approve landing"
          className={`${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <Check size={16} />
          {labelled && "Approve"}
        </button>
      )}
      {status !== "rejected" && (
        <button
          onClick={() => onReview("rejected")}
          title="Reject"
          aria-label="Reject landing"
          className={`${base} bg-red-50 text-red-700 hover:bg-red-100`}
        >
          <X size={16} />
          {labelled && "Reject"}
        </button>
      )}
    </div>
  );
}

export default function LandingsPage() {
  const { user } = useAuth();
  const { openNewEntry, version } = useEntryModal();
  const [filters, setFilters] = useState(EMPTY);
  const [rows, setRows] = useState<Landing[]>([]);
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";

  async function load(f = filters) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
      const d = await api<Landing[]>(`landings.php?${qs.toString()}`);
      setRows(d);
      if (!Object.values(f).some(Boolean)) {
        setSpeciesList([...new Set(d.map((x) => x.species))].sort());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load landings.");
    } finally {
      setLoading(false);
    }
  }

  // load on first open and again whenever a new entry is saved
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function review(id: number, status: "approved" | "rejected") {
    try {
      await api("landing_review.php", { method: "POST", body: JSON.stringify({ id, status }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the landing.");
    }
  }

  function pickStatus(status: string) {
    const next = { ...filters, status };
    setFilters(next);
    load(next);
  }

  function reset() {
    setFilters(EMPTY);
    load(EMPTY);
  }

  const totalValue = rows.reduce((sum, r) => sum + Number(r.total_value || 0), 0);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const th = "whitespace-nowrap px-3 py-3.5 text-xs font-semibold text-slate-500";
  const td = "whitespace-nowrap px-3 py-4";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Fish landings</h1>
          <p className="mt-1 text-slate-500">Every recorded unloading and land delivery.</p>
        </div>
        <button
          onClick={openNewEntry}
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1a8cc7,#0b6aa0)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40"
        >
          <Plus size={18} /> New entry
        </button>
      </div>

      {/* Summary of what is currently shown */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Landings shown" value={String(rows.length)} icon={Package} tone="blue" hint="Matching the filters below" loading={loading} />
        <StatCard label="Value shown" value={formatPeso(totalValue)} icon={Wallet} tone="green" hint="Sum of total value" loading={loading} />
        <StatCard
          label="Pending in view"
          value={String(pendingCount)}
          icon={Clock}
          tone="yellow"
          hint={pendingCount > 0 ? "Waiting for admin approval" : "Nothing waiting"}
          highlight={pendingCount > 0}
          loading={loading}
        />
      </section>

      <div className={`${card} overflow-hidden`}>
        {/* Status tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.label}
                onClick={() => pickStatus(t.value)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  filters.status === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.dot && <span className={`h-2 w-2 rounded-full ${t.dot}`} />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]"
        >
          <select className={inputCls} value={filters.species} onChange={(e) => setFilters({ ...filters, species: e.target.value })}>
            <option value="">All species</option>
            {speciesList.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input type="date" aria-label="From date" className={inputCls} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" aria-label="To date" className={inputCls} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
            <input
              className={`${inputCls} pl-10`}
              placeholder="Search supplier, owner or origin"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={reset} aria-label="Reset filters" className={ghostBtn}>
              <RotateCcw size={15} />
            </button>
            <button className={primaryBtn}>Apply</button>
          </div>
        </form>

        {error && <p className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        {loading ? (
          <div className="space-y-3 border-t border-slate-100 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-slate-100 py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Ship size={22} />
            </div>
            <p className="mt-3 font-medium text-slate-900">No landings found</p>
            <p className="mt-1 text-sm text-slate-500">Change the filters or record a new landing.</p>
            <button onClick={openNewEntry} className={`${primaryBtn} mt-5`}>
              <Plus size={18} /> New entry
            </button>
          </div>
        ) : (
          <>
            {/* Phones: one card per landing */}
            <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={r.boat_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{r.boat_name}</p>
                        <p className="text-xs text-slate-500">{formatDate(r.landing_date)} {formatTime(r.landing_time)}</p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SpeciesChip species={r.species} />
                    <Delivery truck={Number(r.truck_delivery) === 1} />
                    <span className="text-xs text-slate-500">from {r.origin}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Volume</p>
                      <p className="font-medium tabular-nums">{Number(r.volume).toLocaleString()} {r.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total value</p>
                      <p className="font-semibold tabular-nums">{formatPeso(r.total_value)}</p>
                    </div>
                  </div>
                  {isAdmin && <ReviewActions status={r.status} onReview={(s) => review(r.id, s)} labelled />}
                </li>
              ))}
            </ul>

            {/* Larger screens: full table */}
            <div className="hidden overflow-x-auto border-t border-slate-100 md:block">
              <table className="w-full min-w-[1350px] text-left text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className={`${th} pl-6`}>Date</th>
                    <th className={th}>Time</th>
                    <th className={th}>Supplier</th>
                    <th className={th}>Fishing gear</th>
                    <th className={th}>Delivery</th>
                    <th className={th}>Origin</th>
                    <th className={th}>Registered owner</th>
                    <th className={th}>Species</th>
                    <th className={`${th} text-right`}>Volume</th>
                    <th className={`${th} text-right`}>Price per kg</th>
                    <th className={`${th} text-right`}>Total value</th>
                    <th className={th}>Broker</th>
                    <th className={th}>Status</th>
                    {isAdmin && <th className={`${th} sticky right-0 bg-slate-50 pr-6 text-right`}>Review</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="group transition hover:bg-sky-50/40">
                      <td className={`${td} pl-6 text-slate-600`}>{formatDate(r.landing_date)}</td>
                      <td className={`${td} text-slate-600`}>{formatTime(r.landing_time)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.boat_name} />
                          <span className="font-medium text-slate-900">{r.boat_name}</span>
                        </div>
                      </td>
                      <td className={`${td} text-slate-600`}>{val(r.fishing_gear)}</td>
                      <td className={td}><Delivery truck={Number(r.truck_delivery) === 1} /></td>
                      <td className={`${td} text-slate-600`}>{r.origin}</td>
                      <td className={`${td} text-slate-600`}>{val(r.boat_owner)}</td>
                      <td className={td}><SpeciesChip species={r.species} /></td>
                      <td className={`${td} text-right tabular-nums`}>
                        <span className="font-medium text-slate-900">{Number(r.volume).toLocaleString()}</span>{" "}
                        <span className="text-slate-500">{r.unit}</span>
                      </td>
                      <td className={`${td} text-right tabular-nums text-slate-600`}>{r.price_per_kg ? formatPeso(r.price_per_kg) : dash}</td>
                      <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{formatPeso(r.total_value)}</td>
                      <td className={`${td} text-slate-600`}>{val(r.broker)}</td>
                      <td className={td}><StatusBadge status={r.status} /></td>
                      {isAdmin && (
                        <td className={`${td} sticky right-0 bg-white pr-6 shadow-[-8px_0_12px_-8px_rgba(15,42,61,0.12)] group-hover:bg-sky-50`}>
                          <ReviewActions status={r.status} onReview={(s) => review(r.id, s)} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-500">
              Showing {rows.length} {rows.length === 1 ? "landing" : "landings"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
'@

Write-Host "Done. Now run: npm run dev"
