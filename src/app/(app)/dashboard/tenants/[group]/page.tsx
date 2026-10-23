import { notFound } from "next/navigation";
import TenantGroupPage from "@/components/TenantGroupPage";
import { TENANT_GROUPS, tenantGroupBySlug } from "@/lib/tenant-groups";

export const instant = false;

export function generateStaticParams() {
  return TENANT_GROUPS.map(({ slug }) => ({ group: slug }));
}

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const group = tenantGroupBySlug(slug);
  if (!group) notFound();
  return <TenantGroupPage key={group.category} group={group} />;
}
