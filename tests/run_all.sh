#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for test in test-backup test-core test-isolation test-races-and-limits test-security test-sync test-state-vault test-idempotence test-tur004-vault test-tur004-cloud test-tur004-scheduler test-tur005-vault test-tur005-leases test-tur005-cloud test-tur005-diagnostics test-tur005-oauth test-tur006-fence test-tur006-lease-guard test-tur006-oauth test-tur006-scheduler test-tur007-context-race test-tur007-late-ack test-tur007-vault-crash test-tur007-drive-ownership test-tur008-commit-fence test-tur008-oauth-write test-tur008-drive-parent test-tur008-secret-redaction test-tur008-upload-receipt test-tur009-startup test-tur009-revision-fence test-tur009-drive-metadata test-tur009-throttle test-tur009-shared-folder-lease test-tur010-github-visibility test-tur010-drive-readback test-tur010-oauth-policy test-tur010-vault-lock test-tur010-drive-eventual test-tur011-drive-uncertain-upload test-tur011-drive-uncertain-folder test-tur011-media-404 test-tur011-vault-uncertainty test-tur011-malformed-folder test-tur012-malformed-list test-tur012-malformed-report-list; do
  node "tests/${test}.cjs"
done
python tests/test-package.py
python tests/test-ui-smoke.py
# Independent real-worker probe may return NOT_RUN; its result MUST NOT be called PASS.
python tests/test-mv3-extension.py
