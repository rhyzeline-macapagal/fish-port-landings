"use client";

import dynamic from "next/dynamic";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

const NewLandingModal = dynamic(() => import("@/components/NewLandingModal"), {
  loading: () => (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2233]/55 p-4" role="status" aria-live="polite">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-xl">
        Loading landing form…
      </div>
    </div>
  ),
});

interface Ctx {
  openNewEntry: () => void;
  version: number; // increases after every saved entry so pages can reload
}

const C = createContext<Ctx | null>(null);

export function EntryModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const openNewEntry = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    setVersion((v) => v + 1);
    setToast("Landing recorded successfully.");
    window.setTimeout(() => setToast(""), 3500);
  }, []);
  const value = useMemo(() => ({ openNewEntry, version }), [openNewEntry, version]);

  return (
    <C.Provider value={value}>
      {children}
      {open && <NewLandingModal onClose={close} onSaved={saved} />}
      {toast && (
        <div className="fixed right-4 top-4 z-[70] animate-fade" role="status" aria-live="polite">
          <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </C.Provider>
  );
}

export function useEntryModal() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useEntryModal must be used inside EntryModalProvider");
  return ctx;
}
