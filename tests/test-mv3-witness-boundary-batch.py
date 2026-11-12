"""TUR051 adversarial offline witness-quorum study; NEVER production attestation."""
from __future__ import annotations
import hashlib
import importlib.util
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('mv3_contract_quorum', ROOT/'tools/mv3-witness-contract.py')
CONTRACT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CONTRACT
SPEC.loader.exec_module(CONTRACT)
REPO='ftmstr/Embasic-TheDeepSeeker-Build'
HEAD='645c3a8b4dc650cfb7cbe815bbd7be9a3c39c9f1'  # historical fixed test fixture
SHA=hashlib.sha256(b'original-real-MV3-evidence').hexdigest()
CHALLENGE='fixed-independent-challenge-12345'
IDS=frozenset({'claimed-domain-a','claimed-domain-b'})
PRIOR={'claimed-domain-a':10,'claimed-domain-b':21}


def record(name, **changes):
    values=dict(repository=REPO,commit_sha=HEAD,proof_sha256=SHA,run_id=43291258130,
                witness_id=name,witness_sequence=PRIOR.get(name,0)+1,challenge=CHALLENGE)
    values.update(changes)
    return CONTRACT.WitnessBinding(**values)


def audit(records, **changes):
    settings=dict(expected_repository=REPO,expected_commit_sha=HEAD,
                  expected_proof_sha256=SHA,expected_run_id=43291258130,
                  expected_challenge=CHALLENGE,trusted_prior_sequences=PRIOR,
                  expected_witness_ids=IDS)
    settings.update(changes)
    return CONTRACT.audit_claimed_witness_quorum(records,**settings)


class BoundaryBatch(unittest.TestCase):
    def test_two_matching_claims_structurally_pass_but_production_rejects(self):
        self.assertIsNone(audit([record('claimed-domain-a'),record('claimed-domain-b')]))
        with self.assertRaisesRegex(CONTRACT.WitnessNoGo,'PRODUCTION_NO_GO'):
            CONTRACT.production_witness_gate(binding=record('claimed-domain-a'))

    def test_single_claim_missing_quorum_is_rejected(self):
        with self.assertRaisesRegex(CONTRACT.WitnessNoGo,'quorum'):
            audit([record('claimed-domain-a')])

    def test_duplicate_identity_replay_is_rejected(self):
        with self.assertRaisesRegex(CONTRACT.WitnessNoGo,'reused'):
            audit([record('claimed-domain-a'),record('claimed-domain-a')])

    def test_outsider_claimed_identity_rejected(self):
        with self.assertRaisesRegex(CONTRACT.WitnessNoGo,'unapproved'):
            audit([record('claimed-domain-a'),record('attacker-claimed-id')])

    def test_cross_claim_equivocation_digest_or_commit_rejected(self):
        for changed in (record('claimed-domain-b',proof_sha256='0'*64),
                        record('claimed-domain-b',commit_sha='0'*40)):
            with self.subTest(changed=changed),self.assertRaises(CONTRACT.WitnessNoGo):
                audit([record('claimed-domain-a'),changed])

    def test_cross_claim_challenge_and_run_replay_rejected(self):
        for changed in (record('claimed-domain-b',challenge='replay-old-challenge-01'),
                        record('claimed-domain-b',run_id=43291258129)):
            with self.subTest(changed=changed),self.assertRaises(CONTRACT.WitnessNoGo):
                audit([record('claimed-domain-a'),changed])

    def test_monotonic_prior_anchor_replay_and_bool_injection_rejected(self):
        for seq in (21,20,True,0,-4):
            with self.subTest(seq=seq),self.assertRaises(CONTRACT.WitnessNoGo):
                audit([record('claimed-domain-a'),record('claimed-domain-b',witness_sequence=seq)])

    def test_same_uid_can_forge_both_local_identities_negative_poc(self):
        # CRITICAL counterexample: all expected identities, SHA and sequence are
        # under same UID. This structure can be forged in full and STILL passes.
        forged=hashlib.sha256(b'local attacker replacement').hexdigest()
        fake=[record('claimed-domain-a',proof_sha256=forged),
              record('claimed-domain-b',proof_sha256=forged)]
        self.assertIsNone(audit(fake,expected_proof_sha256=forged))
        with self.assertRaises(CONTRACT.WitnessNoGo):
            CONTRACT.production_witness_gate(local_expected_sha256=forged)

    def test_untrusted_caller_controls_quorum_metadata_negative_poc(self):
        invented=frozenset({'forged-witness-a','forged-witness-b'})
        previous={x:11 for x in invented}
        fakes=[record(x,witness_sequence=12) for x in sorted(invented)]
        self.assertIsNone(audit(fakes,expected_witness_ids=invented,trusted_prior_sequences=previous))
        with self.assertRaises(CONTRACT.WitnessNoGo):
            CONTRACT.production_witness_gate()

    def test_empty_untrusted_anchor_is_not_quorum(self):
        with self.assertRaises(CONTRACT.WitnessNoGo):
            audit([],expected_witness_ids=frozenset(),trusted_prior_sequences={})

    @unittest.skipUnless(os.name=='posix','real POSIX chmod cannot prove WORM')
    def test_posix_same_uid_rewrites_readonly_postreturn_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            f=pathlib.Path(td)/'evidence'
            f.write_bytes(b'original')
            f.chmod(0o400)
            f.chmod(0o600)
            f.write_bytes(b'local forged after return')
            self.assertEqual(f.read_bytes(),b'local forged after return')
            with self.assertRaises(CONTRACT.WitnessNoGo):
                CONTRACT.production_witness_gate(local_expected_sha256=hashlib.sha256(f.read_bytes()).hexdigest())

    @unittest.skipUnless(os.name=='posix','real POSIX advisory flock bypass')
    def test_posix_uncooperative_child_writes_during_dir_flock(self):
        import fcntl
        with tempfile.TemporaryDirectory() as td:
            p=pathlib.Path(td)
            f=p/'evidence'
            f.write_bytes(b'good')
            fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
            try:
                fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                subprocess.run([sys.executable,'-c',
                    'from pathlib import Path; import sys; Path(sys.argv[1]).write_bytes(b"forged")',str(f)],
                    stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True,timeout=5)
                self.assertEqual(f.read_bytes(),b'forged')
                with self.assertRaises(CONTRACT.WitnessNoGo):
                    CONTRACT.production_witness_gate()
            finally:
                os.close(fd)

    @unittest.skipUnless(os.name=='posix','real POSIX ancestor rename race')
    def test_posix_ancestor_rename_then_symlink_swap_keeps_old_fd(self):
        with tempfile.TemporaryDirectory() as td:
            root=pathlib.Path(td)
            before=root/'ancestor'
            before.mkdir()
            (before/'evidence').write_bytes(b'prior-proof')
            fd=os.open(before,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
            try:
                before.rename(root/'moved')
                attacker=root/'attacker'
                attacker.mkdir()
                (attacker/'evidence').write_bytes(b'fake')
                before.symlink_to(attacker,target_is_directory=True)
                self.assertEqual((before/'evidence').read_bytes(),b'fake')
                self.assertEqual(os.stat('evidence',dir_fd=fd).st_ino,(root/'moved'/'evidence').stat().st_ino)
                with self.assertRaises(CONTRACT.WitnessNoGo):
                    CONTRACT.production_witness_gate()
            finally:
                os.close(fd)


if __name__=='__main__':
    unittest.main(verbosity=2)
