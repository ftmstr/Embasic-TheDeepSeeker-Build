"""TUR039: exact PR head provenance guard; no live GitHub mutations."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location("ci_head_guard", ROOT / "tools/verify-ci-checkout.py")
GUARD = module_from_spec(SPEC)
SPEC.loader.exec_module(GUARD)
A = "a" * 40
B = "b" * 40


class HeadIdentityGate(unittest.TestCase):
    def test_same_oid_passes(self):
        GUARD.validate(A, A)

    def test_synthetic_merge_oid_rejected(self):
        with self.assertRaisesRegex(ValueError, "differs"):
            GUARD.validate(A, B)

    def test_bad_or_empty_event_oid_rejected(self):
        for bad in ("", "main", "HEAD", A.upper(), A[:-1], A + "0", "0x" + A, A + "\n"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                GUARD.validate(bad, A)

    def test_bad_checkout_oid_rejected(self):
        for bad in ("", "refs/pull/27/merge", B.upper(), B + "\n", "not-a-sha"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                GUARD.validate(A, bad)

    def test_real_git_checkout_positive_and_mismatch(self):
        with tempfile.TemporaryDirectory(prefix="tur039-git-") as tmp:
            def git(*args):
                return subprocess.check_output(["git", "-C", tmp, *args], stderr=subprocess.PIPE).decode().strip()
            git("init", "-q")
            git("config", "user.name", "TUR039 Synthetic")
            git("config", "user.email", "tur039@example.invalid")
            Path(tmp, "a.txt").write_text("one\n")
            git("add", "a.txt")
            git("commit", "-q", "-m", "first")
            head = git("rev-parse", "HEAD")
            GUARD.validate(head, head)
            Path(tmp, "a.txt").write_text("two\n")
            git("commit", "-q", "-am", "second")
            with self.assertRaisesRegex(ValueError, "differs"):
                GUARD.validate(head, git("rev-parse", "HEAD"))

    def test_every_job_checks_exact_sha_not_pr_merge(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        jobs = ("node-regression", "simulated-chromium-ui", "windows-structural", "provenance-archives")
        for i, job in enumerate(jobs):
            start = workflow.index("  " + job + ":")
            end = workflow.find("\n  " + jobs[i + 1] + ":", start) if i + 1 < len(jobs) else len(workflow)
            section = workflow[start:end]
            with self.subTest(job=job):
                self.assertIn("- uses: actions/checkout@v4", section)
                self.assertIn("ref: ${{ github.event.pull_request.head.sha", section)
                self.assertIn("python tools/verify-ci-checkout.py --expected-sha", section)
                self.assertIn("EXPECTED_SHA: ${{ github.event.pull_request.head.sha", section)
                self.assertLess(section.index("Verify exact"), section.index("Run every Node test") if job == "node-regression" else len(section))

    def test_ci_gate_rejects_unsafe_fallbacks(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        self.assertNotIn("continue-on-error: true", workflow)
        self.assertNotIn("|| true", workflow)
        self.assertNotIn("github.event.pull_request.merge_commit_sha", workflow)
        self.assertIn("python tests/test-ci-head-binding.py", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
