"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import NewLandingModal from "@/components/NewLandingModal";

interface Ctx {
  openNewEntry: () => void;
  version: number; // increases after every saved entry so pages can reload
}

const C = createContext<Ctx | null>(null);

export function EntryModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const openNewEntry = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    setVersion((v) => v + 1);
  }, []);

  return (
    <C.Provider value={{ openNewEntry, version }}>
      {children}
      {open && <NewLandingModal onClose={close} onSaved={saved} />}
    </C.Provider>
  );
}

export function useEntryModal() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useEntryModal must be used inside EntryModalProvider");
  return ctx;
}