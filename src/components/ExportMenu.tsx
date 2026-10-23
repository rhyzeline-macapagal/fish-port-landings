"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, SlidersHorizontal } from "lucide-react";

export type ExportKind = "xlsx" | "pdf";

const glassBtn =
  "inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50";

const item =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none";

export default function ExportMenu({
  onExport,
  disabled,
  title = "Export",
  variant = "light",
  up = false,
  onMoreOptions,
  moreOptionsLabel = "More export options",
}: {
  onExport: (kind: ExportKind) => Promise<void> | void;
  disabled?: boolean;
  title?: string;
  variant?: "light" | "glass"; // glass = for the dark dashboard hero
  up?: boolean;                // open the menu upwards (inside overflow-hidden areas)
  onMoreOptions?: () => void;
  moreOptionsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(kind: ExportKind) {
    setOpen(false);
    setBusy(true);
    try {
      await onExport(kind);
    } catch (e) {
      console.error(e);
      window.alert("Could not create the file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className={`relative ${open ? "z-50" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className={variant === "glass" ? glassBtn : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white/85 px-4 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-[border-color,background-color,box-shadow] hover:border-sky-200 hover:bg-white focus:outline-none focus-visible:border-[#1a8cc7] focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/15 disabled:cursor-not-allowed disabled:opacity-50"}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {busy ? "Preparing..." : "Export"}
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180 text-[#0875d1]" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`animate-dropdown absolute right-0 z-[70] w-56 rounded-xl border border-white/80 bg-white/90 p-1.5 text-slate-700 shadow-[0_18px_45px_-18px_rgba(8,47,73,0.45)] ring-1 ring-slate-900/8 backdrop-blur-xl ${
            up ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <button role="menuitem" onClick={() => run("xlsx")} className={item}>
            <FileSpreadsheet size={18} className="text-emerald-600" />
            <span>
              <span className="block font-medium text-slate-900">Excel (.xlsx)</span>
              <span className="block text-xs text-slate-500">Formatted spreadsheet</span>
            </span>
          </button>
          <button role="menuitem" onClick={() => run("pdf")} className={item}>
            <FileText size={18} className="text-red-600" />
            <span>
              <span className="block font-medium text-slate-900">PDF</span>
              <span className="block text-xs text-slate-500">Print-ready report</span>
            </span>
          </button>
          {onMoreOptions && (
            <>
              <div className="my-1 border-t border-slate-200/80" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onMoreOptions();
                }}
                className={item}
              >
                <SlidersHorizontal size={18} className="text-sky-600" />
                <span>
                  <span className="block font-medium text-slate-900">{moreOptionsLabel}</span>
                  <span className="block text-xs text-slate-500">Choose year or date range</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
