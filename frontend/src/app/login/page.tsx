"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type IdentifierMode = "email" | "phone";
type AuthMode = "login" | "signup";
type Step = "credentials" | "primary-otp" | "secondary-otp";

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
  const [redirectPath, setRedirectPath] = useState("/");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const primaryPhone = normalizePhone(phone);

    if (identifierMode === "email" && !email.trim()) {
      throw new Error("Enter your email address.");
    }
    if (identifierMode === "phone" && !validPhone(phone)) {
      throw new Error("Enter a valid phone number in international format, for example +919876543210.");
    }

    if (mode === "signup") {
      if (!fullName.trim()) throw new Error("Enter your full name.");
      if (!email.trim()) throw new Error("Enter the email address that will be linked to this account.");
      if (!validPhone(phone)) throw new Error("Enter a valid phone number in international format, for example +919876543210.");
    }

    const options = mode === "signup"
      ? { shouldCreateUser: true, data: { full_name: fullName.trim() } }
      : { shouldCreateUser: false };

    if (identifierMode === "email") {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options,
      });
      if (authError) throw authError;
      setMessage(`We sent a one-time code to ${email.trim().toLowerCase()}.`);
    } else {
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: primaryPhone,
        options,
      });
      if (authError) throw authError;
      setMessage(`We sent a one-time code to ${primaryPhone}.`);
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
      window.location.assign(redirectPath);
      return;
    }

    const secondaryEmail = email.trim().toLowerCase();
    const secondaryPhone = normalizePhone(phone);

    if (identifierMode === "email") {
      const { error: linkError } = await supabase.auth.updateUser({ phone: secondaryPhone });
      if (linkError) throw linkError;
      setOtp("");
      setStep("secondary-otp");
      setMessage(`Account created. Now verify the phone number ${secondaryPhone}.`);
      return;
    }

    const { error: linkError } = await supabase.auth.updateUser({ email: secondaryEmail });
    if (linkError) throw linkError;
    setOtp("");
    setStep("secondary-otp");
    setMessage(`Account created. Now verify the email address ${secondaryEmail}.`);
  }

  async function verifySecondaryOtp() {
    const supabase = createClient();
    const token = otp.trim();
    if (!/^\d{6,8}$/.test(token)) throw new Error("Enter the OTP you received.");

    if (identifierMode === "email") {
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

    window.location.assign(redirectPath);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (step === "credentials") await sendPrimaryOtp();
      else if (step === "primary-otp") await verifyPrimaryOtp();
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
              {step === "credentials" ? "Use an email or phone OTP. No password is required." : step === "primary-otp" ? "Enter the verification code we just sent." : "Verify your second contact method to finish linking the account."}
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

            {step === "credentials" && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Email address</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required={mode === "signup" || identifierMode === "email"} autoComplete="email" placeholder="inspector@example.com" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                  {mode === "signup" && <span className="mt-1 block text-xs text-slate-500">Required so every inspector account can support email login.</span>}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Phone number</span>
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required={mode === "signup" || identifierMode === "phone"} autoComplete="tel" placeholder="+919876543210" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                  {mode === "signup" && <span className="mt-1 block text-xs text-slate-500">Use international format. Both email and phone are verified during registration.</span>}
                </label>
              </>
            )}

            {step !== "credentials" && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                <p className="font-semibold">{step === "primary-otp" ? "Primary verification" : "Second verification"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{step === "primary-otp" ? (identifierMode === "email" ? email : normalizePhone(phone)) : (identifierMode === "email" ? normalizePhone(phone) : email)}</p>
              </div>
            )}

            {step !== "credentials" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">One-time password</span>
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" autoFocus required placeholder="Enter OTP" className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              </label>
            )}

            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
            {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60">
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {step === "credentials" ? (mode === "login" ? "Send OTP" : "Send registration OTP") : step === "primary-otp" ? "Verify OTP" : "Verify and finish"}
            </button>

            {step !== "credentials" && (
              <button type="button" className="w-full text-center text-sm font-semibold text-sky-800 hover:text-sky-950" onClick={() => { setStep("credentials"); setOtp(""); setError(null); setMessage(null); }}>
                Change email / phone
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
