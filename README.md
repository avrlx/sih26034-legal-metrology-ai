# SIH26034 Legal Metrology AI

**ComplyVision** is an SIH 2026 decision-support prototype for evidence-backed review of declarations on packaged commodities. A Next.js dashboard sends package images to the existing FastAPI analysis pipeline and renders the canonical compliance report without duplicating OCR, computer-vision, extraction, measurement, or Legal Metrology rule logic in the browser.

> This project does not produce an official government compliance certificate or legal opinion.

## Architecture

```text
Browser
  → ComplyVision Next.js frontend
  → Supabase Auth / Postgres (identity + protected inspection history)
  → FastAPI
  → PackageAnalyzer
  → process_image
  → canonical report generator
  → JSON
  → compliance dashboard
```

The Python backend remains the single source of truth for AI analysis and Legal Metrology decisions. Supabase provides authentication, persistent inspection records, profiles/roles, and Row Level Security.

## Prerequisites

- Python 3.12 and a project virtual environment at `.venv/`
- Node.js 22 or newer
- npm
- A Supabase project

## Backend setup

From the repository root:

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
```

PaddleOCR is initialized lazily on the first analysis request and reused afterward. `GET /health` does not initialize OCR.

## Supabase setup

1. Create a project in the Supabase Dashboard.
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
3. In **Authentication → Providers**, keep Email enabled.
4. For normal account security, keep email confirmation enabled.
5. In **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` as an allowed redirect URL.
6. Copy the Project URL and Publishable Key from the Supabase Connect/API settings.

The migration creates:

- `profiles` — authenticated user profile and workspace role (`inspector`, `reviewer`, `admin`).
- `inspections` — persisted canonical inspection reports linked to the authenticated user.
- RLS policies so users can access only their own inspection history and profile.
- An Auth trigger that creates a profile row whenever a new Auth user is created.

Never put a Supabase secret/service-role key in the browser or commit it to Git. The frontend uses the publishable key together with RLS.

## Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Set these values in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Open `http://localhost:3000`. Unauthenticated visitors are redirected to `/login`.

## Authentication and persistence

ComplyVision uses Supabase's cookie-based SSR Auth integration through `@supabase/ssr` and the Next.js 16 `proxy.ts` convention.

Supported flow:

1. Create an account with email/password.
2. Confirm the email if email confirmation is enabled.
3. Sign in.
4. Access the protected inspection workspace.
5. Every completed AI analysis is saved to `public.inspections` for the signed-in user.
6. Sign out from the account menu.

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
9. Supabase-backed authenticated inspection persistence.

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

- Role-specific reviewer/admin workflows and a full persistent-history UI are the next database phase; the schema and RLS foundation are already in place.
- PaddleOCR first-request initialization is slower than subsequent analyses.
- Analysis is synchronous from the browser's perspective; pipeline stages are a UI representation, not server-sent progress.
- Physical numeral-height evidence remains `REVIEW` until independently validated.
- LM-R9 contrast thresholds are implementation-defined engineering thresholds, not statutory thresholds.
- Evidence is embedded in JSON for prototype delivery; production should use authenticated, expiring object storage if payload scale requires separate assets.
