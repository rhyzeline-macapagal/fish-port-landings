"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardCheck, Fish, Info, ListChecks, Plus, Ship, Trash2, Truck } from "lucide-react";
import { api, formatPeso } from "@/lib/api";
import Modal from "@/components/Modal";
import { saveLookup, useLookups } from "@/lib/lookups";

/* One input style for every field: solid white, visible border, larger text, clear focus ring. */
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20";

export const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/* Names from the database, no duplicates (ignoring case), A to Z.
   The first argument is an optional built-in list; pass [] to use database names only. */
export function mergeOptions(standard: string[], saved: string[]) {
  const seen = new Map<string, string>();
  [...standard, ...saved].forEach((name) => {
    const n = clean(name);
    if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/* If the typed name matches a listed one (any capitalisation), save it with the listed spelling */
export function canonical(typed: string, options: string[]) {
  const t = clean(typed);
  return options.find((o) => o.toLowerCase() === t.toLowerCase()) ?? t;
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="h-4 w-1 rounded-full bg-sky-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/* Native select with a visible chevron so it matches the other fields */
function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select id={id} className={`${inputCls} appearance-none pr-10`} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

/* Number input with the peso sign inside the field */
function PesoInput({
  id,
  value,
  onChange,
  required,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-slate-500">
        {"₱"}
      </span>
      <input
        id={id}
        required={required}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        className={`${inputCls} pl-9 tabular-nums`}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* Dropdown of saved names that also accepts a brand new one */
function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyText,
  required,
  drop = "up",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  emptyText: string;
  required?: boolean;
  drop?: "up" | "down";
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
        id={id}
        role="combobox"
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        className={`${inputCls} pr-11`}
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
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
      >
        <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className={`absolute left-0 right-0 z-30 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(8,30,50,0.35)] ${
            drop === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {items.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500">{emptyText}</li>}
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
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] ${
                i === active ? "bg-sky-50 text-slate-900" : "text-slate-700"
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

/* One species line of a trip */
type Item = {
  uid: number; // stable React key, so removing a line doesn't shift the combobox state
  species: string;
  volume: string;
  unit: string;
  price_per_kg: string;
  total_value: string;
  quality: string;
};

const MAX_ITEMS = 30;
const STEPS = [
  { label: "Basic details", hint: "Schedule and delivery", icon: Info },
  { label: "Catch details", hint: "Species and pricing", icon: Fish },
  { label: "Additional", hint: "Broker and remarks", icon: ListChecks },
  { label: "Review", hint: "Confirm before saving", icon: ClipboardCheck },
] as const;

export default function NewLandingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // Trip-level fields. Names match the PHP API: boat_name = producer,
  // boat_owner = registered owner, truck_delivery = true for "By land",
  // plate_number = truck plate (land deliveries only).
  const [f, setF] = useState({
    landing_date: new Date().toLocaleDateString("en-CA"),
    landing_time: "",
    boat_name: "",
    boat_owner: "",
    fishing_gear: "",
    origin: "",
    truck_delivery: false,
    plate_number: "",
    broker: "",
    remarks: "",
  });

  // One line per species (a truck or boat can carry several)
  const uid = useRef(2);
  const newItem = (base?: Pick<Item, "unit" | "quality">): Item => ({
    uid: uid.current++,
    species: "",
    volume: "",
    unit: base?.unit ?? "kg",
    price_per_kg: "",
    total_value: "",
    quality: base?.quality ?? "Fresh",
  });
  const [items, setItems] = useState<Item[]>(() => [{
    uid: 1,
    species: "",
    volume: "",
    unit: "kg",
    price_per_kg: "",
    total_value: "",
    quality: "Fresh",
  }]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  // Dropdown names come only from the database
  const saved = useLookups();
  const brokerOptions = useMemo(() => mergeOptions([], saved.brokers), [saved.brokers]);
  const speciesOptions = useMemo(() => mergeOptions([], saved.species), [saved.species]);
  const producerOptions = useMemo(() => mergeOptions([], saved.producers), [saved.producers]);
  const ownerOptions = useMemo(() => mergeOptions([], saved.owners), [saved.owners]);

  function update(patch: Partial<typeof f>) {
    setF((prev) => ({ ...prev, ...patch }));
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        if ("volume" in patch || "price_per_kg" in patch || "unit" in patch) {
          const v = parseFloat(next.volume);
          const p = parseFloat(next.price_per_kg);
          if (!isNaN(v) && !isNaN(p)) {
            next.total_value = (v * (next.unit === "ton" ? 1000 : 1) * p).toFixed(2);
          }
        }
        return next;
      })
    );
  }

  function addItem() {
    setItems((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, newItem(prev[prev.length - 1])]));
  }

  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const grandValue = items.reduce((s, it) => s + (parseFloat(it.total_value) || 0), 0);
  const grandKg = items.reduce((s, it) => s + (parseFloat(it.volume) || 0) * (it.unit === "ton" ? 1000 : 1), 0);

  function validationMessage(target: number) {
    if (target === 0) {
      if (!f.landing_date) return "Choose the landing date.";
      if (!f.truck_delivery && !clean(f.boat_name)) return "Choose or enter the producer for a sea landing.";
      if (f.truck_delivery && !clean(f.origin)) return "Enter the origin for a land delivery.";
      if (f.truck_delivery && !clean(f.plate_number)) return "Enter the plate number for a land delivery.";
      if (!clean(f.boat_owner)) return "Choose or enter the registered owner.";
    }
    if (target === 1) {
      const seen = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const tag = items.length > 1 ? `Species ${i + 1}: ` : "";
        const name = canonical(it.species, speciesOptions);
        if (!name) return `${tag}Choose a species or type one.`;
        if (seen.has(name.toLowerCase())) return `${name} is listed more than once. Combine them into one line.`;
        seen.add(name.toLowerCase());
        if (!it.volume || Number(it.volume) <= 0) return `${tag}Enter the volume.`;
        if (!it.price_per_kg || Number(it.price_per_kg) <= 0) return `${tag}Enter the price per kg.`;
        if (it.total_value === "" || Number(it.total_value) < 0) return `${tag}Enter the total value.`;
      }
    }
    return "";
  }

  function nextStep() {
    const message = validationMessage(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    for (const target of [0, 1]) {
      const message = validationMessage(target);
      if (message) {
        setStep(target);
        setError(message);
        return;
      }
    }

    const broker = canonical(f.broker, brokerOptions);
    const owner = canonical(f.boat_owner, ownerOptions);
    const producer = f.truck_delivery ? "" : canonical(f.boat_name, producerOptions);
    const payloadItems = items.map((it) => ({
      species: canonical(it.species, speciesOptions),
      volume: Number(it.volume),
      unit: it.unit,
      price_per_kg: Number(it.price_per_kg),
      total_value: Number(it.total_value),
      quality: it.quality,
    }));

    setBusy(true);
    try {
      await api("landings.php", {
        method: "POST",
        body: JSON.stringify({
          ...f,
          // producer (boat name) only applies to sea landings; by land it is sent empty
          boat_name: producer,
          boat_owner: owner,
          // origin only applies to land deliveries; by sea it is sent empty
          origin: f.truck_delivery ? clean(f.origin) : "",
          // plate number only applies to land deliveries
          plate_number: f.truck_delivery ? clean(f.plate_number).toUpperCase() : null,
          // fishing gear only applies to boat landings
          fishing_gear: f.truck_delivery ? null : clean(f.fishing_gear) || null,
          broker,
          items: payloadItems,
        }),
      });

      // Trip is saved: remember any new names in the database
      await Promise.all([
        ...payloadItems.map((it) => saveLookup("species", it.species)),
        ...(broker ? [saveLookup("brokers", broker)] : []),
        ...(owner ? [saveLookup("owners", owner)] : []),
        ...(producer ? [saveLookup("producers", producer)] : []),
      ]);

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
      <form onSubmit={onSubmit} noValidate>
        <div className="flex min-h-[560px] flex-col md:flex-row">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:p-5">
            <ol className="grid grid-cols-4 gap-2 md:grid-cols-1" aria-label="Landing entry steps">
              {STEPS.map(({ label, hint, icon: Icon }, index) => {
                const active = step === index;
                const complete = step > index;
                return (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => index <= step && setStep(index)}
                      aria-current={active ? "step" : undefined}
                      className={`flex w-full min-w-0 items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
                        active ? "bg-white text-[#14263d] shadow-sm ring-1 ring-slate-200" : complete ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                        active ? "bg-[#0875d1] text-white" : complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}>
                        {complete ? <Check size={15} /> : <Icon size={15} />}
                      </span>
                      <span className="hidden min-w-0 md:block">
                        <span className="block truncate text-sm font-semibold">{label}</span>
                        <span className="block truncate text-[11px] font-normal text-slate-500">{hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="min-w-0 flex-1 bg-slate-50/40 px-4 py-5 sm:px-6">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0875d1]">Step {step + 1} of {STEPS.length}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{STEPS[step].label}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{STEPS[step].hint}</p>
            </div>

            <div className="space-y-4">
          {step === 0 && <>
          <Section title="Schedule">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="landing-date" required>
                <input
                  id="landing-date"
                  type="date"
                  required
                  className={inputCls}
                  value={f.landing_date}
                  onChange={(e) => update({ landing_date: e.target.value })}
                />
              </Field>
              <Field label="Time" htmlFor="landing-time">
                <input
                  id="landing-time"
                  type="time"
                  className={inputCls}
                  value={f.landing_time}
                  onChange={(e) => update({ landing_time: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Delivery">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery">
              {DELIVERY.map(({ label, hint, value, icon: Icon }) => {
                const active = f.truck_delivery === value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    key={label}
                    onClick={() => update({ truck_delivery: value })}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                      active
                        ? "border-sky-500 bg-sky-50 shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
                        : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="flex-1 leading-tight">
                      <span className="block text-[15px] font-semibold text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-600">{hint}</span>
                    </span>
                    {active && <Check size={18} className="shrink-0 text-sky-600" />}
                  </button>
                );
              })}
            </div>

            {/* By sea: producer, owner and fishing gear.  By land: owner, origin and plate number. */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-5 sm:grid-cols-2">
              {!f.truck_delivery && (
                <Field label="Producer" htmlFor="producer" required>
                  <Combobox
                    id="producer"
                    required
                    drop="down"
                    value={f.boat_name}
                    onChange={(v) => update({ boat_name: v })}
                    options={producerOptions}
                    placeholder="Choose or type a producer"
                    emptyText="No producers saved yet. Type a name to add one."
                  />
                </Field>
              )}
              <Field label="Registered owner" htmlFor="boat-owner" required>
                <Combobox
                  id="boat-owner"
                  required
                  drop="down"
                  value={f.boat_owner}
                  onChange={(v) => update({ boat_owner: v })}
                  options={ownerOptions}
                  placeholder="Choose or type an owner"
                  emptyText="No owners saved yet. Type a name to add one."
                />
              </Field>
              {f.truck_delivery ? (
                <>
                  <Field label="Origin" htmlFor="origin" required>
                    <input
                      id="origin"
                      required
                      className={inputCls}
                      placeholder="Place of origin"
                      value={f.origin}
                      onChange={(e) => update({ origin: e.target.value })}
                    />
                  </Field>
                  <Field label="Plate number" htmlFor="plate-number" required>
                    <input
                      id="plate-number"
                      required
                      maxLength={20}
                      autoCapitalize="characters"
                      className={`${inputCls} uppercase`}
                      placeholder="e.g. ABC 1234"
                      value={f.plate_number}
                      onChange={(e) => update({ plate_number: e.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Fishing gear" htmlFor="fishing-gear">
                  <input
                    id="fishing-gear"
                    className={inputCls}
                    placeholder="e.g. Ring net"
                    value={f.fishing_gear}
                    onChange={(e) => update({ fishing_gear: e.target.value })}
                  />
                </Field>
              )}
            </div>
          </Section>

          </>}

          {step === 1 && <Section title="Catch and pricing">
            <div className="space-y-4">
              {items.map((it, i) => (
                <div key={it.uid} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      {items.length > 1 ? `Species ${i + 1}` : "Species"}
                    </p>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        aria-label={`Remove species ${i + 1}`}
                        title="Remove this species"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Species" htmlFor={`species-${i}`} required>
                      <Combobox
                        id={`species-${i}`}
                        required
                        drop="down"
                        value={it.species}
                        onChange={(v) => updateItem(i, { species: v })}
                        options={speciesOptions}
                        placeholder="Choose or type a species"
                        emptyText="No species saved yet. Type a name to add one."
                      />
                    </Field>
                    <Field label="Volume" htmlFor={`volume-${i}`} required>
                      <input
                        id={`volume-${i}`}
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className={`${inputCls} tabular-nums`}
                        placeholder="0"
                        value={it.volume}
                        onChange={(e) => updateItem(i, { volume: e.target.value })}
                      />
                    </Field>
                    <Field label="Unit" htmlFor={`unit-${i}`}>
                      <Select id={`unit-${i}`} value={it.unit} onChange={(v) => updateItem(i, { unit: v })}>
                        <option value="kg">kg</option>
                        <option value="ton">ton</option>
                      </Select>
                    </Field>
                    <Field label="Price per kg" htmlFor={`price-per-kg-${i}`} required>
                      <PesoInput
                        id={`price-per-kg-${i}`}
                        required
                        value={it.price_per_kg}
                        onChange={(v) => updateItem(i, { price_per_kg: v })}
                      />
                    </Field>
                    <Field
                      label="Total value"
                      htmlFor={`total-value-${i}`}
                      required
                      hint="Calculated from volume and price. You can still edit it."
                    >
                      <PesoInput
                        id={`total-value-${i}`}
                        required
                        value={it.total_value}
                        onChange={(v) => updateItem(i, { total_value: v })}
                      />
                    </Field>
                    <Field label="Quality" htmlFor={`quality-${i}`}>
                      <Select id={`quality-${i}`} value={it.quality} onChange={(v) => updateItem(i, { quality: v })}>
                        <option>Fresh</option>
                        <option>Chilled</option>
                        <option>Frozen</option>
                        <option>Dried</option>
                      </Select>
                    </Field>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                disabled={items.length >= MAX_ITEMS}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Add another species
              </button>

              {items.length > 1 && (
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Species</p>
                    <p className="font-semibold tabular-nums text-slate-900">{items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total volume</p>
                    <p className="font-semibold tabular-nums text-slate-900">{grandKg.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total value</p>
                    <p className="font-semibold tabular-nums text-slate-900">{formatPeso(grandValue)}</p>
                  </div>
                </div>
              )}
            </div>
          </Section>}

          {step === 2 && <Section title="Broker and remarks">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Broker" htmlFor="broker">
                <Combobox
                  id="broker"
                  drop="down"
                  value={f.broker}
                  onChange={(v) => update({ broker: v })}
                  options={brokerOptions}
                  placeholder="Choose a broker or type a new one"
                  emptyText="No brokers saved yet. Type a name to add one."
                />
              </Field>
              <Field label="Remarks" htmlFor="remarks">
                <textarea
                  id="remarks"
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Anything the reviewer should know"
                  value={f.remarks}
                  onChange={(e) => update({ remarks: e.target.value })}
                />
              </Field>
            </div>
          </Section>}

          {step === 3 && (
            <div className="space-y-4">
              <Section title="Landing summary">
                <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">Schedule</dt><dd className="mt-1 font-medium text-slate-900">{f.landing_date}{f.landing_time ? ` at ${f.landing_time}` : ""}</dd></div>
                  <div><dt className="text-xs text-slate-500">Delivery route</dt><dd className="mt-1 font-medium text-slate-900">{f.truck_delivery ? "By land" : "By sea"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Supplier / origin</dt><dd className="mt-1 font-medium text-slate-900">{f.truck_delivery ? f.origin : f.boat_name}</dd></div>
                  <div><dt className="text-xs text-slate-500">Registered owner</dt><dd className="mt-1 font-medium text-slate-900">{f.boat_owner}</dd></div>
                  {f.truck_delivery && <div><dt className="text-xs text-slate-500">Plate number</dt><dd className="mt-1 font-medium uppercase text-slate-900">{f.plate_number}</dd></div>}
                  {!f.truck_delivery && <div><dt className="text-xs text-slate-500">Fishing gear</dt><dd className="mt-1 font-medium text-slate-900">{f.fishing_gear || "Not provided"}</dd></div>}
                  <div><dt className="text-xs text-slate-500">Broker</dt><dd className="mt-1 font-medium text-slate-900">{f.broker || "Not provided"}</dd></div>
                  <div><dt className="text-xs text-slate-500">New status</dt><dd className="mt-1"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending review</span></dd></div>
                </dl>
              </Section>

              <Section title={`Catch summary (${items.length} ${items.length === 1 ? "species" : "species"})`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="pb-2 font-medium">Species</th><th className="pb-2 text-right font-medium">Volume</th><th className="pb-2 text-right font-medium">Price / kg</th><th className="pb-2 text-right font-medium">Total</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => <tr key={item.uid}><td className="py-3 font-medium text-slate-900">{item.species}</td><td className="py-3 text-right tabular-nums">{item.volume} {item.unit}</td><td className="py-3 text-right tabular-nums">{formatPeso(Number(item.price_per_kg) || 0)}</td><td className="py-3 text-right font-semibold tabular-nums">{formatPeso(Number(item.total_value) || 0)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end gap-6 rounded-lg bg-slate-50 p-3 text-sm">
                  <span><span className="text-slate-500">Volume</span> <strong className="ml-1 tabular-nums">{grandKg.toLocaleString()} kg</strong></span>
                  <span><span className="text-slate-500">Value</span> <strong className="ml-1 tabular-nums">{formatPeso(grandValue)}</strong></span>
                </div>
              </Section>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => { setError(""); setStep((current) => current - 1); }}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="rounded-lg bg-[#0875d1] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a8cc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0875d1] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a8cc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:opacity-60"
              >
                {busy ? "Saving..." : items.length > 1 ? `Save landing (${items.length} species)` : "Save landing"}
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
