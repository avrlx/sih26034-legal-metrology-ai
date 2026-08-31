"""Batch engineering validation for calibrated net-quantity glyph measurement.

This module reuses the existing OCR, extraction, calibration, and measurement
pipeline. It deliberately does not evaluate Rule 7 or issue legal PASS/FAIL.
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import numpy as np

from cv.aruco import detect_aruco_scale
from cv.glyph_measurement import measure_net_quantity_numerals
from cv.measurement import estimate_text_height_mm
from cv.ocr_filter import filter_ocr_items_near_aruco
from cv.quality import analyze_image_quality
from extract_fields import extract_fields


MARKER_SIZE_MM = 50.0
ARUCO_OCR_OVERLAP_THRESHOLD = 0.30
DEFAULT_IMAGES = [Path("samples") / f"{index}.jpg" for index in range(1, 6)]
JSON_OUTPUT = Path("results/measurement_validation.json")
CSV_OUTPUT = Path("results/measurement_validation.csv")

CSV_COLUMNS = [
    "image",
    "usable",
    "image_width",
    "image_height",
    "blur_score",
    "aruco_detected",
    "pixels_per_mm",
    "net_quantity_value",
    "net_quantity_unit",
    "source_text",
    "ocr_box_height_px",
    "ocr_box_height_mm",
    "numeric_text",
    "digit_heights_px",
    "glyph_height_px",
    "glyph_height_mm",
    "glyph_confidence",
    "glyph_status",
    "measurement_quality_flag",
    "suspected_outliers",
    "failure_stage",
    "reason",
    "manual_height_mm",
    "absolute_error_mm",
    "percentage_error",
]


def calculate_manual_error(
    cv_height_mm: float | None,
    manual_height_mm: float | None,
) -> dict[str, float | None]:
    """Calculate reusable CV-vs-manual errors without dividing by zero."""
    if cv_height_mm is None or manual_height_mm is None:
        return {"absolute_error_mm": None, "percentage_error": None}
    try:
        cv_height = float(cv_height_mm)
        manual_height = float(manual_height_mm)
    except (TypeError, ValueError):
        return {"absolute_error_mm": None, "percentage_error": None}
    if not math.isfinite(cv_height) or not math.isfinite(manual_height):
        return {"absolute_error_mm": None, "percentage_error": None}
    absolute_error = abs(cv_height - manual_height)
    percentage_error = (
        absolute_error / manual_height * 100.0 if manual_height != 0 else None
    )
    return {
        "absolute_error_mm": round(absolute_error, 6),
        "percentage_error": (
            round(percentage_error, 6) if percentage_error is not None else None
        ),
    }


def make_json_safe(value: Any) -> Any:
    """Recursively convert common pipeline values to strict JSON primitives."""
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, np.generic):
        return make_json_safe(value.item())
    if isinstance(value, np.ndarray):
        return make_json_safe(value.tolist())
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): make_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [make_json_safe(item) for item in value]
    return str(value)


def _height_variation(heights: Iterable[Any]) -> float | None:
    values = []
    for height in heights:
        try:
            numeric_height = float(height)
        except (TypeError, ValueError):
            continue
        if numeric_height > 0 and math.isfinite(numeric_height):
            values.append(numeric_height)
    if len(values) < 2:
        return 0.0 if values else None
    median_height = statistics.median(values)
    if median_height <= 0:
        return None
    return (max(values) - min(values)) / median_height


def _aruco_side_variation(aruco: dict[str, Any]) -> float | None:
    corners = aruco.get("corners")
    if not isinstance(corners, list) or len(corners) != 4:
        return None
    try:
        points = np.asarray(corners, dtype=float).reshape(4, 2)
    except (TypeError, ValueError):
        return None
    sides = [
        float(np.linalg.norm(points[(index + 1) % 4] - points[index]))
        for index in range(4)
    ]
    mean_side = statistics.mean(sides)
    return statistics.pstdev(sides) / mean_side if mean_side > 0 else None


def internal_consistency_checks(result: dict[str, Any]) -> list[dict[str, Any]]:
    """Return engineering checks for one completed or partial measurement."""
    checks: list[dict[str, Any]] = []
    aruco = result.get("aruco") or {}
    box = result.get("ocr_box_measurement") or {}
    glyph = result.get("glyph_measurement") or {}

    def add(name: str, passed: bool, detail: str, severity: str = "CHECK") -> None:
        checks.append({
            "name": name,
            "passed": bool(passed),
            "severity": severity,
            "detail": detail,
        })

    pixels_per_mm = aruco.get("pixels_per_mm")
    if aruco.get("detected"):
        add(
            "positive_calibration",
            isinstance(pixels_per_mm, (int, float)) and pixels_per_mm > 0,
            f"pixels_per_mm={pixels_per_mm}",
            "REVIEW",
        )
        side_variation = _aruco_side_variation(aruco)
        if side_variation is not None:
            add(
                "aruco_side_consistency",
                side_variation <= 0.20,
                f"relative_side_variation={side_variation:.3f}",
            )

    if glyph.get("status") == "OK":
        glyph_px = glyph.get("estimated_numeral_height_px")
        glyph_mm = glyph.get("estimated_numeral_height_mm")
        confidence = glyph.get("confidence")
        add(
            "positive_glyph_height_px",
            isinstance(glyph_px, (int, float)) and glyph_px > 0,
            f"glyph_height_px={glyph_px}",
            "REVIEW",
        )
        add(
            "positive_glyph_height_mm",
            isinstance(glyph_mm, (int, float)) and glyph_mm > 0,
            f"glyph_height_mm={glyph_mm}",
            "REVIEW",
        )
        add(
            "confidence_range",
            isinstance(confidence, (int, float)) and 0 <= confidence <= 1,
            f"confidence={confidence}",
            "REVIEW",
        )
        box_px = box.get("height_px")
        box_mm = box.get("height_mm")
        if isinstance(box_px, (int, float)) and isinstance(glyph_px, (int, float)):
            add(
                "glyph_not_taller_than_ocr_box_px",
                glyph_px <= box_px,
                f"glyph={glyph_px}px, ocr_box={box_px}px",
            )
            add(
                "glyph_not_close_to_ocr_box_height",
                glyph_px < box_px * 0.90,
                f"glyph_to_box_ratio={glyph_px / box_px:.3f}" if box_px else "ocr_box=0",
            )
        if isinstance(box_mm, (int, float)) and isinstance(glyph_mm, (int, float)):
            add(
                "glyph_not_taller_than_ocr_box_mm",
                glyph_mm <= box_mm,
                f"glyph={glyph_mm}mm, ocr_box={box_mm}mm",
            )
        variation = _height_variation(glyph.get("digit_heights_px") or [])
        if variation is not None:
            add(
                "digit_height_consistency",
                variation <= 0.25,
                f"relative_range={variation:.3f}",
            )
        expected_count = glyph.get("expected_digit_count")
        detected_count = len(glyph.get("digit_heights_px") or [])
        if isinstance(expected_count, int):
            add(
                "expected_digit_count",
                detected_count == expected_count,
                f"detected={detected_count}, expected={expected_count}",
                "REVIEW",
            )
    return checks


def generate_quality_flag(result: dict[str, Any]) -> tuple[str, list[str]]:
    """Classify measurement engineering quality, never legal compliance."""
    reasons: list[str] = []
    quality = result.get("image_quality") or {}
    aruco = result.get("aruco") or {}
    net_quantity = result.get("net_quantity")
    glyph = result.get("glyph_measurement") or {}

    if not quality.get("usable", False):
        reasons.append("Image-quality analysis marked the image unusable")
    if not aruco.get("detected", False):
        reasons.append("ArUco calibration was not detected")
    if not isinstance(net_quantity, dict):
        reasons.append("Net quantity was not extracted")
    if glyph.get("status") != "OK":
        reasons.append(glyph.get("reason") or "Glyph measurement is unavailable")

    confidence = glyph.get("confidence")
    severe = bool(reasons)
    if isinstance(confidence, (int, float)):
        if confidence < 0.65:
            reasons.append(f"Low glyph confidence ({confidence:.3f})")
            severe = True
        elif confidence < 0.85:
            reasons.append(f"Moderate glyph confidence ({confidence:.3f})")

    for check in result.get("consistency_checks") or []:
        if not check.get("passed", True):
            reasons.append(f"{check['name']}: {check['detail']}")
            if check.get("severity") == "REVIEW":
                severe = True

    factors = glyph.get("confidence_factors") or {}
    if isinstance(factors.get("perspective"), (int, float)) and factors["perspective"] < 0.8:
        reasons.append(f"Extreme OCR-box perspective score ({factors['perspective']:.3f})")
    if isinstance(factors.get("crop_boundary"), (int, float)) and factors["crop_boundary"] < 1:
        reasons.append("Selected glyph component touched a crop boundary")
    if isinstance(factors.get("source_box_overlap"), (int, float)) and factors["source_box_overlap"] < 0.5:
        reasons.append(
            f"Low glyph/source-box overlap ({factors['source_box_overlap']:.3f})"
        )
    if glyph.get("value_region_method") == "substring_position_approximation":
        reasons.append(
            "Value-region location uses approximate substring geometry; inspect the debug image"
        )
    if quality.get("warnings"):
        reasons.append("Image warnings: " + ", ".join(quality["warnings"]))

    reasons = list(dict.fromkeys(reasons))
    if severe:
        return "REVIEW", reasons
    if reasons:
        return "CHECK", reasons
    return "GOOD", []


def _empty_result(image_path: str | Path) -> dict[str, Any]:
    return {
        "image": str(image_path),
        "status": "REVIEW",
        "failure_stage": None,
        "reason": None,
        "image_quality": None,
        "aruco": {"detected": False, "pixels_per_mm": None, "marker_id": None},
        "ocr": {"success": False, "raw_item_count": 0, "filtered_item_count": 0},
        "net_quantity": None,
        "ocr_box_measurement": None,
        "glyph_measurement": {
            "status": "REVIEW",
            "confidence": 0.0,
            "reason": "Glyph measurement was not run",
        },
        "manual_height_mm": None,
        "absolute_error_mm": None,
        "percentage_error": None,
        "measurement_quality_flag": "REVIEW",
        "measurement_quality_reasons": [],
        "consistency_checks": [],
    }


def _record_failure(result: dict[str, Any], stage: str, reason: str) -> None:
    if result.get("failure_stage") is None:
        result["failure_stage"] = stage
        result["reason"] = reason


def _raw_ocr_items(ocr: Any, image_path: str) -> list[dict[str, Any]]:
    items = []
    for prediction in ocr.predict(image_path):
        for text, score, box in zip(
            prediction["rec_texts"],
            prediction["rec_scores"],
            prediction["rec_boxes"],
        ):
            items.append({
                "text": str(text),
                "confidence": float(score),
                "box": box.tolist() if hasattr(box, "tolist") else list(box),
            })
    return items


def process_image(
    image_path: str | Path,
    ocr: Any,
    *,
    debug_path: str | Path | None = None,
    quality_analyzer: Callable[[str], dict[str, Any]] = analyze_image_quality,
    aruco_detector: Callable[..., dict[str, Any]] = detect_aruco_scale,
    field_extractor: Callable[[list[dict[str, Any]]], dict[str, Any]] = extract_fields,
    glyph_measurer: Callable[..., dict[str, Any]] = measure_net_quantity_numerals,
) -> dict[str, Any]:
    """Process one image without allowing its failure to abort the batch."""
    image = str(image_path)
    result = _empty_result(image)
    try:
        try:
            quality = quality_analyzer(image)
            result["image_quality"] = quality
            if not quality.get("usable", False):
                _record_failure(
                    result,
                    "image_quality",
                    ", ".join(quality.get("issues") or ["Image is unusable"]),
                )
        except Exception as exc:
            _record_failure(result, "image_quality", str(exc))
            result["reason"] = f"Image-quality analysis failed: {exc}"
            return _finalize_image_result(result)

        try:
            calibration = aruco_detector(image, marker_size_mm=MARKER_SIZE_MM)
            result["aruco"] = calibration
            if not calibration.get("detected"):
                _record_failure(result, "aruco", "ArUco marker was not detected")
        except Exception as exc:
            result["aruco"] = {
                "detected": False,
                "pixels_per_mm": None,
                "marker_id": None,
                "reason": str(exc),
            }
            _record_failure(result, "aruco", f"ArUco calibration failed: {exc}")

        try:
            raw_items = _raw_ocr_items(ocr, image)
            filtered_items = list(filter_ocr_items_near_aruco(
                raw_items,
                result["aruco"].get("corners"),
                overlap_threshold=ARUCO_OCR_OVERLAP_THRESHOLD,
            ))
            result["ocr"] = {
                "success": bool(raw_items),
                "raw_item_count": len(raw_items),
                "filtered_item_count": len(filtered_items),
            }
            if not raw_items:
                _record_failure(result, "ocr", "PaddleOCR returned no text")
        except Exception as exc:
            _record_failure(result, "ocr", f"OCR failed: {exc}")
            result["glyph_measurement"] = {
                "status": "REVIEW", "confidence": 0.0, "reason": "OCR failed"
            }
            return _finalize_image_result(result)

        try:
            fields = field_extractor(filtered_items)
            extracted_quantity = fields.get("net_quantity")
            if isinstance(extracted_quantity, dict):
                result["net_quantity"] = {
                    key: extracted_quantity.get(key)
                    for key in (
                        "value", "unit", "confidence", "source_text",
                        "source_box", "source_image",
                    )
                }
            else:
                _record_failure(result, "net_quantity", "Net quantity was not extracted")
        except Exception as exc:
            extracted_quantity = None
            _record_failure(result, "net_quantity", f"Field extraction failed: {exc}")

        pixels_per_mm = result["aruco"].get("pixels_per_mm")
        if isinstance(extracted_quantity, dict):
            source_box = extracted_quantity.get("source_box")
            if source_box and pixels_per_mm:
                try:
                    result["ocr_box_measurement"] = estimate_text_height_mm(
                        source_box, pixels_per_mm
                    )
                except Exception as exc:
                    _record_failure(result, "ocr_box_measurement", str(exc))

            try:
                debug_image_path = str(debug_path) if debug_path is not None else None
                result["glyph_measurement"] = glyph_measurer(
                    image,
                    extracted_quantity,
                    pixels_per_mm,
                    debug=debug_path is not None,
                    debug_image_path=debug_image_path,
                )
                if result["glyph_measurement"].get("status") != "OK":
                    _record_failure(
                        result,
                        "glyph_measurement",
                        result["glyph_measurement"].get("reason")
                        or "Glyph measurement requires review",
                    )
            except Exception as exc:
                result["glyph_measurement"] = {
                    "status": "REVIEW",
                    "confidence": 0.0,
                    "reason": f"Unexpected glyph measurement error: {exc}",
                }
                _record_failure(result, "glyph_measurement", str(exc))
        else:
            result["glyph_measurement"] = {
                "status": "REVIEW",
                "confidence": 0.0,
                "reason": "Net quantity was not extracted",
            }
    except Exception as exc:
        _record_failure(result, "unexpected_exception", str(exc))
    return _finalize_image_result(result)


def _finalize_image_result(result: dict[str, Any]) -> dict[str, Any]:
    result["consistency_checks"] = internal_consistency_checks(result)
    quality_flag, quality_reasons = generate_quality_flag(result)
    result["measurement_quality_flag"] = quality_flag
    result["measurement_quality_reasons"] = quality_reasons
    result["suspected_outliers"] = quality_reasons
    glyph = result.get("glyph_measurement") or {}
    fully_measured = (
        (result.get("image_quality") or {}).get("usable")
        and (result.get("aruco") or {}).get("detected")
        and isinstance(result.get("net_quantity"), dict)
        and glyph.get("status") == "OK"
    )
    result["status"] = "OK" if fully_measured else "REVIEW"
    if fully_measured:
        result["failure_stage"] = None
        result["reason"] = None
    return make_json_safe(result)


def process_batch(
    image_paths: Iterable[str | Path],
    ocr: Any,
    *,
    processor: Callable[..., dict[str, Any]] = process_image,
    debug_directory: str | Path = "debug",
) -> list[dict[str, Any]]:
    """Process every image, converting even unexpected per-image errors to REVIEW."""
    results = []
    debug_root = Path(debug_directory)
    for index, image_path in enumerate(image_paths, start=1):
        debug_path = debug_root / f"batch_{index}_glyph.jpg"
        try:
            result = processor(image_path, ocr, debug_path=debug_path)
        except Exception as exc:
            result = _empty_result(image_path)
            _record_failure(result, "unexpected_exception", str(exc))
            result = _finalize_image_result(result)
        results.append(result)
    return results


def summarize_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute validation statistics and conservative Rule-7-validation readiness."""
    total = len(results)
    quality_pass = sum(bool((item.get("image_quality") or {}).get("usable")) for item in results)
    aruco_success = sum(bool((item.get("aruco") or {}).get("detected")) for item in results)
    net_success = sum(isinstance(item.get("net_quantity"), dict) for item in results)
    glyph_ok_results = [
        item for item in results
        if (item.get("glyph_measurement") or {}).get("status") == "OK"
    ]
    usable_glyph_results = [
        item for item in glyph_ok_results
        if item.get("status") == "OK"
        and item.get("measurement_quality_flag") in {"GOOD", "CHECK"}
    ]
    confidences = [
        float(item["glyph_measurement"]["confidence"])
        for item in glyph_ok_results
        if isinstance(item["glyph_measurement"].get("confidence"), (int, float))
    ]
    heights = [
        float(item["glyph_measurement"]["estimated_numeral_height_mm"])
        for item in glyph_ok_results
        if isinstance(
            item["glyph_measurement"].get("estimated_numeral_height_mm"),
            (int, float),
        )
    ]

    def stats(values: list[float], prefix: str) -> dict[str, float | None]:
        return {
            f"mean_{prefix}": round(statistics.mean(values), 3) if values else None,
            f"median_{prefix}": round(statistics.median(values), 3) if values else None,
            f"minimum_{prefix}": round(min(values), 3) if values else None,
            f"maximum_{prefix}": round(max(values), 3) if values else None,
        }

    geometry_failures = sum(
        any(
            not check.get("passed", True)
            and check.get("name") in {
                "positive_glyph_height_px",
                "positive_glyph_height_mm",
                "glyph_not_taller_than_ocr_box_px",
                "glyph_not_taller_than_ocr_box_mm",
                "expected_digit_count",
            }
            for check in item.get("consistency_checks") or []
        )
        for item in glyph_ok_results
    )
    median_confidence = statistics.median(confidences) if confidences else None
    readiness_checks = {
        "aruco_at_least_4_of_5": aruco_success >= min(4, total),
        "net_quantity_at_least_4_of_5": net_success >= min(4, total),
        "glyph_measurement_at_least_4_of_5": len(usable_glyph_results) >= min(4, total),
        "successful_confidence_generally_acceptable": (
            median_confidence is not None and median_confidence >= 0.65
        ),
        "no_severe_systematic_geometry_failure": geometry_failures <= 1,
    }
    ready = total == 5 and all(readiness_checks.values())
    readiness = (
        "READY_FOR_RULE7_VALIDATION"
        if ready
        else "NEEDS_MORE_MEASUREMENT_WORK"
    )
    reasoning = [
        f"ArUco calibration succeeded for {aruco_success}/{total} images.",
        f"Net quantity extraction succeeded for {net_success}/{total} images.",
        (
            f"Glyph status was OK for {len(glyph_ok_results)}/{total} images; "
            f"{len(usable_glyph_results)}/{total} were usable end to end."
        ),
        (
            f"Median successful glyph confidence was {median_confidence:.3f}."
            if median_confidence is not None
            else "No successful glyph confidence was available."
        ),
        f"Severe geometry-check failures occurred in {geometry_failures} successful measurements.",
    ]
    return make_json_safe({
        "images_processed": total,
        "image_quality_pass_count": quality_pass,
        "aruco_detection_success_count": aruco_success,
        "net_quantity_extraction_success_count": net_success,
        "glyph_measurement_ok_count": len(glyph_ok_results),
        "glyph_review_count": total - len(glyph_ok_results),
        "end_to_end_measurement_usable_count": len(usable_glyph_results),
        **stats(confidences, "glyph_confidence"),
        "minimum_glyph_height_mm": round(min(heights), 3) if heights else None,
        "maximum_glyph_height_mm": round(max(heights), 3) if heights else None,
        "median_glyph_height_mm": round(statistics.median(heights), 3) if heights else None,
        "quality_flag_counts": {
            flag: sum(item.get("measurement_quality_flag") == flag for item in results)
            for flag in ("GOOD", "CHECK", "REVIEW")
        },
        "suspected_outlier_count": sum(
            bool(item.get("suspected_outliers")) for item in results
        ),
        "readiness": readiness,
        "readiness_checks": readiness_checks,
        "readiness_reasoning": reasoning,
    })


