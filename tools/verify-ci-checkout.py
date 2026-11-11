#!/usr/bin/env python3
"""Fail closed when a CI job tests a synthetic PR merge instead of exact event HEAD.

This verifies Git checkout identity only; it does not authenticate the runner,
GitHub event source, or evidence-producing process. No network/provider calls.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys


OID = re.compile(r"[0-9a-f]{40}\Z")


def validate(expected: str, actual: str) -> None:
    if not OID.fullmatch(expected):
        raise ValueError("expected event commit must be a lowercase 40-hex SHA-1")
    if not OID.fullmatch(actual):
        raise ValueError("checkout HEAD must be a lowercase 40-hex SHA-1")
    if expected != actual:
        raise ValueError("checkout HEAD differs from event PR HEAD (synthetic merge/stale ref)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--expected-sha", required=True)
    args = ap.parse_args()
    try:
        head = subprocess.check_output(
            ["git", "rev-parse", "--verify", "HEAD^{commit}"],
            stderr=subprocess.PIPE, timeout=15,
        ).decode("ascii", "strict").strip()
        validate(args.expected_sha, head)
    except (ValueError, UnicodeError, subprocess.SubprocessError, OSError) as exc:
        print(f"FAIL CI exact HEAD: {exc}", file=sys.stderr)
        return 1
    print(f"PASS CI exact event HEAD: {head} (not a synthetic PR merge)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
