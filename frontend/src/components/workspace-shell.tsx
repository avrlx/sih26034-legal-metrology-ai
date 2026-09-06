"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  FileText,
  History,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
  ExternalLink,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ReportDashboard } from "@/components/report-dashboard";
import { analyzePackage, checkHealth, loadDemoSample } from "@/services/api";
import { fetchInspections, fetchProfile, type InspectionRecord, type ProfileRecord } from "@/services/workspace-data";
import { downloadCompliancePdf } from "@/lib/report-pdf";
import type { CanonicalReport, ReportStatus } from "@/types/report";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);
const PIPELINE_STAGES = [
  "Image uploaded",
  "Image quality check",
  "OCR text detection",
  "Declaration extraction",
  "Rule evaluation",
  "Compliance report generation",
];

type ServiceState = "checking" | "available" | "unavailable";
type View = "dashboard" | "new-inspection" | "history" | "violations" | "analytics" | "rules" | "reports" | "settings";

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "new-inspection", label: "New Inspection", icon: ScanLine },
  { id: "history", label: "Inspection History", icon: History },
  { id: "violations", label: "Violations", icon: ClipboardCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "rules", label: "Rule Management", icon: SlidersHorizontal },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

const RULE_CATALOG = [
  ["LM-R6-001", "Manufacturer / packer / importer declaration", "Rule 6(1)(a)", "Mandatory declaration"],
  ["LM-R6-005", "Common or generic name of commodity", "Rule 6(1)(b)", "Mandatory declaration"],
  ["LM-R6-006", "Net quantity declaration", "Rule 6(1)(c); Rule 12; Rule 13", "Mandatory declaration"],
  ["LM-R6-007", "Month / year of manufacture or pre-packing", "Rule 6(1)(d)", "Mandatory declaration"],
  ["LM-R6-008", "Retail sale price (MRP)", "Rule 2(m); Rule 6(1)(e)", "Mandatory declaration"],
  ["LM-R6-010", "Consumer care details", "Rule 6(2)", "Mandatory declaration"],
  ["LM-R13-001", "Correct unit / sub-unit for declared quantity", "Rule 13(2); Rule 13(3)", "Quantity"],
  ["LM-R7-001", "Minimum numeral height", "Rule 7(2); Table-I", "Physical measurement"],
  ["LM-R9-002", "MRP and quantity contrast / legibility", "Rule 9", "Legibility"],
  ["LM-R26-001", "Small-package exemption applicability", "Rule 26", "Applicability"],
] as const;

function fileError(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) return "Choose a JPEG, JPG, or PNG image.";
  if (file.size > MAX_FILE_BYTES) return "Choose an image no larger than 10 MB.";
  if (file.size === 0) return "The selected image is empty.";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusClass(status: string): string {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "FAIL") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{status}</span>;
}

function ServiceIndicator({ state }: { state: ServiceState }) {
  const available = state === "available";
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500" aria-live="polite">
      <span className={`size-2 rounded-full ${state === "checking" ? "animate-pulse bg-amber-400" : available ? "bg-emerald-500" : "bg-rose-500"}`} />
      {state === "checking" ? "Checking AI service" : available ? "AI service online" : "AI service unavailable"}
    </div>
  );
}

function Sidebar({ view, onNavigate, open, onClose }: { view: View; onNavigate: (view: View) => void; open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-sky-950 text-white transition-transform lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><ShieldCheck className="size-5" /></div>
            <div><p className="font-semibold tracking-tight">ComplyVision</p><p className="text-[10px] uppercase tracking-[0.16em] text-sky-200">Legal Metrology AI</p></div>
          </div>
          <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close navigation"><X className="size-5" /></button>
        </div>
        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Workspace</p>
          <nav className="space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { onNavigate(id); onClose(); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${view === id ? "bg-white text-sky-950 shadow-sm" : "text-sky-100 hover:bg-white/10"}`}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4"><div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10"><p className="text-xs font-semibold">SIH 2026 · PS26034</p><p className="mt-1 text-[11px] leading-5 text-sky-200">AI-assisted package declaration inspection.</p></div></div>
      </aside>
    </>
  );
}

