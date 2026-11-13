#!/usr/bin/env python3
"""TUR055: POSIX-only, bounded, read-only snapshot of two LOCAL witness files.

This establishes consistency of a pinned directory and two locally owned inodes
at the instant of checking, *not* a trusted witness, WORM, immutable evidence,
anti-rollback, ACL security guarantee, or persistent post-return protection.
A same-UID or privileged writer can forge BOTH root and transcript before a
snapshot, can ignore advisory locks, and can mutate files after the return.
TUR050's production_witness_gate remains UNCONDITIONALLY NO_GO.
"""
from __future__ import annotations

try:
    import fcntl
except ImportError:  # Windows: POSIX-only reader must fail closed, not raise ImportError.
    fcntl = None
import importlib.util
from contextlib import contextmanager
import errno
import os
from pathlib import Path
import re
import stat

_HASH = re.compile(rb'[0-9a-f]{64}\Z', re.ASCII)
_MAX_FILE = 32768 + 32 + 1   # local wire's 32768 bytes + <=31 separators + final LF
_ROOT_FILE = 'claimed-genesis.sha256'
_WIRE_FILE = 'claimed-wire.jsonl'


class LocalBundleNoGo(ValueError):
    """Fail-closed LOCAL filesystem consistency, not external provenance."""



def _reject_extended_posix_acl(fd: int, *, is_directory: bool) -> None:
    """Reject even *masked/ineffective* named POSIX ACLs on pinned open FDs.

    UNIX st_mode alone cannot establish the absence of named ACL entries (a
    named ACE may be masked to zero, leaving 0600/0700 mode unchanged). A
    directory default ACL is also rejected before any future inheritance.
    This is only a local snapshot restriction; FD permissions, root and
    same-UID post-return mutation remain explicitly untrusted.

    Unexpected/unsupported attribute lookup must fail closed, never be
    interpreted as an empty ACL. ENODATA/ENOATTR mean absent attribute.
    """
    if not hasattr(os, 'getxattr'):
        raise LocalBundleNoGo('POSIX ACL absence cannot be checked')
    absent = {errno.ENODATA, getattr(errno, 'ENOATTR', errno.ENODATA)}
    names = ('system.posix_acl_access', 'system.posix_acl_default') if is_directory else ('system.posix_acl_access',)
    for name in names:
        try:
            os.getxattr(fd, name)  # fd, not an ancestor-raceable pathname
        except OSError as exc:
            if exc.errno in absent:
                continue
            raise LocalBundleNoGo('POSIX ACL inspection unavailable (fail closed)') from exc
        raise LocalBundleNoGo('extended POSIX ACL on local witness inode')

def _fingerprint(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_nlink,
            s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def _directory_identity(s):
    # Never compare ancestor mtime/ctime: unrelated users can add entries to
    # /tmp between checks. Identity, type, mode and owner are the local guards.
    return (s.st_dev, s.st_ino, stat.S_IFMT(s.st_mode), s.st_mode & 0o7777, s.st_uid)


@contextmanager
def _pinned_directory_chain(directory: Path):
    """Walk every ancestor from / using O_NOFOLLOW pinned directory FDs.

    Previous lstat(path.parents) was best effort and independently raceable.
    This fd-relative component walk refuses symlink components even if they
    change before the final directory open. The chain is checked again before
    returning; it is NOT atomic against transient ABA swaps nor post-return
    same-UID/root mutation. No external identity is authenticated here.
    """
    path = directory.absolute()
    if '..' in path.parts or not path.is_absolute():
        raise LocalBundleNoGo('noncanonical directory ancestry')
    if not (hasattr(os, 'O_DIRECTORY') and hasattr(os, 'O_NOFOLLOW') and
            hasattr(os, 'open') and hasattr(os, 'stat')):
        raise LocalBundleNoGo('pinned ancestor inspection unsupported')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, 'O_CLOEXEC', 0)
    chain = []
    try:
        rootfd = os.open(path.anchor, flags)
        chain.append(('', rootfd, os.fstat(rootfd)))
        for component in path.parts[1:]:
            if component in ('', '.', '..'):
                raise LocalBundleNoGo('unsafe ancestor component')
            parentfd = chain[-1][1]
            fd = os.open(component, flags, dir_fd=parentfd)
            chain.append((component, fd, os.fstat(fd)))
            st = os.stat(component, dir_fd=parentfd, follow_symlinks=False)
            if (_directory_identity(st) != _directory_identity(chain[-1][2]) or
                    not stat.S_ISDIR(st.st_mode)):
                raise LocalBundleNoGo('ancestor component identity changed while opening')
        if not chain or len(chain) < 2:
            raise LocalBundleNoGo('local bundle must not be filesystem root')
        _verify_pinned_directory_chain(chain)
        yield chain[-1][1], chain
    finally:
        for _, fd, _ in reversed(chain):
            os.close(fd)


def _verify_pinned_directory_chain(chain) -> None:
    for i, (component, fd, before) in enumerate(chain):
        now = os.fstat(fd)
        if not stat.S_ISDIR(now.st_mode) or _directory_identity(now) != _directory_identity(before):
            raise LocalBundleNoGo('pinned ancestor metadata changed')
        if i:
            parentfd = chain[i - 1][1]
            current = os.stat(component, dir_fd=parentfd, follow_symlinks=False)
            if not stat.S_ISDIR(current.st_mode) or _directory_identity(current) != _directory_identity(before):
                raise LocalBundleNoGo('ancestor path rebound from pinned inode')


