# SIH26034 Legal Metrology AI

**ComplyVision** is an SIH 2026 decision-support prototype for evidence-backed review of declarations on packaged commodities. A Next.js dashboard sends package images to the existing FastAPI analysis pipeline and renders the canonical compliance report without duplicating OCR, computer-vision, extraction, measurement, or Legal Metrology rule logic in the browser.

> This project does not produce an official government compliance certificate or legal opinion.

## Architecture

```text
Browser
  → ComplyVision Next.js frontend
  → FastAPI
  → PackageAnalyzer
  → process_image
  → canonical report generator
  → JSON
  → compliance dashboard
```

The Python backend is the single source of truth. The frontend validates obvious upload mistakes, calls the API, and presents fields and evidence from canonical report version `1.0`.

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

## Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. Select a JPEG or PNG package image and choose **Analyze package**.

## Dashboard behavior

ComplyVision currently provides:

1. Drag-and-drop and browse upload with filename, size, and format validation.
2. A staged visual pipeline for image quality, OCR, declaration extraction, rule evaluation, and report generation.
3. A responsive compliance dashboard showing PASS, FAIL, REVIEW and N/A outcomes.
4. Extracted declarations with OCR-linked evidence.
5. Image-quality signals, OCR evidence, contrast evidence, and numeral-height evidence.
6. Rule-level explanations with evidence and applicable legal-source identifiers.
7. Canonical JSON and presentation-oriented Markdown report export.
8. Demo package images that use the same `/analyze` API path as normal uploads.

The current frontend branding is **ComplyVision — AI-Powered Legal Metrology** with the tagline **See. Verify. Comply.**

## API

- `GET /health` returns service availability.
- `POST /analyze` accepts a single multipart field named `file` and returns the canonical report JSON.

Supported uploads are JPEG, JPG, and PNG. The default maximum size is 10 MiB.

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

## Validation benchmark

The manual annotation template is at `validation/ground_truth.csv`. Add independently reviewed images and run:

```bash
.venv/bin/python benchmark_validation.py
```

The benchmark reports extraction accuracy, per-rule decisions, PASS/FAIL precision, review rate, confusion transitions, quality-category slices, and false passes. Blank and `UNKNOWN` labels are excluded rather than guessed.

## Evidence safety and limits

- Visual evidence is derived only from the current request image and request-local overlays.
- Overlay paths are restricted to the request evidence directory.
- Images are resized and JPEG-encoded with per-image and total payload limits.
- Temporary uploads and overlays are removed when the request ends.
- The browser receives no filesystem locations or reusable evidence identifiers.

## Known limitations

- This remains a local prototype without authentication, database-backed inspection history, admin functions, or PDF export.
- PaddleOCR first-request initialization is slower than subsequent analyses.
- Analysis is synchronous from the browser's perspective; pipeline stages are a UI representation, not server-sent progress.
- Physical numeral-height evidence remains `REVIEW` until independently validated.
- LM-R9 contrast thresholds are implementation-defined engineering thresholds, not statutory thresholds.
- Evidence is embedded in JSON for prototype delivery; production should use authenticated, expiring object storage if payload scale requires separate assets.