def _csv_row(result: dict[str, Any]) -> dict[str, Any]:
    quality = result.get("image_quality") or {}
    aruco = result.get("aruco") or {}
    quantity = result.get("net_quantity") or {}
    box = result.get("ocr_box_measurement") or {}
    glyph = result.get("glyph_measurement") or {}
    return {
        "image": result.get("image"),
        "usable": quality.get("usable"),
        "image_width": quality.get("width"),
        "image_height": quality.get("height"),
        "blur_score": quality.get("blur_score"),
        "aruco_detected": aruco.get("detected"),
        "pixels_per_mm": aruco.get("pixels_per_mm"),
        "net_quantity_value": quantity.get("value"),
        "net_quantity_unit": quantity.get("unit"),
        "source_text": quantity.get("source_text"),
        "ocr_box_height_px": box.get("height_px"),
        "ocr_box_height_mm": box.get("height_mm"),
        "numeric_text": glyph.get("numeric_text"),
        "digit_heights_px": json.dumps(glyph.get("digit_heights_px") or []),
        "glyph_height_px": glyph.get("estimated_numeral_height_px"),
        "glyph_height_mm": glyph.get("estimated_numeral_height_mm"),
        "glyph_confidence": glyph.get("confidence"),
        "glyph_status": glyph.get("status"),
        "measurement_quality_flag": result.get("measurement_quality_flag"),
        "suspected_outliers": " | ".join(result.get("suspected_outliers") or []),
        "failure_stage": result.get("failure_stage"),
        "reason": result.get("reason") or glyph.get("reason"),
        "manual_height_mm": result.get("manual_height_mm"),
        "absolute_error_mm": result.get("absolute_error_mm"),
        "percentage_error": result.get("percentage_error"),
    }


