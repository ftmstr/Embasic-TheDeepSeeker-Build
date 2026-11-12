# TUR042 — Bounded-pipe MV3 evidence and process-tree cleanup

This is a CI-only hardening change; extension/manifest v1.18.0 remains unchanged.

## Narrowly proven property

The parent collects direct-child stdout/stderr from a kernel pipe using 64 KiB
reads. It checks `len(buffer) + len(chunk) <= MAX_LOG_BYTES` **before appending**.
It never exposes a writable, unbounded stdout scratch file. The parent-managed
bytearray is capped at 2 MiB, regardless of how much the child tries to write
between two scheduler samples. On overflow or timeout, it denies all evidence
publication and terminates the POSIX process group. On Windows, the caller
attempts `taskkill /PID <pid> /T /F` before falling back to direct child kill.

A post-exit 0.5 s bounded drain captures data written before child exit without
waiting unboundedly for a descendant retaining stdout. A verified immutable
snapshot is fsynced into an independent temporary file and atomically renamed.
A valid-looking stdout log does not overcome nonzero direct-child exit or
missing/reordered/malformed checkpoint evidence. No partial evidence is
published on rejected executions. A malicious descendant emitting late bytes
cannot modify an already published snapshot.

## Adversarial test scope

16 real-OS child tests, including new between-sample 4 MiB burst, valid-size
malformed output, POSIX timeout/descendant termination, and CI source policy.
Existing gate adversarial tests remain mandatory (19/19), exact HEAD 7/7,
95 Node scripts, and real Linux Chromium MV3 native alarm/restart evidence 9/9.

## Explicit limitations and NO-GO

The capture buffer bound is **not** a kernel quota for child memory, runner
filesystem, or entire process tree. Windows taskkill does not guarantee all
escaped descendants, especially if the root exited or a child was reparented.
The bound also does not make stdout a cryptographically authenticated browser
origin. Cleanup is best-effort; failure must never authorize artifact upload.
A potentially malicious runner may forge output and is outside this proof.

Physical Windows Chrome MV3/24 h sleep/hibernate/wake, live authorized two-device
GitHub GraphQL beforeOid/REST, live OAuth/Google Drive uncertain 401/403/429 and
lost-ACK, and an external independent nonrollbackable monotonic witness are
**NOT_RUN**. Cross-provider exactly-once and rollback/equivocation resistance
are **NOT_PROVEN**. Readiness 79/100, PC_TEST_CANDIDATE / PRODUCTION_NO_GO.
No main merge, deploy, live cloud mutation, or unauthorized DeepSeek Free UI.
