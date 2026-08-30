import json
import unittest
from pathlib import Path

from cv.ocr_filter import filter_ocr_items_near_aruco
from extract_fields import extract_fields, normalize_text


FIXTURES = Path(__file__).parent / "fixtures"


def load_ocr(name):
    with (FIXTURES / name).open(encoding="utf-8") as fixture:
        lines = json.load(fixture)["lines"]
    return [
        {"text": line, "confidence": 0.98,
         "box": [[0, i * 20], [180, i * 20], [180, (i + 1) * 20], [0, (i + 1) * 20]],
         "source_image": name.replace("_ocr.json", ".jpg")}
        for i, line in enumerate(lines)
    ]


class ExtractionRegressionTests(unittest.TestCase):
    def test_normalization_preserves_raw_evidence(self):
        result = extract_fields(load_ocr("bioworld_ocr.json"))
        quantity_line = next(line for line in result["ocr_evidence"] if line["raw_text"] == ":1N")
        self.assertEqual(quantity_line["normalized_text"], "1 N")
        self.assertEqual(normalize_text("  ;  50PCS  "), "50 PCS")

    def test_bioworld_regression(self):
        result = extract_fields(load_ocr("bioworld_ocr.json"))
        self.assertEqual(result["product"], "TSHIRT")
        self.assertEqual(result["net_quantity"]["value"], 1.0)
        self.assertEqual(result["net_quantity"]["unit"], "N")
        self.assertEqual(result["mrp"]["value"], 999.0)
        self.assertTrue(result["mrp"]["inclusive_of_all_taxes"])
        self.assertEqual(result["manufacture_date"]["normalized"], "2022-02")
        expected_company = "BIOWORLD MERCHANDISING INDIA PVT. LTD"
        self.assertEqual(result["manufacturer"]["name"], expected_company)
        self.assertEqual(result["marketer"]["name"], expected_company)
        self.assertNotIn("Month & Year", result["manufacturer"]["name"])
        self.assertNotIn("February 2022", result["manufacturer"]["name"])
        expected_address = "307-309 PARK CENTRA, SECTOR 30 GURGAON, HARYANA, INDIA 122001."
        self.assertEqual(result["manufacturer"]["address"], expected_address)
        self.assertEqual(result["marketer"]["address"], expected_address)
        self.assertEqual(result["consumer_care"]["phone"], "0124-4362552")
        self.assertEqual(result["consumer_care"]["email"], "contact@bioworldind.com")
        self.assertEqual(result["country_of_origin"], "India")

    def test_go_desi_regression(self):
        result = extract_fields(load_ocr("go_desi_ocr.json"))
        self.assertIsNone(result["product"])
        self.assertEqual(result["net_quantity"]["value"], 50.0)
        self.assertEqual(result["net_quantity"]["unit"], "N")
        self.assertEqual(result["mrp"]["value"], 250.0)
        self.assertEqual(result["manufacture_date"]["normalized"], "2020-07-30")
        self.assertEqual(result["manufacturer"]["name"], "GO DESI MANDI PVT LTD.")
        self.assertEqual(result["marketer"]["name"], "GO DESI MANDI PVT LTD.")
        for role in ("manufacturer", "marketer"):
            address = result[role]["address"].upper()
            self.assertNotIn("FSSAI", address)
            self.assertNotIn("SSAI", address)
            self.assertNotIn("112193", address)
            self.assertNotIn("MORC", address)

    def test_semantic_formats_beat_nearby_numbers(self):
        lines = ["MRP", "560098", "February 2022", "50 PCS", "₹250/-", "NET QTY"]
        items = [{"text": text, "confidence": 0.95, "box": [0, i * 20, 100, i * 20 + 18]} for i, text in enumerate(lines)]
        result = extract_fields(items)
        self.assertEqual(result["mrp"]["value"], 250.0)
        self.assertEqual(result["net_quantity"]["value"], 50.0)

    def test_inline_role_and_wrapped_company_name(self):
        lines = [
            "Manufactured By: ACME GLOBAL",
            "FOODS PRIVATE LIMITED, Plot 4",
            "Industrial Area, Delhi-110001",
            "MRP: Rs. 99.00",
        ]
        items = [{"text": text, "confidence": 0.95, "box": [0, i * 20, 180, i * 20 + 18]} for i, text in enumerate(lines)]
        result = extract_fields(items)
        self.assertEqual(result["manufacturer"]["name"], "ACME GLOBAL FOODS PRIVATE LIMITED")
        self.assertEqual(result["manufacturer"]["address"], "Plot 4 Industrial Area, Delhi-110001")
        self.assertEqual(result["mrp"]["value"], 99.0)

    def test_tax_inclusive_ocr_spacing_variants(self):
        for phrase in (
            "inclusive of all taxes",
            "inclusive ofall taxes",
            "inclusiveof all taxes",
            "inclusiveofalltaxes",
            "(INCLUSIVE OF ALL TAXES)",
        ):
            with self.subTest(phrase=phrase):
                lines = ["MRP", "999.00", phrase]
                items = [
                    {"text": text, "confidence": 0.95, "box": [0, i * 20, 100, i * 20 + 18]}
                    for i, text in enumerate(lines)
                ]
                result = extract_fields(items)
                self.assertEqual(result["mrp"]["value"], 999.0)
                self.assertTrue(result["mrp"]["inclusive_of_all_taxes"])
                raw_texts = [evidence["raw_text"] for evidence in result["ocr_evidence"]]
                self.assertIn(phrase, raw_texts)

    def test_aruco_overlap_filter_preserves_raw_items(self):
        fake_marker_text = {
            "text": "7",
            "confidence": 0.459,
            "box": [821, 527, 1271, 946],
        }
        nearby_real_text = {
            "text": "NET QUANTITY",
            "confidence": 0.98,
            "box": [1200, 980, 1400, 1020],
        }
        raw_ocr_items = [fake_marker_text, nearby_real_text]
        marker_corners = [
            [808, 598],
            [1139, 600],
            [1132, 917],
            [817, 923],
        ]

        extraction_ocr_items = filter_ocr_items_near_aruco(
            raw_ocr_items,
            marker_corners,
            overlap_threshold=0.30,
        )

        self.assertEqual(extraction_ocr_items, [nearby_real_text])
        self.assertEqual(raw_ocr_items, [fake_marker_text, nearby_real_text])


if __name__ == "__main__":
    unittest.main()
