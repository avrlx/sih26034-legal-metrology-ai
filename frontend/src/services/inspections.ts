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

async function createSourcePreview(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const maxDimension = 900;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export async function saveInspection(report: CanonicalReport, sourceFile: File) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return;

  const sourceImageDataUrl = await createSourcePreview(sourceFile);

  const { error } = await supabase.from("inspections").insert({
    user_id: user.id,
    status: report.summary.overall_status,
    product_name: productName(report),
    source_filename: sourceFile.name,
    source_image_data_url: sourceImageDataUrl,
    report,
  });

  if (error) {
    console.warn("Inspection report could not be saved:", error.message);
  }
}
