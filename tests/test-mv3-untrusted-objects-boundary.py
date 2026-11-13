"""TUR053: fail-closed untrusted local witness objects, POSIX mutable-origin PoCs.

These are STRUCTURAL input guards and NEGATIVE real-OS counterexamples.
Passing proves neither independently authenticated WORM nor persistent immutability.
Do not promote local claimed quorum, local hash, mode bits, or inode into provenance.
"""
from __future__ import annotations
import dataclasses
import hashlib
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('tur053_boundaries', ROOT / 'tools' / 'mv3-witness-contract.py')
C = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = C
SPEC.loader.exec_module(C)
REPO = 'ftmstr/Embasic-TheDeepSeeker-Build'
HEAD = 'a625aab28dc3926561e627a93f7606fcebec85da'  # immutable test fixture
SHA = hashlib.sha256(b'locally asserted original bytes').hexdigest()
FORGE_SHA = hashlib.sha256(b'same-uid entirely forged bytes').hexdigest()
IDS = frozenset(('local-witness-domain-a', 'local-witness-domain-b'))
PRIOR = {'local-witness-domain-a': 4, 'local-witness-domain-b': 8}


def epoch(run=43306552820, challenge='local-test-challenge-053a', a=5, b=9, *, sha=SHA, recs=None):
    if recs is None:
        recs = tuple(C.WitnessBinding(REPO, HEAD, sha, run, name, seq, challenge)
                     for name, seq in zip(sorted(IDS), (a, b)))
    return C.ClaimedWitnessEpoch(REPO, HEAD, sha, run, challenge, recs)


def pair(first=None, second=None):
    return (first if first is not None else epoch(), second if second is not None else
            epoch(43306552821, 'local-test-challenge-053b', 6, 10))


def audit(epochs=None, *, prior=None, ids=None):
    return C.audit_claimed_witness_transcript(
        pair() if epochs is None else epochs, expected_repository=REPO,
        trusted_prior_sequences=PRIOR if prior is None else prior,
        expected_witness_ids=IDS if ids is None else ids)


