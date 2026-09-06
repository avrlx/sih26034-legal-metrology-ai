# ComplyVision PR #5 — selective integration

Selection baseline: main `31d6ab0c8536cf2f67a404a184e39c2814f1da81`.
Latest PR reviewed: `7cceda00b98c4e2ff2c1636c24b9c662275aac4f`.
Previously reviewed corrections: `d1771bf5875fa5aa6a6dcbc37a8aeaf922f7b378`, preserved on `codex/complyvision-pr5-integration`.
Safe subset assembled from main on `codex/complyvision-pr5-safe`; the original PR history is not merged wholesale.

## Classification

| Change | Classification | Selected behavior |
| --- | --- | --- |
| ComplyVision branding, social metadata/image, theme | SAFE AFTER SIMPLE FIX | Keep reviewed branding; ensure explicit dark buttons remain readable. |
| Dashboard, history, findings, analytics, report navigation | SAFE AFTER SIMPLE FIX | Keep current-session reports in memory, clearly label that reload clears history; JSON/Markdown export uses the existing renderer. No database calls. |
| Reviewed declaration/extraction corrections | SAFE | Preserve reliable primary values; reject quantity-as-price and manufacturer-heading-as-product substitutions. |
| Reviewed OCR evidence normalization | SAFE AFTER SIMPLE FIX | Preserve primary text; require exact normalized agreement; do not inflate confidence; do not overwrite reliable primary declarations with ensemble candidates. |
| Canonical report and deterministic rule safeguards | SAFE | Keep main's rule engine, conservative physical-measurement REVIEW, full-rule status aggregation, and canonical metadata. |
| New latency logging | SAFE AFTER SIMPLE FIX | Server-side elapsed time and byte count only; omit uploaded filenames and keep API response schema unchanged. |
| New mobile OCR models, batching/resizing/device defaults | UNVERIFIED — SKIPPED | Retain previously exercised OCR setup and current Python dependencies. |
| New OCR verification threshold change to 0.50 | UNVERIFIED — SKIPPED | Retain reviewed 0.82 verification trigger. |
| Declaration-only headline PASS override and new physical-rule thresholds | UNSAFE — SKIPPED | Cannot hide FAIL/REVIEW outcomes. |
| Phone OTP / anonymous sessions / auth and profile UI | UNVERIFIED — SKIPPED | No authentication routes, clients, menu or registration features included. Phone provider was disabled during live review. |
| Supabase database persistence, schema and RLS-dependent features | UNVERIFIED — SKIPPED | No database features or migrations included. Reviewed role/cookie safety fixes remain on the prior integration branch for future authenticated validation. |
| New PDF export | UNVERIFIED — SKIPPED | Keep existing JSON and Markdown export; no jsPDF dependency. |
| Duplicate extraction/report mapping and dependency upgrades | SKIPPED | No redundant modules or dependency changes. |

## Validation

- Backend `pytest`: 110 passed, 0 failed, plus 33 passed subtests; one existing Starlette/httpx deprecation warning.
- Frontend existing tests plus targeted session-history test: 17 passed in total (9 unchanged tests and final targeted rerun of 8 workspace tests).
- Frontend lint: passed with no errors or warnings.
- Frontend production build: passed, including TypeScript; only home, not-found and social-image routes are generated.
- `/health`: HTTP 200 without OCR startup.
- `/analyze`, real `samples/best.jpg`: HTTP 200, canonical version 1.0; OCR succeeded, 14 consensus entries and 5 evidence images. Summary: 8 PASS, 0 FAIL, 1 REVIEW, 1 N/A; overall REVIEW.
- Browser verification: dashboard and upload controls render without authentication; session-only retention is explicitly shown.
- No unresolved Git conflicts; deterministic rules, dependency manifests and lockfile unchanged from main.
- Removed stale generated development route types that referenced excluded auth pages; no type-check suppression was introduced.
- Original untracked root `node_modules/` is excluded from commits. Internal API/environment identifiers remain unchanged.

PR #5 retains excluded work for a later review. This selection does not validate or apply any live Supabase configuration, migration or permission change.
