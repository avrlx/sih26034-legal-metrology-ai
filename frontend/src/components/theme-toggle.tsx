"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "complyvision-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", nextDark);
    setDark(nextDark);
    setMounted(true);
  }, []);

  function toggle() {
    const nextDark = !dark;
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    setDark(nextDark);
  }

  if (!mounted) {
    return <div className="size-10" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
