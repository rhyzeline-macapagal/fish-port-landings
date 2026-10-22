"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tenantGroupBySlug } from "@/lib/tenant-groups";

function getPageLabel(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/landings") return "Fish Landings";
  if (pathname === "/parking") return "Parking Collection";
  if (pathname === "/dashboard/tenants") return "FishPort Tenants";
  if (pathname.startsWith("/dashboard/tenants/")) {
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return tenantGroupBySlug(slug)?.label ?? "Tenant Records";
  }
  return "Mercedes FishPort";
}

export default function AppHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;

  const pageLabel = getPageLabel(pathname);
  const initials = user.full_name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-5 lg:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-[#12344d] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8cc7]/40 lg:hidden"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500">
            Mercedes FishPort <span className="mx-1 text-slate-300">/</span>
            <span className="text-slate-700">{pageLabel}</span>
          </p>
          <h1 className="mt-0.5 truncate text-sm font-semibold text-[#14263d] sm:text-base">{pageLabel}</h1>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-3 sm:gap-3 sm:pl-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-[#12344d]">
            {initials}
          </span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-40 truncate text-xs font-semibold text-[#14263d]">{user.full_name}</span>
            <span className="mt-0.5 block text-[10px] capitalize text-slate-500">{user.role}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
