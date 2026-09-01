## SIH26034 Legal Metrology AI

### Canonical compliance reports

Generate evidence-linked JSON and Markdown reports for `samples/1.jpg` through
`samples/5.jpg`:

```bash
.venv/bin/python generate_compliance_reports.py
```

Outputs are written to `results/reports/`. The reports combine image quality,
OCR evidence, structured declarations, deterministic rule outcomes, contrast
evidence, experimental numeral-height evidence, stable reason codes, and a
safe package-level summary.

These are prototype decision-support reports, not official government
compliance certificates. LM-R7-001 remains `REVIEW` until physical measurement
has been independently validated, and LM-R9-002 thresholds remain explicitly
engineering thresholds rather than statutory limits.

### FastAPI service

Install dependencies and start the local API:

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Endpoints:

- `GET /health` checks service availability without initializing PaddleOCR.
- `POST /analyze` accepts one JPEG, JPG, or PNG as multipart field `file` and
  returns the canonical report JSON.

```bash
curl -X POST \
  -F "file=@samples/1.jpg" \
  http://127.0.0.1:8000/analyze
```

The default upload limit is 10 MiB, an implementation limit rather than a
statutory restriction. Override it with `SIH_MAX_UPLOAD_BYTES`. Configure
explicit frontend origins with a comma-separated `SIH_FRONTEND_ORIGINS`; local
port 3000 origins are allowed by default.

Uploaded images are processed locally in a request-specific temporary
directory and deleted after the response, including when analysis fails. The
API does not persist reports, debug images, OCR text, or uploaded images.
PaddleOCR initializes lazily on the first analysis request and is reused for
subsequent requests.
