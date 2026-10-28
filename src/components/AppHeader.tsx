"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tenantGroupBySlug } from "@/lib/tenant-groups";

function getPageLabel(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/landings") return "Fish Landings";
  if (pathname === "/parking") return "Parking Collection";
  if (pathname === "/dashboard/tenants") return "FishPort Tenants";
  if (pathname === "/species") return "Species";
  if (pathname.startsWith("/dashboard/tenants/")) {
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return tenantGroupBySlug(slug)?.label ?? "Tenant Records";
  }
  return "Mercedes FishPort";
}

export default function AppHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!logoutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogoutOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [logoutOpen]);

  if (!user) return null;

  const pageLabel = getPageLabel(pathname);
  const initials = user.full_name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-sky-200/60 bg-[linear-gradient(105deg,rgba(255,255,255,0.91),rgba(239,248,255,0.84),rgba(224,242,254,0.78))] shadow-[0_10px_35px_-28px_rgba(8,74,120,0.75)] backdrop-blur-2xl">
      <div className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-5 lg:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-200/80 bg-white/65 text-[#0875d1] shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40 lg:hidden"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#0875d1] sm:text-xs">
            Mercedes FishPort <span className="mx-1.5 text-sky-300">/</span>
            <span className="font-semibold tracking-normal text-slate-500">{pageLabel}</span>
          </p>
          <h1 className="mt-1 truncate text-base font-bold tracking-[-0.02em] text-[#102b43] sm:text-lg">{pageLabel}</h1>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/50 p-1.5 shadow-[0_8px_24px_-20px_rgba(8,74,120,0.8)] ring-1 ring-sky-100/60 backdrop-blur-xl sm:gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#dff4ff,#b9e6fb)] text-xs font-bold text-[#0d567f] shadow-sm ring-1 ring-sky-200/70">
            {initials}
          </span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-40 truncate text-[13px] font-semibold text-[#14263d]">{user.full_name}</span>
            <span className="mt-0.5 block text-[10px] font-semibold capitalize text-[#0875d1]">{user.role}</span>
          </span>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0875d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>

      {logoutOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="logout-confirmation-title"
          aria-describedby="logout-confirmation-description"
          className="animate-dropdown fixed inset-x-4 top-20 z-[80] ml-auto w-auto max-w-sm rounded-2xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_22px_55px_-20px_rgba(8,47,73,0.5)] ring-1 ring-slate-900/10 backdrop-blur-2xl sm:right-5 sm:left-auto sm:w-full"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <AlertTriangle size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="logout-confirmation-title" className="font-semibold text-slate-900">Log out of FishPort?</h2>
              <p id="logout-confirmation-description" className="mt-1 text-sm leading-5 text-slate-600">
                Are you sure you want to end your current session?
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setLogoutOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => {
                setLogoutOpen(false);
                logout();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
