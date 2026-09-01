import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportDashboard } from "@/components/report-dashboard";
import { reportFixture } from "@/test/report-fixture";

describe("ReportDashboard evidence", () => {
  it("shows evidence only where related images exist and opens the viewer", async () => {
    const user = userEvent.setup();
    render(<ReportDashboard report={reportFixture()} onReset={vi.fn()} />);
    expect(screen.getByRole("button", { name: /view evidence \(1\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view evidence \(1\)/i }));
    expect(screen.getByRole("dialog", { name: "Visual evidence" })).toBeInTheDocument();
    expect(screen.getByAltText("Numeral height measurement overlay")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close evidence" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders safely when no evidence images are returned", () => {
    const report = reportFixture();
    report.evidence_images = [];
    render(<ReportDashboard report={report} onReset={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /view evidence/i })).not.toBeInTheDocument();
  });
});
