# TUR027 v1.18.0 — Real-MV3 / distributed-CAS acceptance boundary (NOT_RUN unless observed)

## Source and release labels
Canonical PR #16 builds from exact pull-request HEAD, not GitHub's synthetic merge SHA.
The archive builder now requires an explicit `--tur TUR027` so the tracked-source ZIP,
Chrome MV3 ZIP and internal provenance refer to the same TUR027 commit. Two independent
CI builds must produce identical SHA-256 receipts and provenance. Archive CRC, exact
Git blob SHA-1 per tracked file, and 15 Chrome extension-file byte matches are checked.

## Actual Chrome MV3 acceptance — separated from mocks
`tests/test-ui-smoke.py` is only a DOM/Chromium UI mock and MUST NOT be labeled live MV3.
`tests/test-mv3-extension.py` is the real unpacked-extension probe; it checks Chrome
service-worker identity, alarms, vault creation and lock, schedulerNow idempotence,
true same-origin Web Locks contention across two extension pages, persistent browser
profile restart, encrypted state persistence and session-key expiry.
Run on a physical Windows desktop with Python/Playwright and installed Chrome:
```powershell
powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1
```
Capture Chrome version, source HEAD, console output, exit code, actual worker URL,
Chrome profile isolation, and 24-hour Windows sleep/wake/alarms as separate evidence.
Failure to expose the worker in strict mode is FAIL; inability to run is NOT_RUN.
Linux virtual-Xvfb and headless Chromium do not substitute physical Windows acceptance.
A timeout without assertions is NOT_RUN, not PASS.

## Server-enforced independent-writer acceptance (NOT LIVE)
A unique GitHub branch ref is a create-only claim, NOT a lease fencing future writes.
GitHub GraphQL `updateRefs` with `beforeOid` may conditionally protect its exact
ref update. It does not make unrelated GitHub REST file updates or Drive POST atomic.
A genuine acceptance environment would need two mutually independent identities,
an isolated scratch repository and separate Drive test folder, least-privilege scopes,
encrypted durable intent before any mutation, and explicit user approval before
**every live write**. Collect signed responses and independently fetched commit OIDs.
Ambiguous 2xx/timeout/403/429 or lost ACK must block second mutation until exact
identity/digest/readback reconciliation; stale read or forged COMMIT metadata fails closed.
No such live provider mutation has been run in TUR027.

## Witness fresh monotonicity (NOT LIVE)
`signatureVerified:true` and `authenticated:true` are attacker-forgeable flags if
not produced by a trusted verifier. Owner, vault, nonce, expiry, generation, and digest
binding in `tests/test-tur026-witness-freshness-negative.cjs` remains synthetic. A fully signed old
witness plus old AES-GCM ciphertext can replay unless an independently protected,
fresh, non-rollbackable generation/digest is verified with trusted key and reliable
anti-equivocation. Browser storage and a Chrome profile cannot provide that anchor.
No trusted independent server exists in this acceptance; status NOT_PROVEN.

## Production decision
`PC_TEST_CANDIDATE / PRODUCTION_NO_GO`, engineering weighted readiness **79/100**.
No main merge, no deployment, no automated DeepSeek Free browser chat/DOM scraping.
