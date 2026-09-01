import {
  AlertCircle,
  Aperture,
  Braces,
  CheckCircle2,
  CircleGauge,
  FileCheck2,
  ImageIcon,
  Microscope,
  RotateCcw,
  Ruler,
  ScanText,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  CanonicalReport,
  ExtractedField,
  JsonValue,
  ReportStatus,
  RuleEvidence,
  RuleResult,
} from "@/types/report";

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null || value === "") return "Not detected";
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  if (typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => `${humanize(key)}: ${displayValue(item)}`);
    return parts.length ? parts.join(" · ") : "Not detected";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function confidence(value?: number | null): string | null {
  return typeof value === "number" ? `${Math.round(value * 100)}% confidence` : null;
}

const statusPresentation: Record<ReportStatus, { label: string; badge: string; panel: string; icon: typeof CheckCircle2 }> = {
  PASS: { label: "PASS", badge: "border-emerald-300 bg-emerald-50 text-emerald-800", panel: "border-emerald-200", icon: CheckCircle2 },
  FAIL: { label: "FAIL", badge: "border-rose-300 bg-rose-50 text-rose-800", panel: "border-rose-200", icon: XCircle },
  REVIEW: { label: "REVIEW", badge: "border-amber-300 bg-amber-50 text-amber-900", panel: "border-amber-200", icon: TriangleAlert },
  NOT_APPLICABLE: { label: "N/A", badge: "border-slate-300 bg-slate-50 text-slate-700", panel: "border-slate-200", icon: AlertCircle },
};

function StatusBadge({ status, prominent = false }: { status: ReportStatus; prominent?: boolean }) {
  const presentation = statusPresentation[status];
  const Icon = presentation.icon;
  return (
    <Badge
      variant="outline"
      className={`${presentation.badge} ${prominent ? "h-11 rounded-lg px-4 text-base font-bold" : "font-semibold"}`}
    >
      <Icon data-icon="inline-start" /> {presentation.label}
    </Badge>
  );
}

