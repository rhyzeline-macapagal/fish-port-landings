"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  CircleParking,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import type { Role } from "@/lib/api";
import TenantNavigation from "@/components/TenantNavigation";

const NAV: { href: string; label: string; short: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: ["admin", "encoder", "viewer"] },
  { href: "/landings", label: "Landings", short: "Landings", icon: ClipboardList, roles: ["admin", "encoder"] },
  { href: "/parking", label: "Parking Collection", short: "Parking", icon: CircleParking, roles: ["admin", "encoder", "viewer"] },
  { href: "/dashboard/tenants", label: "FishPort Tenants", short: "Tenants", icon: Store, roles: ["admin", "encoder", "viewer"] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label={compact ? "Mercedes FishPort dashboard" : undefined}
      title={compact ? "Mercedes FishPort" : undefined}
      className={`flex min-w-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
        compact ? "justify-center" : "gap-3"
      }`}
    >
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/25 shadow-[0_5px_18px_rgba(1,16,29,0.28)]">
        <Image src="/fishport_1.jpg" alt="" fill sizes="44px" priority className="object-cover" />
      </span>
      {!compact && (
        <span className="min-w-0 overflow-hidden leading-none">
          <span className="block whitespace-nowrap text-[10px] font-semibold tracking-[0.15em] text-sky-100/85">MERCEDES</span>
          <span className="mt-1 block whitespace-nowrap text-[15px] font-extrabold tracking-wide text-white">FISHPORT</span>
          <span className="mt-1 block whitespace-nowrap text-[7px] font-medium tracking-[0.1em] text-slate-300">MANAGEMENT SYSTEM</span>
        </span>
      )}
    </Link>
  );
}

type SidebarProps = {
  mobileOpen: boolean;
  collapsed: boolean;
  onMobileClose: () => void;
  onMobileOpen: () => void;
  onToggleCollapse: () => void;
};

export default function Sidebar({ mobileOpen, collapsed, onMobileClose, onMobileOpen, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const { openNewEntry } = useEntryModal();
  const pathname = usePathname();
  const tenantsActive = pathname.startsWith("/dashboard/tenants");

  useEffect(() => {
    if (!mobileOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  if (!user) return null;

  const userFullName = user.full_name;
  const userRole = user.role;
  const items = NAV.filter((item) => item.roles.includes(user.role));
  const canAdd = user.role !== "viewer" && pathname !== "/parking" && !pathname.startsWith("/dashboard/tenants");
  const initials = user.full_name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const mobileItems = items.filter((item) => item.href !== "/dashboard/tenants");

  function handleNewEntry() {
    onMobileClose();
    openNewEntry();
  }

  function renderSidebarPanel(drawer = false) {
    const compact = !drawer && collapsed;
    const tenantMenuId = drawer ? "tenant-groups-drawer" : "tenant-groups-sidebar";

    return (
      <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(165deg,rgba(20,65,94,0.98)_0%,rgba(14,50,75,0.98)_48%,rgba(8,31,48,0.99)_100%)] text-white backdrop-blur-xl">
        <div className={`relative flex min-h-[5.25rem] items-center border-b border-white/10 ${compact ? "justify-center px-3" : "px-5"}`}>
          <Logo compact={compact} />
          {drawer && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation"
              className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 motion-reduce:transition-none"
            >
              <X size={19} />
            </button>
          )}
          {!drawer && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute -right-3 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-slate-200/80 bg-white text-[#12344d] shadow-md transition-[color,background-color,transform] duration-200 hover:scale-105 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          )}
        </div>

        <nav
          aria-label={drawer ? "Menu navigation" : "Main navigation"}
          className={`scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 ${compact ? "px-2" : "px-3"}`}
        >
          <p className={compact ? "sr-only" : "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/55"}>Main menu</p>
          <div className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const isTenants = href === "/dashboard/tenants";
              return (
                <div key={href}>
                  <Link
                    href={href}
                    onClick={drawer ? onMobileClose : undefined}
                    aria-current={active ? "page" : undefined}
                    aria-label={compact ? label : undefined}
                    title={compact ? label : undefined}
                    className={`flex items-center rounded-xl py-3 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-150 motion-reduce:transition-none ${
                      compact ? "justify-center px-2" : "gap-3 px-3"
                    } ${active ? "bg-[linear-gradient(135deg,rgba(14,165,233,0.96),rgba(8,117,209,0.92))] text-white shadow-[0_8px_20px_-12px_rgba(14,165,233,0.9)] ring-1 ring-inset ring-white/15" : "text-slate-100 hover:bg-white/10 hover:text-white"}`}
                  >
                    <Icon size={20} className="shrink-0" />
                    {!compact && <span className="min-w-0 flex-1 truncate">{label}</span>}
                  </Link>

                  {isTenants && !compact && (
                    <div className="ml-3 mt-2 border-l border-white/15 pl-1.5">
                      <TenantNavigation
                        id={tenantMenuId}
                        pathname={pathname}
                        mobile={drawer}
                        onNavigate={drawer ? onMobileClose : undefined}
                        onEscape={drawer ? onMobileClose : () => undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={`space-y-3 border-t border-white/10 ${compact ? "p-2" : "p-3"}`}>
          {canAdd && (
            <button
              type="button"
              onClick={handleNewEntry}
              aria-label={compact ? "New entry" : undefined}
              title={compact ? "New entry" : undefined}
              className={`flex w-full items-center justify-center rounded-lg bg-[#0875d1] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a8cc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${compact ? "px-2" : "gap-2 px-3"}`}
            >
              <Plus size={17} /> {!compact && "New Entry"}
            </button>
          )}

          <div
            title={compact ? `${userFullName} · ${userRole}` : undefined}
            className={`flex items-center rounded-lg bg-slate-950/20 ring-1 ring-inset ring-white/5 ${compact ? "justify-center p-2" : "gap-3 p-2.5"}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-[#12344d]">
              {initials}
            </span>
            {!compact && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-semibold text-white">{userFullName}</span>
                <span className="mt-1 block text-[11px] capitalize text-slate-300">{userRole}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#0b263a]/80 shadow-[10px_0_35px_-28px_rgba(8,30,50,0.7)] transition-[width] duration-300 ease-out motion-reduce:transition-none lg:block ${
          collapsed ? "w-20" : "w-[15.5rem]"
        }`}
      >
        {renderSidebarPanel()}
      </aside>

      <div
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onMobileClose}
          className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          aria-label="Navigation drawer"
          className={`absolute inset-y-0 left-0 w-[min(21rem,88vw)] shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {renderSidebarPanel(true)}
        </aside>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-xl border border-white/70 bg-white/80 p-1.5 shadow-[0_10px_35px_rgba(18,52,77,0.18)] backdrop-blur-xl md:hidden"
      >
        {mobileItems.map(({ href, short, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                active ? "bg-sky-50 text-[#0875d1]" : "text-slate-500 hover:bg-slate-50 hover:text-[#12344d]"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span className="max-w-full truncate">{short}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMobileOpen}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors ${
            tenantsActive ? "bg-sky-50 text-[#0875d1]" : "text-slate-500 hover:bg-slate-50 hover:text-[#12344d]"
          }`}
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
