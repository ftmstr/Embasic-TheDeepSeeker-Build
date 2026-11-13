#!/usr/bin/env python3
"""TUR058: reproducible *manual Chrome unpacked* PC trial kit, not EXE/prod.

Input MUST be the original CI Chrome ZIP produced from exact Git tracked bytes.
No network, provider token, installation, browser automation or live mutation.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXED_DATE = (1980, 1, 1, 0, 0, 0)


def blob(path: Path) -> bytes:
    return path.read_bytes()


def sha256(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def build(chrome_zip: Path, out_dir: Path, tur: str = 'TUR058') -> Path:
    if not re.fullmatch(r'TUR[0-9]{3,}', tur):
        raise ValueError('Invalid TUR identity')
    out_dir.mkdir(parents=True, exist_ok=True)
    contents = {}
    with zipfile.ZipFile(chrome_zip) as original:
        if original.testzip() is not None:
            raise ValueError('Original Chrome ZIP CRC failed')
        names = original.namelist()
        if len(names) != 15 or len(set(names)) != 15:
            raise ValueError('Expected exactly 15 original Chrome files')
        for name in names:
            if not re.fullmatch(r'[a-zA-Z0-9_.-]+', name) or name in ('.','..'):
                raise ValueError('Unsafe packaged Chrome member')
            contents[name] = original.read(name)
    manifest = json.loads(contents['manifest.json'].decode('utf-8'))
    if (manifest.get('manifest_version') != 3 or manifest.get('version') != '1.18.0'
            or manifest.get('background', {}).get('service_worker') != 'background.js'
            or manifest.get('action', {}).get('default_popup') != 'popup.html'):
        raise ValueError('Unexpected manifest/entrypoints')
    if set(manifest.get('host_permissions', [])) != {
        'https://api.github.com/*', 'https://www.googleapis.com/*'}:
        raise ValueError('Unexpected host permission change')
    if any(p in manifest.get('permissions', []) for p in ('scripting','webRequest','cookies','debugger')):
        raise ValueError('Unexpected broad permission')
    expected = {'manifest.json','background.js','dashboard.html','dashboard.js',
        'popup.html','popup.js','styles.css','backup-crypto.js','remote-claim.js',
        'rollback-witness.js','conditional-ref-cas.js','icon-16.png','icon-32.png',
        'icon-48.png','icon-128.png'}
    if set(contents) != expected:
        raise ValueError('Missing/unexpected Chrome file')
    # The first PC trial MUST NOT require a configured Google OAuth client.
    client_id = manifest.get('oauth2', {}).get('client_id', '')
    if not client_id.startswith('YOUR_'):
        raise ValueError('This local-only trial expects an unconfigured OAuth placeholder')
    # Keep the shipped text byte-stable if Git's Windows checkout maps LF to CRLF.
    docs = blob(ROOT / 'docs/PC_ILK_KULLANIM_TUR058.md').replace(b'\r\n', b'\n')
    ps1 = blob(ROOT / 'tools/verify-pc-kit.ps1').replace(b'\r\n', b'\n')
    checks = ''.join(f'{sha256(contents[name])}  {name}\n' for name in sorted(contents))
    extras = {
        'START_HERE.txt': (
            'EMBASIC TheDeepSeeker — TUR058 deneysel Chrome PC denemesi\n'
            '1) ZIP dosyasını tamamen klasöre çıkar.\n'
            '2) Chrome: chrome://extensions -> Geliştirici modu -> Paketlenmemiş öğe yükle.\n'
            '3) EMBASIC_EXTENSION klasörünü seç, ZIP dosyasını veya üst klasörü değil.\n'
            '4) Uzantı panelinde güçlü şifreli kasanı oluştur; GitHub/Drive kapalı kalsın.\n'
            '5) PC_ILK_KULLANIM_TUR058.md belgesindeki sentetik yerel örneği uygula.\n'
            'Not: Windows .exe/.msi değildir. Fiziksel Windows Chrome kabulü NOT_RUN.\n'
            'PRODUCTION_NO_GO. DeepSeek sohbetine otomatik mesaj GÖNDERİLMEZ.\n'
        ).encode('utf-8'),
        'PC_ILK_KULLANIM_TUR058.md': docs,
        'verify-pc-kit.ps1': ps1,
        'SHA256_EXTENSION.txt': checks.encode('ascii'),
    }
    target = out_dir / f'EMBASIC_TheDeepSeeker_{tur}_PC_TEST_KIT.zip'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as pack:
        items = {f'EMBASIC_EXTENSION/{name}': value for name, value in contents.items()}
        items.update(extras)
        for name in sorted(items):
            info = zipfile.ZipInfo(name, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            pack.writestr(info, items[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(target) as check:
        if check.testzip() is not None:
            raise ValueError('PC kit ZIP CRC failed')
        for name, value in contents.items():
            if check.read(f'EMBASIC_EXTENSION/{name}') != value:
                raise ValueError('Chrome member mutated inside PC kit')
    receipt = out_dir / f'{tur}_PC_KIT_SHA256.txt'
    receipt.write_text(f'{sha256(target.read_bytes())}  {target.name}\n', encoding='ascii')
    print(f'PASS {tur} trial kit {target.stat().st_size} B SHA256={sha256(target.read_bytes())}; '
          '15/15 original Chrome bytes; no installer, live provider or Windows physical acceptance')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--chrome-zip', required=True, type=Path)
    parser.add_argument('--out-dir', required=True, type=Path)
    parser.add_argument('--tur', default='TUR058')
    options = parser.parse_args()
    build(options.chrome_zip, options.out_dir, options.tur)
