$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-File($path, $content) {
  $full = Join-Path (Get-Location).Path $path
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  [System.IO.File]::WriteAllText($full, $content, $utf8)
}

# ---------- components/Modal.tsx (glass shell) ----------
Write-File "src/components/Modal.tsx" @'
"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
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
      {/* dimmed, blurred page */}
      <div className="animate-fade absolute inset-0 bg-[#0b2233]/45 backdrop-blur-md" onClick={onClose} />

      {/* colour behind the glass so the blur has something to catch */}
      <div className="animate-fade pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[8%] top-[8%] h-80 w-80 rounded-full bg-sky-400/50 blur-3xl" />
        <div className="absolute bottom-[6%] right-[10%] h-96 w-96 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="absolute right-[34%] top-[30%] h-64 w-64 rounded-full bg-violet-400/35 blur-3xl" />
      </div>

      {/* glass panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/60 bg-white/60 shadow-[0_24px_80px_-12px_rgba(8,30,50,0.55),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/50 bg-white/30 px-6 py-5">
          <div className="flex items-center gap-3.5">
            {icon && (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#38bdf8,#0284c7)] text-white shadow-lg shadow-sky-500/30 ring-1 ring-white/50">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/50 text-slate-600 transition hover:bg-white/80 hover:text-slate-900"
          >
            <X size={17} />
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
import { Fish, Ship, Truck } from "lucide-react";
import { api } from "@/lib/api";
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

const DELIVERY = [
  { label: "By sea", hint: "Landed from the boat", value: false, icon: Ship },
  { label: "By land", hint: "Delivered by truck", value: true, icon: Truck },
];

export default function NewLandingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // Field names stay the same as before so the PHP API needs no change:
  // boat_name = supplier, truck_delivery = true for "By land".
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
            <Field label="Origin" required>
              <input required className={glassInput} placeholder="Port of origin" value={f.origin}
                onChange={(e) => update({ origin: e.target.value })} />
            </Field>
            <Field label="Fishing ground">
              <input className={glassInput} placeholder="e.g. Visayan Sea" value={f.fishing_ground}
                onChange={(e) => update({ fishing_ground: e.target.value })} />
            </Field>
            <Field label="Time">
              <input type="time" className={glassInput} value={f.landing_time}
                onChange={(e) => update({ landing_time: e.target.value })} />
            </Field>
            <Field label="Boat owner">
              <input className={glassInput} placeholder="Owner name" value={f.boat_owner}
                onChange={(e) => update({ boat_owner: e.target.value })} />
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
              <input className={glassInput} placeholder="Broker or consignee name" value={f.broker}
                onChange={(e) => update({ broker: e.target.value })} />
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

# ---------- rename "Boat" to "Supplier" on the landings page ----------
$lp = Join-Path (Get-Location).Path "src/app/(app)/landings/page.tsx"
if (Test-Path -LiteralPath $lp) {
  $c = [System.IO.File]::ReadAllText($lp)
  $c = $c.Replace('>Boat</th>', '>Supplier</th>').Replace('Search boat, owner or origin', 'Search supplier, owner or origin')
  [System.IO.File]::WriteAllText($lp, $c, $utf8)
}

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "Done. Now run: npm run dev"
