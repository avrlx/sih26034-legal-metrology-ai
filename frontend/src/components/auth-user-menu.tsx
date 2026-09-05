"use client";

import { useEffect, useState } from "react";
import { LogOut, UserCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function AuthUserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!email) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <UserCircle2 className="size-5 text-sky-900" />
        <span className="hidden max-w-40 truncate text-xs font-medium text-slate-700 sm:block">{email}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Signed in as</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-800">{email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
