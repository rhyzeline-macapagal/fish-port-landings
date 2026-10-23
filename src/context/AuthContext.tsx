"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsViewer: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem("user");
        if (raw && localStorage.getItem("token")) setUser(JSON.parse(raw));
      } catch {}
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function saveSession(res: { token: string; user: User }) {
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
  }

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>("login.php", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(res);
  }

  async function loginAsViewer() {
    const res = await api<{ token: string; user: User }>("guest.php", {
      method: "POST",
    });
    saveSession(res);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, loginAsViewer, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
