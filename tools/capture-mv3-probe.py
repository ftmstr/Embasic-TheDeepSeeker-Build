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
    with tempfile.NamedTemporaryFile(prefix='.mv3-child-', suffix='.raw',
                                     dir=output.parent, delete=False) as file:
        scratch = Path(file.name)
        try:
            command = [sys.executable, '-u', str(probe)]
            process = subprocess.Popen(command, cwd=cwd, stdout=file,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            try:
                returncode = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                # Kill the entire subprocess group: no detached Chrome can
                # append a late PASS to a previously timed-out evidence file.
                if os.name == 'posix':
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait(timeout=10)
                returncode = 124
            file.flush()
            os.fsync(file.fileno())
            raw_size = scratch.stat().st_size
            if raw_size > gate.MAX_LOG_BYTES:
                raise ValueError('Child MV3 stdout exceeded bounded evidence size')
            raw = scratch.read_bytes()
            # Reject before publishing anything to a shared upload path.
            gate.verify(raw, returncode)
            if output.is_symlink():
                raise ValueError('Evidence destination changed into symlink')
            os.replace(scratch, output)
            print(f'PASS MV3 DIRECT CHILD: exit=0, bytes={len(raw)}, no shell tee; '
                  'process origin NOT CRYPTOGRAPHICALLY PROVEN')
        finally:
            if scratch.exists():
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
