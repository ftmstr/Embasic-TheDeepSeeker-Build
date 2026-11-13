#!/usr/bin/env python3
"""TUR050 external MV3 witness CONTRACT only, NOT an external witness service.

No trusted independent WORM witness, external monotonic storage, cryptographic
origin attestation or producer separation is integrated. A local digest and
even a structurally valid record cannot authorize production release.
"""
from __future__ import annotations
from dataclasses import dataclass
import hmac
import re

_SHA = re.compile(r'^[0-9a-f]{64}$', re.ASCII)
_HEAD = re.compile(r'^[0-9a-f]{40}$', re.ASCII)
_ID = re.compile(r'^[A-Za-z0-9_-]{8,128}$', re.ASCII)
# Local resource bounds only; these are NOT authenticated trust domains.
_MAX_CLAIMED_WITNESSES = 16
_MAX_CLAIMED_EPOCHS = 32
_MAX_LOCAL_SEQUENCE = (1 << 63) - 1


class WitnessNoGo(ValueError):
    """Fail closed for untrusted, stale or forged local evidence."""


@dataclass(frozen=True)
class WitnessBinding:
    repository: str
    commit_sha: str
    proof_sha256: str
    run_id: int
    witness_id: str
    witness_sequence: int
    challenge: str


def validate_witness_binding(record: WitnessBinding, *, expected_repository: str,
                             expected_commit_sha: str, expected_proof_sha256: str,
                             expected_run_id: int, expected_challenge: str,
                             trusted_prior_sequence: int) -> None:
    """STRUCTURAL validation only, never an external attestation claim.

    Caller must obtain authenticated receipt and prior sequence independently
    and immutably; passing user-controllable values cannot prove the trust gate.
    """
    if type(record) is not WitnessBinding:
        raise WitnessNoGo('invalid untrusted witness record')
    if record.repository != expected_repository or record.repository != 'ftmstr/Embasic-TheDeepSeeker-Build':
        raise WitnessNoGo('unrecognized public repository')
    if not isinstance(record.commit_sha, str) or not _HEAD.fullmatch(record.commit_sha) or record.commit_sha != expected_commit_sha:
        raise WitnessNoGo('exact commit SHA mismatch')
    if (not isinstance(record.proof_sha256, str) or
            not isinstance(expected_proof_sha256, str) or
            not _SHA.fullmatch(record.proof_sha256) or
            not _SHA.fullmatch(expected_proof_sha256) or
            not hmac.compare_digest(record.proof_sha256, expected_proof_sha256)):
        raise WitnessNoGo('proof SHA256 mismatch')
    if (type(record.run_id) is not int or not 0 < record.run_id <= _MAX_LOCAL_SEQUENCE or
            record.run_id != expected_run_id):
        raise WitnessNoGo('run identity mismatch')
    if not isinstance(record.witness_id, str) or not _ID.fullmatch(record.witness_id):
        raise WitnessNoGo('invalid external witness identity')
    if not isinstance(record.challenge, str) or not _ID.fullmatch(record.challenge) or record.challenge != expected_challenge:
        raise WitnessNoGo('fresh challenge binding mismatch')
    if (type(trusted_prior_sequence) is not int or
            not 0 <= trusted_prior_sequence <= _MAX_LOCAL_SEQUENCE or
            type(record.witness_sequence) is not int or
            not 0 < record.witness_sequence <= _MAX_LOCAL_SEQUENCE or
            record.witness_sequence <= trusted_prior_sequence):
        raise WitnessNoGo('monotonic sequence absent, reused or rolled back')


def production_witness_gate(*, binding: WitnessBinding | None = None,
                            local_expected_sha256: str | None = None) -> None:
    """Always NO_GO until separate authenticated immutable witness exists.

    Caller-provided values or flags cannot bypass this missing external
    trust domain. Live provider mutations and publication remain disabled.
    """
    raise WitnessNoGo('external authenticated immutable witness and independent monotonic anchor NOT_RUN; PRODUCTION_NO_GO')


