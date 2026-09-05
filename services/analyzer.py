"""HTTP-independent orchestration of the existing package-analysis pipeline."""

from __future__ import annotations

import threading
import tempfile
from pathlib import Path
from typing import Any, Callable

from batch_measure import process_image
from reporting.report import build_package_report
from services.declaration_extractor import enhance_extracted_fields
from services.evidence import build_evidence_images, scrub_local_paths
from services.report_mapping import merge_enhanced_fields


class PackageAnalysisError(RuntimeError):
    """Raised when a technical failure prevents report generation."""


def _default_ocr_factory() -> Any:
    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang="en",
        enable_mkldnn=False,
    )


class PackageAnalyzer:
    """Reuse one OCR model and the existing single-image processing function.

    Paddle inference is serialized by a lock because thread safety is not
    assumed for the shared prototype model. OpenCV/report generation remains
    request-local, and no report or debug artifact is written by this service.
    """

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
                    batch_result = self._image_processor(
                        path,
                        self._get_ocr(),
                        debug_path=glyph_debug_path,
                    )
                if batch_result.get("failure_stage") == "unexpected_exception":
                    raise PackageAnalysisError("The analysis pipeline failed unexpectedly")
                evidence_images = self._evidence_builder(path, batch_result, evidence_root)
            safe_result = scrub_local_paths(batch_result)
            safe_result["evidence_images"] = evidence_images
            safe_result["image"] = Path(display_filename).name

            # OCR can detect a declaration correctly while the generic field
            # extractor chooses the wrong nearby numeric/text candidate. Run a
            # deterministic semantic pass over the OCR evidence before the
            # canonical report and rule engine consume the fields.
            safe_result["extracted_fields"] = enhance_extracted_fields(
                safe_result.get("extracted_fields") or {}
            )

            # Feed measured engineering evidence into the deterministic Rule 7
            # validator. The principal display-panel area is intentionally not
            # guessed: if it is unavailable, Rule 7 remains REVIEW.
            extracted_fields = dict(safe_result.get("extracted_fields") or {})
            extracted_fields["font_height_measurement"] = safe_result.get("glyph_measurement")
            if safe_result.get("principal_display_panel_area_cm2") is not None:
                extracted_fields["principal_display_panel_area_cm2"] = safe_result[
                    "principal_display_panel_area_cm2"
                ]
            if safe_result.get("package_surface_formed") is not None:
                extracted_fields["package_surface_formed"] = safe_result[
                    "package_surface_formed"
                ]
            safe_result["extracted_fields"] = extracted_fields

            report = self._report_builder(safe_result)
            report = add_enhanced_report_fields(report, safe_result["extracted_fields"])
            return merge_enhanced_fields(report, safe_result["extracted_fields"])
        except PackageAnalysisError:
            raise
        except Exception as exc:
            raise PackageAnalysisError("The analysis pipeline could not produce a report") from exc
