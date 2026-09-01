"""HTTP-independent orchestration of the existing package-analysis pipeline."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable

from batch_measure import process_image
from reporting.report import build_package_report


class PackageAnalysisError(RuntimeError):
    """Raised when a technical failure prevents report generation."""


def _default_ocr_factory() -> Any:
    from paddleocr import PaddleOCR

    return PaddleOCR(lang="en")


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
    ) -> None:
        self._ocr_factory = ocr_factory
        self._image_processor = image_processor
        self._report_builder = report_builder
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
        """Return the canonical report for one local image without persisting it."""
        path = Path(image_path)
        if not path.is_file():
            raise PackageAnalysisError("Input image is unavailable")
        try:
            with self._inference_lock:
                batch_result = self._image_processor(
                    path,
                    self._get_ocr(),
                    debug_path=None,
                )
            if batch_result.get("failure_stage") == "unexpected_exception":
                raise PackageAnalysisError("The analysis pipeline failed unexpectedly")
            batch_result["image"] = Path(display_filename).name
            return self._report_builder(batch_result)
        except PackageAnalysisError:
            raise
        except Exception as exc:
            raise PackageAnalysisError("The analysis pipeline could not produce a report") from exc
