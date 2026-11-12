"""TUR052 structurally bound multi-run witness transcript and real OS threats.

All inputs can be forged by the SAME UID; passing tests NEVER means WORM,
cryptographic origin, independent trust domains or production readiness.
"""
from __future__ import annotations
import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('tur052_claimed_transcript', ROOT / 'tools' / 'mv3-witness-contract.py')
C = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = C
SPEC.loader.exec_module(C)
REPO = 'ftmstr/Embasic-TheDeepSeeker-Build'
HEAD = 'b95a4fe2873353d111493de67cea902c334a0196'  # fixed historical test fixture
SHA = hashlib.sha256(b'original MV3 proof for local transcript tests').hexdigest()
ALT = hashlib.sha256(b'forged local MV3 bytes').hexdigest()
IDS = frozenset(('local-claimed-domain-a', 'local-claimed-domain-b'))
PRIOR = {'local-claimed-domain-a': 10, 'local-claimed-domain-b': 20}


def epoch(run, challenge, seq_a, seq_b, *, digest=SHA, head=HEAD, ids=IDS):
    recs = tuple(C.WitnessBinding(REPO, head, digest, run, name, seq, challenge)
                 for name, seq in zip(sorted(ids), (seq_a, seq_b)))
    return C.ClaimedWitnessEpoch(REPO, head, digest, run, challenge, recs)


def audit(epochs, *, prior=PRIOR, ids=IDS, repo=REPO):
    return C.audit_claimed_witness_transcript(
        epochs, expected_repository=repo,
        trusted_prior_sequences=prior, expected_witness_ids=ids)


