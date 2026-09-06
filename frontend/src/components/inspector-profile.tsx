"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, LogOut, ShieldCheck, UserCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

function validPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

type ProfileDetails = {
  fullName: string;
  age: string;
  designation: string;
  employeeId: string;
  department: string;
  qualification: string;
  experienceYears: string;
  officeLocation: string;
  address: string;
  bio: string;
};

const emptyDetails: ProfileDetails = {
  fullName: "",
  age: "",
  designation: "",
  employeeId: "",
  department: "",
  qualification: "",
  experienceYears: "",
  officeLocation: "",
  address: "",
  bio: "",
};

function inputClassName(): string {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100";
}

export function InspectorProfile() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [details, setDetails] = useState<ProfileDetails>(emptyDetails);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("inspector");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileCompletion = useMemo(() => {
    const fields = [
      details.fullName,
      details.age,
      details.designation,
      details.employeeId,
      details.department,
      details.qualification,
      details.experienceYears,
      details.officeLocation,
      details.address,
      details.bio,
      phone,
    ];
    return Math.round((fields.filter((value) => value.trim()).length / fields.length) * 100);
  }, [details, phone]);

  function updateDetail<K extends keyof ProfileDetails>(key: K, value: ProfileDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  async function loadProfile() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) return;

      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setPhoneVerified(Boolean(user.phone_confirmed_at));

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,role,age,designation,employee_id,department,qualification,experience_years,office_location,address,bio")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      setDetails({
        fullName: profile?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
        age: profile?.age == null ? "" : String(profile.age),
        designation: profile?.designation ?? "",
        employeeId: profile?.employee_id ?? "",
        department: profile?.department ?? "",
        qualification: profile?.qualification ?? "",
        experienceYears: profile?.experience_years == null ? "" : String(profile.experience_years),
        officeLocation: profile?.office_location ?? "",
        address: profile?.address ?? "",
        bio: profile?.bio ?? "",
      });
      setRole(profile?.role ?? "inspector");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadProfile();
  }, [open]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const trimmedName = details.fullName.trim();
      if (!trimmedName) throw new Error("Enter your full name.");

      const age = details.age.trim() ? Number(details.age) : null;
      const experienceYears = details.experienceYears.trim() ? Number(details.experienceYears) : null;

      if (age !== null && (!Number.isInteger(age) || age < 18 || age > 100)) {
        throw new Error("Age must be a whole number between 18 and 100.");
      }
      if (experienceYears !== null && (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80)) {
        throw new Error("Experience must be a whole number between 0 and 80 years.");
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Your session has expired. Please sign in again.");

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          age,
          designation: details.designation.trim() || null,
          employee_id: details.employeeId.trim() || null,
          department: details.department.trim() || null,
          qualification: details.qualification.trim() || null,
          experience_years: experienceYears,
          office_location: details.officeLocation.trim() || null,
          address: details.address.trim() || null,
          bio: details.bio.trim() || null,
        })
        .eq("id", userData.user.id);
      if (profileError) throw profileError;

      setDetails((current) => ({ ...current, fullName: trimmedName }));
      setMessage("Profile details saved successfully.");
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

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      window.location.assign("/login");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
      setSigningOut(false);
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
          <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                    <ShieldCheck className="size-4" /> Account & profile
                  </div>
                  <CardTitle>Inspector Profile</CardTitle>
                  <CardDescription className="mt-1">Complete your professional profile. Your registration email is permanently read-only, while your name, phone and profile details can be updated.</CardDescription>
                </div>
                <button type="button" onClick={() => { setOpen(false); setError(null); setMessage(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close profile">
                  <X className="size-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500"><LoaderCircle className="mr-2 size-4 animate-spin" /> Loading profile…</div>
              ) : (
                <>
                  <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Profile completion</p>
                        <p className="mt-1 text-xs text-slate-500">Add your professional details to make your inspector account complete.</p>
                      </div>
                      <span className="text-lg font-bold text-sky-900">{profileCompletion}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${profileCompletion}%` }} />
                    </div>
                  </div>

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Account information</h3>
                      <p className="mt-1 text-xs text-slate-500">Authentication details connected to your ComplyVision account.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Registered email</p>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Locked</span>
                        </div>
                        <p className="mt-2 break-all text-sm font-semibold text-slate-900">{email || "Not linked"}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">This email cannot be changed from the profile section.</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Account role</p>
                        <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{role}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Role is controlled by the application administrator.</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Personal details</h3>
                      <p className="mt-1 text-xs text-slate-500">Keep these details accurate for inspection records and professional identification.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Full name <span className="text-rose-600">*</span></span>
                        <input value={details.fullName} onChange={(event) => updateDetail("fullName", event.target.value)} placeholder="Enter your full name" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Age</span>
                        <input type="number" min="18" max="100" value={details.age} onChange={(event) => updateDetail("age", event.target.value)} placeholder="e.g. 32" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Designation</span>
                        <input value={details.designation} onChange={(event) => updateDetail("designation", event.target.value)} placeholder="e.g. Legal Metrology Inspector" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Employee / Inspector ID</span>
                        <input value={details.employeeId} onChange={(event) => updateDetail("employeeId", event.target.value)} placeholder="e.g. LM-1024" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Department</span>
                        <input value={details.department} onChange={(event) => updateDetail("department", event.target.value)} placeholder="e.g. Legal Metrology Department" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Qualification</span>
                        <input value={details.qualification} onChange={(event) => updateDetail("qualification", event.target.value)} placeholder="e.g. B.Tech / B.Sc. / LL.B." className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Experience (years)</span>
                        <input type="number" min="0" max="80" value={details.experienceYears} onChange={(event) => updateDetail("experienceYears", event.target.value)} placeholder="e.g. 5" className={inputClassName()} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Office / Posting location</span>
                        <input value={details.officeLocation} onChange={(event) => updateDetail("officeLocation", event.target.value)} placeholder="e.g. Prayagraj, Uttar Pradesh" className={inputClassName()} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Address</span>
                      <textarea value={details.address} onChange={(event) => updateDetail("address", event.target.value)} rows={2} placeholder="Office or correspondence address" className={`${inputClassName()} resize-none`} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Professional bio</span>
                      <textarea value={details.bio} onChange={(event) => updateDetail("bio", event.target.value)} rows={3} maxLength={500} placeholder="Briefly describe your role, expertise or inspection responsibilities." className={`${inputClassName()} resize-none`} />
                      <span className="mt-1 block text-right text-[11px] text-slate-400">{details.bio.length}/500</span>
                    </label>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Phone authentication</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Add or change the phone number used to sign in. A phone-change OTP is required before the new number becomes an authentication method.</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerified(false); }} placeholder="+919876543210" className={`min-w-0 flex-1 ${inputClassName()}`} />
                      <Button type="button" variant="outline" disabled={saving} onClick={() => void sendPhoneOtp()}>Send phone OTP</Button>
                    </div>
                    {phoneOtpSent && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter OTP" className={`min-w-0 flex-1 ${inputClassName()} text-center font-semibold tracking-[0.25em]`} />
                        <Button type="button" disabled={saving} onClick={() => void verifyPhoneOtp()} className="bg-sky-950 hover:bg-sky-900">Verify phone</Button>
                      </div>
                    )}
                    {phone && <p className={`mt-2 text-xs ${phoneVerified ? "text-emerald-700" : "text-amber-700"}`}>{phoneVerified ? "✓ Phone number verified" : "Phone number not verified"}</p>}
                  </section>

                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
                    Your registered email is read-only. Profile details are stored in your private application profile and can be edited by you. Role remains administrator-controlled.
                  </div>

                  {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
                  {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message}</p>}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
                    <Button type="button" disabled={saving} onClick={() => void saveProfile()} className="bg-sky-950 hover:bg-sky-900">
                      {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                      {saving ? "Saving…" : "Save profile"}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={signingOut}
                    onClick={() => void signOut()}
                    className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    {signingOut && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                    {!signingOut && <LogOut className="mr-2 size-4" />}
                    {signingOut ? "Signing out…" : "Sign out"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
