import unittest

from rules.engine import (
    evaluate_font_height_applicability,
    evaluate_rule,
    validate_consumer_care,
    validate_month_year,
    validate_mrp,
    validate_mrp_netqty_contrast,
    validate_net_quantity,
    validate_unit_scale,
)


def _rule(field_name):
    return {"field_name": field_name}


class RuleEngineTests(unittest.TestCase):
    def test_missing_fields_require_review_not_failure(self):
        for field_name in ("manufacturer_name", "manufacturer_address", "commodity_name", "country_of_origin"):
            self.assertEqual(evaluate_rule(_rule(field_name), {})["status"], "REVIEW")
        self.assertEqual(validate_mrp(None)[0], "REVIEW")
        self.assertEqual(validate_net_quantity(None)[0], "REVIEW")
        self.assertEqual(validate_consumer_care(None)[0], "REVIEW")
        self.assertEqual(validate_month_year(None)[0], "REVIEW")

    def test_detected_invalid_values_fail(self):
        self.assertEqual(validate_mrp({"value": 0})[0], "FAIL")
        self.assertEqual(validate_net_quantity({"value": -1, "unit": "G"})[0], "FAIL")
        self.assertEqual(validate_consumer_care({"phone": "123"})[0], "FAIL")

    def test_low_confidence_evidence_requires_review(self):
        self.assertEqual(validate_mrp({"value": 99, "confidence": 0.2})[0], "REVIEW")
        fields = {"manufacturer": {"name": "ACME LTD", "address": "Delhi", "confidence": 0.2}}
        self.assertEqual(evaluate_rule(_rule("manufacturer_name"), fields)["status"], "REVIEW")

    def test_count_rules_remain_not_applicable(self):
        fields = {"net_quantity": {"value": 50, "unit": "N"}}
        self.assertEqual(validate_unit_scale(fields["net_quantity"])[0], "NOT_APPLICABLE")
        self.assertEqual(evaluate_font_height_applicability(fields)[0], "NOT_APPLICABLE")

    def test_rule_7_stays_review_even_with_glyph_measurement(self):
        fields = {
            "net_quantity": {
                "value": 250,
                "unit": "ML",
                "glyph_measurement": {
                    "status": "OK",
                    "estimated_numeral_height_mm": 2.609,
                    "confidence": 0.79,
                },
            }
        }
        status, reason = evaluate_font_height_applicability(fields)
        self.assertEqual(status, "REVIEW")
        self.assertEqual(reason, "Physical font measurement requires calibrated image analysis")

    def test_structured_manufacture_date_passes(self):
        value = {"raw": "February 2022", "normalized": "2022-02", "type": "manufacture_month_year"}
        self.assertEqual(validate_month_year(value)[0], "PASS")

    def test_contrast_rule_passes_only_when_both_targets_are_strong(self):
        value = {"targets": {
            "NET_QUANTITY": {"target": "NET_QUANTITY", "status": "OK", "confidence": 0.88,
                             "contrast_ratio": 4.2, "lab_color_difference": 50.0},
            "MRP": {"target": "MRP", "status": "OK", "confidence": 0.84,
                    "contrast_ratio": 3.4, "lab_color_difference": 38.0},
        }}
        status, reason = validate_mrp_netqty_contrast(value)
        self.assertEqual(status, "PASS")
        self.assertIn("not a statutory threshold", reason)
        self.assertEqual(
            evaluate_rule(_rule("mrp_netqty_contrast"), {"mrp_netqty_contrast": value})["status"],
            "PASS",
        )

    def test_contrast_rule_fails_confidently_low_target(self):
        value = {"targets": {
            "NET_QUANTITY": {"target": "NET_QUANTITY", "status": "OK", "confidence": 0.90,
                             "contrast_ratio": 1.2, "lab_color_difference": 7.0},
            "MRP": {"target": "MRP", "status": "OK", "confidence": 0.90,
                    "contrast_ratio": 4.0, "lab_color_difference": 50.0},
        }}
        self.assertEqual(validate_mrp_netqty_contrast(value)[0], "FAIL")

    def test_contrast_rule_reviews_missing_unreliable_or_borderline_evidence(self):
        self.assertEqual(validate_mrp_netqty_contrast(None)[0], "REVIEW")
        incomplete = {"targets": {"MRP": {"status": "OK", "confidence": 0.9}}}
        self.assertEqual(validate_mrp_netqty_contrast(incomplete)[0], "REVIEW")
        unreliable = {"targets": {
            "NET_QUANTITY": {"status": "REVIEW", "confidence": 0.4},
            "MRP": {"status": "OK", "confidence": 0.9},
        }}
        self.assertEqual(validate_mrp_netqty_contrast(unreliable)[0], "REVIEW")
        missing_metrics = {"targets": {
            "NET_QUANTITY": {"status": "OK", "confidence": 0.9},
            "MRP": {"status": "OK", "confidence": 0.9},
        }}
        self.assertEqual(validate_mrp_netqty_contrast(missing_metrics)[0], "REVIEW")
        borderline = {"targets": {
            "NET_QUANTITY": {"status": "OK", "confidence": 0.8,
                             "contrast_ratio": 2.0, "lab_color_difference": 20.0},
            "MRP": {"status": "OK", "confidence": 0.8,
                    "contrast_ratio": 4.0, "lab_color_difference": 40.0},
        }}
        self.assertEqual(validate_mrp_netqty_contrast(borderline)[0], "REVIEW")


if __name__ == "__main__":
    unittest.main()
