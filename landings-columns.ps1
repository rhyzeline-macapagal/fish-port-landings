$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-File($path, $content) {
  $full = Join-Path (Get-Location).Path $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

# ---------- components/NewLandingModal.tsx ----------
Write-File "src/components/NewLandingModal.tsx" @'
"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Fish, Plus, Ship, Truck } from "lucide-react";
import { api, Landing } from "@/lib/api";
import Modal from "@/components/Modal";

const glassInput =
  "w-full rounded-xl border border-white/70 bg-white/55 px-3.5 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,42,61,0.05)] outline-none backdrop-blur transition placeholder:text-slate-500/70 focus:border-sky-400 focus:bg-white/80 focus:ring-4 focus:ring-sky-400/20";

function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">{children}</div>
    </div>
  );
}

/* Dropdown of saved names that also accepts a brand new one */
function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const typed = value.trim();
  const q = typed.toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(q));
  const exact = options.some((o) => o.toLowerCase() === q);
  const items = [
    ...matches.map((label) => ({ label, isNew: false })),
    ...(typed && !exact ? [{ label: typed, isNew: true }] : []),
  ];

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active].label);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // close the list, not the whole window
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={`${glassInput} pr-11`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show saved names"
        onClick={() => setOpen((o) => !o)}
        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/70"
      >
        <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-48 overflow-y-auto rounded-xl border border-white/70 bg-white/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(8,30,50,0.4)] backdrop-blur-xl"
        >
          {items.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>}
          {items.map((it, i) => (
            <li
              key={`${it.label}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it.label);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                i === active ? "bg-sky-100/80 text-slate-900" : "text-slate-700"
              }`}
            >
              {it.isNew ? (
                <>
                  <Plus size={15} className="text-sky-600" />
                  Add &quot;{it.label}&quot;
                </>
              ) : (
                <>
                  <span className="flex-1">{it.label}</span>
                  {q === it.label.toLowerCase() && <Check size={15} className="text-sky-600" />}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DELIVERY = [
  { label: "By sea", hint: "Landed from the boat", value: false, icon: Ship },
  { label: "By land", hint: "Delivered by truck", value: true, icon: Truck },
];

export default function NewLandingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // Field names match the PHP API: boat_name = supplier,
  // boat_owner = registered owner, truck_delivery = true for "By land".
  const [f, setF] = useState({
    landing_date: new Date().toLocaleDateString("en-CA"),
    landing_time: "",
    boat_name: "",
    boat_owner: "",
    fishing_gear: "",
    origin: "",
    truck_delivery: false,
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
  const [brokers, setBrokers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // saved brokers come from the brokers already used in earlier landings
  useEffect(() => {
    api<Landing[]>("landings.php")
      .then((rows) => {
        const names = rows.map((r) => (r.broker ?? "").trim()).filter(Boolean);
        setBrokers([...new Set(names)].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
  }, []);

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
          broker: f.broker.trim(),
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
      icon={<Fish size={21} />}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-4 px-6 py-6">
          <Section title="Supplier and trip">
            <Field label="Supplier" required className="sm:col-span-2">
              <input required className={glassInput} placeholder="Supplier name" value={f.boat_name}
                onChange={(e) => update({ boat_name: e.target.value })} />
            </Field>
            <Field label="Date" required>
              <input type="date" required className={glassInput} value={f.landing_date}
                onChange={(e) => update({ landing_date: e.target.value })} />
            </Field>
            <Field label="Registered owner" className="sm:col-span-2">
              <input className={glassInput} placeholder="Registered owner name" value={f.boat_owner}
                onChange={(e) => update({ boat_owner: e.target.value })} />
            </Field>
            <Field label="Time">
              <input type="time" className={glassInput} value={f.landing_time}
                onChange={(e) => update({ landing_time: e.target.value })} />
            </Field>
            <Field label="Origin" required>
              <input required className={glassInput} placeholder="Port of origin" value={f.origin}
                onChange={(e) => update({ origin: e.target.value })} />
            </Field>
            <Field label="Fishing ground">
              <input className={glassInput} placeholder="e.g. Visayan Sea" value={f.fishing_ground}
                onChange={(e) => update({ fishing_ground: e.target.value })} />
            </Field>
            <Field label="Fishing gear">
              <input className={glassInput} placeholder="e.g. Ring net" value={f.fishing_gear}
                onChange={(e) => update({ fishing_gear: e.target.value })} />
            </Field>

            <Field label="Delivery" className="sm:col-span-3">
              <div className="grid grid-cols-2 gap-3 sm:max-w-md" role="radiogroup" aria-label="Delivery">
                {DELIVERY.map(({ label, hint, value, icon: Icon }) => {
                  const active = f.truck_delivery === value;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      key={label}
                      onClick={() => update({ truck_delivery: value })}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left backdrop-blur transition ${
                        active
                          ? "border-sky-400 bg-sky-100/70 shadow-[0_0_0_4px_rgba(56,189,248,0.18)]"
                          : "border-white/70 bg-white/45 hover:bg-white/70"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          active ? "bg-sky-500 text-white" : "bg-white/70 text-slate-500"
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-sm font-semibold text-slate-900">{label}</span>
                        <span className="block text-xs text-slate-600">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          <Section title="Catch and pricing">
            <Field label="Species" required>
              <input required className={glassInput} placeholder="e.g. Galunggong" value={f.species}
                onChange={(e) => update({ species: e.target.value })} />
            </Field>
            <Field label="Volume" required>
              <input required type="number" min="0" step="0.01" className={glassInput} placeholder="0" value={f.volume}
                onChange={(e) => update({ volume: e.target.value })} />
            </Field>
            <Field label="Unit">
              <select className={glassInput} value={f.unit} onChange={(e) => update({ unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="ton">ton</option>
              </select>
            </Field>
            <Field label={"Price per kg (\u20B1)"}>
              <input type="number" min="0" step="0.01" className={glassInput} placeholder="0.00" value={f.price_per_kg}
                onChange={(e) => update({ price_per_kg: e.target.value })} />
            </Field>
            <Field label={"Total value (\u20B1)"} required>
              <input required type="number" min="0" step="0.01" className={glassInput} placeholder="0.00" value={f.total_value}
                onChange={(e) => update({ total_value: e.target.value })} />
            </Field>
            <Field label="Quality">
              <select className={glassInput} value={f.quality} onChange={(e) => update({ quality: e.target.value })}>
                <option>Fresh</option>
                <option>Chilled</option>
                <option>Frozen</option>
                <option>Dried</option>
              </select>
            </Field>
            <Field label="Broker" className="sm:col-span-3">
              <Combobox
                value={f.broker}
                onChange={(v) => update({ broker: v })}
                options={brokers}
                placeholder="Choose a broker or type a new one"
                emptyText="No brokers saved yet. Type a name to add one."
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-3">
              <textarea rows={2} className={glassInput} placeholder="Anything the reviewer should know" value={f.remarks}
                onChange={(e) => update({ remarks: e.target.value })} />
            </Field>
          </Section>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-sm text-red-700 backdrop-blur">{error}</p>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/50 bg-white/50 px-6 py-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/70 bg-white/60 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/90"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded-xl bg-[linear-gradient(135deg,#1a8cc7,#0b6aa0)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 ring-1 ring-white/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save landing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
'@

# ---------- app/(app)/landings/page.tsx ----------
Write-File "src/app/(app)/landings/page.tsx" @'
"use client";

import { ReactNode, useEffect, useState } from "react";
import { Check, Plus, RotateCcw, Search, Ship, Truck, X } from "lucide-react";
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

function Delivery({ truck }: { truck: boolean }) {
  const Icon = truck ? Truck : Ship;
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700">
      <Icon size={15} className={truck ? "text-amber-600" : "text-sky-600"} />
      {truck ? "By land" : "By sea"}
    </span>
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

  const th = "whitespace-nowrap px-3 py-3 font-medium";
  const td = "whitespace-nowrap px-3 py-3.5";

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
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500">
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
                  <tr key={r.id} className="group transition hover:bg-slate-50/60">
                    <td className={`${td} pl-6 text-slate-600`}>{formatDate(r.landing_date)}</td>
                    <td className={`${td} text-slate-600`}>{formatTime(r.landing_time)}</td>
                    <td className={`${td} font-medium text-slate-900`}>{r.boat_name}</td>
                    <td className={`${td} text-slate-600`}>{val(r.fishing_gear)}</td>
                    <td className={td}><Delivery truck={Number(r.truck_delivery) === 1} /></td>
                    <td className={`${td} text-slate-600`}>{r.origin}</td>
                    <td className={`${td} text-slate-600`}>{val(r.boat_owner)}</td>
                    <td className={td}>
                      <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">{r.species}</span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{Number(r.volume).toLocaleString()} {r.unit}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.price_per_kg ? formatPeso(r.price_per_kg) : dash}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{formatPeso(r.total_value)}</td>
                    <td className={`${td} text-slate-600`}>{val(r.broker)}</td>
                    <td className={td}><StatusBadge status={r.status} /></td>
                    {isAdmin && (
                      <td className={`${td} sticky right-0 bg-white pr-6 group-hover:bg-slate-50`}>
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

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "Done. Now run: npm run dev"
