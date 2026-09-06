"""HTTP-independent orchestration of the existing package-analysis pipeline."""

from __future__ import annotations

import os
import threading
import tempfile
from pathlib import Path
from typing import Any, Callable

from batch_measure import process_image
from extract_fields import extract_fields
from reporting.report import build_package_report
from services.declaration_extractor import add_enhanced_report_fields, enhance_extracted_fields
from services.evidence import build_evidence_images, scrub_local_paths
from services.mrp_extractor import correct_mrp
from services.ocr_ensemble import run_ocr_ensemble
from services.report_mapping import merge_enhanced_fields


class PackageAnalysisError(RuntimeError):
    """Raised when a technical failure prevents report generation."""


CORE_DECLARATION_RULES = {
    "LM-R6-001",
    "LM-R6-005",
    "LM-R6-006",
    "LM-R6-007",
    "LM-R6-008",
    "LM-R6-010",
}

CORE_FIELDS = (
    "manufacturer",
    "product",
    "net_quantity",
    "manufacture_date",
    "mrp",
    "consumer_care",
)


def _default_ocr_factory() -> Any:
    from paddleocr import PaddleOCR

    # Declaration extraction needs text detection + English recognition, not
    # document parsing. PP-OCRv5 mobile models are substantially lighter than
    # the server models and are intended for efficient local deployment.
    detection_model = os.getenv("SIH_OCR_DETECTION_MODEL", "PP-OCRv5_mobile_det")
    recognition_model = os.getenv("SIH_OCR_RECOGNITION_MODEL", "en_PP-OCRv5_mobile_rec")
    device = os.getenv("SIH_OCR_DEVICE", "cpu")
    return PaddleOCR(
        text_detection_model_name=detection_model,
        text_recognition_model_name=recognition_model,
        text_recognition_batch_size=int(os.getenv("SIH_OCR_RECOGNITION_BATCH", "4")),
        text_det_limit_side_len=int(os.getenv("SIH_OCR_DET_LIMIT", "960")),
        text_det_limit_type="max",
        device=device,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=False,
    )


def _confidence(value: Any) -> float:
    if not isinstance(value, dict):
        return -1.0
    raw = value.get("confidence", value.get("extraction_confidence", value.get("ocr_confidence")))
    return float(raw) if isinstance(raw, (int, float)) else -1.0


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        if value.get("present") is False:
            return False
        normalized = value.get("normalized_value", value.get("value", value.get("raw")))
        if isinstance(normalized, dict):
            return any(item not in (None, "", [], {}) for item in normalized.values())
        return normalized not in (None, "", [], {})
    return value not in (None, "", [], {})


def _needs_ocr_verification(fields: dict[str, Any]) -> bool:
    """Use a second OCR view only when a mandatory declaration is missing."""
    return any(not _has_value(fields.get(name)) for name in CORE_FIELDS)


def _merge_field_candidates(primary: dict[str, Any], ensemble: dict[str, Any]) -> dict[str, Any]:
    """Keep the strongest evidence per field without discarding non-OCR fields."""
    merged = dict(primary)
    for name, candidate in ensemble.items():
        if name == "ocr_evidence" or not isinstance(candidate, dict):
            continue
        current = merged.get(name)
        if not isinstance(current, dict) or _confidence(candidate) > _confidence(current):
            merged[name] = candidate
    if ensemble.get("ocr_evidence"):
        merged["ocr_evidence"] = ensemble["ocr_evidence"]
    return merged


def _apply_core_status_policy(report: dict[str, Any]) -> dict[str, Any]:
    """Keep the headline status focused on mandatory declaration compliance."""
    results = report.get("rule_results") or []
    core = [item for item in results if item.get("rule_id") in CORE_DECLARATION_RULES]
    if not core:
        return report

    core_fail = [item for item in core if item.get("status") == "FAIL"]
    core_review = [item for item in core if item.get("status") == "REVIEW"]
    if core_fail:
        status = "FAIL"
        reason = "At least one mandatory declaration check has a definitive FAIL result"
    elif core_review:
        status = "REVIEW"
        reason = "One or more mandatory declaration checks still require verification"
    else:
        status = "PASS"
        reason = "All mandatory declaration checks passed; supplementary visual checks are reported separately"

    summary = report.setdefault("summary", {})
    summary["overall_status"] = status
    summary["core_declaration_status"] = status
    summary["core_declaration_reason"] = reason
    summary["status_scope"] = "mandatory_declarations"
    return report


