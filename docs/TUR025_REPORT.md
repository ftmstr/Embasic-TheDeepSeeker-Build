# EMBASIC TheDeepSeeker TUR025 — Technical / Security Development Report

**Date:** 2026-11-10, Türkiye. **Canonical source:** Public `ftmstr/Embasic-TheDeepSeeker-Build`, stacked from TUR024 Draft PR #13 HEAD `7dfe40caa19b17485d1951695dd01419ae2099f5`.

**Chrome version:** `1.18.0` (manifest). **Release:** `PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.

## Scope

- New **experimental** `extension/conditional-ref-cas.js` for official GraphQL `updateRefs` `beforeOid` (expected old ref OID). A single conditional update is used in mocks; module never runs automatically and is not wired to `background.js` or production GitHub/Drive uploads.
- Validated exact repository node ID / fully qualified ref / 40 hex OIDs / 64 hex digest / owner nonce, immutable commit message binding, positive live lease checks, durable encrypted journal before mutation and readback after every uncertain result. No automatic GraphQL resubmission.
- Adversarial suites for independent two-writer race (one winner), COMMIT/ACK loss, stale previous intent, owner/commit forgery, lease failure, failed journal, GraphQL fake 200, and signed-witness *replay weakness*. This proves **mock protocol behavior only**, not real provider enforcement.
- Manifest/package/test/Windows runner counts updated for v1.18.0 and 84 Node tests. Source ZIP includes docs and test code; Chrome ZIP includes new experimental module but manifest/background do NOT activate it.

## Validation / explicit limitation

- 84 Node.js tests, package/manifest and *simulated Chromium UI*: **86/86 local PASS**. Real Linux unpacked Chrome service worker probe: `NOT_RUN` (environment could not expose worker); actual physical Windows, 24h sleep/awake, official GitHub GraphQL mutations, two real independent profiles, live OAuth/Drive/GitHub API, external signed witness: **NOT_RUN**.
- Existing 401/403/429 Drive/OAuth and first-writer-wins claim tests preserved. No live credentials, no production cloud provider writes.
- GraphQL `beforeOid` docs support atomic compare for an individual Git reference (and updates within the same mutation). This is not a global GitHub/Drive transaction or a future-REST-writes fence. In particular, an ordinary GitHub REST `force:false` does not prove expected-old-OID CAS.
- Valid old signed witness and valid old AES-GCM ciphertext can be replayed together without trusted fresh monotonic oracle. A synthetic negative test demonstrates the limit and is not a working anti-rollback defense.
- No `main` merge, cloud deploy or unauthorized DeepSeek Free web automation.

**Evidence fields for final upload:** new GitHub SHA / Draft PR / verified GitHub CI job IDs / Git blob SHA parity / Source and Chrome SHA256 plus Drive raw byte readback / central ILERLEME_DURUMU.md update are added only after real provider writes succeed.
