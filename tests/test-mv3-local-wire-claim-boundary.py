"""TUR054: local wire replay/forgery and genuine POSIX OS privilege boundaries.

NOT an independent cryptographic witness, WORM service, or production test.
A structurally accepted local claim can be forged wholesale by its owner.
"""
from __future__ import annotations
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tur054_local_claim_wire', ROOT/'tools'/'mv3-witness-wire.py')
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
wc_spec = importlib.util.spec_from_file_location('tur054_existing_production_gate', ROOT/'tools'/'mv3-witness-contract.py')
W = importlib.util.module_from_spec(wc_spec)
sys.modules[wc_spec.name] = W
wc_spec.loader.exec_module(W)
REPO = 'ftmstr/Embasic-TheDeepSeeker-Build'
HEAD = '13c20b946bad803ffec1597748e5f16e55e9878e'  # fixture, not dynamic Git head
PROOF = hashlib.sha256(b'fixed fixture source for local wire adversarial tests').hexdigest()
GENESIS = hashlib.sha256(b'caller-local-untrusted-genesis').hexdigest()
WID = 'local-claimed-witness-a'
TAG = b'EMBASIC/TUR054/UNTRUSTED-LOCAL-WITNESS-CLAIM\0'


def packet(run, seq, challenge, previous, *, proof=PROOF, head=HEAD):
    return {'format': 'TUR054-LOCAL-CLAIM-v1', 'repository': REPO,
            'commit_sha': head, 'proof_sha256': proof, 'witness_id': WID,
            'run_id': run, 'sequence': seq, 'challenge': challenge,
            'previous_local_digest': previous}


