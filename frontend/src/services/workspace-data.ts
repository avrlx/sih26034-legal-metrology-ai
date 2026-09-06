import type { CanonicalReport } from "@/types/report";

import { createClient } from "@/lib/supabase/client";

export interface InspectionRecord {
  id: string;
  status: "PASS" | "FAIL" | "REVIEW";
  product_name: string | null;
  source_filename: string | null;
  report: CanonicalReport;
  created_at: string;
}

export interface ProfileRecord {
  id: string;
  full_name: string | null;
  role: "inspector" | "reviewer" | "admin";
}

export async function fetchInspections(limit = 100): Promise<InspectionRecord[]> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("inspections")
    .select("id,status,product_name,source_filename,report,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as InspectionRecord[];
}

export async function fetchProfile(): Promise<ProfileRecord | null> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRecord | null;
}
