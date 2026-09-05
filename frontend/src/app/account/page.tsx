import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", claimsData.claims.sub)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Inspector profile</h1>
          <p className="mt-2 text-sm text-slate-500">Your identity and workspace role are managed through Supabase Auth and the protected profiles table.</p>

          <dl className="mt-7 divide-y divide-slate-100 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-5 px-4 py-4">
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="text-sm font-medium text-slate-900">{claimsData.claims.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-5 px-4 py-4">
              <dt className="text-sm text-slate-500">Full name</dt>
              <dd className="text-sm font-medium text-slate-900">{profile?.full_name || "Not set"}</dd>
            </div>
            <div className="flex items-center justify-between gap-5 px-4 py-4">
              <dt className="text-sm text-slate-500">Role</dt>
              <dd className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold uppercase text-sky-800">{profile?.role ?? "inspector"}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-900">Back to dashboard</Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
