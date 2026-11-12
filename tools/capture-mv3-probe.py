#!/usr/bin/env python3
"""Bounded, direct-child MV3 CI capture. NOT an authenticated browser attestation.

TUR042: stdout is consumed from a kernel pipe into a parent-owned buffer whose
size is capped before appending bytes. The child never writes an unbounded
scratch file. This bounds *application-managed* log storage, not the total
memory/disk consumption of a compromised OS child, nor runner provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import importlib.util
import os
if os.name == 'posix':
    import fcntl
from pathlib import Path
import secrets
import signal
import stat
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
    # TUR045: POSIX publication operations are pinned to the original parent
    # directory fd, not a path that an adversary can replace with a symlink.
    # This protects unlink, exclusive tempfile creation and atomic replace.
    directory_fd = None
    publication_name = None
    if os.name == 'posix':
        directory_fd = os.open(output.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        def check_parent_permissions() -> None:
            # TUR047: advisory flock does not exclude a non-cooperating writer.
            # Reject group/world-writable or non-owned output parents.
            # Same-UID/privileged writers and ACL/path races are not proven safe.
            info = os.fstat(directory_fd)
            if info.st_uid != os.geteuid() or info.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
                raise ValueError('MV3 evidence parent directory is not private to owner')
        def check_ancestor_symlinks() -> None:
            # A final-component O_NOFOLLOW does not reject a symlink in an
            # ancestor. Path inspections are NOT atomic against same-UID
            # replacements; the pinned directory inode remains authoritative.
            ancestor = output.parent.absolute()
            while True:
                if stat.S_ISLNK(os.lstat(ancestor).st_mode):
                    raise ValueError('MV3 evidence ancestor symlink forbidden')
                if ancestor.parent == ancestor:
                    break
                ancestor = ancestor.parent
        def check_destination() -> None:
            try:
                entry = os.stat(output.name, dir_fd=directory_fd, follow_symlinks=False)
            except FileNotFoundError:
                return
            if stat.S_ISLNK(entry.st_mode):
                raise ValueError('Refuse symlink evidence destination')
            # Reject a hardlinked destination before destructive stale-log
            # invalidation. A hardlink's data could be another file's evidence.
            if not stat.S_ISREG(entry.st_mode) or entry.st_nlink != 1:
                raise ValueError('Refuse hardlink or nonregular evidence destination')
        try:
            # TUR046: concurrent trusted probes must not invalidate each
            # other's in-flight evidence. Linux/POSIX advisory flock is scoped
            # to the pinned directory inode and held through publication.
            # Malicious non-cooperating writers and Windows are NOT covered.
            try:
                fcntl.flock(directory_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise ValueError('Concurrent MV3 evidence capture; directory locked') from exc
            check_ancestor_symlinks()
            check_parent_permissions()
            check_destination()
            try:
                os.unlink(output.name, dir_fd=directory_fd)
            except FileNotFoundError:
                pass
        except BaseException:
            os.close(directory_fd)
            raise
    else:
        # Windows retains the conservative original path-based behavior; not
        # an independently proved defense against a malicious parent rename.
        output.unlink(missing_ok=True)
    publication = None
    process = None
    pending_published_inode = None
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
        if directory_fd is not None:
            # Secure random exclusive name, relative to pinned directory.
            publication_name = '.mv3-verified-' + secrets.token_hex(16) + '.raw'
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
            temp_fd = os.open(publication_name, flags, 0o600, dir_fd=directory_fd)
            with os.fdopen(temp_fd, 'wb') as verified:
                verified.write(raw)
                verified.flush()
                os.fsync(verified.fileno())
            # Capture the immutable inode identity while our exclusive temp
            # descriptor exists. A same-UID outsider can still mutate/replace
            # this file after any final check; we only detect observed races.
            published_identity = os.stat(publication_name, dir_fd=directory_fd,
                                         follow_symlinks=False)
            # A parent directory rename or symlink swap is a hard failure.
            # Even if renamed after this check, the dirfd destination cannot
            # escape into the attacker's replacement directory.
            parent_stat = os.stat(output.parent, follow_symlinks=False)
            pinned_stat = os.fstat(directory_fd)
            if (parent_stat.st_dev, parent_stat.st_ino) != (pinned_stat.st_dev, pinned_stat.st_ino):
                raise ValueError('MV3 evidence parent directory changed identity')
            check_ancestor_symlinks()
            check_ancestor_symlinks()
            check_parent_permissions()
            check_destination()
            os.replace(publication_name, output.name,
                       src_dir_fd=directory_fd, dst_dir_fd=directory_fd)
            publication_name = None
            pending_published_inode = (published_identity.st_dev, published_identity.st_ino)
            # TUR048: read back *the same inode* through the pinned dirfd,
            # with no symlink following and bounded bytes. Detect a writer
            # that races atomic rename and print(PASS). This does NOT prevent
            # a privileged/same-UID attacker writing after validation.
            read_fd = os.open(output.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                              dir_fd=directory_fd)
            try:
                read_stat = os.fstat(read_fd)
                if (read_stat.st_dev, read_stat.st_ino) != pending_published_inode:
                    raise ValueError('MV3 published evidence inode changed')
                if not stat.S_ISREG(read_stat.st_mode) or read_stat.st_nlink != 1:
                    raise ValueError('MV3 published evidence is not private regular inode')
                with os.fdopen(read_fd, 'rb', closefd=False) as reader:
                    if reader.read(gate.MAX_LOG_BYTES + 1) != raw or reader.read(1):
                        raise ValueError('MV3 published evidence bytes changed')
            finally:
                os.close(read_fd)
            # A second name+directory check spots common rename-after-open
            # and permission-expansion races but cannot provide mutual exclusion.
            final_stat = os.stat(output.name, dir_fd=directory_fd, follow_symlinks=False)
            if (final_stat.st_dev, final_stat.st_ino) != pending_published_inode:
                raise ValueError('MV3 published evidence name changed inode')
            check_ancestor_symlinks()
            parent_stat = os.stat(output.parent, follow_symlinks=False)
            if (parent_stat.st_dev, parent_stat.st_ino) != (pinned_stat.st_dev, pinned_stat.st_ino):
                raise ValueError('MV3 evidence parent directory changed identity after publication')
            check_parent_permissions()
            os.fsync(directory_fd)
            pending_published_inode = None
        else:
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
        if directory_fd is not None:
            try:
                if pending_published_inode is not None:
                    # On a failed post-publication readback, clean up only
                    # our own inode. Do not delete a replacement owned by an
                    # uncooperative actor: its existence is NOT valid evidence.
                    try:
                        current = os.stat(output.name, dir_fd=directory_fd,
                                          follow_symlinks=False)
                        if (current.st_dev, current.st_ino) == pending_published_inode:
                            os.unlink(output.name, dir_fd=directory_fd)
                    except OSError:
                        pass
                if publication_name is not None:
                    os.unlink(publication_name, dir_fd=directory_fd)
            finally:
                os.close(directory_fd)



def verify_published_evidence(output: Path, expected_sha256: str) -> bytes:
    """Read-only POSIX recheck against a caller-pinned digest.

    The digest MUST come from a separately authenticated trust domain.
    A caller-controlled local .sha256 file, the same UID, or a writable
    log+digest pair is NOT an external integrity witness. No claim of WORM,
    independent publisher identity, freshness or post-return immutability.
    """
    if os.name != 'posix':
        raise ValueError('Published MV3 verification requires POSIX dirfd; Windows physical NOT_RUN')
    if not (len(expected_sha256) == 64 and
            all(c in '0123456789abcdef' for c in expected_sha256)):
        raise ValueError('Expected independently pinned lowercase SHA256 digest required')
    parent = output.parent.absolute()
    # Ancestor checks are advisory and non-atomic. The pinned dirfd is the
    # authority for all actual file operations, but no external trust anchor.
    node = parent
    while True:
        if stat.S_ISLNK(os.lstat(node).st_mode):
            raise ValueError('MV3 evidence ancestor symlink forbidden')
        if node.parent == node:
            break
        node = node.parent
    directory_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fcntl.flock(directory_fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        before_dir = os.fstat(directory_fd)
        if (before_dir.st_uid != os.geteuid() or
                before_dir.st_mode & (stat.S_IWGRP | stat.S_IWOTH)):
            raise ValueError('MV3 evidence parent directory is not private to owner')
        fd = os.open(output.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                     dir_fd=directory_fd)
        try:
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
                raise ValueError('MV3 evidence must be an unlinked-private regular inode')
            if before.st_size > gate.MAX_LOG_BYTES:
                raise ValueError('MV3 published evidence exceeds bounded read quota')
            raw = bytearray()
            while len(raw) <= gate.MAX_LOG_BYTES:
                part = os.read(fd, min(READ_CHUNK_BYTES, gate.MAX_LOG_BYTES + 1 - len(raw)))
                if not part:
                    break
                raw.extend(part)
            if len(raw) > gate.MAX_LOG_BYTES:
                raise ValueError('MV3 published evidence exceeds bounded read quota')
            after = os.fstat(fd)
            original_identity = (before.st_dev, before.st_ino)
            metadata = lambda st: (st.st_dev, st.st_ino, st.st_nlink, st.st_size,
                                   st.st_mtime_ns, st.st_ctime_ns)
            if metadata(before) != metadata(after):
                raise ValueError('MV3 published evidence changed during readback')
            current = os.stat(output.name, dir_fd=directory_fd, follow_symlinks=False)
            if (current.st_dev, current.st_ino) != original_identity:
                raise ValueError('MV3 evidence path inode changed during readback')
            if not hmac.compare_digest(hashlib.sha256(raw).hexdigest(), expected_sha256):
                raise ValueError('MV3 published evidence SHA256 differs from pinned digest')
            gate.verify(bytes(raw), 0)
            final_parent = os.stat(parent, follow_symlinks=False)
            if ((final_parent.st_dev, final_parent.st_ino) !=
                    (before_dir.st_dev, before_dir.st_ino) or
                    before_dir.st_dev != os.fstat(directory_fd).st_dev or
                    before_dir.st_ino != os.fstat(directory_fd).st_ino):
                raise ValueError('MV3 published parent directory identity changed')
            return bytes(raw)
        finally:
            os.close(fd)
    finally:
        os.close(directory_fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--timeout-seconds', type=float, default=360)
    parser.add_argument('--verify-published', action='store_true')
    parser.add_argument('--expected-sha256', type=str)
    args = parser.parse_args()
    try:
        if args.verify_published:
            verified = verify_published_evidence(args.log, args.expected_sha256 or '')
            print(f'PASS MV3 PUBLISHED READBACK: {len(verified)} bytes; pinned SHA256 matches; independent witness NOT_PROVEN')
        else:
            if args.expected_sha256 is not None:
                raise ValueError('--expected-sha256 only valid with --verify-published')
            capture(PROBE, args.log, args.timeout_seconds)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f'FAIL MV3 DIRECT CHILD: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
