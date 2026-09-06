"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, LockKeyhole, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  role: string;
  age: string;
  designation: string;
  employee_id: string;
  department: string;
  qualification: string;
  experience_years: string;
  office_location: string;
  address: string;
  bio: string;
};

const emptyProfile: Profile = {
  full_name: "",
  role: "inspector",
  age: "",
  designation: "",
  employee_id: "",
  department: "",
  qualification: "",
  experience_years: "",
  office_location: "",
  address: "",
  bio: "",
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completion = useMemo(() => {
    const values = [
      profile.full_name,
      profile.age,
      profile.designation,
      profile.employee_id,
      profile.department,
      profile.qualification,
      profile.experience_years,
      profile.office_location,
      profile.address,
      profile.bio,
    ];
    return Math.round((values.filter((value) => value.trim()).length / values.length) * 100);
  }, [profile]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        window.location.assign("/login");
        return;
      }

      const user = userData.user;
      setEmail(user.email ?? "");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,role,age,designation,employee_id,department,qualification,experience_years,office_location,address,bio")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile({
          full_name: data?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
          role: data?.role ?? "inspector",
          age: data?.age == null ? "" : String(data.age),
          designation: data?.designation ?? "",
          employee_id: data?.employee_id ?? "",
          department: data?.department ?? "",
          qualification: data?.qualification ?? "",
          experience_years: data?.experience_years == null ? "" : String(data.experience_years),
          office_location: data?.office_location ?? "",
          address: data?.address ?? "",
          bio: data?.bio ?? "",
        });
      }
      setLoading(false);
    }

    void load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Your session has expired. Please sign in again.");

      const name = profile.full_name.trim();
      if (!name) throw new Error("Full name is required.");

      const age = profile.age.trim() ? Number(profile.age) : null;
      const experienceYears = profile.experience_years.trim() ? Number(profile.experience_years) : null;

      if (age !== null && (!Number.isInteger(age) || age < 18 || age > 100)) {
        throw new Error("Age must be a whole number between 18 and 100.");
      }
      if (experienceYears !== null && (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80)) {
        throw new Error("Experience must be a whole number between 0 and 80 years.");
      }

      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          age,
          designation: profile.designation.trim() || null,
          employee_id: profile.employee_id.trim() || null,
          department: profile.department.trim() || null,
          qualification: profile.qualification.trim() || null,
          experience_years: experienceYears,
          office_location: profile.office_location.trim() || null,
          address: profile.address.trim() || null,
          bio: profile.bio.trim() || null,
        })
        .eq("id", userData.user.id);

      if (profileError) throw profileError;
      setProfile((current) => ({ ...current, full_name: name }));
      setMessage("Your inspector profile has been updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center text-sm text-slate-500"><LoaderCircle className="mr-2 size-4 animate-spin" /> Loading profile…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Account</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Inspector profile</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Complete your professional details so your ComplyVision account represents the inspector using the system. Your registered email and role are protected.</p>
              </div>
              <div className="min-w-44 rounded-xl border border-sky-100 bg-sky-50 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>Profile completion</span><span className="text-sky-900">{completion}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${completion}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section>
              <div className="mb-4"><h2 className="text-base font-semibold text-slate-900">Account information</h2><p className="mt-1 text-xs text-slate-500">Authentication and authorization details.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered email</span><LockKeyhole className="size-4 text-slate-400" /></div>
                  <p className="mt-2 break-all text-sm font-semibold text-slate-900">{email || "Not linked"}</p>
                  <p className="mt-1 text-xs text-slate-500">Read-only. This is the email used to register the account.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span><p className="mt-2 text-sm font-semibold uppercase text-sky-800">{profile.role}</p><p className="mt-1 text-xs text-slate-500">Controlled by the application administrator.</p></div>
              </div>
            </section>

            <section>
              <div className="mb-4"><h2 className="text-base font-semibold text-slate-900">Personal & professional details</h2><p className="mt-1 text-xs text-slate-500">These fields can be modified whenever your information changes.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Full name *</span><input value={profile.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputClass} placeholder="Enter full name" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Age</span><input type="number" min="18" max="100" value={profile.age} onChange={(e) => update("age", e.target.value)} className={inputClass} placeholder="e.g. 32" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Designation</span><input value={profile.designation} onChange={(e) => update("designation", e.target.value)} className={inputClass} placeholder="Legal Metrology Inspector" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Employee / Inspector ID</span><input value={profile.employee_id} onChange={(e) => update("employee_id", e.target.value)} className={inputClass} placeholder="e.g. LM-1024" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Department</span><input value={profile.department} onChange={(e) => update("department", e.target.value)} className={inputClass} placeholder="Legal Metrology Department" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Qualification</span><input value={profile.qualification} onChange={(e) => update("qualification", e.target.value)} className={inputClass} placeholder="B.Tech / B.Sc / etc." /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Experience (years)</span><input type="number" min="0" max="80" value={profile.experience_years} onChange={(e) => update("experience_years", e.target.value)} className={inputClass} placeholder="e.g. 6" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Office / posting location</span><input value={profile.office_location} onChange={(e) => update("office_location", e.target.value)} className={inputClass} placeholder="e.g. Prayagraj, Uttar Pradesh" /></label>
              </div>
              <div className="mt-4 grid gap-4">
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Address</span><textarea rows={3} value={profile.address} onChange={(e) => update("address", e.target.value)} className={inputClass} placeholder="Office or correspondence address" /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Professional bio</span><textarea rows={4} value={profile.bio} onChange={(e) => update("bio", e.target.value)} className={inputClass} placeholder="Briefly describe your inspection experience or professional background" /></label>
              </div>
            </section>

            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
              <div className="flex gap-3"><Link href="/" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to dashboard</Link><form action="/auth/signout" method="post"><button type="submit" className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">Sign out</button></form></div>
              <button type="button" disabled={saving} onClick={() => void saveProfile()} className="inline-flex items-center justify-center rounded-lg bg-sky-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"><Save className="mr-2 size-4" />{saving ? "Saving…" : "Save profile"}</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
