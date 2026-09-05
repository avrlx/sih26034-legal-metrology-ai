"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next?.startsWith("/")) setRedirectPath(next);
    if (params.get("error") === "auth_callback_failed") {
      setError("Email verification could not be completed. Please try again.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        window.location.assign(redirectPath);
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
        },
      });

      if (authError) throw authError;

      if (data.session) {
        window.location.assign(redirectPath);
      } else {
        setMessage("Account created. Check your email to verify the account, then sign in.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50">
          <div className="mb-7 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-sky-950 text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight text-slate-950">ComplyVision</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Legal Metrology AI</p>
            <h1 className="mt-6 text-2xl font-semibold text-slate-950">
              {mode === "login" ? "Sign in to your workspace" : "Create your inspector account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Access inspections, compliance reports and persistent history.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
            {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500">
            {mode === "login" ? "New to ComplyVision?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-sky-800 hover:text-sky-950"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">ComplyVision · SIH 2026 · PS26034</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
