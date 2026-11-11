#!/usr/bin/env python3
"""Fail-closed CI evidence gate for genuine Linux Chromium MV3 acceptance.

This checks local process outcome and nine independently named acceptance
checkpoints. It does not attest a physical Windows browser, live provider, or
cryptographic provenance of the log-producing process.
"""
import argparse
import re
import unicodedata
from collections import Counter
from pathlib import Path
import sys

# Order is meaningful and tied to the real probe emission sequence. A
# complete set of forged PASS tokens in a shuffled log must not be green.
REQUIRED_PREFIXES = (
    'PASS MV3 TUR029: two real Chrome profiles',
    'PASS MV3 TUR029 NATIVE ALARM:',
    'PASS MV3 TUR030 RESTART-ALARM:',
    'PASS MV3 TUR031 LOCKED-ALARM:',
    'PASS MV3 TUR031 UNLOCK-ALARM:',
    'PASS MV3 TUR032 LOCKED-RESTART:',
    'PASS MV3 TUR032 RESTART-UNLOCK-ALARM:',
    'PASS MV3 TUR038 FOURTH-RESTART-DOUBLE-ALARM:',
    'PASS MV3 REAL worker:',
)

DENIED_PREFIXES = ('NOT_RUN MV3:', 'FAIL MV3:', 'FAIL MV3 REAL worker:',
                   'NOT_RUN: Linux MV3', 'NOT_RUN: Chromium MV3')
MAX_LOG_BYTES = 2 * 1024 * 1024
# Reject terminal controls and Unicode format characters before interpreting
# checkpoints. A colored or bidi-reordered FAIL must not become invisible.
DENIAL_RE = re.compile(
    r'(?<![A-Z0-9_])(?:FAIL\s+MV3|NOT_RUN\s+MV3|'
    r'NOT_RUN:\s*(?:LINUX|CHROMIUM)\s+MV3)', re.IGNORECASE
)


def reject_unsafe_text(text: str) -> None:
    for character in text:
        category = unicodedata.category(character)
        if (character != '\n' and (category in ('Cc', 'Cf', 'Cs', 'Zl', 'Zp')
                                    or 0x7f <= ord(character) <= 0x9f)):
            raise ValueError('terminal/Unicode control or format character in MV3 evidence')



def verify(log: bytes, exit_code: int) -> None:
    if exit_code != 0:
        raise ValueError(f'probe process nonzero/timeout/kill exit code: {exit_code}')
    if not log or len(log) > MAX_LOG_BYTES or b'\x00' in log:
        raise ValueError('missing, oversized, or binary MV3 evidence')
    try:
        decoded = log.decode('utf-8', errors='strict')
    except UnicodeDecodeError as exc:
        raise ValueError('MV3 evidence is not valid UTF-8') from exc
    reject_unsafe_text(decoded)
    lines = decoded.split('\n')
    counts = Counter()
    sequence = []
    for line in lines:
        normalized = line.strip()
        # NFKC folds compatibility forms (e.g. full-width FAIL). Scan the
        # whole line: timestamps and prefixes must not conceal a failure.
        if DENIAL_RE.search(unicodedata.normalize('NFKC', normalized)):
            raise ValueError(f'probe explicitly failed or did not run: {normalized[:100]}')
        hits = [prefix for prefix in REQUIRED_PREFIXES if normalized.startswith(prefix)]
        if hits:
            if len(hits) != 1:
                raise ValueError('ambiguous MV3 checkpoint token')
            counts[hits[0]] += 1
            sequence.append(hits[0])
        elif re.match(r'^PASS\s+MV3(?:\s|:)', unicodedata.normalize('NFKC', normalized), re.IGNORECASE):
            # An unknown or compatibility-encoded PASS may masquerade as an
            # extra valid checkpoint in job logs; reject rather than ignore.
            raise ValueError('unexpected or noncanonical MV3 PASS evidence')
    if sequence != list(REQUIRED_PREFIXES):
        raise ValueError('MV3 checkpoint ordering, duplication or completeness mismatch')
    wrong = {p: counts[p] for p in REQUIRED_PREFIXES if counts[p] != 1}
    if wrong:
        raise ValueError(f'MV3 acceptance checkpoints must occur exactly once: {wrong}')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--exit-code', type=int, required=True)
    args = parser.parse_args()
    try:
        verify(args.log.read_bytes(), args.exit_code)
    except (ValueError, OSError) as exc:
        print(f'FAIL MV3 CI GATE: {exc}', file=sys.stderr)
        return 1
    print(f'PASS MV3 CI GATE: {len(REQUIRED_PREFIXES)}/{len(REQUIRED_PREFIXES)} '
          'genuine Linux checkpoints and process exit code 0; Windows physical NOT_RUN')
    return 0


if __name__ == '__main__':
    sys.exit(main())
