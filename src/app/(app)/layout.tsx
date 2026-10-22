"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { EntryModalProvider } from "@/context/EntryModalContext";
import AppShell from "@/components/AppShell";

// Pages a viewer is allowed to open
const viewerCanOpen = (pathname: string) =>
  pathname === "/dashboard" || pathname === "/parking" || pathname.startsWith("/dashboard/tenants");

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Viewer can only see the dashboard and the tenants list
  const blocked = user?.role === "viewer" && !viewerCanOpen(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (blocked) router.replace("/dashboard");
  }, [loading, user, blocked, router]);

  if (loading || !user || blocked) {
    return <div className="grid min-h-screen place-items-center bg-[#f5f8fc] text-sm font-medium text-slate-600">Loading...</div>;
  }

  return (
    <EntryModalProvider>
      <AppShell>{children}</AppShell>
    </EntryModalProvider>
  );
}
