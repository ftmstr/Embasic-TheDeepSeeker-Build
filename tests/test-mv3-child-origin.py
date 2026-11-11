"""TUR040 real OS subprocess evidence capture adversarial regression."""
import importlib.util
import os
import time
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('origin_capture', ROOT/'tools/capture-mv3-probe.py')
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def script(prefixes, more='', exit_code=0, sleep=0):
    lines = ['import sys,time', f'time.sleep({sleep})']
    # Binary stdout avoids Windows text-mode CRLF, which the security gate
    # correctly rejects as a terminal control character.
    lines += [f'sys.stdout.buffer.write({(p+" real-OS-child checkpoint"+chr(10)).encode("utf-8")!r});sys.stdout.buffer.flush()' for p in prefixes]
    if more:
        lines.append(f'sys.stdout.buffer.write({(more+chr(10)).encode("utf-8")!r});sys.stdout.buffer.flush()')
    lines.append(f'sys.exit({exit_code})')
    return '\n'.join(lines)+'\n'


class ChildOriginCapture(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.child = self.root/'child.py'
        self.log = self.root/'test.log'

    def write(self, content):
        self.child.write_text(content, encoding='utf-8')

    def test_direct_child_success_and_exact_raw_bytes(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        MOD.capture(self.child, self.log, 5)
        self.assertEqual(self.log.read_bytes(),
                         ('\n'.join(p+' real-OS-child checkpoint' for p in MOD.gate.REQUIRED_PREFIXES)+'\n').encode())

    @unittest.skipUnless(os.name == 'posix', 'POSIX inherited stdout descriptor regression')
    def test_late_descendant_cannot_mutate_published_evidence(self):
        # The direct child exits zero while its descendant retains writable
        # stdout and emits a late FAIL. This tests snapshot immutability,
        # NOT complete process-tree or cryptographic origin attestation.
        marker = self.root/'late-writer.done'
        late = (
            'import pathlib,time;time.sleep(0.5);'
            "print('FAIL MV3: late descendant',flush=True);"
            f'pathlib.Path({str(marker)!r}).write_text("done")'
        )
        lines = [
            'import subprocess,sys',
            f'subprocess.Popen([sys.executable,"-c",{late!r}],'
            'stdout=sys.stdout,stderr=sys.stderr,close_fds=False)',
        ]
        lines += [f'print({(p+" real-OS-child checkpoint")!r},flush=True)'
                  for p in MOD.gate.REQUIRED_PREFIXES]
        self.write('\n'.join(lines)+'\n')
        MOD.capture(self.child, self.log, 5)
        validated = self.log.read_bytes()
        self.assertEqual(len(validated.splitlines()), len(MOD.gate.REQUIRED_PREFIXES))
        for _ in range(40):
            if marker.exists():
                break
            time.sleep(0.05)
        self.assertTrue(marker.exists(), 'late descendant did not execute')
        self.assertEqual(self.log.read_bytes(), validated,
                         'late writer mutated already-verified published evidence')

    def test_forged_pass_lines_from_failing_os_process_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES, exit_code=7))
        with self.assertRaisesRegex(ValueError, 'nonzero'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_real_process_timeout_cannot_publish_delayed_success(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES, sleep=1))
        with self.assertRaisesRegex(ValueError, 'nonzero'):
            MOD.capture(self.child, self.log, 0.10)
        self.assertFalse(self.log.exists())

    def test_not_run_in_real_process_output_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES, more='NOT_RUN MV3: skipped browser'))
        with self.assertRaisesRegex(ValueError, 'did not run'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_missing_child_marker_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES[:-1]))
        with self.assertRaisesRegex(ValueError, 'completeness'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_stale_green_log_cannot_be_published_from_failed_child(self):
        self.log.write_text('trusted-old-not-current', encoding='utf-8')
        self.write(script(MOD.gate.REQUIRED_PREFIXES, exit_code=9))
        with self.assertRaises(ValueError):
            MOD.capture(self.child, self.log, 5)
        # A stale file is still present, so never upload one on failure:
        # GitHub Actions upload-artifact must be under a success-only gate.
        self.assertEqual(self.log.read_text(), 'trusted-old-not-current')

    def test_symlink_destination_rejected_without_writing(self):
        target = self.root/'sensitive'
        target.write_text('untouched')
        try:
            self.log.symlink_to(target)
        except OSError:
            self.skipTest('Symlink creation not available on this Windows runner')
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'symlink'):
            MOD.capture(self.child, self.log, 5)
        self.assertEqual(target.read_text(), 'untouched')

    def test_unbounded_timeout_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'Unbounded'):
            MOD.capture(self.child, self.log, 1000)
        self.assertFalse(self.log.exists())

    def test_ci_uses_direct_child_not_shell_tee_or_always_upload(self):
        workflow = (ROOT/'.github/workflows/ci.yml').read_text(encoding='utf-8')
        section = workflow.split('      - name: Probe genuine unpacked Chromium MV3 worker',1)[1].split('  windows-structural:',1)[0]
        self.assertIn('python tools/capture-mv3-probe.py --log', section)
        self.assertNotIn('| tee', section)
        self.assertNotIn('PIPESTATUS', section)
        self.assertIn('if: success()', section)
        self.assertIn('python tools/verify-mv3-ci-evidence.py --log', section)
        self.assertNotIn('if: always()', section)
        capture = (ROOT/'tools/capture-mv3-probe.py').read_text(encoding='utf-8')
        self.assertIn("'test-mv3-extension.py'", capture)
        self.assertNotIn('parser.add_argument(\'--script\'', capture)


if __name__ == '__main__':
    unittest.main(verbosity=2)
