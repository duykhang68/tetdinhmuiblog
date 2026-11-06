"""Offline regression tests for the incident researcher. No GitHub calls."""
import unittest

import researcher


class FingerprintingTests(unittest.TestCase):
    def test_fingerprint_is_stable_for_recurring_error(self):
        first = researcher.fingerprint("CI", "CI-BUILD-FAILED|Production frontend build")
        second = researcher.fingerprint("CI", "CI-BUILD-FAILED|Production frontend build")
        self.assertEqual(first, second)
        self.assertNotEqual(first, researcher.fingerprint("CI", "Other error"))

    def test_build_failure_classification(self):
        run = {
            "id": 100, "name": "CI · Quality Gate", "conclusion": "failure",
            "head_sha": "a" * 40, "head_branch": "feature",
            "html_url": "https://github.com/test/repo/actions/runs/100",
        }
        jobs = [{"name": "Test and build (Node 22)", "conclusion": "failure",
                 "steps": [{"name": "Production frontend build", "conclusion": "failure"}]}]
        result = researcher.classify_ci(run, jobs)
        self.assertEqual(result["code"], "CI-BUILD-FAILED")
        self.assertIn("CI-BUILD-FAILED", result["signature"])

    def test_success_does_not_produce_incident(self):
        self.assertIsNone(researcher.classify_ci({"conclusion": "success"}, []))

    def test_startup_failure_has_bounded_retry_recipe(self):
        record = researcher.classify_ci(
            {"conclusion": "startup_failure", "name": "CI · Quality Gate"}, []
        )
        self.assertEqual(record["code"], "CI-RUNNER-STARTUP")
        self.assertEqual(researcher.MAX_RUN_ATTEMPTS, 5)

    def test_conflict_identity_is_based_on_paths_not_pr_number(self):
        files = [{"filename": ".github/workflows/pr-fix-version.yml"}]
        a = researcher.classify_conflict(
            {"number": 10, "head": {"sha": "a" * 40}, "html_url": "https://a"}, files
        )
        b = researcher.classify_conflict(
            {"number": 99, "head": {"sha": "b" * 40}, "html_url": "https://b"}, files
        )
        self.assertEqual(a["fingerprint"], b["fingerprint"])
        self.assertEqual(a["code"], "PR-MERGE-DIRTY")
        self.assertIn("permissions", a["guidance"])

    def test_markdown_sanitizes_embedded_markup_and_avoids_raw_logs(self):
        run = {
            "conclusion": "failure", "name": "CI · Quality Gate",
            "html_url": "https://example.invalid/1",
        }
        jobs = [{"name": "CI", "conclusion": "failure",
                 "steps": [{"name": "<script>danger</script>", "conclusion": "failure"}]}]
        md = researcher.markdown(researcher.classify_ci(run, jobs))
        self.assertNotIn("<script>", md)
        self.assertIn("Verification required", md)

    def test_repository_validation(self):
        with self.assertRaises(ValueError):
            researcher.GitHub("token", "other/path/with/more")


if __name__ == "__main__":
    unittest.main()
