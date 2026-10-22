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