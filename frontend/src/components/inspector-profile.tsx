"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck, UserCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

function validPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

export function InspectorProfile() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("inspector");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) return;

      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setPhoneVerified(Boolean(user.phone_confirmed_at));
      setFullName(typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile) {
        setFullName(profile.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""));
        setRole(profile.role ?? "inspector");
      }
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadProfile();
  }, [open]);

  async function saveName() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const trimmedName = fullName.trim();
      if (!trimmedName) throw new Error("Enter your full name.");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Your session has expired. Please sign in again.");

      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmedName } });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", userData.user.id);
      if (profileError) throw profileError;

      setMessage("Profile name updated.");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPhoneOtp() {
    const normalized = normalizePhone(phone);
    if (!validPhone(normalized)) {
      setError("Enter a valid phone number in international format, for example +919876543210.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setPhoneOtp("");
      setPhoneOtpSent(true);
      setPhoneVerified(false);
      setMessage(`A verification OTP was sent to ${normalized}.`);
    } catch (phoneError) {
      setError(phoneError instanceof Error ? phoneError.message : "Could not send the phone verification OTP.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyPhoneOtp() {
    const normalized = normalizePhone(phone);
    if (!/^\d{6,8}$/.test(phoneOtp)) {
      setError("Enter the OTP sent to your phone.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: phoneOtp,
        type: "phone_change",
      });
      if (verifyError) throw verifyError;

      setPhoneVerified(true);
      setPhoneOtpSent(false);
      setPhoneOtp("");
      setMessage("Phone number verified. You can now use phone OTP login for this account.");
    } catch (phoneError) {
      setError(phoneError instanceof Error ? phoneError.message : "Phone verification failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full bg-sky-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-sky-900"
        aria-label="Open inspector profile"
      >
        <UserCircle2 className="size-5" /> Inspector Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Inspector profile">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                    <ShieldCheck className="size-4" /> Account identity
                  </div>
                  <CardTitle>Inspector Profile</CardTitle>
                  <CardDescription className="mt-1">Your email and verified phone are both authentication methods for the same ComplyVision account.</CardDescription>
                </div>
                <button type="button" onClick={() => { setOpen(false); setError(null); setMessage(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close profile">
                  <X className="size-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500"><LoaderCircle className="mr-2 size-4 animate-spin" /> Loading profile…</div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Email</p>
                      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{email || "Not linked"}</p>
                      <p className="mt-1 text-xs text-emerald-700">Verified authentication method</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Phone</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{phone || "Not linked"}</p>
                      <p className={`mt-1 text-xs ${phoneVerified ? "text-emerald-700" : "text-amber-700"}`}>{phoneVerified ? "Verified authentication method" : "OTP verification required"}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Inspector name</span>
                      <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                    </label>
                    <Button type="button" disabled={saving} onClick={() => void saveName()} className="bg-sky-950 hover:bg-sky-900">Save name</Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Phone authentication</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Add or change the phone number used to sign in. Supabase sends a phone-change OTP before the number becomes a login method.</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerified(false); }} placeholder="+919876543210" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                      <Button type="button" variant="outline" disabled={saving} onClick={() => void sendPhoneOtp()}>Send phone OTP</Button>
                    </div>
                    {phoneOtpSent && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter OTP" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold tracking-[0.25em] outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
                        <Button type="button" disabled={saving} onClick={() => void verifyPhoneOtp()} className="bg-sky-950 hover:bg-sky-900">Verify phone</Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    Role: <span className="font-semibold capitalize text-slate-700">{role}</span>. Email and phone are stored by Supabase Auth; the application profile stores your inspector name and role.
                  </div>

                  {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
                  {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
