"""TUR042 real OS bounded-pipe and process-tree capture adversarial regression."""
import importlib.util
import os
import threading
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
        # Race-safe acceptance: if the late FAIL reaches the reader during
        # its bounded drain, the strict gate MUST reject the entire artifact.
        # If it arrives after the clean snapshot, the published snapshot MUST
        # remain immutable. Both outcomes are fail-closed for untrusted bytes.
        try:
            MOD.capture(self.child, self.log, 5)
        except ValueError as exc:
            self.assertTrue('did not run' in str(exc) or 'pipe remained open' in str(exc))
            self.assertFalse(self.log.exists(), 'raced FAIL published an artifact')
        else:
            validated = self.log.read_bytes()
            self.assertEqual(len(validated.splitlines()), len(MOD.gate.REQUIRED_PREFIXES))
            time.sleep(0.65)
            self.assertEqual(self.log.read_bytes(), validated,
                             'late writer mutated already-verified published evidence')

    @unittest.skipUnless(os.name == 'posix', 'POSIX inherited stdout descriptor regression')
    def test_retained_descendant_stdout_cannot_publish_partial_success(self):
        # The direct child emits all nine valid markers, exits zero, but a
        # descendant retains the shared pipe beyond the bounded drain.
        # Previous snapshot-only acceptance could publish this incomplete
        # stream even though the pipe had not reached EOF.
        descendant = 'import time;time.sleep(2)'
        lines = ['import subprocess,sys',
                 f'subprocess.Popen([sys.executable,"-c",{descendant!r}],'
                 'stdout=sys.stdout,stderr=sys.stderr,close_fds=False)']
        lines += [f'print({(p+" real-OS-child checkpoint")!r},flush=True)'
                  for p in MOD.gate.REQUIRED_PREFIXES]
        self.write('\n'.join(lines)+'\n')
        with self.assertRaisesRegex(ValueError, 'pipe remained open'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_forged_pass_lines_from_failing_os_process_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES, exit_code=7))
        with self.assertRaisesRegex(ValueError, 'nonzero'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_real_process_timeout_cannot_publish_delayed_success(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES, sleep=1))
        with self.assertRaisesRegex(ValueError, 'timeout'):
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
        # A failed new probe must not leave an earlier green artifact at the
        # current log path, even if manual uploads bypass CI success guards.
        self.assertFalse(self.log.exists())

    def test_stale_log_removed_before_child_timeout(self):
        self.log.write_text('old-valid-looking-evidence', encoding='utf-8')
        self.write(script(MOD.gate.REQUIRED_PREFIXES, sleep=1))
        with self.assertRaisesRegex(ValueError, 'timeout'):
            MOD.capture(self.child, self.log, 0.10)
        self.assertFalse(self.log.exists(), 'stale accepted evidence survived timeout')

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

    @unittest.skipUnless(os.name == 'posix', 'POSIX dirfd and O_NOFOLLOW required')
    def test_parent_symlink_rejected_before_probe(self):
        target = self.root / 'attacker'
        target.mkdir()
        parent = self.root / 'linked-evidence'
        parent.symlink_to(target, target_is_directory=True)
        log = parent / 'probe.log'
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaises(OSError):
            MOD.capture(self.child, log, 5)
        self.assertFalse((target / 'probe.log').exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX parent rename adversary')
    def test_parent_rename_symlink_swap_cannot_publish_to_attacker(self):
        parent = self.root / 'evidence'
        parent.mkdir()
        moved = self.root / 'original-evidence'
        attacker = self.root / 'attacker'
        attacker.mkdir()
        out = parent / 'genuine.log'
        self.write(script(MOD.gate.REQUIRED_PREFIXES, sleep=0.6))
        def swap():
            time.sleep(0.12)
            parent.rename(moved)
            parent.symlink_to(attacker, target_is_directory=True)
        thread = threading.Thread(target=swap)
        thread.start()
        try:
            with self.assertRaisesRegex(ValueError, 'changed identity'):
                MOD.capture(self.child, out, 5)
        finally:
            thread.join(timeout=3)
        self.assertFalse((attacker / 'genuine.log').exists())
        self.assertFalse((moved / 'genuine.log').exists())
        self.assertFalse(any(p.name.startswith('.mv3-verified-') for p in moved.iterdir()))

    @unittest.skipUnless(os.name == 'posix', 'POSIX secure directory proof')
    def test_preexisting_symlink_inside_pinned_parent_is_not_unlinked(self):
        parent = self.root / 'evidence'
        parent.mkdir()
        victim = self.root / 'victim'
        victim.write_text('protected', encoding='utf-8')
        log = parent / 'proof.log'
        log.symlink_to(victim)
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'symlink'):
            MOD.capture(self.child, log, 5)
        self.assertEqual(victim.read_text(encoding='utf-8'), 'protected')
        self.assertTrue(log.is_symlink())

    @unittest.skipUnless(os.name == 'posix', 'POSIX inode flock needed')
    def test_concurrent_capture_fails_without_invalidating_active_writer(self):
        # First direct child signals launch then sleeps before valid output.
        # Second invocation targeting same directory must fail on the lock,
        # not delete or publish over first invocation's eventual evidence.
        parent = self.root / 'shared-evidence'
        parent.mkdir()
        started = self.root / 'first-child-started'
        child1 = self.root / 'slow-first.py'
        child2 = self.root / 'fast-second.py'
        child1.write_text(
            'import pathlib,time,sys\n'
            f'pathlib.Path({str(started)!r}).write_text("ready")\n'
            'time.sleep(0.7)\n' +
            '\n'.join(f'print({(p+" real-OS-child checkpoint")!r},flush=True)'
                      for p in MOD.gate.REQUIRED_PREFIXES) + '\n',
            encoding='utf-8')
        child2.write_text(script(MOD.gate.REQUIRED_PREFIXES), encoding='utf-8')
        first = parent / 'first.log'
        second = parent / 'second.log'
        exceptions = []
        def run_first():
            try:
                MOD.capture(child1, first, 5)
            except Exception as exc:
                exceptions.append(exc)
        worker = threading.Thread(target=run_first)
        worker.start()
        try:
            deadline = time.monotonic() + 3
            while not started.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertTrue(started.exists(), 'first process never started')
            with self.assertRaisesRegex(ValueError, 'directory locked'):
                MOD.capture(child2, second, 5)
        finally:
            worker.join(timeout=6)
        self.assertFalse(worker.is_alive(), 'first capture never finished')
        self.assertFalse(exceptions, f'first capture failed: {exceptions}')
        self.assertTrue(first.exists())
        self.assertFalse(second.exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX hardlink inode metadata')
    def test_hardlinked_stale_destination_denied_without_unlink(self):
        target = self.root / 'outside-valuable-proof'
        target.write_text('safeguarded', encoding='utf-8')
        os.link(target, self.log)
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'hardlink'):
            MOD.capture(self.child, self.log, 5)
        self.assertEqual(target.read_text(encoding='utf-8'), 'safeguarded')
        self.assertTrue(self.log.exists())
        self.assertEqual(self.log.stat().st_ino, target.stat().st_ino)

    @unittest.skipUnless(os.name == 'posix', 'POSIX nonregular inode metadata')
    def test_existing_destination_directory_denied_without_mutation(self):
        self.log.mkdir()
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'nonregular'):
            MOD.capture(self.child, self.log, 5)
        self.assertTrue(self.log.is_dir())

    @unittest.skipUnless(os.name == 'posix', 'POSIX owner directory mode required')
    def test_noncooperating_world_writable_parent_rejected_even_with_flock(self):
        parent = self.root / 'shared-public'
        parent.mkdir()
        parent.chmod(0o1777)
        log = parent / 'evidence.log'
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'not private to owner'):
            MOD.capture(self.child, log, 5)
        self.assertFalse(log.exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX group-writable directory mode')
    def test_noncooperating_group_writable_parent_rejected(self):
        parent = self.root / 'group-shared'
        parent.mkdir()
        parent.chmod(0o770)
        log = parent / 'evidence.log'
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'not private to owner'):
            MOD.capture(self.child, log, 5)
        self.assertFalse(log.exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX chmod race regression')
    def test_parent_permission_expands_while_child_runs_no_evidence(self):
        parent = self.root / 'private-then-shared'
        parent.mkdir(mode=0o700)
        parent.chmod(0o700)
        started = self.root / 'chmod-race-started'
        log = parent / 'evidence.log'
        self.write('import pathlib,time\n' +
                   f'pathlib.Path({str(started)!r}).write_text("ready")\n' +
                   'time.sleep(0.65)\n' +
                   '\n'.join(f'print({(p+" real-OS-child checkpoint")!r},flush=True)'
                             for p in MOD.gate.REQUIRED_PREFIXES) + '\n')
        def change_permissions():
            deadline = time.monotonic() + 3
            while not started.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            if started.exists():
                parent.chmod(0o777)
        thread = threading.Thread(target=change_permissions)
        thread.start()
        try:
            with self.assertRaisesRegex(ValueError, 'not private to owner'):
                MOD.capture(self.child, log, 5)
        finally:
            thread.join(timeout=4)
        self.assertTrue(started.exists())
        self.assertFalse(log.exists())
        self.assertFalse(any(x.name.startswith('.mv3-verified-') for x in parent.iterdir()))

    @unittest.skipUnless(os.name == 'posix', 'POSIX symlink injection during capture')
    def test_noncooperating_symlink_inserted_after_stale_unlink_is_rejected(self):
        parent = self.root / 'private-evidence'
        parent.mkdir()
        log = parent / 'evidence.log'
        victim = self.root / 'precious-original'
        victim.write_text('safe', encoding='utf-8')
        started = self.root / 'inject-started'
        self.write('import pathlib,time\n' +
                   f'pathlib.Path({str(started)!r}).write_text("ready")\n' +
                   'time.sleep(0.65)\n' +
                   '\n'.join(f'print({(p+" real-OS-child checkpoint")!r},flush=True)'
                             for p in MOD.gate.REQUIRED_PREFIXES) + '\n')
        def inject():
            deadline = time.monotonic() + 3
            while not started.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            if started.exists():
                log.symlink_to(victim)
        thread = threading.Thread(target=inject)
        thread.start()
        try:
            with self.assertRaisesRegex(ValueError, 'symlink'):
                MOD.capture(self.child, log, 5)
        finally:
            thread.join(timeout=4)
        self.assertTrue(started.exists())
        self.assertEqual(victim.read_text(encoding='utf-8'), 'safe')
        self.assertTrue(log.is_symlink())

    def test_unbounded_timeout_rejected(self):
        self.write(script(MOD.gate.REQUIRED_PREFIXES))
        with self.assertRaisesRegex(ValueError, 'Unbounded'):
            MOD.capture(self.child, self.log, 1000)
        self.assertFalse(self.log.exists())

    def test_live_quota_kills_writer_before_sleep_finishes(self):
        # A child that emits more than 2 MiB and then remains alive must be
        # terminated early, not allowed to occupy runner disk until timeout.
        marker = self.root/'child-survived-quota'
        self.write('\n'.join([
            'import pathlib,sys,time',
            f'sys.stdout.buffer.write(b"X"*{MOD.gate.MAX_LOG_BYTES+4096})',
            'sys.stdout.buffer.flush()',
            'time.sleep(2)',
            f'pathlib.Path({str(marker)!r}).write_text("survived")',
        ]) + '\n')
        with self.assertRaisesRegex(ValueError, 'live evidence quota'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())
        self.assertFalse(marker.exists())

    def test_oversized_successful_child_never_publishes(self):
        self.write('\n'.join([
            'import sys',
            f'sys.stdout.buffer.write(b"Y"*{MOD.gate.MAX_LOG_BYTES+1})',
            'sys.stdout.buffer.flush()',
        ]) + '\n')
        with self.assertRaisesRegex(ValueError, 'live evidence quota'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    def test_burst_over_quota_cannot_allocate_unbounded_scratch_file(self):
        # TUR042 actual OS child produces a burst > 4 MiB between any polling
        # samples. The parent drains from a pipe into <=2 MiB bounded storage.
        self.write('import sys\nsys.stdout.buffer.write(b"B"*(4*1024*1024))\nsys.stdout.buffer.flush()\n')
        with self.assertRaisesRegex(ValueError, 'bounded pipe'):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())
        self.assertFalse(any(p.name.startswith('.mv3-child-') for p in self.root.iterdir()))

    def test_exact_quota_and_valid_pass_markers_do_not_bypass_evidence(self):
        # A large, within-limit but malformed child must still fail gate.
        self.write('import sys\nsys.stdout.buffer.write(b"Z"*2000000)\nsys.stdout.buffer.flush()\n')
        with self.assertRaises(ValueError):
            MOD.capture(self.child, self.log, 5)
        self.assertFalse(self.log.exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX process-group cleanup required')
    def test_timeout_kills_real_descendant_process_group(self):
        marker = self.root/'descendant-survived'
        child_code = (
            'import subprocess,sys,time\n'
            f'code={"import time,pathlib;time.sleep(0.7);pathlib.Path("+repr(str(marker))+").write_text(\"escaped\")"!r}\n'
            'subprocess.Popen([sys.executable,"-c",code])\n'
            'time.sleep(4)\n'
        )
        self.write(child_code)
        with self.assertRaisesRegex(ValueError, 'timeout'):
            MOD.capture(self.child, self.log, 0.10)
        time.sleep(0.8)
        self.assertFalse(marker.exists(), 'timeout left a descendant alive')

    def test_bounded_reader_used_not_scratch_file_polling(self):
        source = (ROOT/'tools/capture-mv3-probe.py').read_text(encoding='utf-8')
        self.assertIn("'stdout': subprocess.PIPE", source)
        self.assertIn('len(captured) + len(part) > gate.MAX_LOG_BYTES', source)
        self.assertIn("['taskkill', '/PID', str(process.pid), '/T', '/F']", source)
        self.assertNotIn('NamedTemporaryFile(prefix=\'.mv3-child-\'', source)

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
