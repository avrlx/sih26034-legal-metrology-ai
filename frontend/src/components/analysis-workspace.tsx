"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  FileImage,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  UploadCloud,
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

function fileError(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    return "Choose a JPEG, JPG, or PNG image.";
  }
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
    <div className="flex items-center gap-2 text-xs font-medium text-white/80" aria-live="polite">
      <span
        className={`size-2 rounded-full ${
          state === "checking" ? "animate-pulse bg-amber-300" : available ? "bg-emerald-400" : "bg-rose-400"
        }`}
      />
      {state === "checking" ? "Checking AI service" : available ? "AI service available" : "AI service unavailable"}
    </div>
  );
}

function UploadPanel({
  selectedFile,
  onFile,
  onAnalyze,
  error,
  onDemo,
}: {
  selectedFile: File | null;
  onFile: (file: File) => void;
  onAnalyze: () => void;
  error: string | null;
  onDemo: (path: string, filename: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-3xl border-t-4 border-t-amber-500 bg-white shadow-[0_20px_60px_rgba(20,48,64,0.12)]">
      <CardHeader className="border-b border-slate-100 pb-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
          <ScanLine className="size-4" /> New inspection
        </div>
        <CardTitle className="text-2xl font-semibold text-slate-900">Analyze a package declaration</CardTitle>
        <CardDescription className="max-w-xl text-sm leading-6">
          Upload one clear panel image. The service will extract declarations and produce an evidence-backed Rule 6, 7 and 9 review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-2">
        <div
          data-testid="drop-zone"
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) onFile(file);
          }}
          className={`relative flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging ? "border-sky-600 bg-sky-50" : "border-slate-300 bg-slate-50/70 hover:border-sky-500 hover:bg-sky-50/50"
          }`}
        >
          <div className="mb-4 grid size-14 place-items-center rounded-xl bg-sky-950 text-white shadow-sm">
            {selectedFile ? <FileImage className="size-7" /> : <UploadCloud className="size-7" />}
          </div>
          {selectedFile ? (
            <>
              <p className="max-w-full truncate font-semibold text-slate-900">{selectedFile.name}</p>
              <p className="mt-1 text-sm text-slate-500">{formatBytes(selectedFile.size)}</p>
              <Button variant="outline" className="mt-5" onClick={() => inputRef.current?.click()}>
                Replace image
              </Button>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-900">Drop a package image here</p>
              <p className="mt-1 text-sm text-slate-500">or browse from your device</p>
              <Button className="mt-5 bg-sky-950 px-5 hover:bg-sky-900" onClick={() => inputRef.current?.click()}>
                Browse image
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            aria-label="Package image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="text-xs leading-5 text-slate-500">
            <p>JPEG, JPG or PNG · Maximum 10 MB</p>
            <p>For best results, keep declarations sharp and fully visible.</p>
          </div>
          <Button
            size="lg"
            className="h-11 bg-amber-500 px-6 font-semibold text-slate-950 hover:bg-amber-400"
            disabled={!selectedFile}
            onClick={onAnalyze}
          >
            <ShieldCheck /> Analyze package
          </Button>
        </div>
        <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-900">Try a real sample</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Each sample is sent through the same POST /analyze pipeline as an upload.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/standard-package.jpg", "standard-package.jpg")}>Standard package example</Button>
            <Button type="button" variant="outline" onClick={() => onDemo("/demo-samples/high-glare-package.jpg", "high-glare-package.jpg")}>High-glare example</Button>
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Image not ready</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function AnalysisProgress({ stage }: { stage: number }) {
  return (
    <Card className="mx-auto w-full max-w-3xl bg-white shadow-[0_20px_60px_rgba(20,48,64,0.12)]" aria-live="polite">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Generating compliance report</CardTitle>
            <CardDescription className="mt-1">The backend returns one complete report when analysis finishes.</CardDescription>
          </div>
          <LoaderCircle className="size-7 animate-spin text-sky-700" />
        </div>
        <Progress value={Math.min(((stage + 1) / PIPELINE_STAGES.length) * 100, 94)} />
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-2">
          {PIPELINE_STAGES.map((label, index) => (
            <li key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${index <= stage ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${index < stage ? "bg-emerald-600 text-white" : index === stage ? "bg-sky-800 text-white" : "bg-slate-200"}`}>
                {index < stage ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="text-sm font-medium">{label}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function AnalysisWorkspace() {
  const [service, setService] = useState<ServiceState>("checking");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [report, setReport] = useState<CanonicalReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let current = true;
    checkHealth().then(() => current && setService("available")).catch(() => current && setService("unavailable"));
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!analyzing) return;
    const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, PIPELINE_STAGES.length - 1)), 850);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const selectFile = useCallback((file: File) => {
    const error = fileError(file);
    setValidationError(error);
    setRequestError(null);
    setReport(null);
    setSelectedFile(error ? null : file);
  }, []);

  const analyze = async () => {
    if (!selectedFile || analyzing) return;
    setAnalyzing(true);
    setStage(0);
    setRequestError(null);
    try {
      setReport(await analyzePackage(selectedFile));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Analysis could not be completed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const selectDemo = async (path: string, filename: string) => {
    setRequestError(null);
    try {
      selectFile(await loadDemoSample(path, filename));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The demo image could not be loaded.");
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setValidationError(null);
    setRequestError(null);
    setReport(null);
    setStage(0);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-sky-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-white/15 bg-white/10"><ShieldCheck className="size-5" /></div>
            <div>
              <p className="font-semibold tracking-tight">ComplyVision</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">AI-Powered Legal Metrology</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-sky-200 sm:inline">See. Verify. Comply.</span>
            <ServiceIndicator state={service} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800"><Activity className="size-4" /> SIH 2026 · PS26034</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Package compliance, with evidence attached.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Inspect declarations, image quality, and rule-level evidence through the Legal Metrology analysis pipeline.</p>
        </div>

        {requestError && !analyzing && !report && (
          <Alert variant="destructive" className="mx-auto mb-5 max-w-3xl bg-white">
            <AlertTriangle />
            <AlertTitle>Analysis interrupted</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{requestError}</span>
              <Button variant="outline" size="sm" onClick={analyze}>Retry</Button>
            </AlertDescription>
          </Alert>
        )}
        {analyzing ? (
          <AnalysisProgress stage={stage} />
        ) : report ? (
          <ReportDashboard report={report} onReset={reset} />
        ) : (
          <UploadPanel selectedFile={selectedFile} onFile={selectFile} onAnalyze={analyze} onDemo={selectDemo} error={validationError} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-5 text-center text-xs text-slate-500">
        ComplyVision · Decision-support prototype · Not an official compliance certificate or legal opinion
      </footer>
    </div>
  );
}