function TopBar({ onMenu, service }: { onMenu: () => void; service: ServiceState }) {
  return <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button><div><p className="text-sm font-semibold text-slate-900">Legal Metrology Inspection Portal</p><p className="hidden text-[11px] text-slate-500 sm:block">Evidence-backed compliance decision support</p></div></div><ServiceIndicator state={service} /></header>;
}

function StatCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: "blue" | "green" | "rose" | "amber" }) {
  const tones = { blue: "border-sky-200 bg-sky-50 text-sky-900", green: "border-emerald-200 bg-emerald-50 text-emerald-900", rose: "border-rose-200 bg-rose-50 text-rose-900", amber: "border-amber-200 bg-amber-50 text-amber-900" };
  return <Card className="bg-white"><CardContent className="p-5"><div className={`mb-4 grid size-9 place-items-center rounded-lg border ${tones[tone]}`}><Activity className="size-4" /></div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></CardContent></Card>;
}

function UploadPanel({ selectedFile, onFile, onAnalyze, error, onDemo }: { selectedFile: File | null; onFile: (file: File) => void; onAnalyze: () => void; error: string | null; onDemo: (path: string, filename: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <Card className="mx-auto w-full max-w-3xl border-t-4 border-t-amber-500 bg-white shadow-[0_20px_60px_rgba(20,48,64,0.12)]"><CardHeader className="border-b border-slate-100 pb-5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800"><ScanLine className="size-4" /> New inspection</div><CardTitle className="text-2xl">Analyze a package declaration</CardTitle><CardDescription className="max-w-xl leading-6">Upload one clear package panel. The service extracts declarations and produces an evidence-backed Legal Metrology review.</CardDescription></CardHeader><CardContent className="space-y-5 pt-6"><div data-testid="drop-zone" onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) onFile(file); }} className={`relative flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? "border-sky-600 bg-sky-50" : "border-slate-300 bg-slate-50/70 hover:border-sky-500 hover:bg-sky-50/50"}`}><div className="mb-4 grid size-14 place-items-center rounded-xl bg-sky-950 text-white"><FileImage className="size-7" /></div>{selectedFile ? <><p className="max-w-full truncate font-semibold text-slate-900">{selectedFile.name}</p><p className="mt-1 text-sm text-slate-500">{formatBytes(selectedFile.size)}</p><Button variant="outline" className="mt-5" onClick={() => inputRef.current?.click()}>Replace image</Button></> : <><p className="font-semibold text-slate-900">Drop a package image here</p><p className="mt-1 text-sm text-slate-500">or browse from your device</p><Button className="mt-5 bg-sky-950 hover:bg-sky-900" onClick={() => inputRef.current?.click()}><UploadCloud /> Browse image</Button></>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" aria-label="Package image" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} /></div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="text-xs leading-5 text-slate-500"><p>JPEG, JPG or PNG · Maximum 10 MB</p><p>For best results, keep declarations sharp and fully visible.</p></div><Button size="lg" className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400" disabled={!selectedFile} onClick={onAnalyze}><ShieldCheck /> Analyze package</Button></div><div className="rounded-lg border border-sky-100 bg-sky-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-900">Try a real sample</p><p className="mt-1 text-xs text-slate-600">Demo images use the same POST /analyze pipeline as uploads.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/standard-package.jpg", "standard-package.jpg")}>Standard package</Button><Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/high-glare-package.jpg", "high-glare-package.jpg")}>High-glare package</Button></div></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Image not ready</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</CardContent></Card>;
}

function AnalysisProgress({ stage }: { stage: number }) {
  return <Card className="mx-auto w-full max-w-3xl bg-white"><CardHeader><div className="mb-3 flex items-center justify-between"><div><CardTitle>Generating compliance report</CardTitle><CardDescription className="mt-1">The backend returns one complete canonical report.</CardDescription></div><LoaderCircle className="size-7 animate-spin text-sky-700" /></div><Progress value={Math.min(((stage + 1) / PIPELINE_STAGES.length) * 100, 94)} /></CardHeader><CardContent><ol className="grid gap-3 sm:grid-cols-2">{PIPELINE_STAGES.map((label, index) => <li key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${index <= stage ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}><span className={`grid size-6 place-items-center rounded-full ${index < stage ? "bg-emerald-600 text-white" : index === stage ? "bg-sky-800 text-white" : "bg-slate-200"}`}>{index < stage ? <CheckCircle2 className="size-3.5" /> : index + 1}</span><span className="text-sm font-medium">{label}</span></li>)}</ol></CardContent></Card>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><ShieldCheck className="mx-auto size-10 text-sky-800" /><p className="mt-4 font-semibold text-slate-900">{title}</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{action}</div>;
}