class UntrustedObjectsBoundary(unittest.TestCase):
    def test_01_valid_claimed_history_cannot_open_production_gate(self):
        self.assertIsNone(audit())
        with self.assertRaisesRegex(C.WitnessNoGo, 'PRODUCTION_NO_GO'):
            C.production_witness_gate()

    def test_02_none_record_container_fails_closed(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records=None)))

    def test_03_dict_record_container_fails_closed(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records={'a': 'b'})))

    def test_04_mutable_list_record_container_fails_closed(self):
        recs=list(epoch().records)
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records=recs)))

    def test_05_foreign_element_none_fails_closed(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records=(None, epoch().records[1]))))

    def test_06_foreign_element_object_fails_closed(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records=(object(), epoch().records[1]))))

    def test_07_forged_subclass_rejected_exact_type_required(self):
        class UserSubclass(C.WitnessBinding):
            pass
        record=epoch().records[0]
        forged=UserSubclass(**dataclasses.asdict(record))
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(first=dataclasses.replace(epoch(), records=(forged, epoch().records[1]))))

    def test_08_excessive_local_witness_id_cardinality_rejected(self):
        ids=frozenset('fake-claimed-id-'+str(i) for i in range(17))
        prior={name:0 for name in ids}
        with self.assertRaises(C.WitnessNoGo):
            audit(prior=prior, ids=ids)

    def test_09_fake_local_anchor_string_rejected(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(prior={'local-witness-domain-a':'4','local-witness-domain-b':8})

    def test_10_fake_local_anchor_bool_rejected(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(prior={'local-witness-domain-a':True,'local-witness-domain-b':8})

    def test_11_out_of_range_run_identity_rejected(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(pair(second=epoch(1 << 63, 'local-test-challenge-053b',6,10)))

    def test_12_out_of_range_direct_witness_sequence_rejected(self):
        e=epoch(a=1 << 63)
        with self.assertRaises(C.WitnessNoGo):
            C.audit_claimed_witness_quorum(e.records, expected_repository=REPO,
                expected_commit_sha=e.commit_sha, expected_proof_sha256=e.proof_sha256,
                expected_run_id=e.run_id, expected_challenge=e.challenge,
                trusted_prior_sequences=PRIOR, expected_witness_ids=IDS)

    def test_13_user_supplied_syntactically_coherent_forgery_still_passes_structural_only(self):
        # A malicious same-UID caller can forge both local hashes AND alleged trust roots.
        fake_a=epoch(43306552830,'attacker-created-challenge-1',101,201,sha=FORGE_SHA)
        fake_b=epoch(43306552831,'attacker-created-challenge-2',102,202,sha=FORGE_SHA)
        self.assertIsNone(audit((fake_a,fake_b),prior={sorted(IDS)[0]:100,sorted(IDS)[1]:200}))
        with self.assertRaises(C.WitnessNoGo):
            C.production_witness_gate(local_expected_sha256=FORGE_SHA)

    def test_14_malformed_direct_quorum_record_type_rejected(self):
        e=epoch()
        with self.assertRaises(C.WitnessNoGo):
            C.audit_claimed_witness_quorum((e.records[0], None), expected_repository=REPO,
                expected_commit_sha=e.commit_sha, expected_proof_sha256=e.proof_sha256,
                expected_run_id=e.run_id, expected_challenge=e.challenge,
                trusted_prior_sequences=PRIOR, expected_witness_ids=IDS)

    @unittest.skipUnless(os.name=='posix','physical POSIX inherited open FD required')
    def test_15_preopened_writable_fd_survives_readonly_mode_chmod(self):
        # Actual OS counterexample: chmod 0400 cannot revoke already OPEN writable FD.
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'receipt'
            p.write_bytes(b'origin-record')
            fd=os.open(p,os.O_WRONLY|os.O_APPEND)
            try:
                os.chmod(p,0o400)
                subprocess.run([sys.executable,'-c',
                    'import os,sys;os.write(int(sys.argv[1]),b":forged-after-chmod")',
                    str(fd)],pass_fds=(fd,),check=True,timeout=6)
                self.assertEqual(p.read_bytes(),b'origin-record:forged-after-chmod')
                with self.assertRaises(C.WitnessNoGo):C.production_witness_gate()
            finally:
                os.close(fd)

    @unittest.skipUnless(os.name=='posix','physical POSIX pinned inode required')
    def test_16_same_inode_modified_by_noncooperating_process_during_parent_flock(self):
        # Real inode remains identical while bytes change. No durable immutability.
        import fcntl
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            p=root/'receipt'
            p.write_bytes(b'old-bytes')
            folder=os.open(root,os.O_RDONLY|os.O_DIRECTORY)
            original=os.stat(p)
            try:
                fcntl.flock(folder,fcntl.LOCK_EX|fcntl.LOCK_NB)
                subprocess.run([sys.executable,'-c',
                   'from pathlib import Path;import sys;Path(sys.argv[1]).write_bytes(b"new-bytes")',
                   str(p)],check=True,timeout=6)
                newer=os.stat(p)
                self.assertEqual((original.st_dev,original.st_ino),(newer.st_dev,newer.st_ino))
                self.assertEqual(p.read_bytes(),b'new-bytes')
            finally:
                os.close(folder)

    @unittest.skipUnless(os.name=='posix','physical POSIX late hardlink required')
    def test_17_late_hardlink_from_same_uid_invalidates_prior_nlink_check(self):
        # A post-return nlink=1 check is time-bound. Hardlink AFTER check is possible.
        with tempfile.TemporaryDirectory() as td:
            a=Path(td)/'verified'
            b=Path(td)/'late-link'
            a.write_bytes(b'valid-when-checked')
            self.assertEqual(a.stat().st_nlink,1)
            os.link(a,b)
            self.assertEqual(a.stat().st_nlink,2)
            b.write_bytes(b'mutated-in-linked-path')
            self.assertEqual(a.read_bytes(),b'mutated-in-linked-path')
            with self.assertRaises(C.WitnessNoGo):C.production_witness_gate()


if __name__=='__main__':
    unittest.main(verbosity=2)