def audit_claimed_witness_quorum(records, *, expected_repository: str,
                                 expected_commit_sha: str, expected_proof_sha256: str,
                                 expected_run_id: int, expected_challenge: str,
                                 trusted_prior_sequences, expected_witness_ids) -> None:
    """STRUCTURAL dual-domain claim audit only; NEVER authenticate trust domains.

    Every prior sequence, claimed witness ID and all record bytes are supplied
    by the caller. A same-UID attacker can forge an entire locally supplied
    quorum, including these trust roots. This check must NEVER open the
    production gate; no external signer, WORM, or monotonic store is connected.
    """
    if (type(records) not in (tuple, list) or
            type(expected_witness_ids) is not frozenset or
            not 2 <= len(expected_witness_ids) <= _MAX_CLAIMED_WITNESSES or
            type(trusted_prior_sequences) is not dict or
            len(records) != len(expected_witness_ids) or
            set(trusted_prior_sequences) != expected_witness_ids or
            any(type(v) is not str or not _ID.fullmatch(v)
                for v in expected_witness_ids) or
            any(type(v) is not int or not 0 <= v <= _MAX_LOCAL_SEQUENCE
                for v in trusted_prior_sequences.values())):
        raise WitnessNoGo('independent claimed quorum is missing or malformed')
    identities = set()
    for record in records:
        if type(record) is not WitnessBinding:
            raise WitnessNoGo('witness record type invalid')
        if record.witness_id not in expected_witness_ids:
            raise WitnessNoGo('unapproved claimed witness identity')
        if record.witness_id in identities:
            raise WitnessNoGo('reused claimed witness identity or replay')
        identities.add(record.witness_id)
        validate_witness_binding(
            record, expected_repository=expected_repository,
            expected_commit_sha=expected_commit_sha,
            expected_proof_sha256=expected_proof_sha256,
            expected_run_id=expected_run_id,
            expected_challenge=expected_challenge,
            trusted_prior_sequence=trusted_prior_sequences[record.witness_id])
    if identities != expected_witness_ids:
        raise WitnessNoGo('claimed witness quorum incomplete')


@dataclass(frozen=True)
class ClaimedWitnessEpoch:
    """One caller-supplied epoch; NO independent provenance is asserted."""

    repository: str
    commit_sha: str
    proof_sha256: str
    run_id: int
    challenge: str
    records: tuple[WitnessBinding, ...]


def audit_claimed_witness_transcript(epochs, *, expected_repository: str,
                                     trusted_prior_sequences, expected_witness_ids) -> None:
    """Bounded STRUCTURAL cross-run consistency audit; NOT a WORM witness.

    Fail closed for reused challenge/run, nonmonotonic claimed witness sequence,
    equivocated/incomplete claimed epochs or invalid bounded inputs. It does
    NOT authenticate the caller-provided prior sequences, witness identities,
    epochs or challenge source. A same-UID adversary can forge EVERY field and
    construct a valid transcript. Never connect this to production release.

    TUR053 hardens malformed locally controlled Python objects and bounds
    repeated record parsing, but neither prevents same-UID pre-opened-FD
    overwrites nor authenticates externally supplied receipts/ACL roots.
    """
    if (expected_repository != 'ftmstr/Embasic-TheDeepSeeker-Build' or
            not isinstance(epochs, (tuple, list)) or
            not 2 <= len(epochs) <= _MAX_CLAIMED_EPOCHS or
            type(expected_witness_ids) is not frozenset or
            not 2 <= len(expected_witness_ids) <= _MAX_CLAIMED_WITNESSES or
            type(trusted_prior_sequences) is not dict or
            set(trusted_prior_sequences) != expected_witness_ids or
            any(type(key) is not str or not _ID.fullmatch(key)
                for key in expected_witness_ids) or
            any(type(value) is not int or not 0 <= value <= _MAX_LOCAL_SEQUENCE
                for value in trusted_prior_sequences.values())):
        raise WitnessNoGo('invalid bounded claimed witness transcript or local anchors')
    prior = trusted_prior_sequences.copy()
    observed_challenges = set()
    last_run = 0
    for epoch in epochs:
        if type(epoch) is not ClaimedWitnessEpoch:
            raise WitnessNoGo('invalid epoch record type')
        if (epoch.repository != expected_repository or
                type(epoch.run_id) is not int or
                not last_run < epoch.run_id <= _MAX_LOCAL_SEQUENCE or
                type(epoch.commit_sha) is not str or not _HEAD.fullmatch(epoch.commit_sha) or
                type(epoch.proof_sha256) is not str or not _SHA.fullmatch(epoch.proof_sha256) or
                type(epoch.challenge) is not str or not _ID.fullmatch(epoch.challenge) or
                epoch.challenge in observed_challenges):
            raise WitnessNoGo('replayed run/challenge or malformed claimed epoch')
        # The dataclass annotation alone does not enforce tuple/element types.
        # Validate before iteration: malicious None/dict/custom records must
        # deterministically fail closed (WitnessNoGo), not crash the parser.
        if (type(epoch.records) is not tuple or
                len(epoch.records) != len(expected_witness_ids) or
                any(type(rec) is not WitnessBinding or
                    type(rec.witness_sequence) is not int or
                    not 0 < rec.witness_sequence <= _MAX_LOCAL_SEQUENCE
                    for rec in epoch.records)):
            raise WitnessNoGo('invalid or overflowing claimed sequence')
        audit_claimed_witness_quorum(
            epoch.records, expected_repository=expected_repository,
            expected_commit_sha=epoch.commit_sha,
            expected_proof_sha256=epoch.proof_sha256,
            expected_run_id=epoch.run_id,
            expected_challenge=epoch.challenge,
            trusted_prior_sequences=prior,
            expected_witness_ids=expected_witness_ids)
        for rec in epoch.records:
            prior[rec.witness_id] = rec.witness_sequence
        observed_challenges.add(epoch.challenge)
        last_run = epoch.run_id
