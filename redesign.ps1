$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-File($path, $content) {
  $full = Join-Path (Get-Location).Path $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

# ---------- globals.css ----------
Write-File "src/app/globals.css" @'
@import "tailwindcss";

body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #f3f6f9;
  letter-spacing: -0.005em;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.animate-fade { animation: fade-in 0.2s ease-out; }
.animate-pop { animation: pop-in 0.28s cubic-bezier(0.16, 1, 0.3, 1); }

@media (prefers-reduced-motion: reduce) {
  .animate-fade, .animate-pop { animation: none; }
}
'@

# ---------- components/ui.ts ----------
Write-File "src/components/ui.ts" @'
export const inputCls =
  "w-full rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1a8cc7] focus:ring-4 focus:ring-[#1a8cc7]/15";

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#1a8cc7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#157bb0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a8cc7]/30 disabled:opacity-60";

export const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200";
'@

# ---------- components/Modal.tsx ----------
Write-File "src/components/Modal.tsx" @'
"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-[#0f2a3d]/55 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
'@

# ---------- components/NewLandingModal.tsx ----------
Write-File "src/components/NewLandingModal.tsx" @'
"use client";

import { FormEvent, ReactNode, useState } from "react";
import { api } from "@/lib/api";
import Modal from "@/components/Modal";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">{children}</div>
    </div>
  );
}

