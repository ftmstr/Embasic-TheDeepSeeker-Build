# TUR040 — Genuine Linux MV3 child-process evidence boundary

The CI Linux job executes the existing `tests/test-mv3-extension.py` with a
fixed interpreter and script location via `tools/capture-mv3-probe.py`, NOT
through a shell `tee` pipeline. The directly created OS child process runs the
same previous native browser restart and alarm tests. The runner captures its
combined stdout/stderr to a unique private filesystem temporary file, checks
real child exit/timeout, rejects invalid/missing/duplicate/out-of-order test
checkpoints using the existing fail-closed gate, and only publishes that file
on a successful test. GitHub artifact upload is `if: success()`, not `always`.

An adversarial real OS subprocess harness covers nonzero exit with forged PASS,
no browser (`NOT_RUN`), timeout/kill, truncated checkpoint list, stale log
preservation, symlink target safety, unbounded timeout and workflow wiring.
These negative tests exercise the supervisor, **not a real Chrome browser**.
The existing real Linux Chrome MV3 acceptance remains separately mandatory.

## Non-claims / adversary model

A compromised GitHub runner, malicious checked-out script, altered action,
forged event context, or deliberately PASS-emitting synthetic child can still
produce a success-looking log. Direct-child capture is NOT a signed process
origin attestation. It also cannot prove Windows 24h, live provider CAS,
external monotonic anchor, anti-equivocation, or cross-provider exactly-once.
Physical Windows / live provider / external trusted oracle remain NOT_RUN and
PRODUCTION_NO_GO at 79/100.
