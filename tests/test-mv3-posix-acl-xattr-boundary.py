#!/usr/bin/env python3
"""TUR056: reject hidden/disabled POSIX ACLs on the pinned local bundle.

Actual OS libacl operations, FD xattr checks, and bounded injection tests.
This is a local fail-closed boundary, NOT a trust-domain witness, durable
immutability, Windows reparse acceptance, or antirollback claim.
"""
from __future__ import annotations
import ctypes
import ctypes.util
import errno
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

BASE = Path(__file__).resolve().parents[1]

def load(name, path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec)
    sys.modules[name]=mod
    spec.loader.exec_module(mod)
    return mod

M = load('tur056_snapshot',BASE/'tools'/'mv3-local-bundle-snapshot.py')
F = load('tur056_fixture',BASE/'tests'/'test-mv3-pinned-local-bundle.py')


class ACLBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='tur056-actual-acl-')
        self.addCleanup(self.tmp.cleanup)
        self.directory=Path(self.tmp.name)/'bundle'
        if os.name=='posix':
            F.write_bundle(self.directory)
        else:
            self.directory.mkdir()

    def denied(self):
        with self.assertRaises(M.LocalBundleNoGo):M.read_local_claim_bundle(self.directory, expected_repository=F.REPO, expected_commit_sha=F.HEAD, expected_proof_sha256=F.PROOF, expected_witness_id=F.WID, claimed_genesis_sequence=0)

    def acl(self, path: Path, content: bytes, *, default=False):
        libname=ctypes.util.find_library('acl')
        if not libname:self.skipTest('libacl unavailable; no claimed OS ACL PASS')
        lib=ctypes.CDLL(libname, use_errno=True)
        lib.acl_from_text.argtypes=[ctypes.c_char_p];lib.acl_from_text.restype=ctypes.c_void_p
        lib.acl_set_file.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_void_p];lib.acl_set_file.restype=ctypes.c_int
        lib.acl_free.argtypes=[ctypes.c_void_p];lib.acl_free.restype=ctypes.c_int
        obj=lib.acl_from_text(content)
        if not obj:self.fail('libacl failed to parse test vector')
        try:
            err=lib.acl_set_file(os.fsencode(path),0x4000 if default else 0x8000,obj)
            if err!=0:
                code=ctypes.get_errno()
                if code in (errno.ENOTSUP,errno.EOPNOTSUPP):
                    self.skipTest('filesystem does not support POSIX ACL; NOT_RUN')
                self.fail(f'acl_set_file failed: errno={code}')
        finally:lib.acl_free(obj)

    def masked_named_acl(self, path, *, directory=False):
        self.acl(path,b'u::rwx,u:65534:r--,g::---,m::---,o::---' if directory else
                      b'u::rw-,u:65534:r--,g::---,m::---,o::---')

    def assert_masked_and_denied(self, path: Path, mode: int):
        self.assertEqual(os.stat(path).st_mode & 0o777,mode,
                         'actual ACL must be ineffective, hidden from simple st_mode')
        self.assertTrue(os.getxattr(path,'system.posix_acl_access'))
        self.denied()

    def test_windows_explicitly_not_supported_no_physical_claim(self):
        if os.name=='posix':self.skipTest('Windows-only negative contract')
        self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_standard_private_no_acl_is_locally_accepted_only(self):
        digest, size = F.check(self.directory)
        self.assertEqual(len(digest),64)
        self.assertGreater(size,65)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_masked_named_acl_on_wire_even_when_mode_0600_rejected(self):
        path=self.directory/'claimed-wire.jsonl';self.masked_named_acl(path)
        self.assert_masked_and_denied(path,0o600)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_masked_named_acl_on_root_even_when_mode_0600_rejected(self):
        path=self.directory/'claimed-genesis.sha256';self.masked_named_acl(path)
        self.assert_masked_and_denied(path,0o600)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_masked_named_acl_on_directory_even_when_mode_0700_rejected(self):
        path=self.directory;self.masked_named_acl(path,directory=True)
        self.assert_masked_and_denied(path,0o700)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_default_acl_on_private_directory_rejected(self):
        self.acl(self.directory,b'u::rwx,u:65534:r-x,g::---,m::---,o::---',default=True)
        self.assertEqual(self.directory.stat().st_mode & 0o777,0o700)
        self.assertTrue(os.getxattr(self.directory,'system.posix_acl_default'))
        self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_removing_masked_acl_allows_structural_snapshot_again(self):
        path=self.directory/'claimed-wire.jsonl';self.masked_named_acl(path)
        self.denied()
        os.removexattr(path,'system.posix_acl_access')
        self.assertEqual(len(F.check(self.directory)[0]),64)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_attacker_preopened_fd_survives_later_acl_rejection(self):
        path=self.directory/'claimed-wire.jsonl'
        fd=os.open(path,os.O_RDONLY)
        try:
            self.masked_named_acl(path)
            self.denied()
            self.assertGreater(len(os.read(fd,16384)),0,
                               'real pre-acquired descriptor survives chmod/ACL updates')
        finally:os.close(fd)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_same_uid_child_adds_masked_acl_after_return_no_permanence(self):
        digest, _=F.check(self.directory)
        self.assertEqual(len(digest),64)
        code='import ctypes,ctypes.util,os,sys;lib=ctypes.CDLL(ctypes.util.find_library("acl"));lib.acl_from_text.argtypes=[ctypes.c_char_p];lib.acl_from_text.restype=ctypes.c_void_p;lib.acl_set_file.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_void_p];lib.acl_set_file.restype=ctypes.c_int;ptr=lib.acl_from_text(b"u::rw-,u:65534:r--,g::---,m::---,o::---");sys.exit(0 if ptr and lib.acl_set_file(os.fsencode(sys.argv[1]),0x8000,ptr)==0 else 2)'
        if not ctypes.util.find_library('acl'):self.skipTest('libacl absent; no post-return OS claim')
        p=self.directory/'claimed-wire.jsonl'
        result=subprocess.run([sys.executable,'-c',code,str(p)],timeout=10,capture_output=True)
        if result.returncode!=0:self.skipTest('libacl unsupported; post-return NOT_RUN')
        self.assertEqual(os.stat(p).st_mode & 0o777,0o600)
        self.denied()
        # The prior digest does NOT attest to post-return immutability.

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_acl_added_during_audit_is_detected_on_leaf_fd(self):
        p=self.directory/'claimed-wire.jsonl'
        original=M.os.read; did=[False]
        def wrapped(fd,n):
            data=original(fd,n)
            if not did[0] and data==F.ROOT.encode()+b'\n':
                did[0]=True;self.masked_named_acl(p)
            return data
        with mock.patch.object(M.os,'read',side_effect=wrapped):self.denied()
        self.assertTrue(did[0]);self.assertEqual(os.stat(p).st_mode & 0o777,0o600)

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_default_acl_added_during_audit_is_detected(self):
        original=M.os.read;did=[False]
        def wrapped(fd,n):
            data=original(fd,n)
            if not did[0] and data==F.ROOT.encode()+b'\n':
                did[0]=True;self.acl(self.directory,b'u::rwx,u:65534:r-x,g::---,m::---,o::---',default=True)
            return data
        with mock.patch.object(M.os,'read',side_effect=wrapped):self.denied()
        self.assertTrue(did[0])

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_xattr_inspection_unexpected_eio_fails_closed(self):
        with mock.patch.object(M.os,'getxattr',side_effect=OSError(errno.EIO,'real ACL state unknown')):
            self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_unsupported_xattr_inspection_cannot_be_treated_as_no_acl(self):
        with mock.patch.object(M.os,'getxattr',side_effect=OSError(errno.EOPNOTSUPP,'unknown ACL state')):
            self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_present_empty_xattr_is_not_absent(self):
        with mock.patch.object(M.os,'getxattr',return_value=b''):
            self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_reader_without_os_xattr_support_cannot_promote_local_evidence(self):
        with mock.patch.object(M.os,'getxattr',create=True):
            delattr(M.os,'getxattr')
            self.denied()

    @unittest.skipUnless(os.name=='posix','actual POSIX filesystem only')
    def test_production_witness_remains_unconditionally_no_go(self):
        with self.assertRaises(F.W.WitnessNoGo):F.W.production_witness_gate()

if __name__=='__main__':unittest.main(verbosity=2)
