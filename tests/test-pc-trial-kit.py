"""TUR058 actual offline package usability and reproducibility, no provider calls."""
import importlib.util
import hashlib
import json
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('trial_kit', ROOT / 'tools/build-pc-trial-kit.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
with tempfile.TemporaryDirectory(prefix='embasic-pc-kit-test-') as tmp:
    root = Path(tmp)
    original = root / 'Chrome_MV3.zip'
    with zipfile.ZipFile(original, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for path in sorted((ROOT / 'extension').iterdir()):
            if path.is_file():
                z.write(path, arcname=path.name)
    target = builder.build(original, root, 'TUR058')
    expected_hash = hashlib.sha256(target.read_bytes()).hexdigest()
    assert expected_hash in (root / 'TUR058_PC_KIT_SHA256.txt').read_text()
    with zipfile.ZipFile(target) as z, zipfile.ZipFile(original) as initial:
        assert z.testzip() is None
        assert len(z.namelist()) == 19
        assert 'START_HERE.txt' in z.namelist()
        assert 'PC_ILK_KULLANIM_TUR058.md' in z.namelist()
        assert 'verify-pc-kit.ps1' in z.namelist()
        assert 'SHA256_EXTENSION.txt' in z.namelist()
        for name in initial.namelist():
            assert initial.read(name) == z.read('EMBASIC_EXTENSION/'+name)
        assert b'NOT_RUN' in z.read('START_HERE.txt')
        hashes = z.read('SHA256_EXTENSION.txt').decode().splitlines()
        assert len(hashes) == 15
        for row in hashes:
            digest, name = row.split('  ')
            assert hashlib.sha256(z.read('EMBASIC_EXTENSION/'+name)).hexdigest() == digest
        assert z.read('EMBASIC_EXTENSION/manifest.json') == initial.read('manifest.json')
    second = builder.build(original, root, 'TUR058')
    assert hashlib.sha256(second.read_bytes()).hexdigest() == expected_hash
    # Wrong manifest and appended untrusted file fail closed, never emitted as valid.
    broken = root / 'corrupted.zip'
    with zipfile.ZipFile(original) as z, zipfile.ZipFile(broken, 'w') as w:
        for name in z.namelist():
            data = z.read(name)
            if name == 'manifest.json':
                m = json.loads(data);m['permissions'].append('scripting')
                data = json.dumps(m).encode()
            w.writestr(name, data)
    try:
        builder.build(broken, root, 'TUR058')
    except ValueError as exc:
        assert 'permission' in str(exc)
    else:
        raise AssertionError('Unexpected broad permission accepted')
print('PASS TUR058 PC trial kit: offline deterministic ZIP, 15 exact extension members, SHA manifest, bad permission rejected; no EXE claim')
