"""TUR055: pinned two-file LOCAL claimed witness bundle adversarial OS tests.

Only cross-file point-in-time consistency; not WORM, external attestation,
trusted antirollback, proof origin or post-return immutability.
"""
from __future__ import annotations
import ctypes
import ctypes.util
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

BASE = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

M = load('tur055_local_snapshot', BASE/'tools'/'mv3-local-bundle-snapshot.py')
L = load('tur055_fixture_wire', BASE/'tools'/'mv3-witness-wire.py')
W = load('tur055_production_gate', BASE/'tools'/'mv3-witness-contract.py')
REPO = 'ftmstr/Embasic-TheDeepSeeker-Build'
HEAD = '50c6851361e73e20b37147097559bfb23906acbf'  # fixture exact prior head
PROOF = hashlib.sha256(b'TUR055 synthetic fixture proof').hexdigest()
ROOT = hashlib.sha256(b'TUR055 local forgeable genesis').hexdigest()
WID = 'TUR055-local-claim-identity'
TAG = b'EMBASIC/TUR054/UNTRUSTED-LOCAL-WITNESS-CLAIM\0'


def make_chain(root=ROOT, proof=PROOF, run=1, seq=1):
    def packet(r, q, challenge, previous):
        return {'format':'TUR054-LOCAL-CLAIM-v1', 'repository':REPO,
                'commit_sha':HEAD, 'proof_sha256':proof, 'witness_id':WID,
                'run_id':r, 'sequence':q, 'challenge':challenge,
                'previous_local_digest':previous}
    encode=lambda x: json.dumps(x, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('ascii')
    a=encode(packet(run,seq,'tur055-first-challenge-0001',root))
    b=encode(packet(run+1,seq+1,'tur055-next-challenge-0002',hashlib.sha256(TAG+a).hexdigest()))
    return (a,b)


def write_bundle(d, root=ROOT, proof=PROOF, run=1, seq=1):
    d.mkdir(mode=0o700)
    (d/'claimed-genesis.sha256').write_bytes(root.encode()+b'\n')
    (d/'claimed-wire.jsonl').write_bytes(b'\n'.join(make_chain(root,proof,run,seq))+b'\n')
    os.chmod(d,0o700)
    os.chmod(d/'claimed-genesis.sha256',0o600)
    os.chmod(d/'claimed-wire.jsonl',0o600)


def check(d, **kwargs):
    return M.read_local_claim_bundle(d, expected_repository=REPO,
        expected_commit_sha=HEAD, expected_proof_sha256=kwargs.get('proof', PROOF),
        expected_witness_id=WID, claimed_genesis_sequence=kwargs.get('seq',0))


class PinnedBundleBoundaries(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='tur055-local-bundle-')
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)/'trusted-looking-local'
        if os.name == 'posix':
            write_bundle(self.dir)
        else:
            self.dir.mkdir()

    def assert_denied(self, directory=None, **kwargs):
        with self.assertRaises(M.LocalBundleNoGo):
            check(directory or self.dir, **kwargs)

    def test_windows_explicitly_fail_closed_without_posix_supported_reader(self):
        if os.name != 'nt':
            self.skipTest('Windows-only refusal')
        self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_valid_private_bundle_is_structural_only_and_production_no_go(self):
        digest, size = check(self.dir)
        self.assertEqual(digest, L.audit_local_wire_chain(make_chain(), expected_repository=REPO,
            expected_commit_sha=HEAD, expected_proof_sha256=PROOF,
            expected_witness_id=WID, claimed_genesis_digest=ROOT,claimed_genesis_sequence=0))
        self.assertGreater(size, 65)
        with self.assertRaises(W.WitnessNoGo): W.production_witness_gate()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_directory_symlink_is_rejected(self):
        fake=Path(self.tmp.name)/'aliased';fake.symlink_to(self.dir, target_is_directory=True)
        self.assert_denied(fake)

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_wire_symlink_is_rejected(self):
        path=self.dir/'claimed-wire.jsonl';path.rename(self.dir/'original-wire');path.symlink_to(self.dir/'original-wire')
        self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_root_symlink_is_rejected(self):
        path=self.dir/'claimed-genesis.sha256';path.rename(self.dir/'original-root');path.symlink_to(self.dir/'original-root')
        self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_wire_hardlink_is_rejected(self):
        os.link(self.dir/'claimed-wire.jsonl',self.dir/'extra-link');self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_root_hardlink_is_rejected(self):
        os.link(self.dir/'claimed-genesis.sha256',self.dir/'extra-link');self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_world_or_group_access_to_bundle_directory_rejected(self):
        self.dir.chmod(0o750);self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_world_or_group_access_to_root_rejected(self):
        (self.dir/'claimed-genesis.sha256').chmod(0o640);self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_world_or_group_access_to_wire_rejected(self):
        (self.dir/'claimed-wire.jsonl').chmod(0o644);self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_fifo_wire_rejected_without_blocking_open(self):
        p=self.dir/'claimed-wire.jsonl';p.unlink();os.mkfifo(p,0o600);self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_missing_root_and_missing_wire_denied(self):
        for name in ('claimed-genesis.sha256','claimed-wire.jsonl'):
            with self.subTest(name=name):
                p=self.dir/name;b=p.read_bytes();p.unlink();self.assert_denied();p.write_bytes(b);p.chmod(0o600)

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_truncated_wire_missing_trailing_lf_denied(self):
        p=self.dir/'claimed-wire.jsonl';p.write_bytes(p.read_bytes().rstrip(b'\n'));self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_blank_wire_record_rejected(self):
        p=self.dir/'claimed-wire.jsonl';p.write_bytes(p.read_bytes()+b'\n');self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_root_uppercase_or_missing_lf_refused(self):
        p=self.dir/'claimed-genesis.sha256'
        for bad in (ROOT.upper().encode()+b'\n',ROOT.encode(),b'x'*65):
            with self.subTest(bad=bad[:8]):p.write_bytes(bad);self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_mixed_generation_root_and_wire_rejected(self):
        newroot=hashlib.sha256(b'local-generation-two').hexdigest()
        (self.dir/'claimed-genesis.sha256').write_bytes(newroot.encode()+b'\n')
        self.assert_denied()

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_changed_external_expected_digest_rejected_structurally(self):
        self.assert_denied(proof=hashlib.sha256(b'another-caller-expected-sha').hexdigest())

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_forging_both_local_root_and_wire_can_pass_negative_counterexample(self):
        fake=hashlib.sha256(b'attacker-controlled-genesis').hexdigest()
        fake_proof=hashlib.sha256(b'attacker-controlled-proof-sha').hexdigest()
        (self.dir/'claimed-genesis.sha256').write_bytes(fake.encode()+b'\n')
        (self.dir/'claimed-wire.jsonl').write_bytes(b'\n'.join(make_chain(fake,fake_proof,33,33))+b'\n')
        self.assertEqual(len(check(self.dir, proof=fake_proof,seq=32)[0]),64)
        with self.assertRaises(W.WitnessNoGo): W.production_witness_gate()

    def _inject_after_root_read(self, action):
        original = os.read
        fired = [False]
        def wrapper(fd, n):
            output=original(fd,n)
            if not fired[0] and output==ROOT.encode()+b'\n':
                fired[0]=True
                action()
            return output
        with mock.patch.object(M.os,'read',side_effect=wrapper):
            self.assert_denied()
        self.assertTrue(fired[0],'actual root inode read must trigger OS mutation')

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_inplace_wire_mutation_after_open_before_final_stat_detected(self):
        p=self.dir/'claimed-wire.jsonl'
        def action():
            with p.open('r+b') as f:
                f.seek(0);f.write(b'x');f.flush();os.fsync(f.fileno())
        self._inject_after_root_read(action)

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_atomic_wire_leaf_replace_after_open_detected(self):
        def action():
            replacement=self.dir/'new-wire';replacement.write_bytes(b'evil\n');replacement.chmod(0o600)
            os.replace(replacement,self.dir/'claimed-wire.jsonl')
        self._inject_after_root_read(action)

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_ancestor_directory_swap_with_symlink_after_fd_pinning_rejected(self):
        orig=self.dir
        def action():
            moved=Path(self.tmp.name)/'moved-original';orig.rename(moved)
            orig.symlink_to(moved,target_is_directory=True)
        self._inject_after_root_read(action)

    @unittest.skipUnless(os.name == 'posix', 'actual POSIX inode test only')
    def test_post_return_same_uid_mutation_negative_not_immutable(self):
        digest,_=check(self.dir)
        p=self.dir/'claimed-wire.jsonl'
        script='import sys;from pathlib import Path;p=Path(sys.argv[1]);p.write_bytes(b"changed-after-return\\n")'
        subprocess.run([sys.executable,'-c',script,str(p)],check=True,timeout=6)
        self.assertEqual(len(digest),64)
        self.assert_denied()
        with self.assertRaises(W.WitnessNoGo): W.production_witness_gate()

    @unittest.skipUnless(os.name == 'posix' and hasattr(os,'geteuid') and os.geteuid()==0,
                         'real named POSIX ACL + alternate UID requires isolated root; hosted CI SKIP')
    def test_named_posix_acl_allows_other_uid_read_but_private_snapshot_rejects(self):
        libname=ctypes.util.find_library('acl')
        if not libname:self.skipTest('libacl unavailable, no fabricated ACL acceptance')
        lib=ctypes.CDLL(libname)
        lib.acl_from_text.argtypes=[ctypes.c_char_p];lib.acl_from_text.restype=ctypes.c_void_p
        lib.acl_set_file.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_void_p];lib.acl_set_file.restype=ctypes.c_int
        lib.acl_free.argtypes=[ctypes.c_void_p];lib.acl_free.restype=ctypes.c_int
        # Named user can read even though 'other' bits stay zero; ACL effective
        # mask is reflected in group bits. Snapshot rejects ACL-widened mode.
        path=self.dir/'claimed-wire.jsonl';acl=lib.acl_from_text(b'u::rw-,u:65534:r--,g::---,m::r--,o::---')
        if not acl:self.skipTest('kernel could not parse isolated POSIX ACL fixture')
        try:
            if lib.acl_set_file(os.fsencode(path),0x8000,acl)!=0:
                self.skipTest('filesystem/kernel POSIX ACL feature unavailable')
        finally:lib.acl_free(acl)
        # permit traversal only for this isolated folder, avoid broad file changes
        self.dir.chmod(0o711)
        Path(self.tmp.name).chmod(0o711)
        try:
            def drop():os.setgid(65534);os.setuid(65534)
            result=subprocess.run([sys.executable,'-c',
                'import sys;print(open(sys.argv[1],"rb").read(7).hex())',str(path)],
                preexec_fn=drop,capture_output=True,timeout=6)
            self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
            self.assert_denied()
        finally:
            self.dir.chmod(0o700)
            Path(self.tmp.name).chmod(0o700)

if __name__=='__main__':unittest.main(verbosity=2)
