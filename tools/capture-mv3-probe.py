#!/usr/bin/env python3
"""Direct child-process MV3 CI capture: fail closed on exit, timeout, and evidence.

Runs ONLY the checked-out test-mv3-extension.py in production CLI. Capturing
stdout in a private temporary file avoids shell tee/PIPESTATUS substitution.
This is NOT a cryptographically authenticated runner or browser attestation.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / 'tests' / 'test-mv3-extension.py'
GATE_PATH = ROOT / 'tools' / 'verify-mv3-ci-evidence.py'
spec = importlib.util.spec_from_file_location('checked_out_mv3_evidence_gate', GATE_PATH)
gate = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(gate)


def capture(probe: Path, output: Path, timeout: float, cwd: Path = ROOT) -> None:
    """Execute one controlled child and check its captured bytes + real exit code.

    The supplied script override is only for local adversarial unit tests. The
    CLI always uses the repository's pinned PROBE, never external input.
    """
    if not (0.05 <= timeout <= 360):
        raise ValueError('Unbounded or invalid MV3 child timeout')
    if output.is_symlink():
        raise ValueError('Refuse symlink evidence destination')
    output.parent.mkdir(parents=True, exist_ok=True)
    scratch = None
    publication = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.mv3-child-', suffix='.raw',
                                         dir=output.parent, delete=False) as file:
            scratch = Path(file.name)
            command = [sys.executable, '-u', str(probe)]
            process = subprocess.Popen(command, cwd=cwd, stdout=file,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            # TUR041: bound the *live* scratch-file growth rather than only
            # checking its size after the child exits. A compromised test
            # process must not write indefinitely until the 360s timeout.
            # This polling guard is NOT an atomic OS disk quota: a very fast
            # writer can overshoot between samples; runner disk limits remain
            # an independent defence.
            deadline = time.monotonic() + timeout
            while True:
                if os.fstat(file.fileno()).st_size > gate.MAX_LOG_BYTES:
                    # Terminate the group before rejecting. Descendants may
                    # retain descriptors, but the verified publication path
                    # is never created for oversized evidence.
                    try:
                        if os.name == 'posix':
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=10)
                    raise ValueError('Child MV3 stdout exceeded live evidence quota')
                returncode = process.poll()
                if returncode is not None:
                    break
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    try:
                        if os.name == 'posix':
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except ProcessLookupError:
                        pass
                    process.wait(timeout=10)
                    returncode = 124
                    break
                time.sleep(min(0.02, remaining))
            file.flush()
            os.fsync(file.fileno())
            raw_size = scratch.stat().st_size
            if raw_size > gate.MAX_LOG_BYTES:
                raise ValueError('Child MV3 stdout exceeded bounded evidence size')
            raw = scratch.read_bytes()
            # Reject before publishing anything to a shared upload path.
            gate.verify(raw, returncode)
        # A surviving descendant may retain a writable descriptor to scratch.
        # Never publish that inode: publish only the gate-verified byte snapshot.
        with tempfile.NamedTemporaryFile(prefix='.mv3-verified-', suffix='.raw',
                                         dir=output.parent, delete=False) as verified:
            publication = Path(verified.name)
            verified.write(raw)
            verified.flush()
            os.fsync(verified.fileno())
        if output.is_symlink():
            raise ValueError('Evidence destination changed into symlink')
        os.replace(publication, output)
        publication = None
        print(f'PASS MV3 DIRECT CHILD: exit=0, bytes={len(raw)}, no shell tee; '
              'process origin NOT CRYPTOGRAPHICALLY PROVEN')

    finally:
        if publication is not None and publication.exists():
            publication.unlink()
        if scratch is not None and scratch.exists():
            scratch.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--timeout-seconds', type=float, default=360)
    args = parser.parse_args()
    try:
        # The real test is never supplied from a CLI parameter or network.
        capture(PROBE, args.log, args.timeout_seconds)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f'FAIL MV3 DIRECT CHILD: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
