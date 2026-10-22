"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { ghostBtn } from "@/components/ui";

export type ExportKind = "xlsx" | "pdf";

const glassBtn =
  "inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50";

const item =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-slate-50";

export default function ExportMenu({
  onExport,
  disabled,
  title = "Export",
  variant = "light",
  up = false,
}: {
  onExport: (kind: ExportKind) => Promise<void> | void;
  disabled?: boolean;
  title?: string;
  variant?: "light" | "glass"; // glass = for the dark dashboard hero
  up?: boolean;                // open the menu upwards (inside overflow-hidden areas)
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
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        className={variant === "glass" ? glassBtn : `${ghostBtn} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {busy ? "Preparing..." : "Export"}
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 w-56 rounded-xl bg-white p-1.5 text-slate-700 shadow-xl ring-1 ring-slate-900/10 ${
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
        </div>
      )}
    </div>
  );
}