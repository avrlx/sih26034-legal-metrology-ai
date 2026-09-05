import type { CanonicalReport } from "@/types/report";

import { createClient } from "@/lib/supabase/client";

function productName(report: CanonicalReport): string | null {
  const product = report.extracted_fields.product;
  if (!product || typeof product !== "object") return null;

  const normalized = (product as { normalized_value?: unknown }).normalized_value;
  if (typeof normalized === "string") return normalized;

  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    const name = (normalized as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  const raw = (product as { raw_text?: unknown }).raw_text;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function saveInspection(report: CanonicalReport, sourceFilename: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return;

  const { error } = await supabase.from("inspections").insert({
    user_id: user.id,
    status: report.summary.overall_status,
    product_name: productName(report),
    source_filename: sourceFilename,
    report,
  });

  if (error) {
    console.warn("Inspection report could not be saved:", error.message);
  }
}
