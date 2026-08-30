"""Manual end-to-end OCR pipeline runner.

This module is import-safe for automated test discovery. Run it directly in an
environment with PaddleOCR installed to exercise the full image pipeline.
"""

import json

from cv.aruco import detect_aruco_scale
from cv.measurement import estimate_text_height_mm
from cv.ocr_filter import filter_ocr_items_near_aruco
from cv.quality import analyze_image_quality
from extract_fields import extract_fields
from rules.engine import evaluate_compliance


IMAGE_PATH = "samples/best.jpg" 
MARKER_SIZE_MM = 50.0
ARUCO_OCR_OVERLAP_THRESHOLD = 0.30


def run_pipeline(image_path=IMAGE_PATH, marker_size_mm=MARKER_SIZE_MM):
    from paddleocr import PaddleOCR

    quality = analyze_image_quality(image_path)
    print("\n========== IMAGE QUALITY ==========\n")
    print(json.dumps(quality, indent=2))

    calibration = detect_aruco_scale(image_path, marker_size_mm=marker_size_mm)
    print("\n========== ARUCO CALIBRATION ==========\n")
    print(json.dumps(calibration, indent=2))

    ocr = PaddleOCR(lang="en")
    raw_ocr_items = []
    for result in ocr.predict(image_path):
        for text, score, box in zip(
            result["rec_texts"], result["rec_scores"], result["rec_boxes"]
        ):
            raw_ocr_items.append(
                {"text": text, "confidence": float(score), "box": box.tolist()}
            )

    print("\n========== RAW OCR TEXT ==========\n")
    for item in raw_ocr_items:
        print(f"{item['text']} ({item['confidence']:.3f})")

    extraction_ocr_items = filter_ocr_items_near_aruco(
        raw_ocr_items,
        calibration.get("corners"),
        overlap_threshold=ARUCO_OCR_OVERLAP_THRESHOLD,
    )
    print("\n========== OCR MARKER FILTER ==========\n")
    print(
        f"raw={len(raw_ocr_items)}, extraction={len(extraction_ocr_items)}, "
        f"removed={len(raw_ocr_items) - len(extraction_ocr_items)}"
    )

    fields = extract_fields(extraction_ocr_items)
    measurement = None
    net_qty = fields.get("net_quantity")
    if (
        net_qty
        and isinstance(net_qty, dict)
        and net_qty.get("source_box")
        and calibration.get("pixels_per_mm")
    ):
        measurement = estimate_text_height_mm(
            net_qty["source_box"], calibration["pixels_per_mm"]
        )
        net_qty["measurement"] = measurement

    print("\n========== NET QUANTITY MEASUREMENT ==========\n")
    if measurement:
        print(json.dumps(measurement, indent=2))
    elif not net_qty:
        print("Measurement unavailable: net quantity was not extracted.")
    elif not net_qty.get("source_box"):
        print("Measurement unavailable: net quantity source_box is missing.")
    else:
        print("Measurement unavailable: ArUco calibration failed.")

    print("\n========== EXTRACTED FIELDS ==========\n")
    print(json.dumps(fields, indent=2, ensure_ascii=False))

    compliance = evaluate_compliance(fields)
    print("\n========== COMPLIANCE RESULT ==========\n")
    print(json.dumps(compliance, indent=2, ensure_ascii=False))
    return {
        "quality": quality,
        "calibration": calibration,
        "raw_ocr_items": raw_ocr_items,
        "extraction_ocr_items": extraction_ocr_items,
        "fields": fields,
        "compliance": compliance,
    }


if __name__ == "__main__":
    run_pipeline()
