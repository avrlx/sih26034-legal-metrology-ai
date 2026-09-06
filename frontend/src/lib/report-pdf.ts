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
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 10;
  let y = 16;

  const palette = {
    navy: [8, 47, 73] as [number, number, number],
    blue: [14, 116, 144] as [number, number, number],
    text: [15, 23, 42] as [number, number, number],
    muted: [71, 85, 105] as [number, number, number],
    light: [241, 245, 249] as [number, number, number],
    border: [203, 213, 225] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    pass: [22, 101, 52] as [number, number, number],
    fail: [185, 28, 28] as [number, number, number],
    review: [146, 64, 14] as [number, number, number],
    neutral: [71, 85, 105] as [number, number, number],
  };

  const statusColor = (status: ReportStatus): [number, number, number] => {
    if (status === "PASS") return palette.pass;
    if (status === "FAIL") return palette.fail;
    if (status === "REVIEW") return palette.review;
    return palette.neutral;
  };

  const statusLabel = (status: ReportStatus): string => status === "NOT_APPLICABLE" ? "N/A" : status;

  const ensureSpace = (needed: number) => {
    if (y + needed <= footerY - 4) return;
    doc.addPage();
    y = 17;
  };

  const drawFooter = () => {
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.25);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.muted);
    doc.text("ComplyVision · Legal Metrology Inspection Report · SIH 2026 · PS26034", margin, footerY + 1);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, footerY + 1, { align: "right" });
  };

  const addParagraph = (text: string, size = 9.5, lineHeight = 5, gapAfter = 4, color = palette.text) => {
    const cleaned = text.trim() || "Not detected";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(cleaned, contentWidth) as string[];
    ensureSpace(lines.length * lineHeight + gapAfter);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + gapAfter;
  };

  const addSection = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 22 : 15);
    doc.setFillColor(...palette.navy);
    doc.roundedRect(margin, y, contentWidth, 9, 1.8, 1.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...palette.white);
    doc.text(title.toUpperCase(), margin + 4, y + 6);
    y += 13;
    if (subtitle) {
      addParagraph(subtitle, 8.5, 4.2, 4, palette.muted);
    }
  };

  const addLabelValue = (label: string, value: string) => {
    const labelWidth = 48;
    const valueWidth = contentWidth - labelWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.muted);
    const valueLines = doc.splitTextToSize(value || "Not detected", valueWidth - 3) as string[];
    const rowHeight = Math.max(7, valueLines.length * 4.2 + 2);
    ensureSpace(rowHeight + 1);

    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...palette.text);
    doc.text(valueLines, margin + labelWidth, y);

    y += rowHeight;
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.18);
    doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    y += 2;
  };

  const addStatusPill = (status: ReportStatus, x: number, top: number, width = 24) => {
    const color = statusColor(status);
    doc.setFillColor(...color);
    doc.roundedRect(x, top, width, 7, 1.8, 1.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.white);
    doc.text(statusLabel(status), x + width / 2, top + 4.7, { align: "center" });
  };

  const addCheckCard = (rule: CanonicalReport["rule_results"][number]) => {
    const titleLines = doc.splitTextToSize(rule.description, contentWidth - 35) as string[];
    const reasonLines = doc.splitTextToSize(rule.reason || "No additional explanation was provided.", contentWidth - 8) as string[];
    const estimatedHeight = 13 + titleLines.length * 4.8 + 7 + reasonLines.length * 4.4 + 8;
    ensureSpace(Math.min(estimatedHeight, pageHeight - 30));

    const cardTop = y;
    const color = statusColor(rule.status);
    const titleX = margin + 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, cardTop, contentWidth, Math.min(estimatedHeight, pageHeight - footerY - 20 + (footerY - cardTop)), 2, 2, "FD");

    doc.setFillColor(...color);
    doc.roundedRect(margin, cardTop, 2.5, Math.min(estimatedHeight, pageHeight - 30), 1.2, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...palette.text);
    doc.text(titleLines, titleX, cardTop + 7);
    addStatusPill(rule.status, pageWidth - margin - 25, cardTop + 3, 25);

    const titleHeight = titleLines.length * 4.8;
    const evaluationY = cardTop + 10 + titleHeight;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.muted);
    doc.text("EVALUATION", titleX, evaluationY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.text);
    doc.text(reasonLines, titleX, evaluationY + 5);

    y = evaluationY + 5 + reasonLines.length * 4.4 + 6;
    doc.setDrawColor(...palette.border);
    doc.line(margin + 5, y - 3, pageWidth - margin - 5, y - 3);
    y += 3;
  };

  // Professional report header.
  doc.setFillColor(...palette.navy);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(...palette.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ComplyVision", margin, 13);
  doc.setFontSize(8.5);
  doc.text("LEGAL METROLOGY INSPECTION REPORT", margin, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("See. Verify. Comply.", margin, 25);

  y = 43;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...palette.text);
  doc.text("Package Compliance Report", margin, y);
  y += 7;
  addParagraph("A concise, human-readable inspection report generated from the information presented in the ComplyVision workspace.", 8.8, 4.3, 5, palette.muted);

  const overall = report.summary.overall_status;
  const overallColor = statusColor(overall);
  ensureSpace(20);
  doc.setFillColor(...palette.light);
  doc.setDrawColor(...palette.border);
  doc.roundedRect(margin, y, contentWidth, 17, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...palette.muted);
  doc.text("OVERALL COMPLIANCE OUTCOME", margin + 5, y + 6);
  addStatusPill(overall, pageWidth - margin - 31, y + 4.5, 31);
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...overallColor);
  doc.text(overall === "NOT_APPLICABLE" ? "NOT APPLICABLE" : overall, margin + 5, y + 1);
  y += 13;

  addSection("Inspection details", "Basic inspection information shown to the inspector in the application.");
  addLabelValue("Inspection ID", options.inspectionId ?? "Not available");
  addLabelValue(
    "Inspection time",
    options.createdAt
      ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(options.createdAt))
      : "Not available",
  );
  addLabelValue("Source image", options.sourceFilename ?? report.image.filename ?? "Not available");
  addLabelValue("Image dimensions", `${report.image.width ?? "?"} × ${report.image.height ?? "?"} px`);

  if (options.sourceImageDataUrl) {
    ensureSpace(68);
    const format = options.sourceImageDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    const imageWidth = 78;
    const imageHeight = 52;
    doc.setDrawColor(...palette.border);
    doc.roundedRect(margin, y, imageWidth, imageHeight, 2, 2, "S");
    try {
      doc.addImage(options.sourceImageDataUrl, format, margin, y, imageWidth, imageHeight, undefined, "FAST");
      y += imageHeight + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...palette.muted);
      doc.text("Package image captured during the inspection", margin, y);
      y += 7;
    } catch {
      y += 5;
      addParagraph("The source package image could not be embedded in this PDF.", 8.5, 4.2, 3, palette.muted);
    }
  }

  addSection("Compliance summary", "A quick overview of the checks shown in the inspection report.");
  const metrics = [
    ["PASS", report.summary.pass_count, palette.pass],
    ["FAIL", report.summary.fail_count, palette.fail],
    ["REVIEW", report.summary.review_count, palette.review],
    ["N/A", report.summary.not_applicable_count, palette.neutral],
  ] as const;
  const metricGap = 3;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  ensureSpace(25);
  metrics.forEach(([label, value, color], index) => {
    const x = margin + index * (metricWidth + metricGap);
    doc.setFillColor(...palette.light);
    doc.setDrawColor(...palette.border);
    doc.roundedRect(x, y, metricWidth, 21, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...color);
    doc.text(label, x + 4, y + 6);
    doc.setFontSize(15);
    doc.text(String(value), x + 4, y + 15.5);
  });
  y += 27;
  addParagraph(report.summary.reason, 9, 4.5, 2);

  addSection("Extracted declarations", "The product information displayed in the report, formatted as readable field/value pairs.");
  const declarations = Object.values(report.extracted_fields);
  if (declarations.length === 0) {
    addParagraph("No product declarations were detected.", 9, 4.5, 2, palette.muted);
  } else {
    declarations.forEach((field) => {
      ensureSpace(12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...palette.border);
      const value = display(field.normalized_value);
      const valueLines = doc.splitTextToSize(value, contentWidth - 8) as string[];
      const cardHeight = Math.max(14, 8 + valueLines.length * 4.5);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...palette.blue);
      doc.text(humanize(field.field_name).toUpperCase(), margin + 4, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...palette.text);
      doc.text(valueLines, margin + 4, y + 10);
      y += cardHeight + 4;
    });
  }

  addSection("Compliance checks", "Each check is presented in the same status-and-evaluation style used in the application.");
  if (report.rule_results.length === 0) {
    addParagraph("No compliance checks are available for this inspection.", 9, 4.5, 2, palette.muted);
  } else {
    report.rule_results.forEach(addCheckCard);
  }

  addSection("Inspector interpretation", "Important context for reading the outcome.");
  addParagraph(report.disclaimer, 9, 4.5, 4);
  addParagraph(
    "This report is intended as evidence-backed decision support. A REVIEW outcome indicates that the displayed information requires additional human verification before a final compliance decision is made.",
    9,
    4.5,
    2,
    palette.muted,
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    drawFooter();
  }

  doc.save(`${safeFileName(options.inspectionId ?? report.image.filename.replace(/\.[^.]+$/, ""))}-complyvision-report.pdf`);
}
