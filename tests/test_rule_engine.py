import unittest

from rules.engine import (
    evaluate_font_height_applicability,
    evaluate_rule,
    validate_consumer_care,
    validate_month_year,
    validate_mrp,
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

    def test_structured_manufacture_date_passes(self):
        value = {"raw": "February 2022", "normalized": "2022-02", "type": "manufacture_month_year"}
        self.assertEqual(validate_month_year(value)[0], "PASS")


if __name__ == "__main__":
    unittest.main()
