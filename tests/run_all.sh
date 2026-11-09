#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
count=$(find tests -maxdepth 1 -name 'test-*.cjs' | wc -l)
test "$count" -eq 70
for path in tests/test-*.cjs; do node "$path"; done
python tests/test-package.py
python tests/test-ui-smoke.py
# May say NOT_RUN when no genuine unpacked Chrome worker is visible.
# NOT_RUN is not PASS and does not enter the 72 local-group count.
python tests/test-mv3-extension.py
