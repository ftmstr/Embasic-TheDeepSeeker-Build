#!/usr/bin/env python3
"""Fail-closed CI evidence gate for genuine Linux Chromium MV3 acceptance.

This checks local process outcome and eight independently named acceptance
checkpoints. It does not attest a physical Windows browser, live provider, or
cryptographic provenance of the log-producing process.
"""
import argparse
from collections import Counter
from pathlib import Path
import sys

REQUIRED_PREFIXES = (
    'PASS MV3 REAL worker:',
    'PASS MV3 TUR029: two real Chrome profiles',
    'PASS MV3 TUR029 NATIVE ALARM:',
    'PASS MV3 TUR030 RESTART-ALARM:',
    'PASS MV3 TUR031 LOCKED-ALARM:',
    'PASS MV3 TUR031 UNLOCK-ALARM:',
    'PASS MV3 TUR032 LOCKED-RESTART:',
    'PASS MV3 TUR032 RESTART-UNLOCK-ALARM:',
)
DENIED_PREFIXES = ('NOT_RUN MV3:', 'FAIL MV3:', 'FAIL MV3 REAL worker:',
                   'NOT_RUN: Linux MV3', 'NOT_RUN: Chromium MV3')
MAX_LOG_BYTES = 2 * 1024 * 1024


def verify(log: bytes, exit_code: int) -> None:
    if exit_code != 0:
        raise ValueError(f'probe process nonzero/timeout/kill exit code: {exit_code}')
    if not log or len(log) > MAX_LOG_BYTES or b'\x00' in log:
        raise ValueError('missing, oversized, or binary MV3 evidence')
    try:
        lines = log.decode('utf-8', errors='strict').splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError('MV3 evidence is not valid UTF-8') from exc
    counts = Counter()
    for line in lines:
        normalized = line.strip()
        if any(normalized.startswith(p) for p in DENIED_PREFIXES):
            raise ValueError(f'probe explicitly failed or did not run: {normalized[:100]}')
        for prefix in REQUIRED_PREFIXES:
            if normalized.startswith(prefix):
                counts[prefix] += 1
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
