"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type IdentifierMode = "email" | "phone";
type AuthMode = "login" | "signup";
type Step = "credentials" | "primary-otp" | "secondary-contact" | "secondary-otp";

function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

function validPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifierMode, setIdentifierMode] = useState<IdentifierMode>("email");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const primaryValue = identifierMode === "email" ? email : phone;
  const secondaryMode: IdentifierMode = identifierMode === "email" ? "phone" : "email";
  const secondaryValue = secondaryMode === "email" ? email : phone;

  function resetFlow(nextMode: AuthMode, nextIdentifier = identifierMode) {
    setMode(nextMode);
    setIdentifierMode(nextIdentifier);
    setStep("credentials");
    setOtp("");
    setError(null);
    setMessage(null);
  }

  async function sendPrimaryOtp() {
    const supabase = createClient();

    if (mode === "signup" && !fullName.trim()) {
      throw new Error("Enter your full name.");
    }

    if (identifierMode === "email") {
      if (!email.trim()) throw new Error("Enter your email address.");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: mode === "signup", data: mode === "signup" ? { full_name: fullName.trim() } : undefined },
      });
      if (authError) throw authError;
      setMessage(`We sent a one-time code to ${email.trim().toLowerCase()}.`);
    } else {
      if (!validPhone(phone)) throw new Error("Enter a valid phone number in international format, for example +919876543210.");
      const normalized = normalizePhone(phone);
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: { shouldCreateUser: mode === "signup", data: mode === "signup" ? { full_name: fullName.trim() } : undefined },
      });
      if (authError) throw authError;
      setPhone(normalized);
      setMessage(`We sent a one-time code to ${normalized}.`);
    }

    setStep("primary-otp");
  }

  async function verifyPrimaryOtp() {
    const supabase = createClient();
    const token = otp.trim();
    if (!/^\d{6,8}$/.test(token)) throw new Error("Enter the OTP you received.");

    if (identifierMode === "email") {
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (authError) throw authError;
    } else {
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token,
        type: "sms",
      });
      if (authError) throw authError;
    }

    if (mode === "login") {
      window.location.assign("/");
      return;
    }

    setOtp("");
    setStep("secondary-contact");
    setMessage(`Primary ${identifierMode} verified. Now add your ${secondaryMode} so the same account supports both login methods.`);
  }

  async function sendSecondaryOtp() {
    const supabase = createClient();

    if (secondaryMode === "phone") {
      if (!validPhone(phone)) throw new Error("Enter a valid phone number in international format, for example +919876543210.");
      const normalized = normalizePhone(phone);
      const { error: authError } = await supabase.auth.updateUser({ phone: normalized });
      if (authError) throw authError;
      setPhone(normalized);
      setMessage(`We sent a phone verification OTP to ${normalized}.`);
    } else {
      if (!email.trim()) throw new Error("Enter your email address.");
      const normalized = email.trim().toLowerCase();
      const { error: authError } = await supabase.auth.updateUser({ email: normalized });
      if (authError) throw authError;
      setEmail(normalized);
      setMessage(`We sent an email verification OTP to ${normalized}.`);
    }

    setStep("secondary-otp");
  }

  async function verifySecondaryOtp() {
    const supabase = createClient();
    const token = otp.trim();
    if (!/^\d{6,8}$/.test(token)) throw new Error("Enter the OTP you received.");

    if (secondaryMode === "phone") {
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token,
        type: "phone_change",
      });
      if (authError) throw authError;
    } else {
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email_change",
      });
      if (authError) throw authError;
    }

    window.location.assign("/");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (step === "credentials") await sendPrimaryOtp();
      else if (step === "primary-otp") await verifyPrimaryOtp();
      else if (step === "secondary-contact") await sendSecondaryOtp();
      else await verifySecondaryOtp();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    resetFlow(nextMode);
    setFullName("");
    setOtp("");
    setEmail("");
    setPhone("");
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
              {step === "credentials" ? "Choose one sign-in method. Only that contact is shown." : step === "primary-otp" ? "Enter the verification code we just sent." : step === "secondary-contact" ? `Add your ${secondaryMode} to enable both login methods.` : `Enter the verification code sent to your ${secondaryMode}.`}
            </p>
          </div>

          {step === "credentials" && (
            <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => { setIdentifierMode("email"); setError(null); setMessage(null); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${identifierMode === "email" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500"}`}>Email OTP</button>
              <button type="button" onClick={() => { setIdentifierMode("phone"); setError(null); setMessage(null); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${identifierMode === "phone" ? "bg-white text-sky-950 shadow-sm" : "text-slate-500"}`}>Phone OTP</button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {step === "credentials" && mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {step === "credentials" && identifierMode === "email" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email address</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="inspector@example.com" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {step === "credentials" && identifierMode === "phone" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Phone number</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" placeholder="+919876543210" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                <span className="mt-1 block text-xs text-slate-500">Use international format, e.g. +919876543210.</span>
              </label>
            )}

            {step === "primary-otp" && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                <p className="font-semibold">Primary verification</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{primaryValue}</p>
              </div>
            )}

            {step === "secondary-contact" && secondaryMode === "phone" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Phone number</span>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" placeholder="+919876543210" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {step === "secondary-contact" && secondaryMode === "email" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email address</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="inspector@example.com" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {step === "secondary-otp" && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                <p className="font-semibold">Second contact verification</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{secondaryValue}</p>
              </div>
            )}

            {(step === "primary-otp" || step === "secondary-otp") && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">One-time password</span>
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" autoFocus required placeholder="Enter OTP" className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
            {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60">
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {step === "credentials" ? (mode === "login" ? "Send OTP" : "Send registration OTP") : step === "primary-otp" ? "Verify OTP" : step === "secondary-contact" ? `Send ${secondaryMode === "email" ? "email" : "phone"} OTP` : "Verify and finish"}
            </button>

            {step !== "credentials" && (
              <button type="button" className="w-full text-center text-sm font-semibold text-sky-800 hover:text-sky-950" onClick={() => { setStep("credentials"); setOtp(""); setError(null); setMessage(null); }}>
                Back to sign in options
              </button>
            )}
          </form>

          {step === "credentials" && (
            <div className="mt-5 text-center text-sm text-slate-500">
              {mode === "login" ? "New to ComplyVision?" : "Already have an account?"}{" "}
              <button type="button" className="font-semibold text-sky-800 hover:text-sky-950" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">ComplyVision · SIH 2026 · PS26034</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
