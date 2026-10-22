"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-[#14263d]">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="min-h-screen lg:pl-[15.5rem]">
        <AppHeader onMenuOpen={() => setMobileOpen(true)} />
        <main className="pb-24 md:pb-6">
          <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-5 lg:p-6 xl:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
