"""Adversarial regression for Linux MV3 CI evidence fail-closed gate."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location('mv3_gate', ROOT / 'tools/verify-mv3-ci-evidence.py')
GATE = module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)
PASS_LOG = ('\n'.join(p + ' synthetic acceptance details' for p in GATE.REQUIRED_PREFIXES) + '\n').encode()


class FailClosedMV3Evidence(unittest.TestCase):
    def test_clean_eight_checkpoints(self):
        GATE.verify(PASS_LOG, 0)

    def test_nonzero_exit(self):
        for code in (1, 2, 124, 137, 143, -15):
            with self.subTest(code=code), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG, code)

    def test_missing_checkpoint(self):
        for p in GATE.REQUIRED_PREFIXES:
            with self.subTest(prefix=p), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG.replace((p + ' synthetic acceptance details\n').encode(), b''), 0)

    def test_duplicate_checkpoint(self):
        for p in GATE.REQUIRED_PREFIXES:
            with self.subTest(prefix=p), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG + (p + ' replayed\n').encode(), 0)

    def test_not_run_with_forged_pass(self):
        for marker in (b'NOT_RUN MV3: unavailable\n', b'FAIL MV3: assertion\n',
                       b'FAIL MV3 REAL worker: assertion\n', b'NOT_RUN: Linux MV3 timeout\n'):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG + marker, 0)

    def test_non_evidence(self):
        for raw in (b'', b'\x00' + PASS_LOG, b'\xff' + PASS_LOG,
                    PASS_LOG + b'A' * (GATE.MAX_LOG_BYTES + 1)):
            with self.subTest(length=len(raw)), self.assertRaises(ValueError):
                GATE.verify(raw, 0)

    def test_partial_prefix_forgery(self):
        with self.assertRaises(ValueError):
            GATE.verify(PASS_LOG.replace(b'PASS MV3 REAL worker:', b'PASS MV3 REAL worke:'), 0)

    def test_legacy_honest_not_run_note_in_success(self):
        # Historical successful log mentions physical Windows NOT_RUN as scope,
        # which is not a failure of the Linux acceptance probe.
        GATE.verify(PASS_LOG + b'Physical Windows 24h NOT_RUN\n', 0)

    def test_terminal_ansi_bypass_regression(self):
        for marker in (b'\x1b[31mFAIL MV3: hidden\x1b[0m\n',
                       b'\x1b[0KNOT_RUN MV3: hidden\n',
                       b'\x08FAIL MV3: hidden\n',
                       b'\x1b]0;FAIL MV3\x07\n',
                       b'\tFAIL MV3: hidden\n',
                       b'\rFAIL MV3: hidden\n'):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG + marker, 0)

    def test_unicode_format_bidi_and_separator_bypass_regression(self):
        for marker in ('\u202eFAIL MV3: hidden\n',
                       '\u200bFAIL MV3: hidden\n',
                       '\u2066FAIL MV3: hidden\u2069\n',
                       '\u2028FAIL MV3: hidden\n',
                       '\u0085FAIL MV3: hidden\n'):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG + marker.encode('utf-8'), 0)

    def test_embedded_and_prefixed_failure_markers(self):
        for marker in ('2026-11-11T12:00Z FAIL MV3: actual failure\n',
                       '[runner] NOT_RUN MV3: skipped\n',
                       'prefix FAIL MV3 REAL worker: crash\n',
                       'prefix NOT_RUN: Linux MV3 timeout\n',
                       'prefix NOT_RUN: Chromium MV3 unavailable\n',
                       'pass-looking line | FAIL   MV3: hidden\n',
                       'ｆａｉｌ MV3: compatibility fold\n'):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG + marker.encode('utf-8'), 0)

    def test_clean_unicode_and_historical_windows_scope(self):
        GATE.verify(PASS_LOG + 'Info: café output, Windows 24h NOT_RUN (scope only)\n'.encode(), 0)

    def test_controls_inside_positive_checkpoint(self):
        for marker in (b'\x1b[0m', '\u202e'.encode(), b'\x7f', b'\r', '\u2028'.encode(), '\u0085'.encode()):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                GATE.verify(PASS_LOG.replace(b'PASS MV3 REAL worker:',
                                             marker + b'PASS MV3 REAL worker:'), 0)

    def test_tur037_ci_dependency_failclosed_retry(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text(encoding='utf-8')
        ui_job = workflow.split('  simulated-chromium-ui:', 1)[1].split('  windows-structural:', 1)[0]
        self.assertIn('runs-on: ubuntu-24.04', ui_job)
        self.assertNotIn('runs-on: ubuntu-latest', ui_job)
        self.assertIn('timeout --signal=TERM --kill-after=10s 180s python -m playwright install --with-deps chromium', ui_job)
        self.assertIn('set -euo pipefail', ui_job)
        self.assertIn('if [ "$attempt" -eq 3 ]; then', ui_job)
        self.assertIn('exit 1', ui_job)
        self.assertIn('EMBASIC_REQUIRE_MV3=1', ui_job)
        self.assertIn('tools/verify-mv3-ci-evidence.py --log', ui_job)
        self.assertNotIn('playwright install chromium --no-deps', ui_job)

    def test_workflow_uses_strict_worker_and_gate(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text(encoding='utf-8')
        self.assertIn('EMBASIC_REQUIRE_MV3=1', workflow)
        self.assertIn('python tests/test-mv3-ci-gate.py', workflow)
        self.assertIn('python tools/verify-mv3-ci-evidence.py --log', workflow)
        self.assertNotIn('EMBASIC_REQUIRE_MV3=0', workflow)
        self.assertNotIn("echo '::notice::Chromium MV3 worker unavailable: NOT_RUN", workflow)


if __name__ == '__main__':
    unittest.main(verbosity=2)
