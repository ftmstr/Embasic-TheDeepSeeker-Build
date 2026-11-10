# TUR025 — Windows / Chrome MV3 Physical Acceptance (NOT_RUN)

**Status:** NOT_RUN in development container. Carry out only on authorized Windows 10/11 test PC with test credentials. No DeepSeek Free webpage automation.

1. Independently check `sha256sum` or `Get-FileHash -Algorithm SHA256` on Chrome/source ZIPs against delivered SHA manifest; unzip Chrome ZIP to a dedicated empty directory and load as `chrome://extensions` > Developer Mode > Load Unpacked. Do not select Source ZIP.
2. Inspect extension ID, manifest version `1.18.0`, permissions/host permissions; verify no added DOM/scripting/webRequest permission.
3. Run `powershell -ExecutionPolicy Bypass -File tools/test-windows.ps1` from Source root; all **84 Node** tests + structural + mocked UI should pass. Mocked UI is NOT genuine extension service worker acceptance.
4. With real Chrome and an isolated test profile, run `powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1`, inspect genuine `chrome-extension://` service worker via chrome://extensions and `chrome://serviceworker-internals` if available. Record worker ID, service worker lifecycle, Web Locks availability and alarm wakeups. Any launch error, missing worker or timeout is FAIL/NOT_RUN, never PASS.
5. Test user-triggered encrypted vault unlock/lock, browser kill/restart, two extension pages competing for same-origin Web Locks, alarm after short sleep and again after 24-hour sleep. Record actual clock times/screenshots/log SHA; no synthetic acceptance substitutions.
6. *Experimental GraphQL CAS*: use separate authorized test repository/branch and two distinct test client tokens with least privileges, confirm official `updateRefs` `beforeOid` semantics and permission denial under forced conflicting ref writes. Never run against production/main or without explicit authorization. Current dev release does not expose this mutation through UI and its PoC is not wired into background.js.
7. *Witness test*: requires independent trusted monotonic service and signed freshness/anti-equivocation protocol; no such endpoint is deployed. Keep `NOT_RUN` until one exists.
8. Verify explicit OAuth denial 401/403, rate limit 429/Retry-After, Drive uncertain POST and GitHub missing ACK on authorized test assets, without replay or writes outside scoped folders. Never put secrets in reports.

Final acceptance spreadsheet (manual): Real Windows MV3 **NOT_RUN**; 24-hour sleep/wake **NOT_RUN**; live OAuth/Drive/GitHub/GraphQL **NOT_RUN**; external witness **NOT_RUN**. **PRODUCTION_NO_GO** until all release gates have verifiable evidence.
