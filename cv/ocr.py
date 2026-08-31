"""OCR output normalization and conservative quantity-crop recovery."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import cv2

from extract_fields import QUANTITY_LABEL_RE, is_standalone_quantity_candidate


def _as_box(value: Any, offset: tuple[int, int] = (0, 0)) -> list[int]:
    raw = value.tolist() if hasattr(value, "tolist") else list(value)
    x_offset, y_offset = offset
    if raw and isinstance(raw[0], (list, tuple)):
        xs = [float(point[0]) for point in raw]
        ys = [float(point[1]) for point in raw]
        raw = [min(xs), min(ys), max(xs), max(ys)]
    return [
        int(round(float(raw[0]) + x_offset)),
        int(round(float(raw[1]) + y_offset)),
        int(round(float(raw[2]) + x_offset)),
        int(round(float(raw[3]) + y_offset)),
    ]


def predict_ocr_items(
    ocr: Any,
    image: str | Any,
    *,
    offset: tuple[int, int] = (0, 0),
) -> list[dict[str, Any]]:
    """Normalize PaddleOCR lines and retain word-level geometry when available."""
    try:
        predictions = ocr.predict(image, return_word_box=True)
    except TypeError:  # Test doubles and older compatible wrappers.
        predictions = ocr.predict(image)
    items: list[dict[str, Any]] = []
    for prediction in predictions:
        texts = prediction.get("rec_texts")
        scores = prediction.get("rec_scores")
        boxes = prediction.get("rec_boxes")
        words = prediction.get("text_word")
        word_boxes = prediction.get("text_word_boxes")
        texts = [] if texts is None else texts
        scores = [] if scores is None else scores
        boxes = [] if boxes is None else boxes
        words = [] if words is None else words
        word_boxes = [] if word_boxes is None else word_boxes
        for index, (text, score, box) in enumerate(zip(texts, scores, boxes)):
            tokens = []
            if index < len(words) and index < len(word_boxes):
                for token, token_box in zip(words[index], word_boxes[index]):
                    if str(token).strip():
                        tokens.append({
                            "text": str(token),
                            "box": _as_box(token_box, offset),
                        })
            item = {
                "text": str(text),
                "confidence": float(score),
                "box": _as_box(box, offset),
            }
            if tokens:
                item["tokens"] = tokens
            items.append(item)
    return items


def recover_split_quantity_items(
    image_path: str | Path,
    items: list[dict[str, Any]],
    ocr: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Retry tight label-adjacent crops when full-image OCR lost the value/unit.

    Recovery uses the already configured OCR instance and accepts only a complete,
    standalone number-plus-unit line. It never infers a unit from the label.
    """
    if any(is_standalone_quantity_candidate(str(item.get("text") or "")) for item in items):
        return items, {"attempted": False, "recovered": False, "reason": "quantity_candidate_already_present"}
    image = cv2.imread(str(image_path))
    if image is None:
        return items, {"attempted": False, "recovered": False, "reason": "image_unreadable"}
    height, width = image.shape[:2]
    labels = [item for item in items if QUANTITY_LABEL_RE.search(str(item.get("text") or ""))]
    if not labels:
        return items, {"attempted": False, "recovered": False, "reason": "quantity_label_not_found"}

    recovered: list[dict[str, Any]] = []
    attempted_crops = []
    for label in labels:
        x1, y1, x2, y2 = (int(value) for value in label["box"][:4])
        line_height = max(12, y2 - y1)
        label_width = max(line_height * 2, x2 - x1)
        crop_box = (
            max(0, x1 - int(line_height * 0.7)),
            max(0, y1 - int(line_height * 0.8)),
            min(width, max(x2 + int(label_width * 2.8), x1 + int(line_height * 9))),
            min(height, y2 + int(line_height * 4.2)),
        )
        cx1, cy1, cx2, cy2 = crop_box
        attempted_crops.append(list(crop_box))
        crop = image[cy1:cy2, cx1:cx2]
        for candidate in predict_ocr_items(ocr, crop, offset=(cx1, cy1)):
            text = re.sub(r"\s+", " ", candidate["text"]).strip()
            if not is_standalone_quantity_candidate(text):
                continue
            candidate["recovered_from_quantity_crop"] = True
            candidate["source_image"] = str(image_path)
            if not any(
                existing.get("text") == candidate["text"]
                and existing.get("box") == candidate["box"]
                for existing in items + recovered
            ):
                recovered.append(candidate)
    return items + recovered, {
        "attempted": True,
        "recovered": bool(recovered),
        "attempted_crops": attempted_crops,
        "recovered_item_count": len(recovered),
    }
