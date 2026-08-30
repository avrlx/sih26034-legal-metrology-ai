"""Conservative numeral-glyph measurement for calibrated net quantities."""

from __future__ import annotations

import itertools
import math
import re
from pathlib import Path
from typing import Any, Iterable, Sequence

import cv2
import numpy as np


Box = Sequence[float] | Sequence[Sequence[float]]


def _box_bounds(box: Box | None) -> tuple[float, float, float, float] | None:
    if box is None or len(box) == 0:
        return None
    first = box[0]
    if isinstance(first, (list, tuple, np.ndarray)):
        points = np.asarray(box, dtype=float).reshape(-1, 2)
        return (
            float(points[:, 0].min()),
            float(points[:, 1].min()),
            float(points[:, 0].max()),
            float(points[:, 1].max()),
        )
    if len(box) < 4:
        return None
    x1, y1, x2, y2 = (float(value) for value in box[:4])  # type: ignore[misc]
    return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)


def clamp_box(
    box: Box | None,
    image_width: int,
    image_height: int,
    padding: int = 0,
) -> tuple[int, int, int, int] | None:
    """Clamp a rectangle or OCR polygon to valid image coordinates."""
    bounds = _box_bounds(box)
    if bounds is None or image_width <= 0 or image_height <= 0:
        return None
    x1, y1, x2, y2 = bounds
    padding = max(0, int(padding))
    clamped = (
        max(0, int(math.floor(x1)) - padding),
        max(0, int(math.floor(y1)) - padding),
        min(image_width, int(math.ceil(x2)) + padding),
        min(image_height, int(math.ceil(y2)) + padding),
    )
    if clamped[2] <= clamped[0] or clamped[3] <= clamped[1]:
        return None
    return clamped


def _number_matches(source_text: str) -> list[re.Match[str]]:
    return list(re.finditer(r"(?<!\d)\d+(?:[.,]\d+)?", source_text or ""))


def _numeric_span(source_text: str, value: Any = None) -> tuple[str, int, int] | None:
    matches = _number_matches(source_text)
    if not matches:
        return None

    chosen = matches[0]
    try:
        expected = float(value)
    except (TypeError, ValueError):
        expected = None
    if expected is not None:
        parsed_matches = []
        for match in matches:
            try:
                parsed = float(match.group(0).replace(",", "."))
            except ValueError:
                continue
            parsed_matches.append((abs(parsed - expected), match))
        if parsed_matches:
            chosen = min(parsed_matches, key=lambda entry: entry[0])[1]
    return chosen.group(0).replace(",", "."), chosen.start(), chosen.end()


def extract_numeric_text(source_text: str, value: Any = None) -> str | None:
    """Extract the quantity's numeric token without its label or unit."""
    span = _numeric_span(source_text, value)
    return span[0] if span else None


def pixels_to_mm(height_px: float, pixels_per_mm: float) -> float | None:
    if height_px <= 0 or pixels_per_mm <= 0:
        return None
    return float(height_px) / float(pixels_per_mm)


def _height_inliers(heights: Iterable[float]) -> list[float]:
    values = np.asarray([float(height) for height in heights if height > 0], dtype=float)
    if values.size <= 2:
        return values.tolist()
    median = float(np.median(values))
    deviations = np.abs(values - median)
    mad = float(np.median(deviations))
    tolerance = max(2.0, 2.5 * mad)
    return values[deviations <= tolerance].tolist()


def robust_median_height(heights: Iterable[float]) -> float | None:
    """Return a median after rejecting clear height outliers."""
    inliers = _height_inliers(heights)
    return float(np.median(inliers)) if inliers else None