export default function NewLandingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    landing_date: new Date().toLocaleDateString("en-CA"),
    landing_time: "",
    boat_name: "",
    fishing_gear: "",
    origin: "",
    truck_delivery: false,
    boat_owner: "",
    fishing_ground: "",
    species: "",
    volume: "",
    unit: "kg",
    price_per_kg: "",
    total_value: "",
    broker: "",
    quality: "Fresh",
    remarks: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(patch: Partial<typeof f>) {
    setF((prev) => {
      const next = { ...prev, ...patch };
      if ("volume" in patch || "price_per_kg" in patch || "unit" in patch) {
        const v = parseFloat(next.volume);
        const p = parseFloat(next.price_per_kg);
        if (!isNaN(v) && !isNaN(p)) {
          next.total_value = (v * (next.unit === "ton" ? 1000 : 1) * p).toFixed(2);
        }
      }
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("landings.php", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          volume: Number(f.volume),
          price_per_kg: f.price_per_kg ? Number(f.price_per_kg) : null,
          total_value: Number(f.total_value),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the landing. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New fish landing"
      subtitle="Saved as pending until an admin reviews it."
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-7 px-6 py-6">
          <Section title="Trip details">
            <Field label="Date" required>
              <input type="date" required className={inputCls} value={f.landing_date}
                onChange={(e) => update({ landing_date: e.target.value })} />
            </Field>
            <Field label="Time">
              <input type="time" className={inputCls} value={f.landing_time}
                onChange={(e) => update({ landing_time: e.target.value })} />
            </Field>
            <Field label="Boat name" required>
              <input required className={inputCls} placeholder="F/B Example" value={f.boat_name}
                onChange={(e) => update({ boat_name: e.target.value })} />
            </Field>
            <Field label="Boat owner">
              <input className={inputCls} placeholder="Owner name" value={f.boat_owner}
                onChange={(e) => update({ boat_owner: e.target.value })} />
            </Field>
            <Field label="Origin" required>
              <input required className={inputCls} placeholder="Port of origin" value={f.origin}
                onChange={(e) => update({ origin: e.target.value })} />
            </Field>
            <Field label="Fishing ground">
              <input className={inputCls} placeholder="e.g. Visayan Sea" value={f.fishing_ground}
                onChange={(e) => update({ fishing_ground: e.target.value })} />
            </Field>
            <Field label="Fishing gear">
              <input className={inputCls} placeholder="e.g. Ring net" value={f.fishing_gear}
                onChange={(e) => update({ fishing_gear: e.target.value })} />
            </Field>
            <Field label="Delivery" className="sm:col-span-2">
              <div className="inline-flex rounded-[10px] bg-slate-100 p-1">
                {[
                  { label: "By boat", value: false },
                  { label: "By truck", value: true },
                ].map((o) => (
                  <button
                    type="button"
                    key={o.label}
                    onClick={() => update({ truck_delivery: o.value })}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                      f.truck_delivery === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Catch and pricing">
            <Field label="Species" required>
              <input required className={inputCls} placeholder="e.g. Galunggong" value={f.species}
                onChange={(e) => update({ species: e.target.value })} />
            </Field>
            <Field label="Volume" required>
              <input required type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={f.volume}
                onChange={(e) => update({ volume: e.target.value })} />
            </Field>
            <Field label="Unit">
              <select className={inputCls} value={f.unit} onChange={(e) => update({ unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="ton">ton</option>
              </select>
            </Field>
            <Field label={"Price per kg (\u20B1)"}>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="0.00" value={f.price_per_kg}
                onChange={(e) => update({ price_per_kg: e.target.value })} />
            </Field>
            <Field label={"Total value (\u20B1)"} required>
              <input required type="number" min="0" step="0.01" className={inputCls} placeholder="0.00" value={f.total_value}
                onChange={(e) => update({ total_value: e.target.value })} />
            </Field>
            <Field label="Quality">
              <select className={inputCls} value={f.quality} onChange={(e) => update({ quality: e.target.value })}>
                <option>Fresh</option>
                <option>Chilled</option>
                <option>Frozen</option>
                <option>Dried</option>
              </select>
            </Field>
            <Field label="Broker" className="sm:col-span-3">
              <input className={inputCls} placeholder="Broker or consignee name" value={f.broker}
                onChange={(e) => update({ broker: e.target.value })} />
            </Field>
          </Section>

          <Field label="Remarks">
            <textarea rows={3} className={inputCls} placeholder="Anything the reviewer should know" value={f.remarks}
              onChange={(e) => update({ remarks: e.target.value })} />
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button disabled={busy} className={primaryBtn}>{busy ? "Saving..." : "Save landing"}</button>
        </div>
      </form>
    </Modal>
  );
}
'@

# ---------- context/EntryModalContext.tsx ----------
Write-File "src/context/EntryModalContext.tsx" @'
"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import NewLandingModal from "@/components/NewLandingModal";

interface Ctx {
  openNewEntry: () => void;
  version: number; // increases after every saved entry so pages can reload
}

const C = createContext<Ctx | null>(null);

export function EntryModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const openNewEntry = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    setVersion((v) => v + 1);
  }, []);

  return (
    <C.Provider value={{ openNewEntry, version }}>
      {children}
      {open && <NewLandingModal onClose={close} onSaved={saved} />}
    </C.Provider>
  );
}

export function useEntryModal() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useEntryModal must be used inside EntryModalProvider");
  return ctx;
}
'@

# ---------- components/StatusBadge.tsx ----------
Write-File "src/components/StatusBadge.tsx" @'
const STYLES = {
  pending: { wrap: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  approved: { wrap: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  rejected: { wrap: "bg-red-50 text-red-800", dot: "bg-red-500" },
};

export default function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${s.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
'@

# ---------- components/StatCard.tsx ----------
Write-File "src/components/StatCard.tsx" @'
import type { LucideIcon } from "lucide-react";

const TONES = {
  blue: "text-sky-600",
  green: "text-emerald-600",
  yellow: "text-amber-500",
  red: "text-red-500",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon size={16} className={TONES[tone]} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
'@

# ---------- components/Sidebar.tsx ----------
Write-File "src/components/Sidebar.tsx" @'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Plus, LogOut, Fish, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import type { Role } from "@/lib/api";

const NAV: { href: string; label: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "encoder", "viewer"] },
  { href: "/landings", label: "Landings", icon: ClipboardList, roles: ["admin", "encoder"] },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1a8cc7] text-white">
        <Fish size={20} />
      </div>
      <div className="leading-tight">
        <p className="font-semibold text-white">FishPort</p>
        <p className="text-xs text-sky-200/70">Landing statistics</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { openNewEntry } = useEntryModal();
  const pathname = usePathname();
  if (!user) return null;

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const canAdd = user.role !== "viewer";
  const initials = user.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#0f2a3d] lg:flex">
        <div className="px-5 py-6">
          <Logo />
        </div>

        {canAdd && (
          <div className="px-4">
            <button
              onClick={openNewEntry}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a8cc7] py-3 text-sm font-semibold text-white transition hover:bg-[#2299d6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40"
            >
              <Plus size={18} /> New entry
            </button>
          </div>
        )}

        <nav className="mt-5 flex-1 space-y-1 px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  active ? "bg-white/10 text-white" : "text-sky-100/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} className={active ? "text-sky-300" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-400/20 text-sm font-semibold text-sky-200">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="text-xs capitalize text-sky-200/60">{user.role}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded-lg p-2 text-sky-200/70 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#0f2a3d] px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`rounded-lg p-2 ${pathname === href ? "bg-white/10 text-white" : "text-sky-100/70"}`}
            >
              <Icon size={20} />
            </Link>
          ))}
          {canAdd && (
            <button onClick={openNewEntry} aria-label="New entry" className="rounded-lg bg-[#1a8cc7] p-2 text-white">
              <Plus size={20} />
            </button>
          )}
          <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-sky-100/70">
            <LogOut size={20} />
          </button>
        </div>
      </header>
    </>
  );
}
'@

# ---------- app/(app)/layout.tsx ----------
Write-File "src/app/(app)/layout.tsx" @'
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { EntryModalProvider } from "@/context/EntryModalContext";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Viewer can only see the dashboard
  const blocked = user?.role === "viewer" && pathname !== "/dashboard";

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (blocked) router.replace("/dashboard");
  }, [loading, user, blocked, router]);

  if (loading || !user || blocked) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading...</div>;
  }

  return (
    <EntryModalProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:pl-64">
          <div className="mx-auto max-w-6xl p-5 lg:p-10">{children}</div>
        </main>
      </div>
    </EntryModalProvider>
  );
}
'@

