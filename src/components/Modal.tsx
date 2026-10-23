"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  maxWidthClassName = "max-w-5xl",
  closeDisabled = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  closeDisabled?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [closeDisabled, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-[#0b2233]/55" onClick={() => !closeDisabled && onClose()} />

      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-pop relative flex max-h-[94vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-t-2xl border border-white/80 bg-white/92 shadow-[0_24px_80px_-12px_rgba(8,30,50,0.45)] backdrop-blur-xl outline-none sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-sky-100/80 bg-[linear-gradient(105deg,rgba(255,255,255,0.88),rgba(235,247,255,0.78))] px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3.5">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-[#0875d1]">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
