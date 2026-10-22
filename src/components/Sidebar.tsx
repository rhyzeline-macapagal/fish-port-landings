"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleParking,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import type { Role } from "@/lib/api";
import { TENANT_GROUPS } from "@/lib/tenant-groups";

const NAV: { href: string; label: string; short: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: ["admin", "encoder", "viewer"] },
  { href: "/landings", label: "Landings", short: "Landings", icon: ClipboardList, roles: ["admin", "encoder"] },
  { href: "/parking", label: "Parking Collection", short: "Parking", icon: CircleParking, roles: ["admin", "encoder", "viewer"] },
  { href: "/dashboard/tenants", label: "FishPort Tenants", short: "Tenants", icon: Store, roles: ["admin", "encoder", "viewer"] },
];

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-0.5 ring-2 ring-white/20">
        <Image
          src="/fishport_1.jpg"
          alt="Mercedes FishPort logo"
          width={40}
          height={40}
          priority
          className="h-full w-full rounded-full object-contain"
        />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block text-[11px] font-semibold tracking-[0.16em] text-slate-200">MERCEDES</span>
        <span className="mt-1 block text-[15px] font-extrabold tracking-wide text-white">FISHPORT</span>
        <span className="mt-1 block text-[8px] font-medium tracking-[0.12em] text-slate-400">MANAGEMENT SYSTEM</span>
      </span>
    </Link>
  );
}

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onMobileOpen: () => void;
};

export default function Sidebar({ mobileOpen, onMobileClose, onMobileOpen }: SidebarProps) {
  const { user, logout } = useAuth();
  const { openNewEntry } = useEntryModal();
  const pathname = usePathname();
  const [tenantsOpen, setTenantsOpen] = useState(pathname.startsWith("/dashboard/tenants"));

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
  const tenantsActive = pathname.startsWith("/dashboard/tenants");

  function handleNewEntry() {
    onMobileClose();
    openNewEntry();
  }

  function renderSidebarPanel(drawer = false) {
    const tenantMenuId = drawer ? "tenant-groups-drawer" : "tenant-groups-sidebar";

    return (
      <div className="flex h-full min-h-0 flex-col bg-[#12344d] text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <Logo />
          {drawer && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <X size={19} />
            </button>
          )}
        </div>

        <nav aria-label={drawer ? "Menu navigation" : "Main navigation"} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Main menu</p>
          <div className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              if (href === "/dashboard/tenants") {
                return (
                  <div key={href}>
                    <button
                      type="button"
                      onClick={() => setTenantsOpen((open) => !open)}
                      aria-expanded={tenantsOpen}
                      aria-controls={tenantMenuId}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                        active ? "bg-[#0875d1] text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <Icon size={17} />
                      <span className="flex-1">{label}</span>
                      <ChevronDown size={14} className={`transition-transform ${tenantsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {tenantsOpen && (
                      <div id={tenantMenuId} className="ml-4 mt-1 max-h-72 space-y-0.5 overflow-y-auto border-l border-white/15 py-1 pl-3">
                        {TENANT_GROUPS.map((group) => {
                          const groupHref = `/dashboard/tenants/${group.slug}`;
                          const groupActive = pathname === groupHref;
                          return (
                            <Link
                              key={group.slug}
                              href={groupHref}
                              onClick={onMobileClose}
                              title={group.label}
                              className={`block rounded-md px-2.5 py-2 text-[11px] leading-snug transition-colors ${
                                groupActive ? "bg-sky-500/20 font-medium text-sky-100" : "text-slate-400 hover:bg-white/8 hover:text-white"
                              }`}
                            >
                              {group.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-[#0875d1] text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          {canAdd && (
            <button
              type="button"
              onClick={handleNewEntry}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0875d1] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a8cc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <Plus size={16} /> New Entry
            </button>
          )}

          <div className="flex items-center gap-3 rounded-lg bg-[#0e2b40] p-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-[#12344d]">
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-semibold text-white">{userFullName}</span>
              <span className="mt-1 block text-[10px] capitalize text-slate-400">{userRole}</span>
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15.5rem] border-r border-[#0b263a] lg:block">
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
          className={`absolute inset-0 bg-slate-950/45 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          aria-label="Navigation drawer"
          className={`absolute inset-y-0 left-0 w-[min(21rem,88vw)] shadow-2xl transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {renderSidebarPanel(true)}
        </aside>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_10px_35px_rgba(18,52,77,0.18)] md:hidden"
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
