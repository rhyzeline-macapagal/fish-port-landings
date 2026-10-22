"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { EntryModalProvider } from "@/context/EntryModalContext";
import Sidebar from "@/components/Sidebar";

// Pages a viewer is allowed to open
const VIEWER_PATHS = ["/dashboard", "/dashboard/tenants"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Viewer can only see the dashboard and the tenants list
  const blocked = user?.role === "viewer" && !VIEWER_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (blocked) router.replace("/dashboard");
  }, [loading, user, blocked, router]);

  if (loading || !user || blocked) {
    return <div className="grid min-h-screen place-items-center text-slate-100">Loading...</div>;
  }

  return (
    <EntryModalProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="pb-28 lg:pb-0 lg:pl-64">
          <div className="mx-auto max-w-6xl p-5 lg:p-10">{children}</div>
        </main>
      </div>
    </EntryModalProvider>
  );
}