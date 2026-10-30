"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, History, LogOut, Menu, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tenantGroupBySlug } from "@/lib/tenant-groups";
import { useEntryModal } from "@/context/EntryModalContext";
import { api } from "@/lib/api";

type DeletedHistoryRecord = {
  archive_id: number;
  deleted_by_name: string;
  deleted_at: string;
  expires_at: string;
  record: Record<string, unknown>;
};

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
  const { notifications, clearNotifications } = useEntryModal();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deletedRecord, setDeletedRecord] = useState<Record<string, unknown> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DeletedHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const accountMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logoutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogoutOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [logoutOpen]);

  useEffect(() => {
    if (!notificationsOpen && !logoutOpen) return;
    const closeMenus = (event: MouseEvent) => {
      if (!accountMenu.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setLogoutOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, [logoutOpen, notificationsOpen]);

  if (!user) return null;

  const pageLabel = getPageLabel(pathname);
  const initials = user.full_name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function openHistory() {
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      setHistory(await api<DeletedHistoryRecord[]>("landing_delete.php?history=1"));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-[9999] border-b border-sky-200/80 bg-[linear-gradient(105deg,#ffffff,#f4f9fd_58%,#eaf4fb)] text-[#14263d] shadow-[0_8px_24px_-18px_rgba(8,47,73,0.35)]">
      <div className="flex h-[4.75rem] items-center gap-3 px-4 sm:px-5 lg:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-200/80 bg-white text-[#0875d1] shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40 lg:hidden"
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

        <div ref={accountMenu} className="relative flex items-center gap-1.5 rounded-2xl border border-sky-200/80 bg-white/75 p-1.5 shadow-sm ring-1 ring-sky-100/70 sm:gap-2.5">
          <button type="button" onClick={() => { setNotificationsOpen((open) => !open); setLogoutOpen(false); }} aria-label="Notifications" aria-expanded={notificationsOpen} title="Notifications" className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40 ${notificationsOpen ? "bg-sky-100 text-[#0875d1] ring-1 ring-sky-300" : "text-slate-500 hover:bg-sky-50 hover:text-[#0875d1]"}`}>
            <Bell size={17} />
            {notifications.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-xs font-bold text-[#12344d] ring-1 ring-sky-200/70">
            {initials}
          </span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-40 truncate text-[13px] font-semibold text-[#14263d]">{user.full_name}</span>
            <span className="mt-0.5 block text-[10px] font-semibold capitalize text-[#0875d1]">{user.role}</span>
          </span>
          <button
            type="button"
            onClick={() => { setLogoutOpen(true); setNotificationsOpen(false); }}
            aria-label="Sign out"
            title="Sign out"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40 ${logoutOpen ? "bg-sky-100 text-[#0875d1] ring-1 ring-sky-300" : "text-slate-500 hover:bg-sky-50 hover:text-[#0875d1]"}`}
          >
            <LogOut size={17} />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-full z-[80] mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Notifications</h2><div className="flex items-center gap-3">{notifications.length > 0 && <button type="button" onClick={clearNotifications} className="text-xs font-medium text-sky-700 hover:underline">Clear</button>}<button type="button" onClick={openHistory} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-700"><History size={13} /> History</button></div></div>
              {notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p> : <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{notifications.map((notification) => <li key={notification.id} className="flex gap-3 px-4 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700"><Trash2 size={15} /></span><div><p className="text-sm font-medium text-slate-800">{notification.message}</p><p className="mt-0.5 text-xs text-slate-500">By {notification.actor}</p>{notification.archiveId && <button type="button" onClick={async () => { try { const result = await api<{ record: Record<string, unknown> }>(`landing_delete.php?archive_id=${notification.archiveId}`); setDeletedRecord(result.record); } catch { setDeletedRecord(null); } }} className="mt-1 text-xs font-semibold text-sky-700 hover:underline">View deleted record</button>}</div></li>)}</ul>}
            </div>
          )}
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
      {deletedRecord && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setDeletedRecord(null)}>
          <div role="dialog" aria-modal="true" className="my-auto w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Deleted record</h2><p className="mt-1 text-xs text-slate-500">Available for 5 days after deletion.</p></div><button type="button" onClick={() => setDeletedRecord(null)} aria-label="Close deleted record" className="text-slate-500">×</button></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm"><div><dt className="text-xs text-slate-500">Date</dt><dd className="font-medium">{String(deletedRecord.landing_date ?? "-")}</dd></div><div><dt className="text-xs text-slate-500">Supplier</dt><dd className="font-medium">{String(deletedRecord.boat_name ?? "-")}</dd></div><div><dt className="text-xs text-slate-500">Species</dt><dd className="font-medium">{String(deletedRecord.species ?? "-")}</dd></div><div><dt className="text-xs text-slate-500">Volume</dt><dd className="font-medium">{String(deletedRecord.volume ?? "-")} {String(deletedRecord.unit ?? "")}</dd></div></dl>
          </div>
        </div>,
        document.body,
      )}
      {historyOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setHistoryOpen(false)}>
          <div role="dialog" aria-modal="true" className="my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-900">Deleted record history</h2><p className="mt-1 text-xs text-slate-500">Records remain available for 5 days, then are permanently removed.</p></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history" className="text-slate-500">×</button></div>
            {historyLoading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading history...</p> : history.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No deleted records in the last 5 days.</p> : <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">{history.map((item) => <li key={item.archive_id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{String(item.record.boat_name ?? item.record.species ?? "Deleted landing")}</p><p className="mt-1 text-xs text-slate-500">Deleted by {item.deleted_by_name} · Expires {new Date(item.expires_at).toLocaleDateString()}</p></div><button type="button" onClick={() => { setDeletedRecord(item.record); setHistoryOpen(false); }} className="shrink-0 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100">View record</button></li>)}</ul>}
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
