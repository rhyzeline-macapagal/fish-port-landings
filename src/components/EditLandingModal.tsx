"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Layers, Loader2, Save, Ship, Truck, X } from "lucide-react";
import { api, Landing } from "@/lib/api";
import { ghostBtn, inputCls, primaryBtn } from "@/components/ui";
import { canonical, mergeOptions } from "@/components/NewLandingModal";
import { saveLookup, useLookups } from "@/lib/lookups";

export type EditOptions = {
  species: string[]; vessels: string[]; owners: string[]; brokers: string[];
  origins: string[]; gears: string[]; grounds: string[]; qualities: string[];
};

type Props = {
  landing: Landing;
  options: EditOptions;
  onClose: () => void;
  onSaved: () => void;
};

const card =
  "rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,42,61,0.04),0_12px_32px_-16px_rgba(15,42,61,0.18)]";

function read(l: Landing, k: string) {
  const v = (l as unknown as Record<string, unknown>)[k];
  return v === null || v === undefined ? "" : String(v);
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DataList({ id, items }: { id: string; items: string[] }) {
  return (
    <datalist id={id}>
      {items.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );
}

const money = (volume: string, unit: string, price: string) => {
  const v = parseFloat(volume);
  const p = parseFloat(price);
  if (isNaN(v) || isNaN(p)) return null;
  return String(Math.round(v * (unit === "ton" ? 1000 : 1) * p * 100) / 100);
};

export default function EditLandingModal({ landing, options, onClose, onSaved }: Props) {
  const [f, setF] = useState({
    landing_date: read(landing, "landing_date").slice(0, 10),
    landing_time: read(landing, "landing_time").slice(0, 5),
    boat_name: read(landing, "boat_name"),
    fishing_gear: read(landing, "fishing_gear"),
    origin: read(landing, "origin"),
    plate_number: read(landing, "plate_number"),
    boat_owner: read(landing, "boat_owner"),
    fishing_ground: read(landing, "fishing_ground"),
    species: read(landing, "species"),
    volume: read(landing, "volume"),
    unit: read(landing, "unit") || "kg",
    price_per_kg: read(landing, "price_per_kg"),
    total_value: read(landing, "total_value"),
    broker: read(landing, "broker"),
    quality: read(landing, "quality"),
    remarks: read(landing, "remarks"),
  });
  const [land, setLand] = useState(Number(landing.truck_delivery) === 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Other species rows of the same truck / boat trip
  const tripItems = Number(landing.trip_items) || 1;
  const inTrip = tripItems > 1;

  // Dropdown names come only from the database: the lookups table
  // plus names already used in saved landings (options.*)
  const saved = useLookups();
  const speciesOptions = useMemo(
    () => mergeOptions([], [...saved.species, ...options.species]),
    [saved.species, options.species]
  );
  const brokerOptions = useMemo(
    () => mergeOptions([], [...saved.brokers, ...options.brokers]),
    [saved.brokers, options.brokers]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  // Volume, unit or price changed: refresh the total (it can still be typed over afterwards)
  function setMoney(k: "volume" | "unit" | "price_per_kg", v: string) {
    setF((s) => {
      const next = { ...s, [k]: v };
      const total = money(next.volume, next.unit, next.price_per_kg);
      if (total !== null) next.total_value = total;
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const volume = parseFloat(f.volume);
    if (!f.landing_date) return setError("Date is required.");
    if (!land && !f.boat_name.trim()) return setError("Producer is required for a sea landing.");
    if (!f.species.trim()) return setError("Species is required.");
    if (!(volume > 0)) return setError("Volume must be greater than 0.");
    if (land && !f.origin.trim()) return setError("Enter the origin for a land delivery.");
    if (land && !f.plate_number.trim()) return setError("Enter the plate number for a land delivery.");

    const price = f.price_per_kg === "" ? null : Number(f.price_per_kg);
    const total =
      f.total_value !== ""
        ? Number(f.total_value)
        : price !== null
        ? Number(money(f.volume, f.unit, f.price_per_kg) ?? 0)
        : 0;

    // Keep the listed spelling when the typed name matches an existing one
    const species = canonical(f.species, speciesOptions);
    const broker = f.broker.trim() ? canonical(f.broker, brokerOptions) : "";

    setBusy(true);
    try {
      // 1) This row (species, volume, price, ...) exactly as before
      await api("landing_update.php", {
        method: "POST",
        body: JSON.stringify({
          id: landing.id,
          ...f,
          // producer (boat name) only applies to sea landings
          boat_name: land ? "" : f.boat_name.trim(),
          species,
          broker,
          volume,
          price_per_kg: price,
          total_value: total,
          truck_delivery: land ? 1 : 0,
          origin: land ? f.origin : "",
          plate_number: land ? f.plate_number : "",
        }),
      });

      // 2) Shared details are copied to the other species of the same trip
      if (inTrip) {
        await api("landing_trip_update.php", {
          method: "POST",
          body: JSON.stringify({
            id: landing.id,
            landing_date: f.landing_date,
            landing_time: f.landing_time,
            boat_name: land ? "" : f.boat_name.trim(),
            boat_owner: f.boat_owner,
            fishing_gear: f.fishing_gear,
            fishing_ground: f.fishing_ground,
            truck_delivery: land ? 1 : 0,
            origin: land ? f.origin : "",
            plate_number: land ? f.plate_number : "",
            broker,
            remarks: f.remarks,
          }),
        });
      }

      // Landing is saved: remember any new species / broker name in the database
      await Promise.all([saveLookup("species", species), saveLookup("brokers", broker)]);

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the landing.");
    } finally {
      setBusy(false);
    }
  }

  const routeBtn = (on: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      on ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-landing-title"
        className={`${card} flex max-h-[92vh] w-full max-w-2xl flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 id="edit-landing-title" className="text-lg font-semibold text-slate-900">Edit landing</h2>
            <p className="mt-0.5 text-sm text-slate-500">Update the details of this record.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {inTrip && (
            <div className="flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-100">
              <Layers size={16} className="mt-0.5 shrink-0 text-indigo-600" />
              <p>
                This landing is one of <b>{tripItems} species</b> on the same trip. Changes to the date, time,
                supplier, owner, delivery, origin, plate, gear, ground, broker and remarks apply to all of them.
                Species, volume, price, total and quality only change this record.
              </p>
            </div>
          )}

          {/* Route */}
          <div className="inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setLand(false)} className={routeBtn(!land)}>
              <Ship size={15} /> By sea
            </button>
            <button type="button" onClick={() => setLand(true)} className={routeBtn(land)}>
              <Truck size={15} /> By land
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input type="date" className={inputCls} value={f.landing_date} onChange={(e) => set("landing_date", e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" className={inputCls} value={f.landing_time} onChange={(e) => set("landing_time", e.target.value)} />
            </Field>

            {/* Producer (boat name) only exists for sea landings */}
            {!land && (
              <Field label="Producer">
                <input list="el-vessels" className={inputCls} value={f.boat_name} onChange={(e) => set("boat_name", e.target.value)} />
              </Field>
            )}
            <Field label="Registered owner" className={land ? "sm:col-span-2" : ""}>
              <input list="el-owners" className={inputCls} value={f.boat_owner} onChange={(e) => set("boat_owner", e.target.value)} />
            </Field>

            <Field label="Fishing gear">
              <input list="el-gears" className={inputCls} value={f.fishing_gear} onChange={(e) => set("fishing_gear", e.target.value)} />
            </Field>
            <Field label="Fishing ground">
              <input list="el-grounds" className={inputCls} value={f.fishing_ground} onChange={(e) => set("fishing_ground", e.target.value)} />
            </Field>

            {land && (
              <>
                <Field label="Origin">
                  <input list="el-origins" className={inputCls} value={f.origin} onChange={(e) => set("origin", e.target.value)} />
                </Field>
                <Field label="Plate number">
                  <input
                    className={`${inputCls} uppercase`}
                    value={f.plate_number}
                    onChange={(e) => set("plate_number", e.target.value.toUpperCase())}
                  />
                </Field>
              </>
            )}

            <Field label="Species">
              <input list="el-species" className={inputCls} value={f.species} onChange={(e) => set("species", e.target.value)} />
            </Field>
            <Field label="Broker">
              <input list="el-brokers" className={inputCls} value={f.broker} onChange={(e) => set("broker", e.target.value)} />
            </Field>

            <Field label="Volume">
              <input
                type="number" min={0} step="any" inputMode="decimal" className={inputCls}
                value={f.volume} onChange={(e) => setMoney("volume", e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <select className={inputCls} value={f.unit} onChange={(e) => setMoney("unit", e.target.value)}>
                <option value="kg">kg</option>
                <option value="ton">ton</option>
              </select>
            </Field>

            <Field label="Price per kg">
              <input
                type="number" min={0} step="any" inputMode="decimal" className={inputCls}
                value={f.price_per_kg} onChange={(e) => setMoney("price_per_kg", e.target.value)}
              />
            </Field>
            <Field label="Total value">
              <input
                type="number" min={0} step="any" inputMode="decimal" className={inputCls}
                value={f.total_value} onChange={(e) => set("total_value", e.target.value)}
              />
            </Field>

            <Field label="Quality" className="sm:col-span-2">
              <input list="el-qualities" className={inputCls} value={f.quality} onChange={(e) => set("quality", e.target.value)} />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <textarea rows={2} className={inputCls} value={f.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </Field>
          </div>

          <DataList id="el-vessels" items={options.vessels} />
          <DataList id="el-owners" items={options.owners} />
          <DataList id="el-gears" items={options.gears} />
          <DataList id="el-grounds" items={options.grounds} />
          <DataList id="el-origins" items={options.origins} />
          <DataList id="el-species" items={speciesOptions} />
          <DataList id="el-brokers" items={brokerOptions} />
          <DataList id="el-qualities" items={options.qualities} />

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} disabled={busy} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${primaryBtn} gap-2 disabled:cursor-not-allowed disabled:opacity-60`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}