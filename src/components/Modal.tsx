"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
      if (e.key === "Tab" && panel.current) {
        const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          e.preventDefault();
          panel.current.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [closeDisabled, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
      <div className="animate-fade absolute inset-0 bg-[#0b2233]/55" onClick={() => !closeDisabled && onClose()} />

      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-pop relative flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full min-w-0 ${maxWidthClassName} flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/92 shadow-[0_24px_80px_-12px_rgba(8,30,50,0.45)] backdrop-blur-xl outline-none sm:max-h-[calc(100dvh-3rem)]`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sky-100/80 bg-[linear-gradient(105deg,rgba(255,255,255,0.88),rgba(235,247,255,0.78))] px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-[#0875d1]">
                {icon}
              </div>
            )}
            <div className="min-w-0 break-words">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