function DashboardView({ inspections, onNavigate, onOpenReport, onNew }: { inspections: InspectionRecord[]; onNavigate: (view: View) => void; onOpenReport: (report: CanonicalReport) => void; onNew: () => void }) {
  const total = inspections.length;
  const pass = inspections.filter((x) => x.status === "PASS").length;
  const fail = inspections.filter((x) => x.status === "FAIL").length;
  const review = inspections.filter((x) => x.status === "REVIEW").length;
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Overview</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Compliance Dashboard</h1><p className="mt-2 text-sm text-slate-500">Live statistics from your persisted inspection history.</p></div><Button onClick={onNew} className="bg-sky-950 hover:bg-sky-900"><ScanLine /> New Inspection</Button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total Inspections" value={total} detail="Saved to your workspace" tone="blue" /><StatCard label="Compliant" value={pass} detail={total ? `${((pass / total) * 100).toFixed(1)}% of inspections` : "No inspections yet"} tone="green" /><StatCard label="Violations" value={fail} detail="Require corrective action" tone="rose" /><StatCard label="Needs Review" value={review} detail="Awaiting human verification" tone="amber" /></div>{total === 0 ? <Card className="bg-white"><CardContent className="pt-6"><EmptyState title="No inspections yet" description="Run your first package analysis. Completed reports will automatically appear here and in Inspection History." action={<Button className="mt-5 bg-sky-950 hover:bg-sky-900" onClick={onNew}><ScanLine /> Start first inspection</Button>} /></CardContent></Card> : <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><Card className="bg-white"><CardHeader><CardTitle>Recent inspections</CardTitle><CardDescription>Open any saved report to review the evidence and rule results.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="pb-3 font-medium">Inspection</th><th className="pb-3 font-medium">Product</th><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{inspections.slice(0, 5).map((item) => <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50"><td className="py-3"><button className="font-semibold text-sky-800 hover:underline" onClick={() => onOpenReport(item.report)}>{item.id.slice(0, 8).toUpperCase()}</button></td><td className="py-3 text-slate-600">{item.product_name || "Not detected"}</td><td className="py-3 text-slate-500">{formatDate(item.created_at)}</td><td className="py-3"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div><Button variant="outline" className="mt-4" onClick={() => onNavigate("history")}>View all inspections</Button></CardContent></Card><Card className="bg-white"><CardHeader><CardTitle>Outcome mix</CardTitle><CardDescription>Current saved inspection distribution.</CardDescription></CardHeader><CardContent className="space-y-5">{[["Compliant", pass, "bg-emerald-500"],["Violations", fail, "bg-rose-500"],["Needs review", review, "bg-amber-500"]].map(([label, count, color]) => <div key={String(label)}><div className="flex justify-between text-sm"><span className="text-slate-700">{label}</span><span className="font-semibold text-slate-900">{count}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${total ? Math.max(Number(count) / total * 100, Number(count) ? 4 : 0) : 0}%` }} /></div></div>)}<Button variant="outline" onClick={() => onNavigate("analytics")}>Open analytics</Button></CardContent></Card></div>}<Card className="border-sky-100 bg-sky-50/60"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sky-950">AI-assisted, human-verified</p><p className="mt-1 text-sm text-slate-600">OCR and extraction accelerate inspection; the rule engine remains the source of compliance decisions and uncertain cases are surfaced for review.</p></div><Button variant="outline" onClick={() => onNavigate("rules")}>View rule framework</Button></CardContent></Card></div>;
}

function HistoryView({ inspections, onOpenReport }: { inspections: InspectionRecord[]; onOpenReport: (report: CanonicalReport) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ReportStatus>("ALL");
  const filtered = inspections.filter((item) => { const haystack = `${item.id} ${item.product_name ?? ""} ${item.source_filename ?? ""}`.toLowerCase(); return haystack.includes(query.toLowerCase()) && (status === "ALL" || item.status === status); });
  return <Section title="Inspection History" eyebrow="Workspace" description="Search, filter and reopen every report saved to your authenticated workspace."><div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, file or inspection ID" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500" /></div><select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | ReportStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="ALL">All statuses</option><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="REVIEW">REVIEW</option></select></div><Card className="bg-white"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b text-xs text-slate-500"><th className="px-5 py-3">Inspection</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-900">{item.id.slice(0, 8).toUpperCase()}</td><td className="px-5 py-4 text-slate-600">{item.product_name || "Not detected"}</td><td className="px-5 py-3"><div className="flex items-center gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">{item.source_image_data_url ? <img src={item.source_image_data_url} alt={`Scanned source for ${item.source_filename || "inspection"}`} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-slate-400"><FileImage className="size-5" /></div>}</div><div className="min-w-0"><p className="max-w-48 truncate text-xs font-medium text-slate-700">{item.source_filename || "uploaded image"}</p><p className="mt-0.5 text-[11px] text-slate-400">Scanned package</p></div></div></td><td className="px-5 py-4 text-slate-500">{formatDate(item.created_at)}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={() => onOpenReport(item.report)}>Open report</Button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="p-8"><EmptyState title="No matching inspections" description={inspections.length ? "Try a different search or status filter." : "Run an inspection to start building your history."} /></div>}</CardContent></Card></Section>;
}

function ViolationsView({ inspections, onOpenReport }: { inspections: InspectionRecord[]; onOpenReport: (report: CanonicalReport) => void }) {
  const rows = inspections.flatMap((inspection) => inspection.report.rule_results.filter((rule) => rule.status === "FAIL" || rule.status === "REVIEW").map((rule) => ({ inspection, rule })));
  const grouped = new Map<string, number>();
  rows.forEach(({ rule }) => grouped.set(rule.rule_id, (grouped.get(rule.rule_id) ?? 0) + 1));
  return <Section title="Violations" eyebrow="Workspace" description="Review failed and uncertain rule checks across your saved inspections."><div className="grid gap-4 sm:grid-cols-3 mb-5"><StatCard label="Total findings" value={rows.length} detail="FAIL + REVIEW" tone="rose" /><StatCard label="Failed checks" value={rows.filter((x) => x.rule.status === "FAIL").length} detail="Definite non-compliance" tone="rose" /><StatCard label="Review checks" value={rows.filter((x) => x.rule.status === "REVIEW").length} detail="Human verification needed" tone="amber" /></div><Card className="bg-white"><CardHeader><CardTitle>Finding register</CardTitle><CardDescription>Each row links back to the complete evidence-backed report.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="pb-3">Rule</th><th className="pb-3">Inspection</th><th className="pb-3">Product</th><th className="pb-3">Status</th><th className="pb-3">Reason</th><th className="pb-3">Action</th></tr></thead><tbody>{rows.map(({ inspection, rule }, index) => <tr key={`${inspection.id}-${rule.rule_id}-${index}`} className="border-b last:border-0"><td className="py-3 font-semibold text-slate-900">{rule.rule_id}</td><td className="py-3 text-slate-600">{inspection.id.slice(0, 8).toUpperCase()}</td><td className="py-3 text-slate-600">{inspection.product_name || "Not detected"}</td><td className="py-3"><StatusBadge status={rule.status} /></td><td className="max-w-[420px] py-3 text-slate-500">{rule.reason}</td><td className="py-3"><Button size="sm" variant="outline" onClick={() => onOpenReport(inspection.report)}>Review</Button></td></tr>)}</tbody></table></div>{rows.length === 0 && <EmptyState title="No violations recorded" description="Completed inspections with FAIL or REVIEW rule results will appear here." />}</CardContent></Card><Card className="mt-5 bg-white"><CardHeader><CardTitle>Most frequent rules</CardTitle></CardHeader><CardContent className="space-y-3">{Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).map(([ruleId, count]) => <div key={ruleId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="font-medium text-slate-700">{ruleId}</span><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">{count} finding{count === 1 ? "" : "s"}</span></div>)}</CardContent></Card></Section>;
}

function AnalyticsView({ inspections }: { inspections: InspectionRecord[] }) {
  const total = inspections.length;
  const counts = { PASS: inspections.filter((x) => x.status === "PASS").length, FAIL: inspections.filter((x) => x.status === "FAIL").length, REVIEW: inspections.filter((x) => x.status === "REVIEW").length };
  const ruleCounts = new Map<string, number>();
  inspections.forEach((inspection) => inspection.report.rule_results.filter((r) => r.status === "FAIL").forEach((rule) => ruleCounts.set(rule.rule_id, (ruleCounts.get(rule.rule_id) ?? 0) + 1)));
  const topRules = Array.from(ruleCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return <Section title="Analytics" eyebrow="Workspace" description="Understand compliance outcomes and recurring failed rules from your actual inspection data."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Inspections" value={total} detail="Persisted reports" tone="blue" /><StatCard label="Compliance rate" value={total ? Math.round(counts.PASS / total * 100) : 0} detail="Percent PASS" tone="green" /><StatCard label="Violation rate" value={total ? Math.round(counts.FAIL / total * 100) : 0} detail="Percent FAIL" tone="rose" /><StatCard label="Review rate" value={total ? Math.round(counts.REVIEW / total * 100) : 0} detail="Percent REVIEW" tone="amber" /></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card className="bg-white"><CardHeader><CardTitle>Outcome distribution</CardTitle></CardHeader><CardContent className="space-y-5">{(["PASS", "FAIL", "REVIEW"] as const).map((status) => <div key={status}><div className="mb-2 flex justify-between text-sm"><span>{status}</span><span className="font-semibold">{counts[status]}</span></div><div className="h-4 rounded-full bg-slate-100"><div className={`h-4 rounded-full ${status === "PASS" ? "bg-emerald-500" : status === "FAIL" ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${total ? counts[status] / total * 100 : 0}%` }} /></div></div>)}</CardContent></Card><Card className="bg-white"><CardHeader><CardTitle>Recurring failed rules</CardTitle><CardDescription>Only definite FAIL results are included.</CardDescription></CardHeader><CardContent className="space-y-3">{topRules.length ? topRules.map(([rule, count]) => <div key={rule} className="flex items-center gap-3"><span className="w-24 text-xs font-semibold text-slate-600">{rule}</span><div className="h-3 flex-1 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-rose-500" style={{ width: `${Math.min(count / Math.max(topRules[0][1], 1) * 100, 100)}%` }} /></div><span className="w-8 text-right text-xs font-semibold">{count}</span></div>) : <EmptyState title="Not enough data" description="Run inspections that produce FAIL results to populate recurring-rule analytics." />}</CardContent></Card></div></Section>;
}

function RulesView() {
  const [query, setQuery] = useState("");
  const filtered = RULE_CATALOG.filter(([id, name, source, category]) => `${id} ${name} ${source} ${category}`.toLowerCase().includes(query.toLowerCase()));
  return <Section title="Rule Management" eyebrow="Legal Metrology" description="Search the versioned compliance rule catalog used to explain inspection outcomes. Legal decisions remain enforced by the backend rule engine."><div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rule ID, declaration or source" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500" /></div><a href="https://consumeraffairs.gov.in/pages/legal-metrology-act" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline">Official DCA source <ExternalLink className="size-4" /></a></div><Card className="mb-5 border-sky-100 bg-sky-50/60"><CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sky-950">Rule engine status: active</p><p className="text-sm text-slate-600">Current UI catalog contains {RULE_CATALOG.length} inspection rules. The backend remains authoritative for PASS / FAIL / REVIEW decisions.</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Versioned</span></CardContent></Card><div className="grid gap-4 md:grid-cols-2">{filtered.map(([id, name, source, category]) => <Card key={id} className="bg-white"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-sky-700">{id}</p><h3 className="mt-1 font-semibold text-slate-900">{name}</h3></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{category}</span></div><p className="mt-3 text-sm text-slate-500">Legal source: {source}</p><p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Available to the inspection engine</p></CardContent></Card>)}</div>{filtered.length === 0 && <EmptyState title="No rules found" description="Try another search term." />}</Section>;
}

function ReportsView({ inspections, onOpenReport }: { inspections: InspectionRecord[]; onOpenReport: (report: CanonicalReport) => void }) {
  return <Section title="Reports" eyebrow="Workspace" description="Open saved compliance reports or download a detailed, shareable PDF report."><Card className="bg-white"><CardHeader><CardTitle>Report archive</CardTitle><CardDescription>{inspections.length} report{inspections.length === 1 ? "" : "s"} available in this workspace. PDF exports include inspection details, extracted declarations, every rule result, evidence and limitations.</CardDescription></CardHeader><CardContent className="space-y-3">{inspections.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{item.product_name || "Unnamed commodity"}</p><p className="mt-1 text-xs text-slate-500">{item.id.slice(0, 8).toUpperCase()} · {formatDate(item.created_at)} · {item.source_filename || "uploaded image"}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><Button size="sm" variant="outline" onClick={() => onOpenReport(item.report)}><FileText /> Open</Button><Button size="sm" className="bg-sky-950 text-white hover:bg-sky-900" onClick={() => downloadCompliancePdf(item.report, { inspectionId: item.id, createdAt: item.created_at, sourceFilename: item.source_filename, sourceImageDataUrl: item.source_image_data_url })}><FileText /> PDF</Button></div></div>)}{inspections.length === 0 && <EmptyState title="No reports yet" description="Your first completed inspection will automatically appear here." />}</CardContent></Card></Section>;
}

function SettingsView({ profile, service, onRefreshHealth }: { profile: ProfileRecord | null; service: ServiceState; onRefreshHealth: () => void }) {
  return <Section title="Settings" eyebrow="Workspace" description="Review account, service and persistence configuration for this inspection workspace."><div className="grid gap-5 lg:grid-cols-2"><Card className="bg-white"><CardHeader><CardTitle>Inspector account</CardTitle><CardDescription>Your authenticated workspace identity.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Full name</p><p className="mt-1 font-medium text-slate-900">{profile?.full_name || "Not provided"}</p><p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Role</p><p className="mt-1 font-medium capitalize text-slate-900">{profile?.role || "Inspector"}</p></div><Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline">Manage account & profile <ExternalLink className="size-4" /></Link></CardContent></Card><Card className="bg-white"><CardHeader><CardTitle>AI service</CardTitle><CardDescription>Connection status for the FastAPI analysis backend.</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between rounded-lg border border-slate-200 p-4"><div><p className="font-medium text-slate-900">Backend availability</p><p className="mt-1 text-xs text-slate-500">{service === "available" ? "Connected to the local AI service." : service === "checking" ? "Checking connection…" : "Backend is unavailable."}</p></div><span className={`size-3 rounded-full ${service === "available" ? "bg-emerald-500" : service === "checking" ? "bg-amber-400" : "bg-rose-500"}`} /></div><Button variant="outline" className="mt-4" onClick={onRefreshHealth}><RefreshCw /> Check again</Button></CardContent></Card><Card className="bg-white lg:col-span-2"><CardHeader><CardTitle>Data & privacy</CardTitle><CardDescription>How this prototype handles inspection history.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-4"><p className="font-medium">Persistent history</p><p className="mt-1 text-xs leading-5 text-slate-500">Completed reports are stored in the authenticated Supabase inspections table.</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="font-medium">Row-level access</p><p className="mt-1 text-xs leading-5 text-slate-500">Your history is scoped to the signed-in user by database policies.</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="font-medium">AI decision support</p><p className="mt-1 text-xs leading-5 text-slate-500">The application is a decision-support prototype, not an official certificate or legal opinion.</p></div></CardContent></Card></div></Section>;
}

function Section({ title, eyebrow, description, children }: { title: string; eyebrow: string; description: string; children: React.ReactNode }) {
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>{children}</div>;
}

export function WorkspaceShell() {
  const [service, setService] = useState<ServiceState>("checking");
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [report, setReport] = useState<CanonicalReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);

  const refreshHealth = useCallback(async () => {
    setService("checking");
    try { await checkHealth(); setService("available"); } catch { setService("unavailable"); }
  }, []);

  const refreshData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [history, userProfile] = await Promise.all([fetchInspections(), fetchProfile()]);
      setInspections(history);
      setProfile(userProfile);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Inspection history could not be loaded.");
    } finally { setDataLoading(false); }
  }, []);

  useEffect(() => { void refreshHealth(); void refreshData(); }, [refreshHealth, refreshData]);
  useEffect(() => { if (!analyzing) return; const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, PIPELINE_STAGES.length - 1)), 850); return () => window.clearInterval(timer); }, [analyzing]);

  const selectFile = useCallback((file: File) => { const error = fileError(file); setValidationError(error); setRequestError(null); setReport(null); setSelectedFile(error ? null : file); }, []);
  const analyze = async () => { if (!selectedFile || analyzing) return; setAnalyzing(true); setStage(0); setRequestError(null); try { const nextReport = await analyzePackage(selectedFile); setReport(nextReport); await refreshData(); } catch (error) { setRequestError(error instanceof Error ? error.message : "Analysis could not be completed."); } finally { setAnalyzing(false); } };
  const selectDemo = async (path: string, filename: string) => { setRequestError(null); try { selectFile(await loadDemoSample(path, filename)); } catch (error) { setRequestError(error instanceof Error ? error.message : "The demo image could not be loaded."); } };
  const reset = () => { setSelectedFile(null); setValidationError(null); setRequestError(null); setReport(null); setStage(0); };
  const goNew = () => { reset(); setView("new-inspection"); };
  const openReport = (nextReport: CanonicalReport) => { setReport(nextReport); setSelectedFile(null); setRequestError(null); setValidationError(null); setView("new-inspection"); };

  let content: React.ReactNode;
  if (view === "dashboard") content = <DashboardView inspections={inspections} onNavigate={setView} onOpenReport={openReport} onNew={goNew} />;
  else if (view === "new-inspection") content = analyzing ? <AnalysisProgress stage={stage} /> : report ? <ReportDashboard report={report} onReset={reset} /> : <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">New Inspection</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Inspect a packaged commodity</h1></div>{requestError && <Alert variant="destructive" className="mx-auto mb-5 max-w-3xl bg-white"><AlertTriangle /><AlertTitle>Analysis interrupted</AlertTitle><AlertDescription>{requestError}</AlertDescription></Alert>}<UploadPanel selectedFile={selectedFile} onFile={selectFile} onAnalyze={analyze} onDemo={selectDemo} error={validationError} /></>;
  else if (dataLoading) content = <Card className="bg-white"><CardContent className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin" /> Loading workspace data…</CardContent></Card>;
  else if (dataError) content = <Card className="bg-white"><CardContent className="py-10"><Alert variant="destructive"><AlertTriangle /><AlertTitle>Workspace data unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{dataError}</span><Button variant="outline" size="sm" onClick={() => void refreshData()}><RefreshCw /> Retry</Button></AlertDescription></Alert></CardContent></Card>;
  else if (view === "history") content = <HistoryView inspections={inspections} onOpenReport={openReport} />;
  else if (view === "violations") content = <ViolationsView inspections={inspections} onOpenReport={openReport} />;
  else if (view === "analytics") content = <AnalyticsView inspections={inspections} />;
  else if (view === "rules") content = <RulesView />;
  else if (view === "reports") content = <ReportsView inspections={inspections} onOpenReport={openReport} />;
  else content = <SettingsView profile={profile} service={service} onRefreshHealth={() => void refreshHealth()} />;

  return <div className="min-h-screen bg-slate-50 lg:flex"><Sidebar view={view} onNavigate={setView} open={mobileNav} onClose={() => setMobileNav(false)} /><div className="min-w-0 flex-1"><TopBar onMenu={() => setMobileNav(true)} service={service} /><main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">{content}</main><footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400">ComplyVision · Decision-support prototype · Not an official compliance certificate or legal opinion</footer></div></div>;
}
