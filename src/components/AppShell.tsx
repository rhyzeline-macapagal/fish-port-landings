"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.11),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_28%),linear-gradient(135deg,#f8fbff_0%,#eef5fb_52%,#f8fbff_100%)] text-[#14263d]">
      <Sidebar
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />
      <div
        className={`min-h-screen transition-[padding] duration-300 ease-out motion-reduce:transition-none ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-[15.5rem]"
        }`}
      >
        <AppHeader onMenuOpen={() => setMobileOpen(true)} />
        <main className="pb-24 md:pb-6">
          <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-5 lg:p-6 xl:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
