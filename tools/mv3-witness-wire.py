#!/usr/bin/env python3
"""TUR054: bounded, deterministic LOCAL claimed witness wire transcript audit.

STRUCTURAL ONLY. The genesis digest, prior sequence, record writer and all local
storage remain caller-controlled. A same-UID/root adversary can forge a coherent
new chain, including its genesis and hashes. No external signed WORM witness,
nonrollbackable monotonic root, origin attestation, or production unlock exists.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import re

_REPO = 'ftmstr/Embasic-TheDeepSeeker-Build'
_HASH = re.compile(r'[0-9a-f]{64}\Z', re.ASCII)
_HEAD = re.compile(r'[0-9a-f]{40}\Z', re.ASCII)
_ID = re.compile(r'[A-Za-z0-9_-]{8,128}\Z', re.ASCII)
_TAG = b'EMBASIC/TUR054/UNTRUSTED-LOCAL-WITNESS-CLAIM\0'
_FORMAT = 'TUR054-LOCAL-CLAIM-v1'
_KEYS = frozenset(('format', 'repository', 'commit_sha', 'proof_sha256',
                   'witness_id', 'run_id', 'sequence', 'challenge',
                   'previous_local_digest'))
_MAX_FRAME = 4096
_MAX_TOTAL = 32768
_MAX_SEQ = (1 << 63) - 1


class LocalWireNoGo(ValueError):
    """Fail closed only for a LOCAL claimed record. Not an attestation."""


def _unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise LocalWireNoGo('duplicate JSON key')
        result[key] = value
    return result


def _bad_constant(_):
    raise LocalWireNoGo('non-standard JSON numeric constant')


def _strict_text(value, pattern):
    return type(value) is str and bool(pattern.fullmatch(value))


def audit_local_wire_chain(frames, *, expected_repository, expected_commit_sha,
                           expected_proof_sha256, expected_witness_id,
                           claimed_genesis_digest, claimed_genesis_sequence):
    """Validate 2-32 strictly canonical caller-supplied JSON bytes, returning a
    LOCALLY calculated digest; never use the result as production provenance.

    Requiring a previous hash detects inconsistency relative to a *given* root,
    not a malicious rewrite of the entire chain and its local genesis. Every
    expected value supplied here is caller-controlled unless a separate real
    independent trust domain proves otherwise (none is integrated).
    """
    if (type(frames) is not tuple or not 2 <= len(frames) <= 32 or
            type(expected_repository) is not str or expected_repository != _REPO or
            not _strict_text(expected_commit_sha, _HEAD) or
            not _strict_text(expected_proof_sha256, _HASH) or
            not _strict_text(expected_witness_id, _ID) or
            not _strict_text(claimed_genesis_digest, _HASH) or
            type(claimed_genesis_sequence) is not int or
            not 0 <= claimed_genesis_sequence < _MAX_SEQ):
        raise LocalWireNoGo('malformed local claimed trust-root configuration')
    previous = claimed_genesis_digest
    last_run = 0
    last_seq = claimed_genesis_sequence
    challenges = set()
    total = 0
    for wire in frames:
        if type(wire) is not bytes or not 0 < len(wire) <= _MAX_FRAME:
            raise LocalWireNoGo('invalid or oversized local claimed wire frame')
        total += len(wire)
        if total > _MAX_TOTAL:
            raise LocalWireNoGo('local claimed transcript exceeds byte budget')
        try:
            value = json.loads(wire.decode('utf-8', errors='strict'),
                               object_pairs_hook=_unique_keys,
                               parse_constant=_bad_constant)
        except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as exc:
            raise LocalWireNoGo('non-canonical or malformed local JSON') from exc
        if type(value) is not dict or value.keys() != _KEYS:
            raise LocalWireNoGo('unrecognized/missing claimed wire fields')
        if (type(value['format']) is not str or value['format'] != _FORMAT or
                type(value['repository']) is not str or value['repository'] != expected_repository or
                type(value['commit_sha']) is not str or value['commit_sha'] != expected_commit_sha or
                type(value['proof_sha256']) is not str or
                not hmac.compare_digest(value['proof_sha256'], expected_proof_sha256) or
                type(value['witness_id']) is not str or value['witness_id'] != expected_witness_id or
                type(value['run_id']) is not int or not last_run < value['run_id'] <= _MAX_SEQ or
                type(value['sequence']) is not int or not last_seq < value['sequence'] <= _MAX_SEQ or
                not _strict_text(value['challenge'], _ID) or value['challenge'] in challenges or
                not _strict_text(value['previous_local_digest'], _HASH) or
                not hmac.compare_digest(value['previous_local_digest'], previous)):
            raise LocalWireNoGo('local identity, challenge, previous digest or monotonic claim rejected')
        # Verify exact wire bytes, not merely equivalent parsed JSON. This also
        # rejects insignificant whitespace, non-ASCII confusables, floats and
        # alternate escape forms that a local writer could otherwise equivocate.
        canonical = json.dumps(value, sort_keys=True, separators=(',', ':'),
                               ensure_ascii=True, allow_nan=False).encode('ascii')
        if not hmac.compare_digest(wire, canonical):
            raise LocalWireNoGo('noncanonical local claimed JSON bytes')
        previous = hashlib.sha256(_TAG + wire).hexdigest()
        challenges.add(value['challenge'])
        last_run = value['run_id']
        last_seq = value['sequence']
    return previous