def filter_components(
    components: Iterable[dict[str, Any]],
    region_width: int,
    region_height: int,
    reference_height: float,
) -> list[dict[str, Any]]:
    """Remove obvious connected-component noise while retaining narrow digits."""
    minimum_height = max(3, int(round(reference_height * 0.20)))
    maximum_height = max(minimum_height, int(round(reference_height * 1.30)))
    minimum_area = max(3, int(round(reference_height * 0.45)))
    maximum_area = max(minimum_area, int(region_width * region_height * 0.20))
    maximum_width = max(3, int(round(reference_height * 1.35)))

    filtered = []
    for component in components:
        width = int(component["width"])
        height = int(component["height"])
        area = int(component["area"])
        if component.get("touches_crop_boundary"):
            continue
        if not (1 <= width <= maximum_width):
            continue
        if not (minimum_height <= height <= maximum_height):
            continue
        if not (minimum_area <= area <= maximum_area):
            continue
        if area / max(1, width * height) < 0.05:
            continue
        filtered.append(component)
    return filtered


def _review(reason: str, confidence: float = 0.0, **evidence: Any) -> dict[str, Any]:
    return {
        "status": "REVIEW",
        "method": "connected_components",
        "reason": reason,
        "confidence": round(float(max(0.0, min(1.0, confidence))), 3),
        **evidence,
    }


def _foreground_mask(gray: np.ndarray) -> tuple[np.ndarray, str, float]:
    normalized = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4)).apply(gray)
    masks = []
    for mode, name in (
        (cv2.THRESH_BINARY_INV, "dark_on_light"),
        (cv2.THRESH_BINARY, "light_on_dark"),
    ):
        _, mask = cv2.threshold(normalized, 0, 255, mode | cv2.THRESH_OTSU)
        ratio = float(np.count_nonzero(mask) / mask.size)
        masks.append((abs(ratio - 0.15), mask, name, ratio))
    _, mask, polarity, ratio = min(masks, key=lambda entry: entry[0])
    return mask, polarity, ratio


def _connected_components(mask: np.ndarray, crop_box: tuple[int, int, int, int]) -> list[dict[str, Any]]:
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    crop_x1, crop_y1, _, _ = crop_box
    height, width = mask.shape
    components = []
    for label in range(1, count):
        x, y, component_width, component_height, area = (
            int(value) for value in stats[label, :5]
        )
        components.append({
            "x": x,
            "y": y,
            "width": component_width,
            "height": component_height,
            "area": area,
            "box": [
                crop_x1 + x,
                crop_y1 + y,
                crop_x1 + x + component_width,
                crop_y1 + y + component_height,
            ],
            "touches_crop_boundary": (
                x <= 0
                or y <= 0
                or x + component_width >= width
                or y + component_height >= height
            ),
        })
    return components


def _select_digit_components(
    components: list[dict[str, Any]],
    expected_count: int,
    expected_center_x: float,
    reference_width: float,
) -> list[dict[str, Any]]:
    ordered = sorted(components, key=lambda component: component["box"][0])
    if len(ordered) <= expected_count:
        return ordered

    best: tuple[float, tuple[dict[str, Any], ...]] | None = None
    for group in itertools.combinations(ordered, expected_count):
        heights = np.asarray([component["height"] for component in group], dtype=float)
        centers = np.asarray(
            [(component["box"][0] + component["box"][2]) / 2 for component in group],
            dtype=float,
        )
        consistency = float(np.std(heights) / max(1.0, np.mean(heights)))
        center_distance = abs(float(np.mean(centers)) - expected_center_x) / max(1.0, reference_width)
        order_gaps = np.diff(centers)
        gap_penalty = (
            float(np.std(order_gaps) / max(1.0, np.mean(order_gaps)))
            if order_gaps.size > 1
            else 0.0
        )
        score = consistency + center_distance * 0.35 + gap_penalty * 0.15
        if best is None or score < best[0]:
            best = (score, group)
    return list(best[1]) if best else []


