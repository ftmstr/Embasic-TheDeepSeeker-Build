# TUR032 — Native MV3 locked restart, delayed HTTP COMMIT and equivocation adversarial acceptance

**Only Public repository:** `ftmstr/Embasic-TheDeepSeeker-Build`. This is an additional test/acceptance turn stacked on TUR031 Draft PR #20, no merged main, deployment, privileged authorization changes, or unattended DeepSeek Free browser automation. Synthetic data ONLY.

## Real Linux Chromium MV3 — NOT physical Windows

The extension in `tests/test-mv3-extension.py` is unpacked into a REAL persistent Chromium browser, not mocked. The third full **process restart** occurs **after** native TUR031 locked/alarm and unlocked/alarm acceptance; before shutdown the vault is deliberately sealed. After reopening the same disposable Chrome profile, both `chrome.storage.session` ephemeral key and protected `snapshot` must be unavailable; encrypted ciphertext must be byte-identical. An actual `chrome.alarms.onAlarm` event is observed while the profile remains sealed, after which ciphertext and decrypted persisted scheduler checkpoint must remain unchanged. After explicit unlock, a second native alarm must advance the checkpoint, preserving the same single waiting run, no stale/live leases and no uncertain GitHub/Drive commits. CI reports `PASS` only upon explicit all-stage TUR029/TUR030/TUR031/TUR032 genuine worker markers; `NOT_RUN` on missing worker or global timeout; real assertions `FAIL`. The Linux experiment is **not** the Windows 10/11 desktop or 24h actual suspend/resume test (NOT_RUN).

## Synthetic network test on real localhost TCP

`tests/test-tur032-delayed-commit-http.cjs`: two independently journaled client profiles. A synthetic provider reads a genuine loopback HTTP POST then drops the socket **before performing COMMIT**. While the remote ref still shows old OID, repeated API mutation is forbidden. An adversarial delayed server COMMIT subsequently advances to the exact owner-bound OID; a fresh ref + immutable commit readback recovers without a second POST. A different profile/owner cannot adopt or overwrite the ref. Forged same-OID immutable owner metadata is rejected. This is **not** a live GitHub GraphQL/Google Drive test.

`tests/test-tur032-witness-equivocation-negative.cjs`: genuine ECDSA P-256 signatures can validate separately in independent local clients with the **same generation but conflicting report digests**. Cross-profile aggregation detects conflict, but not globally before either accepted the forged/equivocating signer. Authentication and local caller-owned freshness do **not** provide server-authenticated, independent nonrollbackable generation or anti-equivocation. No trusted external witness service exists: NOT_RUN / PRODUCTION_NO_GO.

Prior TUR032 test in `test-tur025-conditional-cas-negative.cjs` retains fake GraphQL ACK, immutable commit owner mismatch, post-intent uncertain no-replay, and changed owner nonce failures.

## Remaining production gates

- Physical Windows Chrome real MV3, 24h sleep/wake and manual verification: **NOT_RUN**.
- Real independent authorized multi-device GitHub GraphQL `beforeOid`/REST race; Google OAuth/Drive 401/403/429/lost POST ACK/idempotency: **NOT_RUN / NOT_PROVEN**.
- Global cross-provider exactly-once and externally authenticated monotonic witness key rotation/anti-equivocation: **NOT_PROVEN**. Experimental CAS/witness remain NOT WIRED into production cloud uploads.
- No main merge, production deploy, account automation or DeepSeek Free unattended web messages.

**Weighted readiness remains 79/100. `PC_TEST_CANDIDATE / PRODUCTION_NO_GO`.**

A complete round needs real canonical HEAD 4/4 CI including genuine worker logs; deterministic SOURCE/Chrome ZIP at exact SHA with SHA256/CRC and 100% Git tracked blob identity; full raw Google Drive readback; separate report files; and historical ledger update.
