import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { analyzePackage, checkHealth, loadDemoSample } from "@/services/api";
import { reportFixture } from "@/test/report-fixture";

vi.mock("@/services/api", () => ({
  analyzePackage: vi.fn(),
  checkHealth: vi.fn(),
  loadDemoSample: vi.fn(),
}));

const mockedAnalyze = vi.mocked(analyzePackage);
const mockedHealth = vi.mocked(checkHealth);
const mockedDemo = vi.mocked(loadDemoSample);

describe("AnalysisWorkspace", () => {
  beforeEach(() => {
    mockedHealth.mockResolvedValue({ status: "ok", service: "PackSure" });
    mockedAnalyze.mockResolvedValue(reportFixture());
    mockedDemo.mockResolvedValue(new File(["demo"], "standard-package.jpg", { type: "image/jpeg" }));
  });

  it("accepts a supported file selection and shows its metadata", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    const file = new File([new Uint8Array(2048)], "package.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByLabelText("Package image"), file);

    expect(screen.getByText("package.jpg")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze package/i })).toBeEnabled();
  });

  it("rejects an unsupported file before upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<AnalysisWorkspace />);

    await user.upload(screen.getByLabelText("Package image"), new File(["gif"], "package.gif", { type: "image/gif" }));

    expect(screen.getByText("Choose a JPEG, JPG, or PNG image.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze package/i })).toBeDisabled();
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it("shows a non-streaming loading state and disables duplicate submission", async () => {
    const user = userEvent.setup();
    let resolveReport: (value: ReturnType<typeof reportFixture>) => void = () => undefined;
    mockedAnalyze.mockImplementation(() => new Promise((resolve) => { resolveReport = resolve; }));
    render(<AnalysisWorkspace />);
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));

    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(screen.getByText("Generating compliance report")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /analyze package/i })).not.toBeInTheDocument();
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
    resolveReport(reportFixture());
  });

  it("renders REVIEW as a valid canonical result with returned counts", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Overall compliance status")).toBeInTheDocument();
    expect(screen.getAllByText("REVIEW").length).toBeGreaterThan(0);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("LM-R7-001 · Rule 7")).toBeInTheDocument();
    expect(screen.getByText("SUNLITE REFINED OIL")).toBeInTheDocument();
  });

  it("renders a sanitized analysis error with Retry", async () => {
    const user = userEvent.setup();
    mockedAnalyze.mockRejectedValue(new Error("Analysis could not be completed. Please retry."));
    render(<AnalysisWorkspace />);
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Analysis interrupted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("does not crash when optional evidence fields are missing", async () => {
    const user = userEvent.setup();
    const report = reportFixture();
    report.quality = {};
    report.ocr = {};
    report.evidence = {};
    report.evidence_images = undefined;
    mockedAnalyze.mockResolvedValue(report);
    render(<AnalysisWorkspace />);
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Overall compliance status")).toBeInTheDocument();
    expect(screen.getByText("No OCR evidence was returned.")).toBeInTheDocument();
    expect(screen.getByText("No contrast evidence was returned.")).toBeInTheDocument();
  });

  it("loads a demo image and submits it through the real analysis function", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    await user.click(screen.getByRole("button", { name: "Standard package example" }));
    expect(mockedDemo).toHaveBeenCalledWith("/demo-samples/standard-package.jpg", "standard-package.jpg");
    await user.click(screen.getByRole("button", { name: /analyze package/i }));
    expect(mockedAnalyze).toHaveBeenCalledWith(expect.objectContaining({ name: "standard-package.jpg" }));
  });
});