class MultiRunBoundary(unittest.TestCase):
    def setUp(self):
        self.first = epoch(43296921210, 'local-challenge-first-epoch', 11, 21)
        self.second = epoch(43296921211, 'local-challenge-second-epoch', 12, 22)

    def test_two_rounds_structurally_pass_but_production_unconditionally_no_go(self):
        self.assertIsNone(audit((self.first, self.second)))
        with self.assertRaisesRegex(C.WitnessNoGo, 'PRODUCTION_NO_GO'):
            C.production_witness_gate()

    def test_missing_one_run_rejected(self):
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first,))

    def test_empty_history_rejected(self):
        with self.assertRaises(C.WitnessNoGo):
            audit(())

    def test_bounded_transcript_rejects_33_runs(self):
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, self.second) * 17)

    def test_same_challenge_reused_at_later_run_rejected(self):
        reused = epoch(43296921211, self.first.challenge, 12, 22)
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, reused))

    def test_run_replay_or_reverse_order_rejected(self):
        for run in (43296921210, 43296921209, True, -1):
            with self.subTest(run=run), self.assertRaises(C.WitnessNoGo):
                audit((self.first, epoch(run, 'local-challenge-other-run', 12, 22)))

    def test_same_run_equivocated_digest_rejected(self):
        fake = epoch(43296921210, 'local-challenge-other-run', 12, 22, digest=ALT)
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, fake))

    def test_cross_run_old_second_witness_sequence_rejected(self):
        for val in (21, 20, 0, True):
            with self.subTest(val=val), self.assertRaises(C.WitnessNoGo):
                audit((self.first, epoch(43296921211, 'local-challenge-other-run', 12, val)))

    def test_cross_run_prior_anchor_is_required_and_strictly_typed(self):
        for bad in ({}, {'local-claimed-domain-a': True, 'local-claimed-domain-b': 20},
                    {'local-claimed-domain-a': -1, 'local-claimed-domain-b': 20}):
            with self.subTest(bad=bad), self.assertRaises(C.WitnessNoGo):
                audit((self.first, self.second), prior=bad)

    def test_missing_claimed_domain_in_later_run_rejected(self):
        second = C.ClaimedWitnessEpoch(REPO, HEAD, SHA, 43296921211,
                  'local-challenge-second-epoch', self.second.records[:1])
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, second))

    def test_duplicate_claimed_identity_later_run_rejected(self):
        second = C.ClaimedWitnessEpoch(REPO, HEAD, SHA, 43296921211,
                  'local-challenge-second-epoch', self.second.records[:1]*2)
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, second))

    def test_wrong_repo_or_invalid_epoch_object_rejected(self):
        for bad in (dict(), C.ClaimedWitnessEpoch('attacker/repo', HEAD, SHA,
                      43296921211, 'local-challenge-second-epoch', self.second.records)):
            with self.subTest(bad=str(bad)[:30]), self.assertRaises(C.WitnessNoGo):
                audit((self.first, bad))

    def test_max_sequence_overflow_rejected(self):
        bad = epoch(43296921211, 'local-challenge-other-run', 12, 1 << 63)
        with self.assertRaises(C.WitnessNoGo):
            audit((self.first, bad))

    def test_same_uid_can_forge_entire_history_negative_counterexample(self):
        fake_a = epoch(43296921300, 'forged-first-challenge-01', 111, 211, digest=ALT)
        fake_b = epoch(43296921301, 'forged-second-challenge-02', 112, 212, digest=ALT)
        self.assertIsNone(audit([fake_a, fake_b], prior={'local-claimed-domain-a': 100,
                                                       'local-claimed-domain-b': 200}))
        with self.assertRaises(C.WitnessNoGo):
            C.production_witness_gate(local_expected_sha256=ALT)

    @unittest.skipUnless(os.name == 'posix', 'real POSIX same-UID child required')
    def test_posix_child_forges_local_history_on_disk_after_return(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'local-claims.txt'
            path.write_text('accepted-local-claims', encoding='utf-8')
            os.chmod(path, 0o400)
            subprocess.run([sys.executable, '-c',
                'from pathlib import Path; import os,sys; p=Path(sys.argv[1]); os.chmod(p,0o600); p.write_text("fully-forged-local-claims")',
                str(path)], check=True, timeout=5)
            self.assertEqual(path.read_text(), 'fully-forged-local-claims')
            self.assertIsNone(audit((self.first, self.second)))
            with self.assertRaises(C.WitnessNoGo):
                C.production_witness_gate()

    @unittest.skipUnless(os.name == 'posix', 'real POSIX noncooperating writer required')
    def test_posix_noncooperating_writer_bypasses_held_directory_flock(self):
        import fcntl
        with tempfile.TemporaryDirectory() as td:
            folder = Path(td)
            claimed = folder / 'claimed-witness-history.txt'
            claimed.write_text('locally-signed')
            fd = os.open(folder, os.O_RDONLY | os.O_DIRECTORY)
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                subprocess.run([sys.executable, '-c',
                    'from pathlib import Path; import sys; Path(sys.argv[1]).write_text("rewritten-by-uncooperative-child")',
                    str(claimed)], check=True, timeout=5)
                self.assertEqual(claimed.read_text(), 'rewritten-by-uncooperative-child')
                with self.assertRaises(C.WitnessNoGo):
                    C.production_witness_gate()
            finally:
                os.close(fd)

    @unittest.skipUnless(os.name == 'posix', 'real POSIX ancestor inode swap required')
    def test_posix_ancestor_rename_and_symlink_swap_redirects_untrusted_claims(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            current = root / 'records'
            current.mkdir()
            (current / 'claim').write_bytes(b'trusted-only-by-local-path')
            fd = os.open(current, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                current.rename(root / 'previous')
                attacker = root / 'attacker'
                attacker.mkdir()
                (attacker / 'claim').write_bytes(b'forged-current-claim')
                current.symlink_to(attacker, target_is_directory=True)
                self.assertEqual((current / 'claim').read_bytes(), b'forged-current-claim')
                with os.fdopen(os.open('claim', os.O_RDONLY, dir_fd=fd), 'rb') as fp:
                    self.assertEqual(fp.read(), b'trusted-only-by-local-path')
                with self.assertRaises(C.WitnessNoGo):
                    C.production_witness_gate()
            finally:
                os.close(fd)


if __name__ == '__main__':
    unittest.main(verbosity=2)
