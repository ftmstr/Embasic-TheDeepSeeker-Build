"""Deterministic offline packaging for EMBASIC TheDeepSeeker v1.18 TUR025.
No access tokens, user data, remote scripts, or user account API calls.
"""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED,ZipInfo
import hashlib,json
root=Path(__file__).resolve().parents[1]
out=Path('/mnt/data')
chrome=out/'EMBASIC_TheDeepSeeker_TUR025_v1.18.0_Chrome.zip'
source=out/'EMBASIC_TheDeepSeeker_TUR025_v1.18.0_Source.zip'
allow_ext=['manifest.json','background.js','remote-claim.js','rollback-witness.js','conditional-ref-cas.js','dashboard.html','dashboard.js','backup-crypto.js','popup.html','popup.js','styles.css',
           'icon-16.png','icon-32.png','icon-48.png','icon-128.png']
manifest=json.loads((root/'extension/manifest.json').read_text(encoding='utf-8'))
assert manifest['version']=='1.18.0'
for name in allow_ext:assert (root/'extension'/name).is_file(),name

def write_zip(path,items):
    with ZipFile(path,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
        for arc,src in sorted(items):
            data=Path(src).read_bytes();info=ZipInfo(arc,date_time=(2026,11,10,12,0,0))
            info.compress_type=ZIP_DEFLATED;info.external_attr=0o644<<16
            z.writestr(info,data,compress_type=ZIP_DEFLATED,compresslevel=9)

write_zip(chrome,[(f,root/'extension'/f) for f in allow_ext]+[('README_KURULUM.md',root/'README.md')])
files=[]
for folder in ('extension','tests','docs','tools','.github'):
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and not p.name.startswith('.') and p.suffix!='.pyc')
files.extend([root/'README.md',root/'LICENSE',root/'.gitignore'])
write_zip(source,[(p.relative_to(root).as_posix(),p) for p in files])
with ZipFile(chrome) as z:
    assert z.testzip() is None
    assert 'manifest.json' in z.namelist()
    assert 'extension/manifest.json' not in z.namelist()
    assert all(not f.endswith('.token') for f in z.namelist())
with ZipFile(source) as z:
    assert z.testzip() is None
    assert 'extension/manifest.json' in z.namelist()
    assert 'LICENSE' in z.namelist() and '.gitignore' in z.namelist()
    assert '.github/workflows/ci.yml' in z.namelist()
    assert 'extension/conditional-ref-cas.js' in z.namelist()
    assert 'tests/test-state-vault.cjs' in z.namelist()
    assert 'tests/test-idempotence.cjs' in z.namelist()
    assert 'tests/test-tur004-vault.cjs' in z.namelist()
    assert 'tests/test-tur004-cloud.cjs' in z.namelist()
    assert 'tests/test-tur004-scheduler.cjs' in z.namelist()
    for new_test in ('test-tur025-conditional-cas-two-writers.cjs','test-tur025-conditional-cas-ack.cjs','test-tur025-conditional-cas-negative.cjs','test-tur025-witness-replay-limit.cjs','test-tur017-claim-two-clients.cjs','test-tur017-claim-lost-ack.cjs','test-tur017-claim-identity-and-fence.cjs','test-tur017-claim-no-write-without-journal.cjs','test-tur017-witness-cryptographic.cjs','test-tur017-backup-restore-fence.cjs','test-tur017-drive-cross-profile-limit.cjs','test-tur016-cross-context-locks.cjs','test-tur016-web-lock-unavailable.cjs','test-tur016-cross-worker-drive-wal.cjs','test-tur016-oauth-statuses.cjs','test-tur016-github-branch-ack.cjs','test-tur016-rollback-limit.cjs','test-tur015-cross-worker-stale.cjs','test-tur015-seal-clobber.cjs','test-tur015-recovery-replay.cjs','test-tur015-folder-global-intent.cjs','test-tur015-google-connect-readonly.cjs','test-tur015-mv3-restart.cjs','test-tur015-invalid-journal.cjs','test-tur014-branch-ack.cjs','test-tur014-branch-cas.cjs','test-tur014-drive-write-ahead.cjs','test-tur014-journal-crash.cjs','test-tur014-vault-rollback.cjs','test-tur014-github-head-advance.cjs','test-tur014-oauth-write-ahead.cjs', 'test-tur013-github-ack.cjs','test-tur013-github-journal.cjs','test-tur013-github-vault.cjs','test-tur013-github-lease.cjs','test-tur005-vault.cjs','test-tur005-leases.cjs','test-tur005-cloud.cjs','test-tur005-diagnostics.cjs','test-tur005-oauth.cjs', 'test-tur006-fence.cjs','test-tur006-lease-guard.cjs','test-tur006-oauth.cjs','test-tur006-scheduler.cjs', 'test-tur007-context-race.cjs','test-tur007-late-ack.cjs','test-tur007-vault-crash.cjs','test-tur007-drive-ownership.cjs', 'test-tur008-commit-fence.cjs','test-tur008-oauth-write.cjs','test-tur008-drive-parent.cjs','test-tur008-secret-redaction.cjs','test-tur008-upload-receipt.cjs', 'test-tur009-startup.cjs','test-tur009-revision-fence.cjs','test-tur009-drive-metadata.cjs','test-tur009-throttle.cjs','test-tur009-shared-folder-lease.cjs', 'test-tur010-github-visibility.cjs','test-tur010-drive-readback.cjs','test-tur010-oauth-policy.cjs','test-tur010-vault-lock.cjs','test-tur010-drive-eventual.cjs', 'test-tur011-drive-uncertain-upload.cjs','test-tur011-drive-uncertain-folder.cjs','test-tur011-media-404.cjs', 'test-tur011-vault-uncertainty.cjs','test-tur011-malformed-folder.cjs'):
        assert 'tests/'+new_test in z.namelist()
checksums=out/'EMBASIC_TheDeepSeeker_TUR025_v1.18.0_SHA256.txt'
checksums.write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in (chrome,source)),encoding='utf-8')
print('CHROME',chrome,chrome.stat().st_size,'bytes')
print('SOURCE',source,source.stat().st_size,'bytes')
print('SHA',checksums)
