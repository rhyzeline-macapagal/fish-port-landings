"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { EntryModalProvider } from "@/context/EntryModalContext";
import AppShell from "@/components/AppShell";
import FishLoader from "@/components/FishLoader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const blocked = false;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (blocked) router.replace("/dashboard");
  }, [loading, user, blocked, router]);

  if (loading || !user || blocked) {
    return <FishLoader />;
  }

  return (
    <EntryModalProvider>
      <AppShell>{children}</AppShell>
    </EntryModalProvider>
  );
}
