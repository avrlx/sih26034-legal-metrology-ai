import type { CanonicalReport } from "@/types/report";

export function reportFixture(): CanonicalReport {
  return {
    report_version: "1.0",
    disclaimer: "Prototype report. Not an official compliance certificate.",
    image: {
      filename: "uploaded_image.jpg",
      width: 1414,
      height: 2000,
      processing_timestamp: "2026-09-02T00:00:00Z",
      quality_status: "USABLE",
    },
    quality: {
      usable: true,
      blur_score: 578.42,
      brightness: 215.92,
      glare_ratio: 0.0646,
      issues: [],
      warnings: ["MODERATE_GLARE"],
      threshold_basis: "prototype engineering thresholds; not statutory",
    },
    ocr: {
      success: true,
      raw_item_count: 2,
      filtered_item_count: 2,
      evidence: [
        { raw_text: "Net Quantity 1 L", confidence: 0.98 },
        { raw_text: "MRP ₹145.00", confidence: 0.97 },
      ],
    },
    extracted_fields: {
      product: {
        field_name: "product",
        present: true,
        normalized_value: "SUNLITE REFINED OIL",
        raw_text: "Product: SUNLITE REFINED OIL",
        extraction_confidence: 0.955,
        issues: [],
      },
      importer: {
        field_name: "importer",
        present: false,
        normalized_value: null,
        issues: [],
      },
    },
    rule_results: [
      {
        rule_id: "LM-R6-001",
        description: "Manufacturer name declared",
        field_name: "manufacturer_name",
        legal_source: "Rule 6(1)(a)",
        status: "PASS",
        applicable: true,
        reason_codes: ["FIELD_PRESENT"],
        reason: "manufacturer_name detected",
        evidence: [{ evidence_type: "EXTRACTED_FIELD", field: "product", value: "SUNLITE REFINED OIL", confidence: 0.955 }],
        confidence: 0.955,
        issues: [],
      },
      {
        rule_id: "LM-R7-001",
        description: "Minimum numeral height for net quantity",
        field_name: "net_quantity_font_height",
        legal_source: "Rule 7",
        status: "REVIEW",
        applicable: true,
        reason_codes: ["MEASUREMENT_NOT_VALIDATED"],
        reason: "Physical-scale measurement requires independent validation",
        evidence: [{
          evidence_type: "NUMERAL_HEIGHT_MEASUREMENT",
          measurement_status: "OK",
          estimated_numeral_height_mm: 26.87,
          validation_status: "AWAITING_MANUAL_GROUND_TRUTH",
          unresolved_reason: "Physical numeral-height measurement has not been independently validated",
        }],
        issues: [],
      },
    ],
    summary: {
      overall_status: "REVIEW",
      pass_count: 8,
      fail_count: 0,
      review_count: 1,
      not_applicable_count: 1,
      reason: "At least one applicable rule or critical processing condition requires review",
    },
    evidence: {
      contrast: {
        threshold_basis: "implementation-defined engineering thresholds; not statutory",
        targets: {
          NET_QUANTITY: { status: "OK", ocr_text: "1 L", contrast_ratio: 8.261, lab_color_difference: 171.959 },
        },
      },
      numeral_height: {
        estimated_numeral_height_mm: 26.87,
        measurement_confidence: 0.967,
        calibration_detected: true,
        pixels_per_mm: 6.4013,
        validation_status: "AWAITING_MANUAL_GROUND_TRUTH",
        unresolved_reason: "Physical numeral-height measurement has not been independently validated",
      },
      calibration: { detected: true, pixels_per_mm: 6.4013 },
    },
    warnings: [],
    evidence_images: [{
      id: "numeral-height-overlay",
      type: "NUMERAL_HEIGHT_OVERLAY",
      label: "Numeral height measurement overlay",
      mime_type: "image/jpeg",
      data_url: "data:image/jpeg;base64,YQ==",
      related_declaration: "product",
      related_rule_id: "LM-R7-001",
    }],
  };
}
