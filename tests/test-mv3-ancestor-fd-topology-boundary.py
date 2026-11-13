#!/usr/bin/env python3
"""TUR057: real POSIX full-ancestor pinned dirfd TOCTOU/caller-owned witness tests.

Proves only local fail-closed checks on observed component rebinds;
transient ABA and after-return mutation remain possible, and caller-controlled
witness hashes/roots are NOT immutable independent attestation.
"""
from __future__ import annotations
import errno
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

BASE = Path(__file__).resolve().parents[1]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m

F = load('tur057_fixture', BASE/'tests'/'test-mv3-pinned-local-bundle.py')
M = F.M  # Test the exact same actual module/exception class as the real fixture

class PinnedAncestors(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='tur057-ancestor-dirfd-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.outer = self.base/'upper'
        self.inner = self.outer/'inner'
        self.inner.mkdir(parents=True)
        self.directory = self.inner/'bundle'
        if os.name == 'posix':F.write_bundle(self.directory)
        else:self.directory.mkdir()

    def check(self, directory=None):
        return F.check(self.directory if directory is None else directory)

    def denied(self, directory=None):
        with self.assertRaises(M.LocalBundleNoGo):self.check(directory)

    def intercept_after_root(self, action, *, expect_reject=True):
        real = M.os.read
        fired=[False]
        def wrapped(fd, length):
            content=real(fd,length)
            if content == F.ROOT.encode()+b'\n' and not fired[0]:
                fired[0]=True
                action()
            return content
        with mock.patch.object(M.os, 'read', side_effect=wrapped):
            if expect_reject:self.denied()
            else:self.assertEqual(len(self.check()[0]),64)
        self.assertTrue(fired[0],'must exercise real root read, not fake a result')

    def test_windows_local_ancestor_reader_is_explicitly_no_go(self):
        if os.name=='posix':self.skipTest('Windows-only negative contract')
        self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_nested_private_bundle_is_structural_only(self):
        digest,size=self.check()
        self.assertEqual(len(digest),64)
        self.assertGreater(size,65)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_symlink_outer_ancestor_pre_open_rejected(self):
        dst=self.base/'moved';self.outer.rename(dst)
        self.outer.symlink_to(dst,target_is_directory=True)
        self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_symlink_inner_ancestor_pre_open_rejected(self):
        dst=self.outer/'moved-inner';self.inner.rename(dst)
        self.inner.symlink_to(dst,target_is_directory=True)
        self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_relative_dotdot_component_fail_closed(self):
        target=self.inner/'..'/'inner'/'bundle'
        self.denied(target)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_rename_outer_to_symlink_during_read_rejected(self):
        def action():
            relocated=self.base/'old-outer'
            self.outer.rename(relocated)
            self.outer.symlink_to(relocated,target_is_directory=True)
        self.intercept_after_root(action)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_rename_inner_to_symlink_during_read_rejected(self):
        def action():
            relocated=self.outer/'old-inner'
            self.inner.rename(relocated)
            self.inner.symlink_to(relocated,target_is_directory=True)
        self.intercept_after_root(action)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_rename_outer_to_different_regular_directory_during_read_rejected(self):
        def action():
            moved=self.base/'old-outer'
            self.outer.rename(moved)
            self.outer.mkdir(mode=0o700)
            (self.outer/'inner').mkdir(mode=0o700)
        self.intercept_after_root(action)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_rename_inner_to_different_regular_directory_during_read_rejected(self):
        def action():
            self.inner.rename(self.outer/'old-inner')
            self.inner.mkdir(mode=0o700)
        self.intercept_after_root(action)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_chmod_ancestor_during_read_detected_at_final_fd_check(self):
        self.intercept_after_root(lambda: os.chmod(self.outer,0o711))

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_uncooperative_child_ignores_flock_and_renames_ancestor(self):
        def attack():
            script=('import os,sys; from pathlib import Path; p=Path(sys.argv[1]); '
                    'p.rename(p.with_name("child-moved"));p.mkdir(mode=0o700)')
            p=subprocess.run([sys.executable,'-c',script,str(self.outer)],capture_output=True,timeout=7)
            self.assertEqual(p.returncode,0,p.stderr.decode(errors='replace'))
        self.intercept_after_root(attack)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_previous_open_inode_survives_rebound_negative_counterexample(self):
        path=self.directory/'claimed-wire.jsonl'
        fd=os.open(path,os.O_RDONLY)
        try:
            moved=self.base/'old-outer';self.outer.rename(moved)
            self.outer.mkdir(mode=0o700)
            self.assertGreater(len(os.read(fd,4096)),0)
            self.denied()
        finally:os.close(fd)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_transient_rename_and_restore_ABA_can_pass_not_atomic(self):
        def action():
            moved=self.base/'temporary-outer';self.outer.rename(moved)
            self.outer.mkdir(mode=0o700)
            self.outer.rmdir()
            moved.rename(self.outer)
        self.intercept_after_root(action,expect_reject=False)
        self.assertEqual(len(self.check()[0]),64)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_post_return_child_can_swap_ancestor_not_permanent(self):
        digest,_=self.check()
        script=('from pathlib import Path;import sys; p=Path(sys.argv[1]);'
                'p.rename(p.with_name("after-return-original"));p.mkdir(mode=0o700)')
        proc=subprocess.run([sys.executable,'-c',script,str(self.outer)],timeout=7,capture_output=True)
        self.assertEqual(proc.returncode,0,proc.stderr.decode(errors='replace'))
        self.assertEqual(len(digest),64)
        self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_os_stat_unavailable_for_pinned_ancestor_fail_closed(self):
        original=M.os.stat
        seen=[0]
        def wrapped(*args,**kwargs):
            if args and args[0]=='upper' and 'dir_fd' in kwargs:
                seen[0]+=1
                if seen[0]>=2:raise OSError(errno.EIO,'ancestor identity cannot be checked')
            return original(*args,**kwargs)
        with mock.patch.object(M.os,'stat',side_effect=wrapped):self.denied()
        self.assertGreaterEqual(seen[0],2)

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_unavailable_no_follow_api_fails_closed(self):
        with mock.patch.object(M.os,'O_NOFOLLOW',create=True):
            delattr(M.os,'O_NOFOLLOW')
            self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_chain_pinning_rejects_non_directory_ancestor(self):
        self.outer.rename(self.base/'hidden-outer')
        self.outer.write_text('not a folder')
        self.denied()

    @unittest.skipUnless(os.name=='posix','real POSIX FD test')
    def test_local_forged_consistent_claim_production_gate_still_denies(self):
        self.assertEqual(len(self.check()[0]),64)
        with self.assertRaises(F.W.WitnessNoGo):F.W.production_witness_gate()

    @unittest.skipUnless(os.name=='posix' and hasattr(os,'geteuid') and os.geteuid()==0,
                         'separate privileged OS principal requires isolated root, hosted Ubuntu SKIP')
    def test_privileged_writer_can_chmod_ancestor_after_return_negative(self):
        digest,_=self.check()
        script='import os,sys;os.chmod(sys.argv[1],0o777)'
        child=subprocess.run([sys.executable,'-c',script,str(self.outer)],timeout=7)
        self.assertEqual(child.returncode,0)
        self.assertEqual(len(digest),64)
        # The same local data can still PASS after the privileged parent mode
        # change. A previously returned hash never proves durable permissions.
        self.assertEqual(len(self.check()[0]),64)
        with self.assertRaises(F.W.WitnessNoGo):F.W.production_witness_gate()

if __name__=='__main__':unittest.main(verbosity=2)
