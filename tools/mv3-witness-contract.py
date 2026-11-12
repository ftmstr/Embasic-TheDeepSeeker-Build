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
    if type(record.run_id) is not int or record.run_id <= 0 or record.run_id != expected_run_id:
        raise WitnessNoGo('run identity mismatch')
    if not isinstance(record.witness_id, str) or not _ID.fullmatch(record.witness_id):
        raise WitnessNoGo('invalid external witness identity')
    if not isinstance(record.challenge, str) or not _ID.fullmatch(record.challenge) or record.challenge != expected_challenge:
        raise WitnessNoGo('fresh challenge binding mismatch')
    if (type(trusted_prior_sequence) is not int or trusted_prior_sequence < 0 or
            type(record.witness_sequence) is not int or
            record.witness_sequence <= trusted_prior_sequence):
        raise WitnessNoGo('monotonic sequence absent, reused or rolled back')


def production_witness_gate(*, binding: WitnessBinding | None = None,
                            local_expected_sha256: str | None = None) -> None:
    """Always NO_GO until separate authenticated immutable witness exists.

    Caller-provided values or flags cannot bypass this missing external
    trust domain. Live provider mutations and publication remain disabled.
    """
    raise WitnessNoGo('external authenticated immutable witness and independent monotonic anchor NOT_RUN; PRODUCTION_NO_GO')
