import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { TENANT_GROUPS } from "@/lib/tenant-groups";

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TENANT_GROUPS.map((group) => (
          <Link
            key={group.slug}
            href={`/dashboard/tenants/${group.slug}`}
            className="group flex min-h-24 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <span className="font-medium leading-snug text-slate-800 group-hover:text-sky-800">{group.label}</span>
            <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-600" />
          </Link>
        ))}
      </section>
    </div>
  );
}
