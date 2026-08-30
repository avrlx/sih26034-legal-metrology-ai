import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from cv.glyph_measurement import (
    clamp_box,
    extract_numeric_text,
    filter_components,
    measure_net_quantity_numeral_height,
    pixels_to_mm,
    robust_median_height,
)


class GlyphMeasurementTests(unittest.TestCase):
    def test_source_box_clamping_supports_padding_and_polygons(self):
        self.assertEqual(clamp_box([-5, -2, 120, 80], 100, 60, padding=2), (0, 0, 100, 60))
        polygon = [[5, 7], [90, 7], [90, 50], [5, 50]]
        self.assertEqual(clamp_box(polygon, 100, 60, padding=3), (2, 4, 93, 53))

    def test_numeric_substring_removes_label_and_unit(self):
        self.assertEqual(extract_numeric_text("Net Vol: 250 ml", 250.0), "250")
        self.assertEqual(extract_numeric_text("NET WEIGHT 500 g", 500), "500")
        self.assertEqual(extract_numeric_text("250 ml", 250), "250")

    def test_decimal_numeric_text_is_preserved(self):
        self.assertEqual(extract_numeric_text("Net Vol: 1.5 L", 1.5), "1.5")
        self.assertEqual(extract_numeric_text("Net Wt: 0,5 kg", 0.5), "0.5")

    def test_connected_component_filter_keeps_narrow_digits(self):
        components = [
            {"width": 2, "height": 25, "area": 38, "touches_crop_boundary": False},
            {"width": 15, "height": 26, "area": 180, "touches_crop_boundary": False},
            {"width": 2, "height": 2, "area": 3, "touches_crop_boundary": False},
            {"width": 50, "height": 40, "area": 1800, "touches_crop_boundary": False},
            {"width": 12, "height": 25, "area": 160, "touches_crop_boundary": True},
        ]
        filtered = filter_components(components, 100, 40, reference_height=30)
        self.assertEqual(filtered, components[:2])

    def test_robust_median_rejects_height_outlier(self):
        self.assertEqual(robust_median_height([30, 31, 29, 90]), 30.0)

    def test_pixels_to_mm_conversion(self):
        self.assertAlmostEqual(pixels_to_mm(31, 11.1172), 2.7885, places=4)

    def test_missing_calibration_returns_review(self):
        quantity = {"value": 250, "source_text": "250 ml", "source_box": [0, 0, 50, 20]}
        result = measure_net_quantity_numeral_height("unused.jpg", quantity, None)
        self.assertEqual(result["status"], "REVIEW")
        self.assertIn("calibration", result["reason"].lower())

    def test_missing_source_box_returns_review(self):
        quantity = {"value": 250, "source_text": "250 ml"}
        result = measure_net_quantity_numeral_height("unused.jpg", quantity, 10.0)
        self.assertEqual(result["status"], "REVIEW")
        self.assertIn("source_box", result["reason"])

    def test_bad_segmentation_returns_review(self):
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "blank.png"
            image = np.full((80, 240, 3), 255, dtype=np.uint8)
            self.assertTrue(cv2.imwrite(str(image_path), image))
            quantity = {
                "value": 250,
                "source_text": "Net Vol: 250 ml",
                "source_box": [10, 10, 220, 60],
                "confidence": 0.99,
            }
            result = measure_net_quantity_numeral_height(str(image_path), quantity, 10.0)

        self.assertEqual(result["status"], "REVIEW")
        self.assertIn("segmentation", result["reason"].lower())


if __name__ == "__main__":
    unittest.main()
