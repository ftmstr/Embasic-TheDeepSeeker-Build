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

# TUR035: real-Git staged index must not masquerade as committed HEAD.
import os
import subprocess
import tempfile


def _git(*args):
    subprocess.run(["git", *args], check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.PIPE)


with tempfile.TemporaryDirectory(prefix="embasic-head-tree-") as temp:
    old_cwd = os.getcwd()
    try:
        os.chdir(temp)
        _git("init", "-q")
        _git("config", "user.email", "tur035@example.invalid")
        _git("config", "user.name", "TUR035 Synthetic")
        with open("tracked.txt", "w", encoding="utf-8") as fp:
            fp.write("baseline\n")
        _git("add", "tracked.txt")
        _git("commit", "-q", "-m", "synthetic baseline")
        module.require_index_matches_head()  # committed clean index accepted
        with open("tracked.txt", "a", encoding="utf-8") as fp:
            fp.write("staged but not committed\n")
        _git("add", "tracked.txt")
        try:
            module.require_index_matches_head()
        except RuntimeError as exc:
            assert "index tree differs from HEAD" in str(exc)
        else:
            raise AssertionError("staged tracked edit accepted as committed HEAD")
        _git("reset", "-q", "--hard", "HEAD")
        with open("new-staged.txt", "w", encoding="utf-8") as fp:
            fp.write("new staged file\n")
        _git("add", "new-staged.txt")
        try:
            module.require_index_matches_head()
        except RuntimeError:
            pass
        else:
            raise AssertionError("staged new file accepted as committed HEAD")
        _git("reset", "-q", "--hard", "HEAD")
        _git("rm", "-q", "tracked.txt")
        try:
            module.require_index_matches_head()
        except RuntimeError:
            pass
        else:
            raise AssertionError("staged deletion accepted as committed HEAD")
        _git("reset", "-q", "--hard", "HEAD")
        module.require_index_matches_head()  # restored HEAD accepted
    finally:
        os.chdir(old_cwd)
print("PASS TUR035 real-Git HEAD/index tree: 2 clean accepted; staged edit/add/delete denied")
