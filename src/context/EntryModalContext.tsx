"use client";

import dynamic from "next/dynamic";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type AppNotification = { id: number; message: string; actor: string; at: number; archiveId?: number };

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
  showToast: (message: string) => void;
  addNotification: (message: string, archiveId?: number, actor?: string) => void;
  notifications: AppNotification[];
  clearNotifications: () => void;
}

const C = createContext<Ctx | null>(null);

export function EntryModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const openNewEntry = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }, []);
  const addNotification = useCallback((message: string, archiveId?: number, actorName?: string) => {
    const now = Date.now();
    let actor = actorName || "Current user";
    if (!actorName) {
      try { actor = JSON.parse(localStorage.getItem("user") ?? "{}").full_name || actor; } catch {}
    }
    setNotifications((current) => [{ id: now, message, actor, at: now, archiveId }, ...current].slice(0, 20));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const saved = useCallback(() => {
    setOpen(false);
    setVersion((v) => v + 1);
    showToast("New record added!");
    addNotification("New landing record added");
  }, [addNotification, showToast]);
  const value = useMemo(() => ({ openNewEntry, version, showToast, addNotification, notifications, clearNotifications }), [addNotification, clearNotifications, notifications, openNewEntry, showToast, version]);

  return (
    <C.Provider value={value}>
      {children}
      {open && <NewLandingModal onClose={close} onSaved={saved} />}
      {toast && (
        <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center p-4 animate-fade" role="status" aria-live="polite">
          <div className="rounded-2xl border border-emerald-200 bg-white px-8 py-5 text-lg font-bold text-emerald-700 shadow-2xl">
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
