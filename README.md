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
