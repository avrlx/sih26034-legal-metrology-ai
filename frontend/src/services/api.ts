import type { CanonicalReport, HealthResponse } from "@/types/report";
import { saveInspection } from "@/services/inspections";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
  return `${base}${path}`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalReport(value: unknown): value is CanonicalReport {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  return (
    typeof value.report_version === "string" &&
    typeof value.summary.overall_status === "string" &&
    typeof value.summary.pass_count === "number" &&
    typeof value.summary.fail_count === "number" &&
    typeof value.summary.review_count === "number" &&
    typeof value.summary.not_applicable_count === "number" &&
    Array.isArray(value.rule_results) &&
    isRecord(value.extracted_fields)
  );
}

function requestFailure(status: number): ApiError {
  if (status === 413) return new ApiError("The image is larger than the service upload limit.", status);
  if (status === 415) return new ApiError("Use a JPEG, JPG, or PNG image.", status);
  if (status === 400) return new ApiError("The selected file is empty or is not a valid image.", status);
  if (status === 422) return new ApiError("The service could not read the uploaded image field.", status);
  if (status >= 500) return new ApiError("Analysis could not be completed. Please retry.", status);
  return new ApiError("The service rejected the analysis request.", status);
}

export async function checkHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/health"), { method: "GET" });
  } catch {
    throw new ApiError("AI service is unavailable.");
  }
  if (!response.ok) throw new ApiError("AI service health check failed.", response.status);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.status !== "string" || typeof body.service !== "string") {
    throw new ApiError("AI service returned an invalid health response.");
  }
  return body as unknown as HealthResponse;
}

export async function analyzePackage(file: File): Promise<CanonicalReport> {
  const form = new FormData();
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(apiUrl("/analyze"), { method: "POST", body: form });
  } catch {
    throw new ApiError("Could not reach the AI service. Check that the backend is running.");
  }
  if (!response.ok) throw requestFailure(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The service returned an unreadable analysis response.");
  }
  if (!isCanonicalReport(body)) {
    throw new ApiError("The service returned an invalid canonical report.");
  }

  await saveInspection(body, file.name);
  return body;
}

export async function loadDemoSample(path: string, filename: string): Promise<File> {
  const response = await fetch(path, { method: "GET" });
  if (!response.ok) throw new ApiError("The demo image could not be loaded.", response.status);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
