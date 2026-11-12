"""TUR050 external witness trust-boundary and actual POSIX filesystem tests."""
from __future__ import annotations
import hashlib
import importlib.util
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import sys

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('mv3_witness_contract', ROOT/'tools/mv3-witness-contract.py')
MOD = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MOD
SPEC.loader.exec_module(MOD)
REPO='ftmstr/Embasic-TheDeepSeeker-Build'
HEAD='7d69e89369a87a997218faaa0f56ce801b0fb006'  # historical fixture, not current HEAD
SHA=hashlib.sha256(b'genuine-evidence').hexdigest()
CHALLENGE='fresh-run-challenge-0001'


def receipt(**changes):
    fields=dict(repository=REPO,commit_sha=HEAD,proof_sha256=SHA,run_id=43285230751,
                witness_id='external-witness-01',witness_sequence=11,challenge=CHALLENGE)
    fields.update(changes)
    return MOD.WitnessBinding(**fields)


def validate(value):
    return MOD.validate_witness_binding(
        value,expected_repository=REPO,expected_commit_sha=HEAD,
        expected_proof_sha256=SHA,expected_run_id=43285230751,
        expected_challenge=CHALLENGE,trusted_prior_sequence=10)


class ExternalWitnessContract(unittest.TestCase):
    def test_structural_binding_never_authenticates_witness(self):
        self.assertIsNone(validate(receipt()))
        with self.assertRaisesRegex(MOD.WitnessNoGo,'NOT_RUN'):
            MOD.production_witness_gate(binding=receipt())

    def test_missing_external_witness_fails_closed(self):
        with self.assertRaisesRegex(MOD.WitnessNoGo,'NOT_RUN'):
            MOD.production_witness_gate()

    def test_same_uid_can_forge_log_and_sha_but_not_production(self):
        with TemporaryDirectory() as td:
            log=Path(td)/'mv3.log'
            log.write_bytes(b'original')
            log.write_bytes(b'attacker forged nine marker text')
            digest=hashlib.sha256(log.read_bytes()).hexdigest()
            self.assertEqual(digest,hashlib.sha256(log.read_bytes()).hexdigest())
            with self.assertRaisesRegex(MOD.WitnessNoGo,'PRODUCTION_NO_GO'):
                MOD.production_witness_gate(local_expected_sha256=digest)

    def test_wrong_head_repository_and_run_rejected(self):
        for item in [receipt(commit_sha='0'*40),receipt(repository='attacker/repo'),receipt(run_id=1)]:
            with self.subTest(item=item),self.assertRaises(MOD.WitnessNoGo):
                validate(item)

    def test_stale_or_rollback_sequence_rejected(self):
        for sequence in [10,9,0,-1,True]:
            with self.subTest(sequence=sequence),self.assertRaises(MOD.WitnessNoGo):
                validate(receipt(witness_sequence=sequence))

    def test_equivocation_sha_and_challenge_rejected(self):
        for item in [receipt(proof_sha256='0'*64),receipt(challenge='different-challenge-000'),
                     receipt(proof_sha256='ABC')]:
            with self.subTest(item=item),self.assertRaises(MOD.WitnessNoGo):
                validate(item)

    @unittest.skipUnless(os.name=='posix','POSIX filesystem permission probe')
    def test_real_os_permission_expansion_not_external_witness(self):
        with TemporaryDirectory() as td:
            path=Path(td)/'proof'
            path.write_bytes(b'genuine-evidence')
            path.chmod(0o600)
            self.assertEqual(path.stat().st_mode & 0o777,0o600)
            path.chmod(0o666)
            self.assertEqual(path.stat().st_mode & 0o777,0o666)
            with self.assertRaises(MOD.WitnessNoGo):
                MOD.production_witness_gate(binding=receipt())

    @unittest.skipUnless(os.name=='posix','POSIX ancestor symlink replacement probe')
    def test_real_os_ancestor_symlink_swap_does_not_create_witness(self):
        with TemporaryDirectory() as td:
            root=Path(td)
            p=root/'dir'
            p.mkdir()
            (p/'proof').write_bytes(b'genuine-evidence')
            p.rename(root/'renamed')
            p.symlink_to(root/'renamed',target_is_directory=True)
            self.assertTrue(p.is_symlink())
            with self.assertRaises(MOD.WitnessNoGo):
                MOD.production_witness_gate(binding=receipt())

    def test_locally_asserted_signature_cannot_promote(self):
        self.assertFalse(hasattr(MOD.WitnessBinding,'verified'))
        with self.assertRaises(MOD.WitnessNoGo):
            MOD.production_witness_gate(binding=receipt())


if __name__=='__main__':
    unittest.main(verbosity=2)
