import tempfile
import unittest
from pathlib import Path

from services.analyzer import PackageAnalysisError, PackageAnalyzer


class AnalyzerServiceTests(unittest.TestCase):
    def test_ocr_instance_is_lazy_and_reused_without_debug_outputs(self):
        calls = {"factory": 0, "processor": 0}
        ocr_instance = object()

        def factory():
            calls["factory"] += 1
            return ocr_instance

        def processor(path, ocr, *, debug_path):
            calls["processor"] += 1
            self.assertIs(ocr, ocr_instance)
            self.assertIsNone(debug_path)
            return {"image": str(path), "failure_stage": None}

        def report_builder(result):
            return {"report_version": "1.0", "image": result["image"]}

        analyzer = PackageAnalyzer(
            ocr_factory=factory, image_processor=processor, report_builder=report_builder
        )
        self.assertFalse(analyzer.ocr_initialized)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.jpg"
            path.write_bytes(b"placeholder")
            first = analyzer.analyze_package(path, display_filename="first.jpg")
            second = analyzer.analyze_package(path, display_filename="second.jpg")
        self.assertEqual(calls, {"factory": 1, "processor": 2})
        self.assertTrue(analyzer.ocr_initialized)
        self.assertEqual(first["image"], "first.jpg")
        self.assertEqual(second["image"], "second.jpg")

    def test_unexpected_pipeline_failure_is_technical_error(self):
        analyzer = PackageAnalyzer(
            ocr_factory=lambda: object(),
            image_processor=lambda *_args, **_kwargs: {
                "failure_stage": "unexpected_exception", "image": "private/path.jpg"
            },
            report_builder=lambda result: result,
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.jpg"
            path.write_bytes(b"placeholder")
            with self.assertRaises(PackageAnalysisError):
                analyzer.analyze_package(path)


if __name__ == "__main__":
    unittest.main()
