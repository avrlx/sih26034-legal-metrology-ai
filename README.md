# SIH26034 Legal Metrology AI

PackSure is an SIH 2026 decision-support prototype for evidence-backed review of declarations on packaged commodities. A Next.js dashboard sends one package image to the existing FastAPI analysis pipeline and renders the canonical compliance report without duplicating OCR, computer-vision, extraction, measurement, or Legal Metrology rule logic in the browser.

> This project does not produce an official government compliance certificate or legal opinion.

## Architecture

```text
Browser
  → Next.js frontend
  → FastAPI
  → PackageAnalyzer
  → process_image
  → canonical report generator
  → JSON
  → compliance dashboard
```

The Python backend is the single source of truth. The frontend only validates obvious upload mistakes, calls the API, and presents fields and evidence from canonical report version `1.0`.

## Prerequisites

- Python 3.12 and a project virtual environment at `.venv/`
- Node.js 20 or newer
- npm

## Backend setup

From the repository root:

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
```

PaddleOCR is initialized lazily on the first analysis request and reused afterward. `GET /health` does not initialize OCR.

Backend environment variables:

- `SIH_FRONTEND_ORIGINS`: comma-separated explicit CORS origins. Defaults to `http://localhost:3000,http://127.0.0.1:3000`.
- `SIH_MAX_UPLOAD_BYTES`: positive upload-size limit in bytes. Defaults to 10 MiB.

## Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Select a JPEG or PNG package image and choose **Analyze package**.

Frontend environment variables:

- `NEXT_PUBLIC_API_BASE_URL`: FastAPI base URL; local default is `http://127.0.0.1:8000`.
- `NEXT_PUBLIC_SITE_URL`: trusted public frontend origin used for social metadata; local default is `http://localhost:3000`.

The frontend lives entirely under `frontend/`:

```text
frontend/src/
  app/                     Next.js App Router entry point and theme
  components/              upload, progress, report, and shadcn/ui components
  services/api.ts          centralized health and multipart analysis client
  types/report.ts          canonical report TypeScript model
  test/                    typed test fixtures
```

## API

- `GET /health` returns service availability.
- `POST /analyze` accepts a single multipart field named `file` and returns the canonical report JSON.

Supported uploads are JPEG, JPG, and PNG. The default maximum size is 10 MiB.

```bash
curl -X POST \
  -F "file=@samples/1.jpg" \
  http://127.0.0.1:8000/analyze
```

Uploads and intermediate overlays use request-isolated temporary storage and are deleted after processing. The service does not persist uploaded files, reports, OCR text, or debug images. Visual evidence is returned as bounded JPEG data URLs in the canonical report; local debug paths are never exposed.

## Dashboard behavior

The frontend provides three states:

1. Upload with drag-and-drop, browse, filename, size, and format validation.
2. A non-streaming pipeline visualization while the single `POST /analyze` request runs.
3. A responsive compliance dashboard showing summary counts, declarations, all rule results, OCR evidence, image quality, warnings, contrast evidence, and numeral-height evidence.

Relevant declaration and rule cards expose a **View evidence** action for request-generated declaration crops, LM-R7 numeral-height overlays, and LM-R9 contrast overlays. Cards without visual evidence do not show an empty action. Reports can be downloaded as canonical JSON or a presentation-only Markdown summary.

Two bundled demo selectors use `samples/1.jpg` and `samples/3.jpg`. Selecting one loads the actual image file and sends it through the same `POST /analyze` request as a user upload; no report response is hardcoded in the frontend.

`REVIEW` is treated as a valid report outcome. LM-R7 measurement uncertainty and LM-R9 contrast or glare evidence are displayed from backend reason codes and evidence; those calculations are never reimplemented in TypeScript.

## Tests

Backend:

```bash
.venv/bin/python -m pytest -q
```

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Generate local JSON and Markdown reports for `samples/1.jpg` through `samples/5.jpg` with:

```bash
.venv/bin/python generate_compliance_reports.py
```

Generated reports are written to the ignored `results/reports/` directory.

## Validation benchmark

The manual annotation template is at `validation/ground_truth.csv`. Add 20–50 independently reviewed images and follow `validation/README.md`; blank and `UNKNOWN` labels are excluded from denominators and are never guessed.

Run:

```bash
.venv/bin/python benchmark_validation.py
```

The benchmark reuses `PackageAnalyzer` and writes ignored JSON, CSV, and Markdown summaries under `results/validation/`. It reports exact and normalized extraction accuracy, per-rule decisions, PASS/FAIL precision, review rate, confusion transitions, quality-category slices, and false passes. An empty template produces explicit null/not-evaluated metrics rather than fabricated accuracy.

## Evidence safety and limits

- Visual evidence is derived only from the current request image and the pipeline's generated request-local overlays.
- Overlay paths must resolve under the request's evidence directory; arbitrary files are rejected.
- Images are resized and JPEG-encoded with per-image and total payload limits before embedding.
- Temporary uploads and overlays are removed when the request ends. The browser receives no filesystem locations or reusable evidence identifiers.
- Embedded evidence increases response size; this prototype caps raw evidence at 768 KiB per image and 2 MiB per report.

## Known limitations

- This is a local prototype with no authentication, database, scan history, admin functions, or PDF export.
- PaddleOCR first-request initialization is slower than subsequent analyses.
- Analysis is synchronous from the browser's perspective; pipeline stages are a UI representation, not server-sent progress.
- Physical numeral-height evidence remains `REVIEW` until independently validated.
- LM-R9 contrast thresholds are implementation-defined engineering thresholds, not statutory thresholds.
- Evidence images are embedded in JSON for safe local-prototype delivery; a production service should use authenticated, expiring object storage if payload scale requires separate assets.
- Frontend validation reflects the default 10 MiB upload limit; the backend remains authoritative if its configured limit differs.