# ---------- app/(app)/dashboard/page.tsx ----------
Write-File "src/app/(app)/dashboard/page.tsx" @'
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Package, Wallet, Clock, Plus } from "lucide-react";
import { api, formatDate, formatKg, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { ghostBtn } from "@/components/ui";

const COLORS = ["#1a8cc7", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b", "#22c55e", "#0ea5e9", "#f97316"];

interface DashboardData {
  total_landings: number | string;
  total_volume: number | string;
  total_value: number | string;
  pending_review: number | string;
  by_species: { species: string; volume: number | string }[];
  recent: Landing[];
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,42,61,0.12)",
  fontSize: 13,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { openNewEntry, version } = useEntryModal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("dashboard.php")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [version]);

  const species = (data?.by_species ?? []).map((s) => ({ name: s.species, volume: Number(s.volume) }));
  const speciesTotal = species.reduce((sum, s) => sum + s.volume, 0);
  const recent = data?.recent ?? [];
  const firstName = user?.full_name.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const canAdd = user?.role !== "viewer";

  return (
    <div className="space-y-6">
      {/* Hero: the one bold element */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0f2a3d] p-7 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#1a8cc7]/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-sky-200/80">{today}. Welcome back, {firstName}.</p>
            <p className="mt-6 text-sm text-sky-100/70">Total volume landed</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
              {formatKg(data?.total_volume ?? 0)}
            </p>
          </div>
          {canAdd && (
            <button
              onClick={openNewEntry}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f2a3d] transition hover:bg-sky-50"
            >
              <Plus size={18} /> Record a landing
            </button>
          )}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Quiet stats strip */}
      <section className="grid grid-cols-1 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <StatCard label="Total landings" value={String(Number(data?.total_landings ?? 0))} icon={Package} tone="blue" />
        <StatCard label="Total value" value={formatPeso(data?.total_value ?? 0)} icon={Wallet} tone="green" />
        <StatCard label="Pending review" value={String(Number(data?.pending_review ?? 0))} icon={Clock} tone="yellow" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-3">
          <h2 className="font-semibold">Volume by species</h2>
          <p className="text-sm text-slate-500">Kilograms landed per species</p>
          <div className="mt-5 h-64">
            {species.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-slate-500">No landings yet. Record one to see the chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={species} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={tooltipStyle} formatter={(v) => formatKg(Number(v))} />
                  <Bar dataKey="volume" fill="#1a8cc7" radius={[8, 8, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <h2 className="font-semibold">Species share</h2>
          <p className="text-sm text-slate-500">Percent of total volume</p>
          {species.length === 0 ? (
            <p className="grid h-56 place-items-center text-sm text-slate-500">Nothing to show yet.</p>
          ) : (
            <>
              <div className="relative mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={species} dataKey="volume" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {species.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatKg(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-lg font-semibold tabular-nums">{species.length}</p>
                    <p className="text-xs text-slate-500">species</p>
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {species.slice(0, 5).map((s, i) => (
                  <li key={s.name} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate text-slate-700">{s.name}</span>
                    <span className="tabular-nums text-slate-500">
                      {speciesTotal ? Math.round((s.volume / speciesTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-semibold">Recent landings</h2>
            <p className="text-sm text-slate-500">The latest entries from the port</p>
          </div>
          {user?.role !== "viewer" && (
            <Link href="/landings" className={ghostBtn}>View all landings</Link>
          )}
        </div>

        {recent.length === 0 ? (
          <p className="border-t border-slate-100 py-12 text-center text-sm text-slate-500">No landings recorded yet.</p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Boat</th>
                  <th className="px-3 py-3 font-medium">Species</th>
                  <th className="px-3 py-3 text-right font-medium">Volume</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-6 py-3.5 text-slate-500">{formatDate(r.landing_date)}</td>
                    <td className="px-3 py-3.5 font-medium text-slate-900">{r.boat_name}</td>
                    <td className="px-3 py-3.5">{r.species}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{Number(r.volume).toLocaleString()} {r.unit}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{formatPeso(r.total_value)}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
'@

# ---------- app/(app)/landings/page.tsx ----------
Write-File "src/app/(app)/landings/page.tsx" @'
"use client";

import { useEffect, useState } from "react";
import { Check, Plus, RotateCcw, Search, X } from "lucide-react";
import { api, formatDate, formatPeso, Landing } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import StatusBadge from "@/components/StatusBadge";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";

const EMPTY = { status: "", species: "", from: "", to: "", q: "" };
const TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fish landings</h1>
          <p className="mt-1 text-slate-500">Every recorded unloading and land delivery.</p>
        </div>
        <button onClick={openNewEntry} className={primaryBtn}>
          <Plus size={18} /> New entry
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="inline-flex rounded-[10px] bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.label}
                onClick={() => pickStatus(t.value)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  filters.status === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">{loading ? "Loading..." : `${rows.length} ${rows.length === 1 ? "landing" : "landings"}`}</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]"
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
              placeholder="Search boat, owner or origin"
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

        {error && <p className="m-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-slate-900">No landings found</p>
            <p className="mt-1 text-sm text-slate-500">Change the filters or record a new landing.</p>
            <button onClick={openNewEntry} className={`${primaryBtn} mt-5`}>
              <Plus size={18} /> New entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Boat</th>
                  <th className="px-3 py-3 font-medium">Origin</th>
                  <th className="px-3 py-3 font-medium">Species</th>
                  <th className="px-3 py-3 text-right font-medium">Volume</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-right font-medium">Review</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-6 py-3.5 text-slate-500">{formatDate(r.landing_date)}</td>
                    <td className="px-3 py-3.5">
                      <p className="font-medium text-slate-900">{r.boat_name}</p>
                      {r.boat_owner && <p className="text-xs text-slate-500">{r.boat_owner}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-slate-600">{r.origin}</td>
                    <td className="px-3 py-3.5">
                      <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">{r.species}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{Number(r.volume).toLocaleString()} {r.unit}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums">{formatPeso(r.total_value)}</td>
                    <td className="px-3 py-3.5"><StatusBadge status={r.status} /></td>
                    {isAdmin && (
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          {r.status !== "approved" && (
                            <button
                              onClick={() => review(r.id, "approved")}
                              title="Approve"
                              aria-label="Approve landing"
                              className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {r.status !== "rejected" && (
                            <button
                              onClick={() => review(r.id, "rejected")}
                              title="Reject"
                              aria-label="Reject landing"
                              className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
'@

# ---------- remove the old separate-page entry form ----------
Remove-Item -Recurse -Force -LiteralPath "src/app/(app)/landings/new" -ErrorAction SilentlyContinue
Remove-Item -Force -LiteralPath "src/components/LandingForm.tsx" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "Done. Now run: npm run dev"
