"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, login, loginAsViewer } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onViewer() {
    setError("");
    setBusy(true);
    try {
      await loginAsViewer();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open as viewer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0f6fa3] via-[#1a8cc7] to-[#35b4e8] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* decorative circles */}
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute bottom-40 right-16 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white p-2 shadow-lg">
            <Image
              src="/logo.png"
              alt="FishPort logo"
              width={44}
              height={44}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <span className="text-xl font-bold text-white">Mercedes Municipal Fish Port Management Office</span>
          
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-white">
            Fish port statistics, all in one place.
          </h2>
          <p className="mt-4 text-base text-white/80">
            Track landings, monitor trends, and manage your port data with
            clear, real-time insights.
          </p>
        </div>

        <p className="relative text-sm text-white/60">
          © {new Date().getFullYear()} FishPort Statistics
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="animate-pop w-full max-w-sm">
          {/* Logo (visible on mobile, too) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/logo.png"
              alt="FishPort logo"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="font-bold">FishPort</p>
              <p className="text-sm text-slate-500">Statistics</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to your account to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1a8cc7] focus:bg-white focus:ring-4 focus:ring-[#1a8cc7]/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1a8cc7] focus:bg-white focus:ring-4 focus:ring-[#1a8cc7]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a8cc7] py-3 text-sm font-semibold text-white shadow-lg shadow-[#1a8cc7]/25 transition hover:bg-[#157bb0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Viewer access */}
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={onViewer}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye size={16} />
            Open as viewer
          </button>
        </div>
      </div>
    </div>
  );
}