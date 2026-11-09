import json, pathlib, re
from html.parser import HTMLParser
root=pathlib.Path(__file__).resolve().parent.parent/'extension'
manifest=json.loads((root/'manifest.json').read_text())
assert manifest['manifest_version']==3
assert manifest['version']=='1.13.0'
assert not any(x in manifest['permissions'] for x in ('scripting','cookies','webRequest','debugger'))
assert all(x in ('https://api.github.com/*','https://www.googleapis.com/*') for x in manifest['host_permissions'])
for path in ('background.js','dashboard.html','dashboard.js','backup-crypto.js','styles.css','popup.html','popup.js'):
    assert (root/path).is_file()
for path in manifest['icons'].values():
    assert (root/path).is_file()
class IdParser(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=set()
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d: self.ids.add(d['id'])
for prefix in ('dashboard','popup'):
    p=IdParser();p.feed((root/f'{prefix}.html').read_text())
    code=(root/f'{prefix}.js').read_text()
    required=set(re.findall(r"(?:\$\(|getElementById\()'([^']+)'",code))
    missing=required-p.ids
    assert not missing, (prefix,missing)
assert (root.parent/'tools/test-mv3-windows.ps1').is_file()
assert 'EMBASIC_REQUIRE_MV3' in (root.parent/'tools/test-mv3-windows.ps1').read_text()
print('PASS — HTML UI IDs, extension icons, manifest, MV3 Windows acceptance tool and required assets.')
