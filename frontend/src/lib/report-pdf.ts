import { jsPDF } from "jspdf";

import type { CanonicalReport, JsonValue, ReportStatus } from "@/types/report";

function display(value: JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not detected";
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => `${key.replaceAll("_", " ")}: ${display(item)}`)
      .join(" · ") || "Not detected";
  }
  return String(value);
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "package";
}

export interface PdfReportOptions {
  inspectionId?: string;
  createdAt?: string;
  sourceFilename?: string | null;
  sourceImageDataUrl?: string | null;
}

export function downloadCompliancePdf(report: CanonicalReport, options: PdfReportOptions = {}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 17;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 17;
    }
  };

  const addWrapped = (text: string, size = 9, gap = 4.5, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text || "Not detected", contentWidth) as string[];
    ensureSpace(lines.length * gap + 2);
    doc.text(lines, margin, y);
    y += lines.length * gap;
  };

  const heading = (text: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, margin, y);
    y += 7;
  };

  const sectionLabel = (text: string) => {
    ensureSpace(9);
    doc.setFillColor(8, 47, 73);
    doc.roundedRect(margin, y - 4.5, contentWidth, 7.5, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(text, margin + 3, y);
    doc.setTextColor(20, 30, 40);
    y += 8;
  };

  const addRule = (label: string, value: string, status?: ReportStatus) => {
    const statusColor: Record<string, [number, number, number]> = {
      PASS: [22, 101, 52],
      FAIL: [185, 28, 28],
      REVIEW: [146, 64, 14],
      NOT_APPLICABLE: [71, 85, 105],
    };
    ensureSpace(13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, margin, y);
    if (status) {
      const [r, g, b] = statusColor[status] ?? [71, 85, 105];
      doc.setTextColor(r, g, b);
      doc.text(status === "NOT_APPLICABLE" ? "N/A" : status, pageWidth - margin, y, { align: "right" });
      doc.setTextColor(20, 30, 40);
    }
    y += 4.5;
    addWrapped(value, 8.5, 4.2);
    y += 1.5;
  };

  // Header
  doc.setFillColor(8, 47, 73);
  doc.rect(0, 0, pageWidth, 31, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ComplyVision", margin, 13);
  doc.setFontSize(9);
  doc.text("LEGAL METROLOGY INSPECTION REPORT", margin, 19);
  doc.setFont("helvetica", "normal");
  doc.text("See. Verify. Comply.", margin, 25);
  doc.setTextColor(20, 30, 40);
  y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Package Compliance Report", margin, y);
  y += 8;

  const overall = report.summary.overall_status;
  doc.setFontSize(12);
  doc.setTextColor(overall === "PASS" ? 22 : overall === "FAIL" ? 185 : 146, overall === "PASS" ? 101 : overall === "FAIL" ? 28 : 64, overall === "PASS" ? 52 : overall === "FAIL" ? 28 : 14);
  doc.text(`Overall outcome: ${overall === "NOT_APPLICABLE" ? "NOT APPLICABLE" : overall}`, margin, y);
  doc.setTextColor(20, 30, 40);
  y += 8;

  sectionLabel("INSPECTION DETAILS");
  addRule("Inspection ID", options.inspectionId ?? "Not available");
  addRule("Inspection time", options.createdAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(options.createdAt)) : "Not available");
  addRule("Source image", options.sourceFilename ?? report.image.filename ?? "Not available");
  addRule("Image dimensions", `${report.image.width ?? "?"} × ${report.image.height ?? "?"} px`);
  addRule("Image quality", report.quality.usable ? "USABLE" : "REVIEW");

  if (options.sourceImageDataUrl) {
    try {
      ensureSpace(78);
      const format = options.sourceImageDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      const imageWidth = 78;
      const imageHeight = 55;
      doc.addImage(options.sourceImageDataUrl, format, margin, y, imageWidth, imageHeight, undefined, "FAST");
      y += imageHeight + 5;
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Source package image captured during inspection", margin, y);
      doc.setTextColor(20, 30, 40);
      y += 6;
    } catch {
      addWrapped("Source image could not be embedded in the PDF; the inspection record still contains its filename.", 8, 4.2);
    }
  }

  sectionLabel("COMPLIANCE SUMMARY");
  addRule("Result", report.summary.reason);
  addRule("PASS checks", String(report.summary.pass_count));
  addRule("FAIL checks", String(report.summary.fail_count));
  addRule("REVIEW checks", String(report.summary.review_count));
  addRule("Not applicable", String(report.summary.not_applicable_count));

  sectionLabel("EXTRACTED DECLARATIONS");
  Object.values(report.extracted_fields).forEach((field) => {
    addRule(field.field_name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), display(field.normalized_value));
    if (field.raw_text) addWrapped(`OCR source: ${field.raw_text}`, 7.5, 3.8);
    if (typeof field.extraction_confidence === "number") addWrapped(`Extraction confidence: ${Math.round(field.extraction_confidence * 100)}%`, 7.5, 3.8);
  });

  sectionLabel("RULE-BY-RULE EVALUATION");
  report.rule_results.forEach((rule) => {
    addRule(`${rule.rule_id} — ${rule.description}`, `${rule.reason}\nLegal source: ${rule.legal_source}`, rule.status);
    if (rule.evidence.length) {
      rule.evidence.slice(0, 4).forEach((evidence) => {
        const details = Object.entries(evidence)
          .filter(([, value]) => value !== null && value !== undefined && value !== "" && !Array.isArray(value))
          .map(([key, value]) => `${key.replaceAll("_", " ")}: ${display(value as JsonValue)}`)
          .join(" · ");
        if (details) addWrapped(`Evidence: ${details}`, 7.3, 3.7);
      });
    }
  });

  if (report.evidence.calibration || report.evidence.numeral_height || report.evidence.contrast) {
    sectionLabel("ENGINEERING EVIDENCE");
    if (report.evidence.calibration) addRule("Calibration", display(report.evidence.calibration as unknown as JsonValue));
    if (report.evidence.numeral_height) addRule("Numeral height", display(report.evidence.numeral_height as unknown as JsonValue));
    if (report.evidence.contrast) addRule("Contrast / legibility", display(report.evidence.contrast as unknown as JsonValue));
  }

  if (report.warnings.length) {
    sectionLabel("PROCESSING WARNINGS");
    report.warnings.forEach((warning) => addRule(`${warning.severity} — ${warning.code}`, warning.message));
  }

  sectionLabel("INTERPRETATION & LIMITATIONS");
  addWrapped(report.disclaimer, 8.5, 4.3);
  addWrapped("This report is generated by ComplyVision as evidence-backed decision support. PASS, FAIL and REVIEW outcomes are based on the extracted evidence and versioned inspection rules available to the application at analysis time. A REVIEW result means additional human verification or physical evidence is required.", 8.5, 4.3);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("ComplyVision · SIH 2026 · PS26034", margin, pageHeight - 6);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  doc.save(`${safeFileName(options.inspectionId ?? report.image.filename.replace(/\.[^.]+$/, ""))}-complyvision-report.pdf`);
}
