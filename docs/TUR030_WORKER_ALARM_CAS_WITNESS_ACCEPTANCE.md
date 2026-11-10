# TUR030 v1.18.0 — Restart/native-alarm continuity and cross-provider CAS/witness safety

**Scope:** Public `ftmstr/Embasic-TheDeepSeeker-Build`, stacked Draft PR after TUR029. Synthetic test data only. `main` merge, production deploy, DeepSeek Free unattended web chat, DOM scraping, and real user/identity/provider mutations are forbidden.

## Genuine Linux Chromium MV3 (distinct from UI mock)

`tests/test-mv3-extension.py` has a new opt-in `EMBASIC_TUR030_RESTART_ALARM=1` test that depends on the previous TUR029 two-profile and genuine Chrome native-alarm checks. In an isolated disposable persistent profile it:

1. Captures a scheduler checkpoint **after native `chrome.alarms` dispatch** and the sole pending run identifier.
2. Closes and relaunches the **actual Chromium browser** with the same persistent profile, so the in-memory MV3 worker and session key cannot be carried across the restart.
3. Requires the encrypted vault to be sealed/locked, refuses a locked snapshot, then explicitly unlocks the disposable vault.
4. Requires the pre-restart encrypted checkpoint not to regress, the periodic native alarm to remain registered, and the sole pending run to retain its identity.
5. Schedules and observes a **second actual `chrome.alarms` dispatch after restart**, requires the persisted checkpoint to advance, verifies the unique pending run and zero live/stale or uncertain cloud lease indicators.

GitHub Actions uses a **separate genuine MV3 probe** from mocked dashboard UI. A CI pass for the MV3 acceptance is only claimed when the log includes all the actual PASS markers for worker, TUR029 profiles/native alarm and TUR030 restart/native alarm. Unavailable extension environment/timeouts are explicitly **NOT_RUN**, not PASS; real assertion failures are **FAIL**. A successful Linux headless probe is *not* equivalent to physical Windows Chrome or 24-hour actual suspend/wake.

## Independent real loopback HTTP — synthetic provider only

`tests/test-tur030-cross-provider-http-negative.cjs` opens a real local TCP/HTTP server for **both** synthetic GraphQL ref CAS and synthetic Drive multipart upload. Both profiles can own **different GitHub refs** with `beforeOid` conditional mutation, verified owner-bound commit readback, and durable intent. No shared global fence follows from this. The two profiles then issue a Drive upload for **the same content digest**; the synthetic server commits each upload but returns HTTP 503 after COMMIT. Exactly two uploads remain, even though each profile's local WAL blocks its own second attempt. A third profile has no WAL and cannot infer the remote outcome. A wrong parent is rejected by the mock. This is intentionally a **negative** result about cross-provider exactly-once; it is not evidence about live GitHub or Google Drive behavior.

`tests/test-tur030-witness-trust-boundary.cjs` uses real P-256 ECDSA signatures to exercise signed, owner/vault/digest/generation/nonce/expiry/key-pin receipts. It demonstrates that **an authentic signed old receipt** can still authenticate a rolled-back snapshot if the application also rolls back its expected generation. The contract cannot be trusted without a protected, independent, fresh nonrollbackable monotonic authority. No trusted external witness exists or was contacted in this round.

## Acceptance / NO-GO gates

- Physical Windows Chrome MV3, real suspend/wake over 24 hours, user-profile/device concurrency and OS wakeup timing: **NOT_RUN**.
- Live user-authorized GitHub GraphQL `updateRefs(beforeOid)`/readback, real Google Drive/OAuth 401/403/429 and independent cross-provider lease/commit: **NOT_RUN**.
- Externally hosted, independently keyed monotonic signing service, key rotation, nonrollbackable state, equivocation/replay rejection: **NOT_RUN / NOT_PROVEN**.
- Experimental `extension/conditional-ref-cas.js` and `extension/rollback-witness.js` remain **NOT WIRED** to actual cloud uploads. No cross-provider atomicity, exactly-once, or monotonic anti-rollback certification may be inferred from tests.
- Source/Chrome archives must be built from **exact canonical Draft PR head** (not synthetic PR merge), checked against every tracked Git blob and ZIP CRC, built twice for deterministic SHA-256, then uploaded and **full raw SHA-256 read back** from Drive. Never label delivered unless real CI jobs and matching artifact evidence exist.

**Engineering readiness stays 79/100; `PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.**
