#!/usr/bin/env python3
"""Deterministic tracked-source and unpacked-Chrome ZIP evidence, CI only.

Never uses secrets, provider tokens, the DeepSeek web UI, or a live Chrome profile.
The generated archives are test candidates, not release approvals.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import zipfile


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])


def collect() -> list[tuple[str, bytes, int, str]]:
    result = []
    for item in git("ls-files", "--stage", "-z").split(b"\x00"):
        if not item:
            continue
        meta, raw_path = item.split(b"\t", 1)
        mode, expected_blob, stage = meta.decode("ascii").split()
        if stage != "0" or mode not in ("100644", "100755"):
            raise RuntimeError("Unsupported Git index stage or file mode")
        name = os.fsdecode(raw_path)
        pp = PurePosixPath(name)
        if pp.is_absolute() or ".." in pp.parts or not pp.parts or "\\" in name:
            raise RuntimeError("Unsafe tracked path")
        contents = Path(name).read_bytes()
        actual_blob = hashlib.sha1(
            b"blob " + str(len(contents)).encode("ascii") + b"\x00" + contents
        ).hexdigest()
        if actual_blob != expected_blob:
            raise RuntimeError("Git index/worktree blob mismatch: " + name)
        result.append((name, contents, int(mode, 8), actual_blob))
    if len(result) < 100 or not any(name == "extension/manifest.json" for name, *_ in result):
        raise RuntimeError("Incomplete or invalid Git source tree")
    return sorted(result, key=lambda x: x[0])


def make_zip(target: Path, entries: list[tuple[str, bytes, int, str]], chrome: bool) -> list[str]:
    names = []
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, contents, mode, _ in entries:
            if chrome:
                if not name.startswith("extension/"):
                    continue
                zip_name = name[len("extension/"):]
            else:
                zip_name = name
            info = zipfile.ZipInfo(zip_name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = ((0o100755 if mode & 0o111 else 0o100644) << 16)
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, contents, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            names.append(zip_name)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None or archive.namelist() != names:
            raise RuntimeError("ZIP CRC/member-order verification failed")
        for name, contents, _, _ in entries:
            key = name[len("extension/"):] if chrome and name.startswith("extension/") else name
            if chrome and not name.startswith("extension/"):
                continue
            if archive.read(key) != contents:
                raise RuntimeError("ZIP member differs from Git tracked bytes: " + name)
    return names


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True, type=Path)
    ap.add_argument("--tur", required=True, choices=["TUR026", "TUR027", "TUR028", "TUR029"],
                    help="Exact independently verified round ID; never silently relabel an archive.")
    args = ap.parse_args()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    entries = collect()
    source = out_dir / f"EMBASIC_TheDeepSeeker_{args.tur}_Source.zip"
    chrome = out_dir / f"EMBASIC_TheDeepSeeker_{args.tur}_Chrome_MV3.zip"
    source_names = make_zip(source, entries, chrome=False)
    chrome_names = make_zip(chrome, entries, chrome=True)
    if "manifest.json" not in chrome_names or "background.js" not in chrome_names:
        raise RuntimeError("Chrome archive missing required MV3 entrypoint")
    manifest = json.loads((Path("extension") / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3 or manifest.get("version") != "1.18.0":
        raise RuntimeError("Unexpected Chrome manifest identity/version")
    head = git("rev-parse", "HEAD").decode().strip()
    provenance = {
        "tur": args.tur,
        "head": head,
        "manifestVersion": manifest["version"],
        "sourceCount": len(source_names),
        "chromeCount": len(chrome_names),
        "files": [{"path": p, "gitBlobSha1": sha, "bytes": len(b)}
                  for p, b, _, sha in entries],
        "note": "CI-only, no live MV3/provider/Windows acceptance",
    }
    (out_dir / "GitHub_tracked_blob_provenance.json").write_text(
        json.dumps(provenance, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    receipts = []
    for archive in (source, chrome):
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        receipts.append(f"{digest}  {archive.name}")
        print(f"PASS {archive.name}: {archive.stat().st_size} bytes SHA256={digest}")
    (out_dir / "SHA256SUMS.txt").write_text("\n".join(receipts) + "\n", encoding="ascii")
    print(f"PASS source={len(source_names)} Git blob exact; chrome={len(chrome_names)} exact; CRC PASS")
    print("NOT_RUN real Chrome MV3/Windows 24h/GitHub GraphQL mutation/OAuth/Drive/external witness")


if __name__ == "__main__":
    main()
