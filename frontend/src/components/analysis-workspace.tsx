"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardCheck,
  FileImage,
  FileText,
  History,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  ScanLine,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ReportDashboard } from "@/components/report-dashboard";
import { analyzePackage, checkHealth, loadDemoSample } from "@/services/api";
import type { CanonicalReport } from "@/types/report";

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
            <div>
              <p className="font-semibold tracking-tight">ComplyVision</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-sky-200">Legal Metrology AI</p>
            </div>
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
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
            <p className="text-xs font-semibold">SIH 2026 · PS26034</p>
            <p className="mt-1 text-[11px] leading-5 text-sky-200">AI-assisted package declaration inspection.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenu, service }: { onMenu: () => void; service: ServiceState }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
        <div>
          <p className="text-sm font-semibold text-slate-900">Legal Metrology Inspection Portal</p>
          <p className="hidden text-[11px] text-slate-500 sm:block">Evidence-backed compliance decision support</p>
        </div>
      </div>
      <ServiceIndicator state={service} />
    </header>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "blue" | "green" | "rose" | "amber" }) {
  const tones = {
    blue: "border-sky-200 bg-sky-50 text-sky-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <Card className="bg-white"><CardContent className="p-5"><div className={`mb-4 grid size-9 place-items-center rounded-lg border ${tones[tone]}`}><Activity className="size-4" /></div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></CardContent></Card>;
}

function Dashboard({ onNewInspection, onNavigate }: { onNewInspection: () => void; onNavigate: (view: View) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Overview</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Compliance Dashboard</h1><p className="mt-2 text-sm text-slate-500">Monitor inspections, violations and review workload from one place.</p></div>
        <Button onClick={onNewInspection} className="bg-sky-950 hover:bg-sky-900"><ScanLine /> New Inspection</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Inspections" value="128" detail="This inspection workspace" tone="blue" />
        <StatCard label="Compliant" value="76" detail="59.4% of inspections" tone="green" />
        <StatCard label="Violations" value="31" detail="Require corrective action" tone="rose" />
        <StatCard label="Needs Review" value="21" detail="Awaiting human verification" tone="amber" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="bg-white"><CardHeader><CardTitle>Recent inspections</CardTitle><CardDescription>Latest package reviews and their current outcome.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="pb-3 font-medium">Inspection</th><th className="pb-3 font-medium">Product</th><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{[["INSP-0128","Packaged food","Today","REVIEW"],["INSP-0127","Personal care","Today","PASS"],["INSP-0126","Household goods","Yesterday","FAIL"],["INSP-0125","Packaged food","Yesterday","PASS"]].map(([id, product, date, status]) => <tr key={id} className="border-b last:border-0"><td className="py-3 font-semibold text-slate-900">{id}</td><td className="py-3 text-slate-600">{product}</td><td className="py-3 text-slate-500">{date}</td><td className="py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "FAIL" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{status}</span></td></tr>)}</tbody></table></div><Button variant="outline" className="mt-4" onClick={() => onNavigate("history")}>View all inspections</Button></CardContent></Card>
        <Card className="bg-white"><CardHeader><CardTitle>Violation overview</CardTitle><CardDescription>Current review workload by category.</CardDescription></CardHeader><CardContent className="space-y-5">{[["Missing declaration","14","rose"],["Incorrect MRP / quantity","8","rose"],["Readability / contrast","5","amber"],["Measurement review","4","amber"]].map(([label, count, tone]) => <div key={label}><div className="flex justify-between text-sm"><span className="text-slate-700">{label}</span><span className="font-semibold text-slate-900">{count}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${tone === "rose" ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(Number(count) * 5, 90)}%` }} /></div></div>)}<Button variant="outline" onClick={() => onNavigate("violations")}>Review violations</Button></CardContent></Card>
      </div>
      <Card className="border-sky-100 bg-sky-50/60"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sky-950">AI-assisted, human-verified</p><p className="mt-1 text-sm text-slate-600">OCR and extraction accelerate inspection; the rule engine remains the source of compliance decisions and uncertain cases are surfaced for review.</p></div><Button variant="outline" onClick={onNavigate.bind(null, "rules")}>View rule framework</Button></CardContent></Card>
    </div>
  );
}

function PlaceholderView({ view, onNewInspection }: { view: View; onNewInspection: () => void }) {
  const labels: Record<View, [string, string, string]> = {
    dashboard: ["Dashboard", "Compliance overview", "Use the sidebar to navigate the inspection workspace."],
    "new-inspection": ["New Inspection", "Start a package review", "Upload a package image and run the existing AI analysis pipeline."],
    history: ["Inspection History", "Inspection history", "Searchable inspection history will be connected to persistent storage in the next backend phase."],
    violations: ["Violations", "Violation management", "Review and group detected non-compliances by rule, product and inspection."],
    analytics: ["Analytics", "Inspection analytics", "Track compliance rates, review rates and recurring violation patterns."],
    rules: ["Rule Management", "Legal Metrology rule framework", "Manage versioned rule definitions while keeping legal decision logic in the backend."],
    reports: ["Reports", "Compliance reports", "Generate and retrieve evidence-backed inspection reports."],
    settings: ["Settings", "System settings", "Configure workspace and inspection preferences."],
  };
  const [title, heading, description] = labels[view];
  return <Card className="mx-auto max-w-3xl bg-white"><CardHeader><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{title}</p><CardTitle className="text-3xl">{heading}</CardTitle><CardDescription className="max-w-2xl text-sm leading-6">{description}</CardDescription></CardHeader><CardContent><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><ShieldCheck className="mx-auto size-10 text-sky-800" /><p className="mt-4 font-semibold text-slate-900">Workspace module ready</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The navigation and application shell are now in place. The existing analysis engine remains connected through New Inspection.</p><Button className="mt-5 bg-sky-950 hover:bg-sky-900" onClick={onNewInspection}><ScanLine /> Open New Inspection</Button></div></CardContent></Card>;
}

function UploadPanel({ selectedFile, onFile, onAnalyze, error, onDemo }: { selectedFile: File | null; onFile: (file: File) => void; onAnalyze: () => void; error: string | null; onDemo: (path: string, filename: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <Card className="mx-auto w-full max-w-3xl border-t-4 border-t-amber-500 bg-white shadow-[0_20px_60px_rgba(20,48,64,0.12)]"><CardHeader className="border-b border-slate-100 pb-5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800"><ScanLine className="size-4" /> New inspection</div><CardTitle className="text-2xl">Analyze a package declaration</CardTitle><CardDescription className="max-w-xl leading-6">Upload one clear package panel. The service extracts declarations and produces an evidence-backed Legal Metrology review.</CardDescription></CardHeader><CardContent className="space-y-5 pt-6"><div data-testid="drop-zone" onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) onFile(file); }} className={`relative flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? "border-sky-600 bg-sky-50" : "border-slate-300 bg-slate-50/70 hover:border-sky-500 hover:bg-sky-50/50"}`}><div className="mb-4 grid size-14 place-items-center rounded-xl bg-sky-950 text-white"><FileImage className="size-7" /></div>{selectedFile ? <><p className="max-w-full truncate font-semibold text-slate-900">{selectedFile.name}</p><p className="mt-1 text-sm text-slate-500">{formatBytes(selectedFile.size)}</p><Button variant="outline" className="mt-5" onClick={() => inputRef.current?.click()}>Replace image</Button></> : <><p className="font-semibold text-slate-900">Drop a package image here</p><p className="mt-1 text-sm text-slate-500">or browse from your device</p><Button className="mt-5 bg-sky-950 hover:bg-sky-900" onClick={() => inputRef.current?.click()}><UploadCloud /> Browse image</Button></>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" aria-label="Package image" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} /></div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="text-xs leading-5 text-slate-500"><p>JPEG, JPG or PNG · Maximum 10 MB</p><p>For best results, keep declarations sharp and fully visible.</p></div><Button size="lg" className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400" disabled={!selectedFile} onClick={onAnalyze}><ShieldCheck /> Analyze package</Button></div><div className="rounded-lg border border-sky-100 bg-sky-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-900">Try a real sample</p><p className="mt-1 text-xs text-slate-600">Demo images use the same POST /analyze pipeline as uploads.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/standard-package.jpg", "standard-package.jpg")}>Standard package</Button><Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/high-glare-package.jpg", "high-glare-package.jpg")}>High-glare package</Button></div></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Image not ready</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</CardContent></Card>;
}

function AnalysisProgress({ stage }: { stage: number }) {
  return <Card className="mx-auto w-full max-w-3xl bg-white"><CardHeader><div className="mb-3 flex items-center justify-between"><div><CardTitle>Generating compliance report</CardTitle><CardDescription className="mt-1">The backend returns one complete canonical report.</CardDescription></div><LoaderCircle className="size-7 animate-spin text-sky-700" /></div><Progress value={Math.min(((stage + 1) / PIPELINE_STAGES.length) * 100, 94)} /></CardHeader><CardContent><ol className="grid gap-3 sm:grid-cols-2">{PIPELINE_STAGES.map((label, index) => <li key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${index <= stage ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}><span className={`grid size-6 place-items-center rounded-full ${index < stage ? "bg-emerald-600 text-white" : index === stage ? "bg-sky-800 text-white" : "bg-slate-200"}`}>{index < stage ? <Check className="size-3.5" /> : index + 1}</span><span className="text-sm font-medium">{label}</span></li>)}</ol></CardContent></Card>;
}

export function AnalysisWorkspace() {
  const [service, setService] = useState<ServiceState>("checking");
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [report, setReport] = useState<CanonicalReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => { let current = true; checkHealth().then(() => current && setService("available")).catch(() => current && setService("unavailable")); return () => { current = false; }; }, []);
  useEffect(() => { if (!analyzing) return; const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, PIPELINE_STAGES.length - 1)), 850); return () => window.clearInterval(timer); }, [analyzing]);

  const selectFile = useCallback((file: File) => { const error = fileError(file); setValidationError(error); setRequestError(null); setReport(null); setSelectedFile(error ? null : file); }, []);
  const analyze = async () => { if (!selectedFile || analyzing) return; setAnalyzing(true); setStage(0); setRequestError(null); try { setReport(await analyzePackage(selectedFile)); } catch (error) { setRequestError(error instanceof Error ? error.message : "Analysis could not be completed."); } finally { setAnalyzing(false); } };
  const selectDemo = async (path: string, filename: string) => { setRequestError(null); try { selectFile(await loadDemoSample(path, filename)); } catch (error) { setRequestError(error instanceof Error ? error.message : "The demo image could not be loaded."); } };
  const reset = () => { setSelectedFile(null); setValidationError(null); setRequestError(null); setReport(null); setStage(0); };
  const goNew = () => { reset(); setView("new-inspection"); };

  let content: React.ReactNode;
  if (view === "dashboard") content = <Dashboard onNewInspection={goNew} onNavigate={setView} />;
  else if (view === "new-inspection") content = analyzing ? <AnalysisProgress stage={stage} /> : report ? <ReportDashboard report={report} onReset={reset} /> : <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">New Inspection</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Inspect a packaged commodity</h1></div>{requestError && !analyzing && !report && <Alert variant="destructive" className="mx-auto mb-5 max-w-3xl bg-white"><AlertTriangle /><AlertTitle>Analysis interrupted</AlertTitle><AlertDescription className="flex items-center justify-between gap-3"><span>{requestError}</span><Button variant="outline" size="sm" onClick={analyze}>Retry</Button></AlertDescription></Alert>}<UploadPanel selectedFile={selectedFile} onFile={selectFile} onAnalyze={analyze} onDemo={selectDemo} error={validationError} /></>;
  else content = <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Workspace</p></div><PlaceholderView view={view} onNewInspection={goNew} /></>;

  return <div className="min-h-screen bg-slate-50 lg:flex"><Sidebar view={view} onNavigate={setView} open={mobileNav} onClose={() => setMobileNav(false)} /><div className="min-w-0 flex-1"><TopBar onMenu={() => setMobileNav(true)} service={service} /><main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">{content}</main><footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400">ComplyVision · Decision-support prototype · Not an official compliance certificate or legal opinion</footer></div></div>;
}
