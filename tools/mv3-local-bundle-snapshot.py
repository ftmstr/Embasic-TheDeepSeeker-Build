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


def _fingerprint(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_nlink,
            s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def _ancestor_scan(path: Path) -> None:
    # An ancestor lstat sweep is BEST-EFFORT and NOT race-free; only the leaf
    # directory O_NOFOLLOW and final path identity checks are pinned.
    for part in (path, *path.parents):
        if stat.S_ISLNK(part.lstat().st_mode):
            raise LocalBundleNoGo('symlink in local ancestor chain')


def _open_leaf(parent_fd: int, name: str, owner: int):
    flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, 'O_NOFOLLOW', 0)
    flags |= getattr(os, 'O_CLOEXEC', 0)
    fd = os.open(name, flags, dir_fd=parent_fd)
    try:
        before = os.fstat(fd)
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
        _ancestor_scan(directory.absolute())
        dfd = os.open(directory, os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0) |
                      getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_CLOEXEC', 0))
        try:
            owner = os.geteuid()
            parent_before = os.fstat(dfd)
            if (not stat.S_ISDIR(parent_before.st_mode) or
                    parent_before.st_uid != owner or parent_before.st_mode & 0o077):
                raise LocalBundleNoGo('local directory must be owner-private')
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
                    after = os.fstat(fd)
                    path_now = os.stat(name, dir_fd=dfd, follow_symlinks=False)
                    if (_fingerprint(before) != _fingerprint(after) or
                            (path_now.st_dev, path_now.st_ino) != (before.st_dev, before.st_ino) or
                            not stat.S_ISREG(path_now.st_mode) or path_now.st_nlink != 1):
                        raise LocalBundleNoGo('local leaf inode changed during audit')
                parent_path_now = os.stat(directory, follow_symlinks=False)
                if (_fingerprint(parent_before) != _fingerprint(os.fstat(dfd)) or
                        (parent_path_now.st_dev, parent_path_now.st_ino) !=
                        (parent_before.st_dev, parent_before.st_ino)):
                    raise LocalBundleNoGo('local parent directory path identity changed')
                return result, len(root) + len(wire)
            finally:
                for _, fd, _ in opened:
                    os.close(fd)
        finally:
            os.close(dfd)
    except (OSError, UnicodeError, ImportError, TypeError, AttributeError, OverflowError) as exc:
        raise LocalBundleNoGo('local snapshot unavailable or unsafe (fail closed)') from exc
