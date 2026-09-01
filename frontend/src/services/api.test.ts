import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzePackage, checkHealth } from "@/services/api";
import { reportFixture } from "@/test/report-fixture";

describe("API service", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks backend health once through the configured endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok", service: "PackSure" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkHealth()).resolves.toEqual({ status: "ok", service: "PackSure" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/health", { method: "GET" });
  });

  it("posts the image under the exact multipart field named file", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(reportFixture()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image"], "package.jpg", { type: "image/jpeg" });

    await analyzePackage(file);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/analyze");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("file")).toBe(file);
  });

  it("rejects an invalid canonical response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "REVIEW" }), { status: 200 })));
    await expect(analyzePackage(new File(["x"], "package.png", { type: "image/png" }))).rejects.toThrow("invalid canonical report");
  });

  it("maps backend errors to safe user-facing messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("/private/server/traceback", { status: 500 })));
    await expect(analyzePackage(new File(["x"], "package.png", { type: "image/png" }))).rejects.toThrow("Analysis could not be completed");
  });
});
