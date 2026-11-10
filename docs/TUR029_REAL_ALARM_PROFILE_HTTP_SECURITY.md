# TUR029 v1.18.0 — real Chrome alarm/profile acceptance and independent HTTP adversarial boundary

## Scope and trust: CI evidence is not production authorization

1. New native-Chrome Playwright acceptance in `tests/test-mv3-extension.py` under `EMBASIC_TUR029_PROFILE_PROBE=1` opens **two truly independent persistent Chromium profiles** (two separate browser processes/storage). The second profile must NOT contain the first profile’s encrypted vault; identical Web Locks names can be held simultaneously in the different profiles. This is **negative** proof that browser Web Locks do not furnish cross-profile/distributed fencing.
2. `EMBASIC_TUR029_NATIVE_ALARM=1` programs real `chrome.alarms` for `embasic-scheduler` (temporary synthetic Chrome profile only), waits for the **actual native alarm** to advance the encrypted scheduler checkpoint, and rejects duplicate or unexpected waiting runs and uncertain upload flags. This is distinct from manual `schedulerNow` and from mock UI. CI allows 70s for possible Chrome >=30s alarm floor; overall probe timeout 160s. Genuine worker, two profiles and native alarm each require their own explicit PASS. If no worker can be launched, returns **NOT_RUN** and is not counted as acceptance. If worker is available but assertions fail, **FAIL**. A CI timeout is **NOT_RUN**, not PASS; a Windows desktop/24h suspend still **NOT_RUN**.
3. New `tests/test-tur029-http-cas-ambiguity.cjs` starts an ephemeral **127.0.0.1 Node HTTP server**, exercising true socket requests with two independent local clients and locally emulated conditional GraphQL updateRefs (`beforeOid`, `force:false`). Single mock winner despite **post-COMMIT HTTP 503**, no replay on readback/404 gap, identical owner-bound immutable commit check, and permanent uncertainty after HTTP 429 precommit. The server is **not GitHub**; none of this establishes live GitHub GraphQL CAS, multi-provider transaction, or cross-device lease.
4. Google Drive 401/403/429 and POST ACK reconciliation remain separate existing synthetic tests. A first account's local encrypted WAL is not accessible to another Chrome profile. Exactly-once, Drive provider-side idempotency, cross-provider atomicity and genuine Google OAuth acceptance remain **NOT_PROVEN**.
5. TUR027/028 ECDSA replay negatives preserved: authentic signed old witness plus valid old AES-GCM ciphertext can be replayed absent an independent fresh nonrollbackable generation/digest oracle. No such oracle, trusted key rotation or independent monotonic service has been deployed or tested: **NOT_RUN / NO-GO**.

## Required true acceptance after this round

- Physical Windows Chrome >=120 real MV3 worker, 24h active+suspend/wake, locked vault, broken network, consent revocation, restart/clock-skew, native alarm and scheduler uniqueness: **NOT_RUN**.
- Two distinct authorized accounts/devices with server-enforced GraphQL beforeOid and saved provider readbacks; Drive independent folder/WAL cross-profile POST ACK under 401/403/429; external independently authenticated monotonic freshness witness: **NOT_RUN**. Require explicit approval before any live mutations and dedicated disposable test resources.
- Never merge `main`, deploy production, scrape/automate DeepSeek Free web chat, or claim that test mocks prove safety.
- Keep weighted engineering readiness **79/100**, `PC_TEST_CANDIDATE / PRODUCTION_NO_GO` until truly independent acceptance.

## Reproducible packaging

`python tools/build-release-artifacts.py --tur TUR029 --out-dir <directory>` on exact verified PR HEAD, twice. Verify tracked Git blobs/ZIP CRC/15 Chrome bytes, sha256sum receipts and Google Drive full raw readback. CI packages exact PR HEAD rather than synthetic merge; new archive names TUR029.
