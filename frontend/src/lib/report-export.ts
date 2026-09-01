import type { CanonicalReport, JsonValue } from "@/types/report";

function display(value: JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Unknown";
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object") return Object.entries(value).filter(([, item]) => item !== null).map(([key, item]) => `${key}=${display(item)}`).join(", ") || "Unknown";
  return String(value);
}

export function reportToJson(report: CanonicalReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function reportToMarkdown(report: CanonicalReport): string {
  const lines = [
    "# Package Compliance Report", "", `**Overall result: ${report.summary.overall_status}**`, "",
    report.summary.reason, "", `> ${report.disclaimer}`, "", "## Extracted declarations", "",
  ];
  Object.values(report.extracted_fields).forEach((field) => lines.push(`- **${field.field_name.replaceAll("_", " ")}:** ${display(field.normalized_value)}`));
  lines.push("", "## Rule results", "");
  report.rule_results.forEach((rule) => lines.push(`### ${rule.rule_id} — ${rule.status}`, "", rule.description, "", `Reason: ${rule.reason}`, ""));
  lines.push("## Summary", "", `PASS ${report.summary.pass_count} · FAIL ${report.summary.fail_count} · REVIEW ${report.summary.review_count} · NOT_APPLICABLE ${report.summary.not_applicable_count}`, "");
  return lines.join("\n");
}

export function downloadReport(report: CanonicalReport, format: "json" | "md"): void {
  const content = format === "json" ? reportToJson(report) : reportToMarkdown(report);
  const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.image.filename.replace(/\.[^.]+$/, "") || "package"}-report.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
