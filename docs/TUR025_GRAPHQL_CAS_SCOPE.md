# TUR025 — GitHub GraphQL beforeOid CAS: security / failure contract

**Status:** EXPERIMENTAL / NOT WIRED / PRODUCTION_NO_GO. Written 2026-11-10.

## Official capability and exact scope

GitHub GraphQL documents `updateRefs(input: UpdateRefsInput!)` with one or multiple `RefUpdate`s. Each update may supply `beforeOid` and `afterOid`. A `beforeOid` mismatch is intended to reject the update, and updates *within a single mutation* are documented as atomic. `force:false` additionally forbids non-fast-forward updates; it is NOT by itself a compare-and-swap precondition. See https://docs.github.com/en/graphql/reference/git .

The `extension/conditional-ref-cas.js` proof of concept constructs a *single-ref* `updateRefs` mutation using strictly validated `repositoryId`, fully qualified `refs/heads/embasic-fences/<task>/<run>` name, 40-hex `beforeOid` and `afterOid`, `force:false`, stable `clientMutationId` from nonce and commit, and immutable owner/nonce/report-digest/previous-OID commit message. Missing repository node ID or valid commit objects cause rejection. It does **not** construct real commits or acquire real credentials. It is **not imported** by the active `background.js` or manifest.

The caller must supply a *durable and encrypted* intent journal and live positive lease decision. It persists intent before mutation. Readback checks exact ref name/OID and immutable commit message. Failure, timeouts, malformed GraphQL result or GraphQL `errors` **never** trigger a second mutation; remote read-only reconciliation may identify exactly the intended commit. If ref is unchanged, outcome remains `CAS_UNCERTAIN_NO_REPLAY`. If another OID is present, fail closed (`CAS_CONFLICT`). A matching remote commit without durable local intent is insufficient to assume ownership.

## Tests actually run

- Two independent async writers observe one previous OID before one-winner atomic *mock* GraphQL operation; loser receives synthetic beforeOid mismatch; exactly one mock commit.
- Lost ACK after synthetic server COMMIT: readback verified owner succeeds, then subsequent matching journal read-only reconciliation sends no mutation; stale view blocks retry.
- Forged commit identity fails; denied/stale/exception lease blocks remote GET/mutation; failed journal stops all mutations; fake successful GraphQL 200 without ref movement fails.
- A correctly signed ECDSA witness and old valid AES-GCM ciphertext can be replayed together. Without an independently fresh monotonic witness, rollback is **NOT DETECTED**. Negative test only, not security guarantee.
- Existing regression suite continues OAuth 401/403/429 and multi-profile Drive WAL model tests; these are **mock-only**, not production provider acceptance.

## Explicitly NOT proven / excluded

1. No real GitHub GraphQL mutation was executed. Real GitHub access scope, endpoint rate limits, permissions, error schema, and two-account race remain **NOT_RUN**.
2. CAS applies to one exact Git ref when the provider honors beforeOid. A subsequent independent REST `PATCH/PUT`, branch delete/recreate, admin operation, or retargeting after success can invalidate a local ownership inference. CAS is not a renewable lease, nor an independent permanent fence against all later mutations.
3. GitHub ref mutation does not atomically commit a Google Drive POST, OAuth token operation, Chrome storage write or any external transaction. Cross-provider exactly-once is **NOT_PROVEN**.
4. Chrome Web Locks only coordinates same-origin clients in one browser storage context; separate Chrome profiles/devices do not share it. Local encrypted journals are not distributed CAS.
5. A signed ECDSA witness proves signer authenticity, not freshness. Valid old signed witness and valid old ciphertext can be replayed together unless the remote witness service maintains a tamper-resistant latest generation with authenticated freshness/availability/anti-equivocation. No such real service was deployed; **NOT_RUN**.
6. Physical Windows Chrome MV3, overnight sleep/resume, live GitHub GraphQL/Drive/OAuth and external monotonic witness **NOT_RUN**. Synthetic/HTML mock Chromium test is not genuine MV3 acceptance.
7. No DeepSeek Free web automation, DOM scraping, silent prompting or service restriction bypass.

**Release gate:** keep `PRODUCTION_NO_GO`, do not wire PoC into production synchronization without new live provider authorization, dedicated branch isolation, real independent client CAS acceptance, bounded privilege, recovery, rollback witness and explicit user approval.