def _open_leaf(parent_fd: int, name: str, owner: int):
    flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, 'O_NOFOLLOW', 0)
    flags |= getattr(os, 'O_CLOEXEC', 0)
    fd = os.open(name, flags, dir_fd=parent_fd)
    try:
        before = os.fstat(fd)
        _reject_extended_posix_acl(fd, is_directory=False)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                before.st_uid != owner or before.st_mode & 0o077 or
                not 0 < before.st_size <= (_MAX_FILE if name == _WIRE_FILE else 65)):
            raise LocalBundleNoGo('unsafe local leaf type/owner/mode/size/link count')
        return fd, before
    except BaseException:
        os.close(fd)
        raise


def _read_bounded(fd: int, limit: int) -> bytes:
    chunks = []
    total = 0
    while True:
        block = os.read(fd, min(8192, limit - total + 1))
        if not block:
            return b''.join(chunks)
        total += len(block)
        if total > limit:
            raise LocalBundleNoGo('local snapshot exceeds byte bound')
        chunks.append(block)


def read_local_claim_bundle(directory: Path, *, expected_repository: str,
                            expected_commit_sha: str, expected_proof_sha256: str,
                            expected_witness_id: str,
                            claimed_genesis_sequence: int):
    """Check pinned read-only LOCAL bundle, returning (local_digest, byte_count).

    Directory and the two *fixed-name* files must be private, owner current EUID,
    regular and single-link; file names and inodes must remain stable through
    the read/audit. Advisory directory flock is cooperative only. The structural
    wire audit's caller-controlled expected values are NOT authenticated.
    """
    if os.name != 'posix' or not hasattr(os, 'geteuid') or fcntl is None:
        raise LocalBundleNoGo('POSIX-only local consistency; Windows NOT_RUN')
    if not isinstance(directory, Path):
        raise LocalBundleNoGo('directory must be exact Path object')
    try:
        with _pinned_directory_chain(directory) as (dfd, chain):
            owner = os.geteuid()
            parent_before = os.fstat(dfd)
            if (not stat.S_ISDIR(parent_before.st_mode) or
                    parent_before.st_uid != owner or parent_before.st_mode & 0o077):
                raise LocalBundleNoGo('local directory must be owner-private')
            _reject_extended_posix_acl(dfd, is_directory=True)
            fcntl.flock(dfd, fcntl.LOCK_SH | fcntl.LOCK_NB)
            opened = []
            try:
                # Open both before reading either. This prevents accidentally
                # opening only the second generation after the first read.
                for name in (_ROOT_FILE, _WIRE_FILE):
                    opened.append((name, *_open_leaf(dfd, name, owner)))
                root = _read_bounded(opened[0][1], 65)
                wire = _read_bounded(opened[1][1], _MAX_FILE)
                if len(root) != 65 or not root.endswith(b'\n') or not _HASH.fullmatch(root[:-1]):
                    raise LocalBundleNoGo('local claimed genesis format invalid')
                if not wire.endswith(b'\n') or b'\r' in wire:
                    raise LocalBundleNoGo('truncated or noncanonical local wire file')
                frames = tuple(wire[:-1].split(b'\n'))
                if not 2 <= len(frames) <= 32 or any(not f for f in frames):
                    raise LocalBundleNoGo('missing, empty or excessive local wire frames')
                # Read-only audit of two *caller-owned* files; even success
                # cannot be treated as an independent witness assertion.
                libpath = Path(__file__).resolve().with_name('mv3-witness-wire.py')
                spec = importlib.util.spec_from_file_location('tur055_local_wire_internal', libpath)
                if spec is None or spec.loader is None:
                    raise LocalBundleNoGo('local structural parser unavailable')
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                try:
                    result = module.audit_local_wire_chain(
                        frames, expected_repository=expected_repository,
                        expected_commit_sha=expected_commit_sha,
                        expected_proof_sha256=expected_proof_sha256,
                        expected_witness_id=expected_witness_id,
                        claimed_genesis_digest=root[:-1].decode('ascii'),
                        claimed_genesis_sequence=claimed_genesis_sequence)
                except module.LocalWireNoGo as exc:
                    raise LocalBundleNoGo('local structural wire inconsistency') from exc
                for name, fd, before in opened:
                    _reject_extended_posix_acl(fd, is_directory=False)
                    after = os.fstat(fd)
                    path_now = os.stat(name, dir_fd=dfd, follow_symlinks=False)
                    if (_fingerprint(before) != _fingerprint(after) or
                            (path_now.st_dev, path_now.st_ino) != (before.st_dev, before.st_ino) or
                            not stat.S_ISREG(path_now.st_mode) or path_now.st_nlink != 1):
                        raise LocalBundleNoGo('local leaf inode changed during audit')
                _reject_extended_posix_acl(dfd, is_directory=True)
                parent_path_now = os.stat(directory, follow_symlinks=False)
                if (_fingerprint(parent_before) != _fingerprint(os.fstat(dfd)) or
                        (parent_path_now.st_dev, parent_path_now.st_ino) !=
                        (parent_before.st_dev, parent_before.st_ino)):
                    raise LocalBundleNoGo('local parent directory path identity changed')
                _verify_pinned_directory_chain(chain)
                return result, len(root) + len(wire)
            finally:
                for _, fd, _ in opened:
                    os.close(fd)
    except (OSError, UnicodeError, ImportError, TypeError, AttributeError, OverflowError) as exc:
        raise LocalBundleNoGo('local snapshot unavailable or unsafe (fail closed)') from exc
