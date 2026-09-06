"use client";

import { WorkspaceShell } from "@/components/workspace-shell";

export function AnalysisWorkspace() {
  return (
    <>
      <style jsx global>{`
        .dark .bg-sky-50\\/60 { background-color: oklch(0.22 0.045 230) !important; }
        .dark .bg-sky-50\\/70 { background-color: oklch(0.22 0.045 230) !important; }
        .dark .bg-white\\/80 { background-color: color-mix(in oklab, var(--card) 80%, transparent) !important; }
        .dark .bg-white\\/90 { background-color: color-mix(in oklab, var(--card) 90%, transparent) !important; }
        .dark .bg-white\\/60 { background-color: color-mix(in oklab, var(--card) 60%, transparent) !important; }
        .dark .bg-slate-50\\/60 { background-color: oklch(0.22 0.028 235) !important; }
        .dark .bg-slate-50\\/80 { background-color: oklch(0.23 0.028 235) !important; }
        .dark [class~="text-white/70"], .dark [class~="text-white/80"], .dark [class~="text-white/90"] { color: oklch(0.94 0.012 225) !important; }
        .dark [class~="text-amber-950"], .dark [class~="text-amber-900/80"] { color: oklch(0.9 0.12 82) !important; }
        .dark [class~="text-rose-950"], .dark [class~="text-rose-900/80"] { color: oklch(0.9 0.1 20) !important; }
        .dark [class~="text-emerald-950"], .dark [class~="text-emerald-900/80"] { color: oklch(0.9 0.12 155) !important; }
        .dark [class~="text-sky-950"], .dark [class~="text-sky-900/80"] { color: oklch(0.9 0.09 215) !important; }
        .dark [class~="text-slate-950/80"], .dark [class~="text-slate-900/80"], .dark [class~="text-slate-800/80"], .dark [class~="text-slate-700/80"] { color: oklch(0.88 0.015 225) !important; }
        .dark main .bg-sky-50\\/60 { background-color: oklch(0.22 0.045 230) !important; color: oklch(0.93 0.012 225) !important; }
        .dark main .bg-sky-50\\/60 p { color: oklch(0.88 0.09 215) !important; }
        .dark main .bg-sky-50\\/60 p + p { color: oklch(0.78 0.02 225) !important; }
      `}</style>
      <WorkspaceShell />
    </>
  );
}
