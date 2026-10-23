import Link from "next/link";
import { ChevronRight, Layers3, Store } from "lucide-react";
import { TENANT_GROUP_SECTIONS } from "@/lib/tenant-groups";

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[#12344d] p-6 text-white">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10"><Store size={22} /></span>
          <div>
            <h1 className="text-2xl font-semibold">FishPort Tenants</h1>
            <p className="mt-1 text-sm text-slate-300">Select a tenant group to manage its records.</p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        {TENANT_GROUP_SECTIONS.map((section) => (
          <section key={section.id} className="surface-glass overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-[#0875d1]">
                <Layers3 size={16} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[#14263d]">{section.label}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{section.groups.length} tenant groups</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 p-2">
              {section.groups.map((group) => (
                <Link
                  key={group.slug}
                  href={`/dashboard/tenants/${group.slug}`}
                  title={group.label}
                  className="group flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-sky-50 focus-visible:bg-sky-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a8cc7]/40 motion-reduce:transition-none"
                >
                  <span className="text-sm font-medium leading-snug text-slate-700 group-hover:text-sky-800">{group.label}</span>
                  <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-sky-600 motion-reduce:transition-none" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
