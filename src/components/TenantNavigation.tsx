"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import { TENANT_GROUP_SECTIONS } from "@/lib/tenant-groups";

type TenantNavigationProps = {
  id: string;
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
  onEscape: () => void;
};

export default function TenantNavigation({
  id,
  pathname,
  mobile = false,
  onNavigate,
  onEscape,
}: TenantNavigationProps) {
  const [search, setSearch] = useState("");
  const sections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return TENANT_GROUP_SECTIONS;
    const terms = query.split(/\s+/);

    return TENANT_GROUP_SECTIONS.map((section) => ({
      ...section,
      groups: section.groups.filter((group) => {
        const searchableName = `${group.label} ${group.navLabel}`.toLocaleLowerCase();
        return terms.every((term) => searchableName.includes(term));
      }),
    })).filter((section) => section.groups.length > 0);
  }, [search]);

  return (
    <div id={id} className={mobile ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className="relative mx-2 mb-3">
        <Search
          aria-hidden="true"
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (search) setSearch("");
            else onEscape();
          }}
          aria-label="Search tenant groups"
          placeholder="Search tenant groups..."
          className="h-9 w-full rounded-lg border border-white/15 bg-[#0e2b40] pl-9 pr-3 text-xs text-white outline-none transition-colors duration-150 placeholder:text-slate-500 hover:border-white/25 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 motion-reduce:transition-none"
        />
      </div>

      <div
        className={`${mobile ? "min-h-0 flex-1" : "max-h-[23rem]"} overflow-y-auto overscroll-contain px-2 pb-2`}
        aria-live="polite"
      >
        {sections.length === 0 ? (
          <div className="mx-1 rounded-lg border border-dashed border-white/15 px-3 py-6 text-center">
            <Store aria-hidden="true" size={18} className="mx-auto text-slate-500" />
            <p className="mt-2 text-xs font-medium text-slate-300">No tenant groups found</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Try a category name such as fish, vessel, or ice.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`${id}-${section.id}`}>
                <h3
                  id={`${id}-${section.id}`}
                  className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  {section.label}
                </h3>
                <div className="space-y-0.5">
                  {section.groups.map((group) => {
                    const href = `/dashboard/tenants/${group.slug}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={group.slug}
                        href={href}
                        onClick={onNavigate}
                        aria-label={group.label}
                        aria-current={active ? "page" : undefined}
                        title={group.label}
                        className={`group flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-snug outline-none transition-colors duration-150 motion-reduce:transition-none ${
                          active
                            ? "bg-sky-500/20 font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/20"
                            : "text-slate-300 hover:bg-white/8 hover:text-white focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-300"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-sky-300" : "bg-slate-600 group-hover:bg-slate-400"}`}
                        />
                        <span>{mobile ? group.label : group.navLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
