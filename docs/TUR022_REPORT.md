# TUR022 — Preflight lease before remote provider reads (experimental)

**Scope:** TUR021 HEAD `115934559901b98784c74919921cd371dde0a1e0` üzerine stacked Draft PR. `main` merge/deploy yok.

## Security patch
`extension/remote-claim.js` `acquire()` now requires an explicitly `true` lease/fence callback BEFORE any GitHub provider read (including GET ref). Previously `observe()` could issue an unauthorized remote GET under revoked or absent lease, with mutation rejected only after GET. The code still checks lease after observation, after durable intent, and after commit verification. It does **not** implement server-enforced branch PUT CAS or a distributed lease.

## Regression
`tests/test-tur022-no-provider-read-on-denied-lease.cjs`: missing/false/null/0/string lease → zero provider GET/POST, zero journal; a lease revoked inside an authorized GET → no POST. **Mock provider only**. Existing 79 Node tests preserved, now **80 Node groups + package + MOCK UI = 82 local groups**. Strict Windows test-count gate updated, formerly stale at 77. Actual CI pending.

## Open risks
`remote-claim` and ECDSA `rollback-witness` experimental, not linked to application production `githubUpload`/`driveUpload`. GitHub ref first-writer-wins does not fence later GitHub PUT; different Chrome profiles' WAL are disjoint; authenticated old ciphertext rollback cannot be proven without live independent monotonic witness. Live GitHub, Drive, OAuth 401/403/429, real Chrome MV3 worker, physical Windows and 24-hour sleep/wake **NOT_RUN**. DeepSeek Free web auto-chat/scraping not implemented. `PRODUCTION_NO_GO`.