class PackageAnalyzer:
    """Reuse one OCR model and the existing single-image processing function."""

    def __init__(
        self,
        *,
        ocr_factory: Callable[[], Any] = _default_ocr_factory,
        image_processor: Callable[..., dict[str, Any]] = process_image,
        report_builder: Callable[..., dict[str, Any]] = build_package_report,
        evidence_builder: Callable[..., list[dict[str, Any]]] = build_evidence_images,
    ) -> None:
        self._ocr_factory = ocr_factory
        self._image_processor = image_processor
        self._report_builder = report_builder
        self._evidence_builder = evidence_builder
        self._ocr: Any | None = None
        self._initialization_lock = threading.Lock()
        self._inference_lock = threading.Lock()

    @property
    def ocr_initialized(self) -> bool:
        return self._ocr is not None

    def warm_up(self) -> None:
        """Load OCR models before the first user-facing inspection request."""
        self._get_ocr()

    def _get_ocr(self) -> Any:
        if self._ocr is None:
            with self._initialization_lock:
                if self._ocr is None:
                    self._ocr = self._ocr_factory()
        return self._ocr

    def analyze_package(
        self, image_path: str | Path, *, display_filename: str = "uploaded_image.jpg",
    ) -> dict[str, Any]:
        """Return the canonical report; request-local artifacts remain private."""
        path = Path(image_path)
        if not path.is_file():
            raise PackageAnalysisError("Input image is unavailable")
        try:
            with tempfile.TemporaryDirectory(prefix="sih26034_evidence_") as directory:
                evidence_root = Path(directory)
                glyph_debug_path = evidence_root / "glyph.jpg"
                with self._inference_lock:
                    ocr = self._get_ocr()
                    batch_result = self._image_processor(path, ocr, debug_path=glyph_debug_path)

                    primary_fields = enhance_extracted_fields(batch_result.get("extracted_fields") or {})
                    primary_fields = correct_mrp(primary_fields)
                    batch_result["extracted_fields"] = primary_fields

                    if _needs_ocr_verification(primary_fields):
                        primary_items = primary_fields.get("ocr_evidence") or []
                        ensemble_items, ensemble_meta = run_ocr_ensemble(
                            ocr, str(path), primary_items=primary_items,
                        )
                    else:
                        ensemble_items = []
                        ensemble_meta = {
                            "passes": 1,
                            "raw_items": len(primary_fields.get("ocr_evidence") or []),
                            "consensus_items": 0,
                            "errors": [],
                            "skipped": True,
                            "reason": "mandatory_declarations_sufficient",
                        }

                if batch_result.get("failure_stage") == "unexpected_exception":
                    raise PackageAnalysisError("The analysis pipeline failed unexpectedly")
                evidence_images = self._evidence_builder(path, batch_result, evidence_root)
            safe_result = scrub_local_paths(batch_result)
            safe_result["evidence_images"] = evidence_images
            safe_result["image"] = Path(display_filename).name
            safe_result.setdefault("ocr", {})["ensemble"] = ensemble_meta

            if ensemble_items:
                ensemble_fields = enhance_extracted_fields(extract_fields(ensemble_items))
                ensemble_fields = correct_mrp(ensemble_fields)
                safe_result["extracted_fields"] = _merge_field_candidates(
                    safe_result.get("extracted_fields") or {}, ensemble_fields
                )

            safe_result["extracted_fields"] = enhance_extracted_fields(safe_result.get("extracted_fields") or {})
            safe_result["extracted_fields"] = correct_mrp(safe_result["extracted_fields"])

            extracted_fields = dict(safe_result.get("extracted_fields") or {})
            extracted_fields["font_height_measurement"] = safe_result.get("glyph_measurement")
            if safe_result.get("principal_display_panel_area_cm2") is not None:
                extracted_fields["principal_display_panel_area_cm2"] = safe_result["principal_display_panel_area_cm2"]
            if safe_result.get("package_surface_formed") is not None:
                extracted_fields["package_surface_formed"] = safe_result["package_surface_formed"]
            safe_result["extracted_fields"] = extracted_fields

            report = self._report_builder(safe_result)
            report = add_enhanced_report_fields(report, safe_result["extracted_fields"])
            report = merge_enhanced_fields(report, safe_result["extracted_fields"])
            return _apply_core_status_policy(report)
        except PackageAnalysisError:
            raise
        except Exception as exc:
            raise PackageAnalysisError("The analysis pipeline could not produce a report") from exc
