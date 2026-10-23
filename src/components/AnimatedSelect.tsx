"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

export default function AnimatedSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  buttonClassName = "",
  align = "left",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={box} className={`relative ${open ? "z-50" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-white/85 px-3.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-150 hover:border-sky-200 hover:bg-white focus:outline-none focus-visible:border-[#1a8cc7] focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 ${buttonClassName}`}
      >
        <span className="truncate">{selected}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180 text-[#0875d1]" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`animate-dropdown scrollbar-hidden absolute top-full z-[70] mt-2 max-h-72 min-w-full overflow-y-auto rounded-xl border border-white/80 bg-white/90 p-1.5 text-slate-700 shadow-[0_18px_45px_-18px_rgba(8,47,73,0.45)] ring-1 ring-slate-900/8 backdrop-blur-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none ${
                  active ? "bg-sky-50 font-semibold text-[#0875d1]" : "font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50"
                }`}
              >
                <span>{option.label}</span>
                {active && <Check size={15} aria-hidden="true" className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