def encode(p):
    return json.dumps(p, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode('ascii')


def make_chain(*, first=1, first_seq=1, genesis=GENESIS, proof=PROOF):
    a = encode(packet(first, first_seq, 'unique-challenge-alpha-0001', genesis, proof=proof))
    next_digest = hashlib.sha256(TAG + a).hexdigest()
    b = encode(packet(first+1, first_seq+1, 'unique-challenge-beta-0002', next_digest, proof=proof))
    return (a, b)


def audit(frames, *, genesis=GENESIS, prior=0, proof=PROOF):
    return C.audit_local_wire_chain(frames, expected_repository=REPO,
        expected_commit_sha=HEAD, expected_proof_sha256=proof,
        expected_witness_id=WID, claimed_genesis_digest=genesis,
        claimed_genesis_sequence=prior)


class LocalClaimWireThreats(unittest.TestCase):
    def setUp(self):
        self.chain = make_chain()

    def assert_rejected(self, frames):
        with self.assertRaises(C.LocalWireNoGo):
            audit(frames)

    def test_canonical_chain_structural_only_and_production_no_go(self):
        self.assertEqual(len(audit(self.chain)), 64)
        with self.assertRaisesRegex(W.WitnessNoGo, 'PRODUCTION_NO_GO'):
            W.production_witness_gate()

    def test_duplicate_json_key_prevents_parser_confusion(self):
        a = self.chain[0].replace(b'"run_id":1', b'"run_id":1,"run_id":9')
        self.assertNotEqual(a, self.chain[0]); self.assert_rejected((a, self.chain[1]))

    def test_reordered_fields_refused_even_when_json_equivalent(self):
        value = json.loads(self.chain[0]); a = json.dumps(value).encode()
        self.assert_rejected((a, self.chain[1]))

    def test_extra_whitespace_refused(self):
        a = self.chain[0].replace(b':', b': ', 1)
        self.assert_rejected((a, self.chain[1]))

    def test_invalid_utf8_refused(self):
        self.assert_rejected((self.chain[0]+b'\xff', self.chain[1]))

    def test_concatenated_json_or_trailing_garbage_refused(self):
        self.assert_rejected((self.chain[0]+self.chain[0], self.chain[1]))

    def test_json_nan_injection_refused(self):
        a = self.chain[0].replace(b'"run_id":1', b'"run_id":NaN')
        self.assert_rejected((a, self.chain[1]))

    def test_bad_or_foreign_wire_schema_refused(self):
        for key in ('format', 'repository', 'witness_id'):
            with self.subTest(key=key):
                p = json.loads(self.chain[0]); p.pop(key)
                self.assert_rejected((encode(p), self.chain[1]))

    def test_boolean_and_float_sequence_are_not_integers(self):
        for bad in (True, 1.0):
            with self.subTest(bad=bad):
                p = json.loads(self.chain[0]); p['sequence'] = bad
                self.assert_rejected((encode(p), self.chain[1]))

    def test_duplicate_challenge_across_runs_refused(self):
        p = json.loads(self.chain[1]); p['challenge'] = json.loads(self.chain[0])['challenge']
        self.assert_rejected((self.chain[0], encode(p)))

    def test_replayed_run_id_and_out_of_order_run_refused(self):
        for bad in (0, 1, -1):
            with self.subTest(run=bad):
                p = json.loads(self.chain[1]); p['run_id'] = bad
                self.assert_rejected((self.chain[0], encode(p)))

    def test_rolled_back_or_reused_sequence_refused(self):
        for bad in (-1, 0, 1):
            with self.subTest(sequence=bad):
                p = json.loads(self.chain[1]); p['sequence'] = bad
                self.assert_rejected((self.chain[0], encode(p)))

    def test_forked_previous_hash_rejected_relative_to_claimed_root(self):
        p = json.loads(self.chain[1]); p['previous_local_digest'] = '0'*64
        self.assert_rejected((self.chain[0], encode(p)))

    def test_modified_local_genesis_refused_only_if_old_root_supplied(self):
        self.assertNotEqual(GENESIS, '0'*64)
        with self.assertRaises(C.LocalWireNoGo):
            audit(self.chain, genesis='0'*64)

    def test_full_same_uid_rewrite_of_root_chain_and_sha_can_still_pass_negative(self):
        fake_root = hashlib.sha256(b'attacker-can-forge-claimed-genesis').hexdigest()
        fake_proof = hashlib.sha256(b'attacker-can-forge-evidence-plus-local-sha').hexdigest()
        fake = make_chain(first=500, first_seq=81, genesis=fake_root, proof=fake_proof)
        self.assertEqual(len(audit(fake, genesis=fake_root, prior=80, proof=fake_proof)), 64)
        with self.assertRaises(W.WitnessNoGo):
            W.production_witness_gate(local_expected_sha256=fake_proof)

    def test_capacity_overflow_and_untrusted_object_type_fail_closed(self):
        for bad in ([], [*self.chain], (self.chain[0],)*33, (b' ', self.chain[1]),
                    (b'x'*4097, self.chain[1])):
            with self.subTest(type=str(type(bad))), self.assertRaises(C.LocalWireNoGo):
                audit(bad)

    def test_unicode_confusable_and_nonascii_wire_not_canonical(self):
        p = json.loads(self.chain[0]); p['challenge'] = 'chаllenge-fake-00001'  # Cyrillic a
        wire = json.dumps(p, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
        self.assert_rejected((wire, self.chain[1]))

    @unittest.skipUnless(os.name=='posix', 'requires actual POSIX inode and replace')
    def test_posix_atomic_leaf_replacement_after_pinned_fd_changes_path_identity(self):
        with tempfile.TemporaryDirectory() as td:
            folder = Path(td); proof = folder/'proof'; proof.write_bytes(self.chain[0])
            fd = os.open(proof, os.O_RDONLY | os.O_NOFOLLOW)
            try:
                old = os.fstat(fd)
                replacement = folder/'attacker'; replacement.write_bytes(b'locally-forged-after-validation')
                os.replace(replacement, proof)
                self.assertNotEqual(old.st_ino, os.stat(proof).st_ino)
                self.assertEqual(os.pread(fd, len(self.chain[0]), 0), self.chain[0])
                self.assertEqual(proof.read_bytes(), b'locally-forged-after-validation')
                with self.assertRaises(W.WitnessNoGo): W.production_witness_gate()
            finally:
                os.close(fd)

    @unittest.skipUnless(os.name=='posix' and hasattr(os,'geteuid') and os.geteuid()==0,
                         'actual alternate-UID DAC/privileged writer needs UID 0; skip on unprivileged CI')
    def test_posix_privileged_writer_bypasses_read_only_while_other_uid_denied(self):
        # All actions are confined to temporary root-owned 0400 evidence file.
        # Drop child to uid/gid 65534 rather than escalating a CI user.
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); root.chmod(0o755)
            path=root/'claimed-proof'; path.write_bytes(b'original'); path.chmod(0o400)
            def drop():
                os.setgid(65534); os.setuid(65534)
            res=subprocess.run([sys.executable,'-c',
                'import sys;open(sys.argv[1],"wb").write(b"tampered")',str(path)],
                preexec_fn=drop, capture_output=True, timeout=6)
            self.assertNotEqual(res.returncode,0,'different unprivileged UID should lack write permission')
            self.assertEqual(path.read_bytes(),b'original')
            res2=subprocess.run([sys.executable,'-c',
                'import sys;open(sys.argv[1],"wb").write(b"root-overrode-0400")',str(path)],
                capture_output=True,timeout=6)
            self.assertEqual(res2.returncode,0,res2.stderr.decode(errors='replace'))
            self.assertEqual(path.read_bytes(),b'root-overrode-0400')
            with self.assertRaises(W.WitnessNoGo): W.production_witness_gate()

    @unittest.skipUnless(os.name=='posix', 'POSIX separate child with same UID required')
    def test_posix_child_forges_local_digest_and_replays_new_chain_on_disk(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); chain_file=root/'claimed-chain.jsonl'; root_file=root/'claimed-root.txt'
            chain_file.write_bytes(b'\n'.join(self.chain)); root_file.write_text(GENESIS)
            # Independent process overwrites BOTH local chain and root consistently;
            # it does not gain a protected external identity or monotonic anchor.
            script=('from pathlib import Path;import hashlib,json,sys; '
                    'p=Path(sys.argv[1]);r=Path(sys.argv[2]); '
                    'root=hashlib.sha256(b"same-uid-forged-genesis").hexdigest(); '
                    'f=lambda x:json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode(); '
                    'x=json.loads(p.read_bytes().splitlines()[0]); '
                    'x.update(run_id=91,sequence=91,challenge="forged-challenge-first-91",previous_local_digest=root); '
                    'a=f(x); h=hashlib.sha256(b"EMBASIC/TUR054/UNTRUSTED-LOCAL-WITNESS-CLAIM\\0"+a).hexdigest(); '
                    'x.update(run_id=92,sequence=92,challenge="forged-challenge-second-92",previous_local_digest=h); '
                    'p.write_bytes(a+b"\\n"+f(x));r.write_text(root)')
            subprocess.run([sys.executable,'-c',script,str(chain_file),str(root_file)],check=True,timeout=5)
            rewritten=tuple(chain_file.read_bytes().splitlines())
            self.assertEqual(len(rewritten),2)
            self.assertEqual(len(audit(rewritten,genesis=root_file.read_text(),prior=90)),64)
            with self.assertRaises(W.WitnessNoGo):W.production_witness_gate()

if __name__=='__main__': unittest.main(verbosity=2)
