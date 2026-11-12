#!/usr/bin/env python3
"""Bounded, direct-child MV3 CI capture. NOT an authenticated browser attestation.

TUR042: stdout is consumed from a kernel pipe into a parent-owned buffer whose
size is capped before appending bytes. The child never writes an unbounded
scratch file. This bounds *application-managed* log storage, not the total
memory/disk consumption of a compromised OS child, nor runner provenance.
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
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / 'tests' / 'test-mv3-extension.py'
GATE_PATH = ROOT / 'tools' / 'verify-mv3-ci-evidence.py'
spec = importlib.util.spec_from_file_location('checked_out_mv3_evidence_gate', GATE_PATH)
gate = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(gate)

READ_CHUNK_BYTES = 65536
POLL_SECONDS = 0.02
POST_EXIT_DRAIN_SECONDS = 0.5


def _terminate_tree(process: subprocess.Popen) -> None:
    """Best-effort process-tree cleanup. Never treat cleanup as proof of origin.

    POSIX: target the child's session/group even if its direct leader has exited.
    Windows: taskkill /T /F targets descendants, then kill direct child if needed.
    Failure to clean descendants does NOT authorize publishing any evidence.
    """
    if os.name == 'posix':
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    elif os.name == 'nt':
        try:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=5, check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass
        if process.poll() is None:
            process.kill()
    elif process.poll() is None:
        process.kill()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)


def capture(probe: Path, output: Path, timeout: float, cwd: Path = ROOT) -> None:
    """Execute the pinned real probe (CLI) or a local-only adversarial fixture.

    The worker reads fixed chunks into a strict bounded buffer. Excess bytes
    trigger a reject without first allocating a 2+ MiB scratch file. A writer
    can still briefly exceed the pipe capacity *within the child*, but cannot
    grow an application-owned unbounded log file between polling samples.
    """
    if not (0.05 <= timeout <= 360):
        raise ValueError('Unbounded or invalid MV3 child timeout')
    if output.is_symlink():
        raise ValueError('Refuse symlink evidence destination')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Invalidate any previous green artifact before starting a new probe.
    # Otherwise a failed/aborted run can leave a stale log at the expected
    # upload path even though its current direct-child evidence was rejected.
    # unlink removes the directory entry itself, never follows a symlink.
    output.unlink(missing_ok=True)
    publication = None
    process = None
    captured = bytearray()
    lock = threading.Lock()
    oversize = threading.Event()
    eof = threading.Event()
    reader_error = []

    def read_bounded(stream) -> None:
        try:
            while True:
                part = os.read(stream.fileno(), READ_CHUNK_BYTES)
                if not part:
                    return
                with lock:
                    if len(captured) + len(part) > gate.MAX_LOG_BYTES:
                        oversize.set()
                        return
                    captured.extend(part)
        except OSError as exc:
            reader_error.append(exc)
        finally:
            eof.set()

    try:
        kwargs = {'cwd': cwd, 'stdout': subprocess.PIPE, 'stderr': subprocess.STDOUT}
        if os.name == 'posix':
            kwargs['start_new_session'] = True
        elif os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP
        process = subprocess.Popen([sys.executable, '-u', str(probe)], **kwargs)
        assert process.stdout is not None
        reader = threading.Thread(target=read_bounded, args=(process.stdout,), daemon=True)
        reader.start()
        deadline = time.monotonic() + timeout
        while True:
            if oversize.is_set():
                raise ValueError('Child MV3 stdout exceeded live evidence quota (bounded pipe)')
            if reader_error:
                raise ValueError('Child MV3 stdout read failed')
            returncode = process.poll()
            if returncode is not None:
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ValueError('Child MV3 timeout; no evidence may be published')
            time.sleep(min(POLL_SECONDS, remaining))
        # Give the reader bounded time to flush bytes already in the kernel
        # pipe. A descendant may deliberately retain stdout open: snapshot
        # only the direct-child result; never publish the writable pipe/inode.
        reader.join(timeout=POST_EXIT_DRAIN_SECONDS)
        # A direct child can exit successfully while an untrusted descendant
        # retains stdout. Never authenticate a partial pipe snapshot: require
        # actual EOF from every inherited writer before evidence publication.
        if not eof.is_set():
            raise ValueError('Child MV3 stdout pipe remained open after bounded drain')
        if oversize.is_set():
            raise ValueError('Child MV3 stdout exceeded live evidence quota (bounded pipe)')
        if reader_error:
            raise ValueError('Child MV3 stdout read failed')
        with lock:
            raw = bytes(captured)
        gate.verify(raw, returncode)
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
        print(f'PASS MV3 DIRECT CHILD: exit=0, bytes={len(raw)}, bounded pipe; '
              'process origin NOT CRYPTOGRAPHICALLY PROVEN')
    finally:
        # On any failure, terminate the *group*, not just the direct child.
        # Even on success a retained descendant pipe must not be trusted as a
        # separate source of output. A cleanup failure is NOT attestation.
        if process is not None:
            _terminate_tree(process)
            if process.stdout is not None:
                process.stdout.close()
        if publication is not None and publication.exists():
            publication.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--timeout-seconds', type=float, default=360)
    args = parser.parse_args()
    try:
        capture(PROBE, args.log, args.timeout_seconds)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f'FAIL MV3 DIRECT CHILD: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
