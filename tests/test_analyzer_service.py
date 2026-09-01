import tempfile
import unittest
from pathlib import Path

from services.analyzer import PackageAnalysisError, PackageAnalyzer


class AnalyzerServiceTests(unittest.TestCase):
    def test_ocr_instance_is_lazy_and_reused_with_request_local_evidence(self):
        calls = {"factory": 0, "processor": 0}
        evidence_directories = []
        ocr_instance = object()

        def factory():
            calls["factory"] += 1
            return ocr_instance

        def processor(path, ocr, *, debug_path):
            calls["processor"] += 1
            self.assertIs(ocr, ocr_instance)
            evidence_directories.append(Path(debug_path).parent)
            self.assertTrue(Path(debug_path).parent.name.startswith("sih26034_evidence_"))
            return {
                "image": str(path), "failure_stage": None,
                "glyph_measurement": {"debug_image_path": str(debug_path)},
            }

        def report_builder(result):
            return {"report_version": "1.0", "image": result["image"]}

        analyzer = PackageAnalyzer(
            ocr_factory=factory,
            image_processor=processor,
            report_builder=report_builder,
            evidence_builder=lambda *_args: [{"id": "safe-evidence"}],
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
        self.assertTrue(all(not directory.exists() for directory in evidence_directories))

    def test_unexpected_pipeline_failure_is_technical_error(self):
        analyzer = PackageAnalyzer(
            ocr_factory=lambda: object(),
            image_processor=lambda *_args, **_kwargs: {
                "failure_stage": "unexpected_exception", "image": "private/path.jpg"
            },
            report_builder=lambda result: result,
            evidence_builder=lambda *_args: [],
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.jpg"
            path.write_bytes(b"placeholder")
            with self.assertRaises(PackageAnalysisError):
                analyzer.analyze_package(path)


if __name__ == "__main__":
    unittest.main()
