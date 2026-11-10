"use client";

import { Fish } from "lucide-react";

type FishLoaderProps = {
  compact?: boolean;
  overlay?: boolean;
  label?: string;
};

export default function FishLoader({ compact = false, overlay = false, label = "Loading FishPort data" }: FishLoaderProps) {
  if (compact) {
    return (
      <div className="fish-loader-inline" role="status" aria-live="polite">
        <span className="fish-loader-icon fish-loader-icon-sm">
          <Fish size={18} strokeWidth={2.2} />
        </span>
        <span>{label}</span>
        <span className="fish-loader-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    );
  }

  return (
    <main className={`fish-loader-screen${overlay ? " fish-loader-overlay" : ""}`} role="status" aria-live="polite" aria-label={label}>
      <div className="fish-loader-card">
        <div className="fish-loader-water" aria-hidden="true">
          <span className="fish-loader-bubble fish-loader-bubble-one" />
          <span className="fish-loader-bubble fish-loader-bubble-two" />
          <span className="fish-loader-bubble fish-loader-bubble-three" />
          <span className="fish-loader-wave fish-loader-wave-one" />
          <span className="fish-loader-wave fish-loader-wave-two" />
          <span className="fish-loader-icon">
            <Fish size={42} strokeWidth={1.8} />
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Mercedes FishPort</p>
        <p className="mt-2 text-lg font-bold text-[#14263d]">{label}</p>
        <div className="fish-loader-progress mt-5" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