function SummaryHeader({ report }: { report: CanonicalReport }) {
  const summary = report.summary;
  const metrics: Array<{ label: string; value: number; classes: string }> = [
    { label: "PASS", value: summary.pass_count, classes: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    { label: "FAIL", value: summary.fail_count, classes: "border-rose-200 bg-rose-50 text-rose-800" },
    { label: "REVIEW", value: summary.review_count, classes: "border-amber-200 bg-amber-50 text-amber-900" },
    { label: "N/A", value: summary.not_applicable_count, classes: "border-slate-200 bg-slate-50 text-slate-700" },
  ];
  return (
    <Card className="border-t-4 border-t-amber-500 bg-white shadow-[0_18px_50px_rgba(20,48,64,0.10)]">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
              <ShieldCheck className="size-4" /> Canonical report v{report.report_version}
            </div>
            <CardTitle className="text-2xl sm:text-3xl">Overall compliance status</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">{summary.reason}</CardDescription>
          </div>
          <StatusBadge status={summary.overall_status} prominent />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className={`rounded-lg border p-4 ${metric.classes}`}>
              <p className="text-xs font-semibold tracking-wide">{metric.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{metric.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeclarationCard({ entry }: { entry: ExtractedField }) {
  const certainty = confidence(entry.extraction_confidence ?? entry.ocr_confidence);
  return (
    <div className={`rounded-lg border p-4 ${entry.present ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50/70"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{humanize(entry.field_name)}</p>
        <span className={`size-2 rounded-full ${entry.present ? "bg-emerald-500" : "bg-slate-300"}`} aria-label={entry.present ? "Detected" : "Missing"} />
      </div>
      <p className={`mt-2 break-words text-sm font-medium leading-6 ${entry.present ? "text-slate-900" : "text-slate-400"}`}>
        {displayValue(entry.normalized_value)}
      </p>
      {(certainty || entry.raw_text) && (
        <div className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          {certainty && <p>{certainty}</p>}
          {entry.raw_text && <p className="mt-1 line-clamp-3">Source: {entry.raw_text}</p>}
        </div>
      )}
    </div>
  );
}

function Declarations({ report }: { report: CanonicalReport }) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-sky-100 text-sky-900"><ScanText className="size-5" /></div>
          <div>
            <CardTitle>Extracted declarations</CardTitle>
            <CardDescription>Normalized values with OCR-linked source evidence.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {Object.values(report.extracted_fields).map((entry) => <DeclarationCard key={entry.field_name} entry={entry} />)}
      </CardContent>
    </Card>
  );
}

function ImageQualityPanel({ report }: { report: CanonicalReport }) {
  const quality = report.quality;
  const ocrEvidence = report.ocr.evidence ?? [];
  const metrics = [
    { label: "Resolution", value: report.image.width && report.image.height ? `${report.image.width} × ${report.image.height}` : "Unavailable" },
    { label: "Blur score", value: quality.blur_score?.toFixed(2) ?? "Unavailable" },
    { label: "Brightness", value: quality.brightness?.toFixed(2) ?? "Unavailable" },
    { label: "Glare ratio", value: typeof quality.glare_ratio === "number" ? `${(quality.glare_ratio * 100).toFixed(2)}%` : "Unavailable" },
  ];
  return (
    <div className="space-y-5">
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-sky-100 text-sky-900"><ImageIcon className="size-5" /></div>
            <div>
              <CardTitle>Image quality</CardTitle>
              <CardDescription>Engineering signals that affect result certainty.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-sm text-slate-600">Usability</span>
            <Badge variant="outline" className={quality.usable ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}>
              {quality.usable ? "USABLE" : "REVIEW"}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">{metric.label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{metric.value}</dd>
              </div>
            ))}
          </dl>
          {[...(quality.issues ?? []), ...(quality.warnings ?? [])].length > 0 && (
            <div className="space-y-2">
              {[...(quality.issues ?? []), ...(quality.warnings ?? [])].map((issue) => (
                <div key={issue} className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  <TriangleAlert className="size-3.5 shrink-0" /> {humanize(issue)}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] leading-5 text-slate-400">{quality.threshold_basis}</p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-sky-100 text-sky-900"><Aperture className="size-5" /></div>
            <div>
              <CardTitle>OCR evidence</CardTitle>
              <CardDescription>{report.ocr.filtered_item_count ?? ocrEvidence.length} text regions retained.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ocrEvidence.length ? (
            <Accordion>
              <AccordionItem value="ocr-lines">
                <AccordionTrigger>View detected text</AccordionTrigger>
                <AccordionContent>
                  <ul className="max-h-72 space-y-2 overflow-auto pr-2">
                    {ocrEvidence.map((item, index) => (
                      <li key={`${item.raw_text ?? item.normalized_text ?? "ocr"}-${index}`} className="flex items-start justify-between gap-4 rounded-md bg-slate-50 p-3 text-xs">
                        <span className="break-words text-slate-700">{item.raw_text ?? item.normalized_text ?? "Unlabelled OCR region"}</span>
                        {confidence(item.confidence) && <span className="shrink-0 text-slate-400">{confidence(item.confidence)}</span>}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : <p className="text-sm text-slate-500">No OCR evidence was returned.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function EvidenceDetails({ item }: { item: RuleEvidence }) {
  const fields = [
    item.field && ["Field", humanize(item.field)],
    item.value !== undefined && ["Detected value", displayValue(item.value)],
    item.raw_text && ["OCR evidence", item.raw_text],
    item.target && ["Target", humanize(item.target)],
    item.ocr_text && ["Target text", item.ocr_text],
    typeof item.contrast_ratio === "number" && ["Contrast ratio", item.contrast_ratio.toFixed(3)],
    typeof item.lab_difference === "number" && ["Lab difference", item.lab_difference.toFixed(3)],
    typeof item.estimated_numeral_height_mm === "number" && ["Estimated numeral height", `${item.estimated_numeral_height_mm.toFixed(2)} mm`],
    item.measurement_status && ["Measurement status", humanize(item.measurement_status)],
    item.validation_status && ["Validation status", humanize(item.validation_status)],
    item.unresolved_reason && ["Measurement limitation", item.unresolved_reason],
    confidence(item.confidence) && ["Confidence", confidence(item.confidence)],
  ].filter(Boolean) as Array<[string, string]>;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">{humanize(item.evidence_type)}</p>
      {fields.length ? (
        <dl className="space-y-2">
          {fields.map(([label, value]) => (
            <div key={label} className="grid gap-1 text-xs sm:grid-cols-[9rem_1fr]">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="break-words text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="text-xs text-slate-500">No additional evidence fields were available.</p>}
    </div>
  );
}

function RuleCard({ rule }: { rule: RuleResult }) {
  const presentation = statusPresentation[rule.status];
  return (
    <AccordionItem value={rule.rule_id} className={`rounded-xl border ${presentation.panel} bg-white px-4 shadow-sm sm:px-5`}>
      <AccordionTrigger className="gap-4 py-4 hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-col gap-2 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.12em] text-sky-800">{rule.rule_id} · {rule.legal_source}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{rule.description}</p>
          </div>
          <StatusBadge status={rule.status} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        <div className="grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_1.25fr]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Evaluation</p>
              <p className="mt-2 text-sm leading-6 text-slate-800">{rule.reason}</p>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Field</dt><dd className="font-medium text-slate-800">{humanize(rule.field_name)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Applicable</dt><dd className="font-medium text-slate-800">{rule.applicable ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Confidence</dt><dd className="font-medium text-slate-800">{confidence(rule.confidence) ?? "Not available"}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {rule.reason_codes.map((code) => <Badge key={code} variant="outline" className="bg-slate-50 font-mono text-[10px] text-slate-600">{code}</Badge>)}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Evidence references</p>
            {rule.evidence.length ? rule.evidence.map((item, index) => <EvidenceDetails key={`${item.evidence_type}-${index}`} item={item} />) : (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No linked evidence was returned for this rule.</p>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function RuleResults({ report }: { report: CanonicalReport }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-800"><FileCheck2 className="size-4" /> Rule evaluation</div>
          <h2 className="text-xl font-semibold text-slate-950">Legal Metrology rule results</h2>
        </div>
        <p className="text-xs text-slate-500">{report.rule_results.length} rules</p>
      </div>
      <Accordion className="gap-3">
        {report.rule_results.map((rule) => <RuleCard key={rule.rule_id} rule={rule} />)}
      </Accordion>
    </section>
  );
}

function MeasurementAndContrast({ report }: { report: CanonicalReport }) {
  const numeral = report.evidence.numeral_height;
  const calibration = report.evidence.calibration;
  const targets = Object.entries(report.evidence.contrast?.targets ?? {});
  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-800"><Microscope className="size-4" /> Engineering evidence</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-indigo-100 text-indigo-900"><Ruler className="size-5" /></div>
              <div><CardTitle>Numeral height</CardTitle><CardDescription>LM-R7 measurement and calibration evidence.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Estimated height</dt><dd className="mt-1 font-semibold">{typeof numeral?.estimated_numeral_height_mm === "number" ? `${numeral.estimated_numeral_height_mm.toFixed(2)} mm` : "Unavailable"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Confidence</dt><dd className="mt-1 font-semibold">{confidence(numeral?.measurement_confidence) ?? "Unavailable"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Calibration</dt><dd className="mt-1 font-semibold">{calibration?.detected ? "Detected" : "Unavailable"}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Scale</dt><dd className="mt-1 font-semibold">{typeof numeral?.pixels_per_mm === "number" ? `${numeral.pixels_per_mm.toFixed(3)} px/mm` : "Unavailable"}</dd></div>
            </dl>
            {numeral?.unresolved_reason && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><TriangleAlert /><AlertTitle>Review required</AlertTitle><AlertDescription className="text-amber-900/80">{numeral.unresolved_reason}</AlertDescription></Alert>}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-indigo-100 text-indigo-900"><CircleGauge className="size-5" /></div>
              <div><CardTitle>Contrast &amp; legibility</CardTitle><CardDescription>LM-R9 local contrast measurements.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {targets.length ? targets.map(([name, target]) => (
              <div key={name} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{humanize(name)}</p><Badge variant="outline" className="bg-slate-50">{target.status ?? "UNKNOWN"}</Badge></div>
                <p className="mt-1 text-xs text-slate-500">{target.ocr_text ?? "No target text"}</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-500">Contrast ratio</dt><dd className="mt-1 font-semibold">{target.contrast_ratio?.toFixed(3) ?? "Unavailable"}</dd></div>
                  <div><dt className="text-slate-500">Lab difference</dt><dd className="mt-1 font-semibold">{target.lab_color_difference?.toFixed(3) ?? "Unavailable"}</dd></div>
                </dl>
              </div>
            )) : <p className="text-sm text-slate-500">No contrast evidence was returned.</p>}
            {report.evidence.contrast?.threshold_basis && <p className="text-[11px] leading-5 text-slate-400">{report.evidence.contrast.threshold_basis}</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ReportDashboard({ report, onReset }: { report: CanonicalReport; onReset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <SummaryHeader report={report} />

      {report.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <TriangleAlert />
          <AlertTitle>Processing notes</AlertTitle>
          <AlertDescription className="text-amber-900/80">
            {report.warnings.map((warning) => <p key={`${warning.code}-${warning.source_code}`}>{warning.message}</p>)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Declarations report={report} />
        <ImageQualityPanel report={report} />
      </div>

      <RuleResults report={report} />
      <MeasurementAndContrast report={report} />

      <Card className="bg-sky-950 text-white">
        <CardContent className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Braces className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold">Report complete</p>
              <p className="mt-1 text-xs leading-5 text-sky-200">{report.image.filename} · {report.rule_results.length} rules · processed {report.image.processing_timestamp ? new Date(report.image.processing_timestamp).toLocaleString() : "timestamp unavailable"}</p>
            </div>
          </div>
          <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={onReset}><RotateCcw /> Analyze another image</Button>
        </CardContent>
      </Card>

      <Separator />
      <p className="mx-auto max-w-3xl text-center text-xs leading-5 text-slate-500">{report.disclaimer}</p>
    </div>
  );
}
