"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, UserCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function AuthUserMenu() {
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadIdentity(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
      if (!user) {
        setFullName(null);
        setEmail(null);
        return;
      }

      setEmail(user.email ?? null);

      const metadataName = typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        const profileName = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
        setFullName(profileName || metadataName || user.email || null);
      } catch {
        setFullName(metadataName || user.email || null);
      }
    }

    supabase.auth.getUser().then(({ data }) => void loadIdentity(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadIdentity(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!fullName && !email) return null;

  const displayName = fullName || email || "Account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <UserCircle2 className="size-5 text-sky-900" />
        <span className="hidden max-w-40 truncate text-xs font-medium text-slate-700 sm:block">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Inspector account</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{displayName}</p>
            {email && <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>}
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="mb-1 block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Account & profile
          </Link>
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