def _save_debug_image(
    image: np.ndarray,
    source_box: tuple[int, int, int, int],
    value_region_box: list[int],
    digit_boxes: list[list[int]],
    debug_image_path: str,
) -> bool:
    debug = image.copy()
    cv2.rectangle(debug, source_box[:2], source_box[2:], (255, 0, 0), 2)
    cv2.rectangle(debug, value_region_box[:2], value_region_box[2:], (0, 165, 255), 2)
    for box in digit_boxes:
        cv2.rectangle(debug, box[:2], box[2:], (0, 255, 0), 2)
    path = Path(debug_image_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return bool(cv2.imwrite(str(path), debug))


def measure_net_quantity_numeral_height(
    image_path: str,
    net_quantity: dict[str, Any] | None,
    pixels_per_mm: float | None,
    *,
    padding_px: int | None = None,
    debug_image_path: str | None = None,
) -> dict[str, Any]:
    """Estimate printed numeral height using calibrated connected components.

    The crop expands enough to complete glyphs that intersect the OCR source box,
    but selection remains constrained to the source line and estimated numeric span.
    Unreliable segmentation produces ``REVIEW`` rather than a fabricated height.
    """
    if not net_quantity:
        return _review("Net quantity is missing")
    source_text = str(net_quantity.get("source_text") or "")
    source_box_value = net_quantity.get("source_box")
    common_evidence = {"source_text": source_text, "source_box": source_box_value}
    if source_box_value is None or len(source_box_value) == 0:
        return _review("Net quantity source_box is missing", **common_evidence)
    if not pixels_per_mm or float(pixels_per_mm) <= 0:
        return _review("ArUco calibration is missing", **common_evidence)

    numeric_span = _numeric_span(source_text, net_quantity.get("value"))
    if numeric_span is None:
        return _review("Numeric quantity text was not found", **common_evidence)
    numeric_text, numeric_start, numeric_end = numeric_span
    expected_digit_count = sum(character.isdigit() for character in numeric_text)
    if expected_digit_count == 0:
        return _review("Numeric quantity contains no visible digits", numeric_text=numeric_text, **common_evidence)

    image = cv2.imread(str(image_path))
    if image is None:
        return _review("Source image could not be read", numeric_text=numeric_text, **common_evidence)
    image_height, image_width = image.shape[:2]
    source_box = clamp_box(source_box_value, image_width, image_height)
    if source_box is None:
        return _review("Net quantity source_box is outside the image", numeric_text=numeric_text, **common_evidence)
    source_x1, source_y1, source_x2, source_y2 = source_box
    source_width = source_x2 - source_x1
    source_height = source_y2 - source_y1

    # OCR rectangles can clip anti-aliased glyph edges. The expanded search crop
    # completes intersecting components; later filters still anchor them to the
    # original source line, preventing adjacent declarations from being selected.
    search_padding = (
        max(2, int(round(source_height * 0.65)))
        if padding_px is None
        else max(0, int(padding_px))
    )
    crop_box = clamp_box(source_box_value, image_width, image_height, search_padding)
    if crop_box is None:
        return _review("Net quantity crop is invalid", numeric_text=numeric_text, **common_evidence)
    crop_x1, crop_y1, crop_x2, crop_y2 = crop_box
    crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        return _review("Net quantity crop is empty", numeric_text=numeric_text, **common_evidence)

    text_length = max(1, len(source_text))
    approximate_character_width = source_width / text_length
    numeric_x1 = source_x1 + source_width * (numeric_start / text_length)
    numeric_x2 = source_x1 + source_width * (numeric_end / text_length)
    # Labels usually make proportional x estimates start slightly early; avoid
    # pulling a final label glyph in, while allowing the last digit to be wider.
    value_x1 = max(
        crop_x1,
        int(math.ceil(numeric_x1 + approximate_character_width * 0.10)),
    )
    value_x2 = min(crop_x2, int(math.ceil(numeric_x2 + approximate_character_width)))
    value_region_box = [value_x1, crop_y1, value_x2, crop_y2]
    expected_center_x = (numeric_x1 + numeric_x2) / 2

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    mask, polarity, foreground_ratio = _foreground_mask(gray)
    components = _connected_components(mask, crop_box)
    components = filter_components(components, crop.shape[1], crop.shape[0], source_height)
    candidates = []
    for component in components:
        box_x1, box_y1, box_x2, box_y2 = component["box"]
        center_x = (box_x1 + box_x2) / 2
        vertical_intersection = max(0, min(box_y2, source_y2) - max(box_y1, source_y1))
        if value_x1 <= center_x <= value_x2 and vertical_intersection > 0:
            candidates.append(component)

    evidence = {
        **common_evidence,
        "numeric_text": numeric_text,
        "source_box": list(source_box),
        "crop_box": list(crop_box),
        "crop_dimensions": {"width": int(crop.shape[1]), "height": int(crop.shape[0])},
        "value_region_box": value_region_box,
        "pixels_per_mm": round(float(pixels_per_mm), 4),
        "threshold_polarity": polarity,
        "foreground_ratio": round(foreground_ratio, 4),
        "expected_digit_count": expected_digit_count,
    }
    selected = _select_digit_components(
        candidates,
        expected_digit_count,
        expected_center_x,
        source_width,
    )
    if len(selected) != expected_digit_count:
        return _review(
            "Numeral segmentation did not match the expected digit count",
            confidence=min(0.49, len(selected) / expected_digit_count * 0.5),
            candidate_count=len(candidates),
            digit_boxes=[component["box"] for component in selected],
            **evidence,
        )

    raw_heights = [float(component["height"]) for component in selected]
    inlier_heights = _height_inliers(raw_heights)
    if len(inlier_heights) != expected_digit_count:
        return _review(
            "Digit heights were inconsistent",
            confidence=0.45,
            candidate_count=len(candidates),
            digit_boxes=[component["box"] for component in selected],
            digit_heights_px=raw_heights,
            **evidence,
        )
    estimated_height_px = robust_median_height(raw_heights)
    if estimated_height_px is None:
        return _review("No usable digit heights were found", **evidence)
    estimated_height_mm = pixels_to_mm(estimated_height_px, float(pixels_per_mm))
    if estimated_height_mm is None:
        return _review("Pixel-to-millimetre conversion failed", **evidence)

    mean_height = float(np.mean(raw_heights))
    variation = float(np.std(raw_heights) / max(1.0, mean_height))
    consistency_score = max(0.0, 1.0 - variation * 3.0)
    ocr_confidence = max(0.0, min(1.0, float(net_quantity.get("confidence", 0.5) or 0.5)))
    foreground_score = max(0.0, 1.0 - abs(foreground_ratio - 0.15) / 0.35)
    confidence = 0.30 + consistency_score * 0.25 + ocr_confidence * 0.30 + foreground_score * 0.15
    digit_boxes = [component["box"] for component in selected]
    if confidence < 0.75:
        return _review(
            "Numeral segmentation confidence was too low",
            confidence=confidence,
            candidate_count=len(candidates),
            digit_boxes=digit_boxes,
            digit_heights_px=raw_heights,
            **evidence,
        )
    result = {
        "status": "OK",
        "method": "connected_components",
        **evidence,
        "candidate_count": len(candidates),
        "digit_boxes": digit_boxes,
        "digit_heights_px": [round(height, 2) for height in raw_heights],
        "median_digit_height_px": round(float(estimated_height_px), 2),
        "estimated_numeral_height_px": round(float(estimated_height_px), 2),
        "estimated_numeral_height_mm": round(float(estimated_height_mm), 3),
        "confidence": round(float(min(1.0, confidence)), 3),
    }
    if debug_image_path:
        result["debug_image_path"] = debug_image_path
        result["debug_image_saved"] = _save_debug_image(
            image, source_box, value_region_box, digit_boxes, debug_image_path
        )
    return result
