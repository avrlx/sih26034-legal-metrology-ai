-- Store a compact source-image preview for human-friendly inspection history.
-- The original uploaded image is not stored in the report JSON; this preview is intentionally resized client-side.
alter table public.inspections
  add column if not exists source_image_data_url text;