def save_reports(
    results: list[dict[str, Any]],
    summary: dict[str, Any],
    *,
    json_path: str | Path = JSON_OUTPUT,
    csv_path: str | Path = CSV_OUTPUT,
) -> None:
    json_output = Path(json_path)
    csv_output = Path(csv_path)
    json_output.parent.mkdir(parents=True, exist_ok=True)
    csv_output.parent.mkdir(parents=True, exist_ok=True)
    report = make_json_safe({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Engineering validation only; not Rule 7 legal compliance",
        "marker_size_mm": MARKER_SIZE_MM,
        "results": results,
        "summary": summary,
    })
    with json_output.open("w", encoding="utf-8") as output:
        json.dump(report, output, indent=2, ensure_ascii=False, allow_nan=False)
        output.write("\n")
    with csv_output.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=CSV_COLUMNS,
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(_csv_row(result) for result in results)


def print_summary_table(results: list[dict[str, Any]]) -> None:
    print("IMAGE | QUANTITY | ARUCO | GLYPH MM | CONFIDENCE | STATUS")
    for result in results:
        quantity = result.get("net_quantity") or {}
        quantity_text = (
            f"{quantity.get('value'):g} {quantity.get('unit')}"
            if isinstance(quantity.get("value"), (int, float)) and quantity.get("unit")
            else "--"
        )
        aruco_text = "YES" if (result.get("aruco") or {}).get("detected") else "NO"
        glyph = result.get("glyph_measurement") or {}
        height = glyph.get("estimated_numeral_height_mm")
        confidence = glyph.get("confidence")
        height_text = f"{height:.3f}" if isinstance(height, (int, float)) else "--"
        confidence_text = (
            f"{confidence:.3f}" if isinstance(confidence, (int, float)) else "--"
        )
        print(
            f"{Path(result['image']).name} | {quantity_text} | {aruco_text} | "
            f"{height_text} | {confidence_text} | {result['measurement_quality_flag']}"
        )


def main() -> int:
    from paddleocr import PaddleOCR

    ocr = PaddleOCR(lang="en")
    results = process_batch(DEFAULT_IMAGES, ocr)
    summary = summarize_results(results)
    save_reports(results, summary)
    print_summary_table(results)
    print(f"\nReadiness: {summary['readiness']}")
    for reason in summary["readiness_reasoning"]:
        print(f"- {reason}")
    print(f"\nJSON: {JSON_OUTPUT}")
    print(f"CSV:  {CSV_OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
