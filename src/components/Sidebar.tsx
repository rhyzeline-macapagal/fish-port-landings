"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Plus, LogOut, Store, CircleParking, ChevronDown, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEntryModal } from "@/context/EntryModalContext";
import type { Role } from "@/lib/api";
import { TENANT_GROUPS } from "@/lib/tenant-groups";

const NAV: { href: string; label: string; short: string; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, roles: ["admin", "encoder", "viewer"] },
  { href: "/landings", label: "Landings", short: "Landings", icon: ClipboardList, roles: ["admin", "encoder"] },
  { href: "/parking", label: "Parking Collection", short: "Parking", icon: CircleParking, roles: ["admin", "encoder", "viewer"] },
  { href: "/dashboard/tenants", label: "Fishport Tenants", short: "Tenants", icon: Store, roles: ["admin", "encoder", "viewer"] },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1">
        <Image
          src="/fishport_1.jpg"
          alt="Mercedes Fish Port logo"
          width={44}
          height={44}
          priority
          className="h-full w-full object-contain"
        />
      </div>
      <div className="leading-tight">
        <p className="font-semibold text-white">Mercedes Fish Port</p>
        <p className="text-xs text-slate-300">Landing Statistics</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { openNewEntry } = useEntryModal();
  const pathname = usePathname();
  const [tenantsOpen, setTenantsOpen] = useState(pathname.startsWith("/dashboard/tenants"));
  if (!user) return null;

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const canAdd = user.role !== "viewer" && pathname !== "/parking" && !pathname.startsWith("/dashboard/tenants");
  const initials = user.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const mobileItem = "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium transition";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-dark fixed inset-y-0 left-0 z-20 hidden w-64 flex-col rounded-none border-0 border-r border-white/10 lg:flex">
        <div className="px-5 py-6">
          <Logo />
        </div>

        {canAdd && (
          <div className="px-4">
            <button
              onClick={openNewEntry}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1a8cc7] py-2.5 text-sm font-medium text-white transition hover:bg-[#2299d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
            >
              <Plus size={16} /> New entry
            </button>
          </div>
        )}

        <nav className="mt-5 flex-1 space-y-1 px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            if (href === "/dashboard/tenants") return (
              <div key={href}>
                <button
                  type="button"
                  onClick={() => setTenantsOpen((open) => !open)}
                  aria-expanded={tenantsOpen}
                  aria-controls="tenant-groups-menu"
                  className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-left text-sm font-medium transition ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} className={active ? "text-sky-300" : ""} />
                  <span className="flex-1">{label}</span>
                  <ChevronDown size={15} className={`transition ${tenantsOpen ? "rotate-180" : ""}`} />
                </button>
                {tenantsOpen && <div id="tenant-groups-menu" className="mt-1 max-h-[42vh] space-y-0.5 overflow-y-auto border-l border-white/15 pl-3">
                  {TENANT_GROUPS.map((group) => {
                    const groupHref = `/dashboard/tenants/${group.slug}`;
                    const groupActive = pathname === groupHref;
                    return <Link key={group.slug} href={groupHref} title={group.label} className={`block rounded-md px-3 py-2 text-xs leading-snug transition ${groupActive ? "bg-sky-500/20 text-sky-100" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}>{group.label}</Link>;
                  })}
                </div>}
              </div>
            );
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition ${
                  active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} className={active ? "text-sky-300" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 flex items-center gap-3 rounded-md bg-white/10 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/15 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="text-xs capitalize text-slate-300">{user.role}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded-md p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Mobile floating bottom nav */}
      <nav
        aria-label="Main navigation"
        className="glass-dark fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-xl p-1.5 lg:hidden"
      >
        {items.map(({ href, short, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`${mobileItem} ${
                active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={20} className={active ? "text-sky-300" : ""} />
              <span className="max-w-full truncate">{short}</span>
            </Link>
          );
        })}

        {canAdd && (
          <button
            onClick={openNewEntry}
            aria-label="New entry"
            className={`${mobileItem} bg-[#1a8cc7] text-white hover:bg-[#2299d6]`}
          >
            <Plus size={20} />
            <span>New</span>
          </button>
        )}

        <button
          onClick={logout}
          aria-label="Sign out"
          className={`${mobileItem} text-slate-300 hover:bg-white/10 hover:text-white`}
        >
          <LogOut size={20} />
          <span>Sign out</span>
        </button>
      </nav>
    </>
  );
}
