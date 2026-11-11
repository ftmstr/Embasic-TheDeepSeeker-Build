"""TUR034 fail-closed archive identity regressions (no provider/network access)."""
import importlib.util
from pathlib import Path

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("release_builder", root / "tools/build-release-artifacts.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

accepted = [("TUR034", "tur034/provenance-identity-guard"),
            ("TUR105", "tur105/future-unique-round")]
rejected = [("TUR034", "tur033/stale-ci-label"),
            ("TUR033", "tur034/mismatched-newer-branch"),
            ("TUR034", "main"),
            ("TUR034", "tur034/"),
            ("TUR034", "tur034/fake\nbranch"),
            ("TUR34", "tur34/short-round"),
            ("TUR025", "tur025/old"),
            ("TUR034", "tur034x/wrong-prefix")]
for tur, branch in accepted:
    module.verify_round_identity(tur, branch)
for tur, branch in rejected:
    try:
        module.verify_round_identity(tur, branch)
    except RuntimeError:
        continue
    raise AssertionError(f"Accepted forged or stale TUR identity: {tur} {branch!r}")

workflow = (root / ".github/workflows/ci.yml").read_text(encoding="utf-8")
assert 'steps.turn.outputs.tur' in workflow
assert '--branch "$BRANCH"' in workflow
assert 'name: tur032-v1.18.0-source-chrome-sha-gitblobs' not in workflow
assert 'name: tur032-linux-real-mv3-locked-restart-evidence' not in workflow
print(f"PASS TUR034 archive label identity: {len(accepted)} allowed, {len(rejected)} denied; dynamic CI evidence names")
