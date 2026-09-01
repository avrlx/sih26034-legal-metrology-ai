export type ReportStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ReportImage {
  filename: string;
  path?: string | null;
  width?: number | null;
  height?: number | null;
  processing_timestamp?: string | null;
  quality_status?: "USABLE" | "REVIEW" | string;
}

export interface ImageQuality {
  usable?: boolean | null;
  blur_score?: number | null;
  brightness?: number | null;
  glare_ratio?: number | null;
  issues?: string[];
  warnings?: string[];
  threshold_basis?: string;
}

export interface OcrEvidence {
  raw_text?: string | null;
  normalized_text?: string | null;
  confidence?: number | null;
  box?: JsonValue;
  source_image?: string | null;
  [key: string]: unknown;
}

export interface OcrReport {
  success?: boolean;
  raw_item_count?: number;
  filtered_item_count?: number;
  quantity_crop_recovery?: JsonValue;
  evidence?: OcrEvidence[];
  [key: string]: unknown;
}

export interface ExtractedField {
  field_name: string;
  present: boolean;
  normalized_value?: JsonValue;
  raw_text?: string | null;
  ocr_confidence?: number | null;
  extraction_confidence?: number | null;
  source_polygon?: JsonValue;
  extraction_method?: string | null;
  issues?: string[];
}

export interface RuleEvidence {
  evidence_type: string;
  field?: string;
  value?: JsonValue;
  raw_text?: string | null;
  source_polygon?: JsonValue;
  confidence?: number | null;
  issues?: string[];
  target?: string;
  ocr_text?: string | null;
  target_box?: JsonValue;
  contrast_ratio?: number | null;
  lab_difference?: number | null;
  foreground_luminance?: number | null;
  background_luminance?: number | null;
  threshold_basis?: string;
  measurement_status?: string;
  estimated_numeral_height_mm?: number | null;
  measurement_confidence?: number | null;
  calibration_detected?: boolean;
  pixels_per_mm?: number | null;
  validation_status?: string | null;
  unresolved_reason?: string | null;
  debug_overlay_path?: string | null;
}

export interface RuleResult {
  rule_id: string;
  description: string;
  field_name: string;
  legal_source: string;
  status: ReportStatus;
  applicable: boolean;
  reason_codes: string[];
  reason: string;
  evidence: RuleEvidence[];
  confidence?: number | null;
  issues?: string[];
}

export interface ReportSummary {
  overall_status: ReportStatus;
  pass_count: number;
  fail_count: number;
  review_count: number;
  not_applicable_count: number;
  reason: string;
}

export interface ContrastTarget {
  status?: string;
  target?: string;
  ocr_text?: string | null;
  contrast_ratio?: number | null;
  lab_color_difference?: number | null;
  engineering_interpretation?: string | null;
  confidence?: number | null;
  issues?: string[];
  [key: string]: unknown;
}

export interface ContrastEvidence {
  method?: string;
  threshold_basis?: string;
  targets?: Record<string, ContrastTarget>;
}

export interface NumeralHeightEvidence {
  evidence_type?: string;
  measurement_status?: string;
  estimated_numeral_height_mm?: number | null;
  measurement_confidence?: number | null;
  confidence?: number | null;
  calibration_detected?: boolean;
  pixels_per_mm?: number | null;
  validation_status?: string | null;
  unresolved_reason?: string | null;
  debug_overlay_path?: string | null;
}

export interface CalibrationEvidence {
  detected?: boolean;
  marker_id?: number | null;
  marker_size_mm?: number | null;
  pixels_per_mm?: number | null;
  calibration_confidence?: number | null;
  diagnostic_warnings?: string[];
  [key: string]: unknown;
}

export interface ProcessingWarning {
  code: string;
  source_code?: string | null;
  severity: string;
  message: string;
}

export interface CanonicalReport {
  report_version: string;
  disclaimer: string;
  image: ReportImage;
  quality: ImageQuality;
  ocr: OcrReport;
  extracted_fields: Record<string, ExtractedField>;
  rule_results: RuleResult[];
  summary: ReportSummary;
  evidence: {
    contrast?: ContrastEvidence;
    numeral_height?: NumeralHeightEvidence;
    calibration?: CalibrationEvidence;
  };
  warnings: ProcessingWarning[];
}

export interface HealthResponse {
  status: string;
  service: string;
}
