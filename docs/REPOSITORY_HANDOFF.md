# EMBASIC TheDeepSeeker — GitHub + Google Drive handoff

## Canonical locations

- GitHub: `https://github.com/ftmstr/Embasic-TheDeepSeeker-Build` (Public, GPL-3.0)
- Development branch: `bootstrap/tur012-v1.11.0`. New tours should stack Draft PRs from a verified branch and never silently modify `main`.
- Drive reports: `Uygulama/Embasic TheDeepSeeker/Rapor`, folder ID `12Pn5U54iZZ-xd7Vvm2PcTY97fzWWlRlm`.
- Drive project parent: `13FaO-wpoW1xY00zhgHm-ejFfPMuq1Ugq`; source folder: `1BOx3L61li5c-c-C5EL7gDwJ7QGXfFh5G`.

## Evidence and safeguards

- Baseline: TUR 012 v1.11.0 source ZIP SHA-256 `322a8dcd97cd7701b3c98acb17cb9c6cbf7ab07b6bc55b4ae9abd2a9c0c74761`.
- Chrome ZIP SHA-256 `b1957002dc6220e62638723e0fc57bafd3a6573ebe5cc2bd2e858899edb0da2f`.
- Local baseline: 46 Node.js regressions + 1 structural package test + 1 **mocked** UI smoke = 48 local groups PASS; Windows real MV3, OAuth/Drive, GitHub live **NOT_RUN**.
- Bootstrap changes: updated stale Windows test-count expectation, documented TUR 012 and added GitHub Actions verification workflow. These are not evidence of real Chrome acceptance.
- Chrome extension does **not** automatically send messages to or scrape DeepSeek Free web chat. This remains user controlled.
- Public repository: never commit runtime vault, user task history, real API tokens, credentials, private case material or real Drive backups.
- Source archive deliberately omits historical screenshots (`ui-smoke.png`, `docs/ui-smoke-tur002.png`, `docs/ui-smoke-tur003.png`) to keep repository lightweight. All functional source, tests, docs, extension icons and tools are included.

## Tour closure protocol

1. Re-query GitHub branch, open PRs and latest Drive `Rapor`; do not repeat completed TUR.
2. Verify base SHA and regression tests; develop on one new branch/stacked Draft PR only.
3. Record actual CI/job logs with exact SHA; label real Windows/Chrome or account tests `NOT_RUN` if not executed.
4. Upload a per-TUR Markdown technical report to the exact Drive Rapor folder and read back metadata/content; preserve previous reports.
5. Report results, open blockers and estimated weighted readiness. Never claim exactly-once distributed transaction guarantees or unlimited DeepSeek Free automation.
