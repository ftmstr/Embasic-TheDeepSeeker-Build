"""Real unpacked Chrome MV3 acceptance, not a mock.
Environment incapable of exposing worker -> NOT_RUN; genuine assertion failure -> FAIL.
Needs Playwright Chromium/Chrome with unpacked extensions enabled.
Usage: python tests/test-mv3-extension.py
       EMBASIC_HEADLESS=0 EMBASIC_REQUIRE_MV3=1 python tests/test-mv3-extension.py (Windows Chrome acceptance)
Runs only synthetic local data, does not connect to GitHub/Drive/DeepSeek.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse
import os, sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

extension=Path(__file__).resolve().parents[1]/'extension'
chrome_bin=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None)
headless=os.environ.get('EMBASIC_HEADLESS','1')!='0'
strict=os.environ.get('EMBASIC_REQUIRE_MV3','0')=='1'
worker_wait_ms=max(1000,min(20000,int(os.environ.get('EMBASIC_MV3_WAIT_MS','10000'))))

with sync_playwright() as p, TemporaryDirectory() as directory:
    try:
        ctx=p.chromium.launch_persistent_context(
            directory, executable_path=chrome_bin, headless=headless,
            args=['--no-sandbox','--disable-dev-shm-usage',
                  f'--disable-extensions-except={extension}',f'--load-extension={extension}'],
            timeout=18000)
    except Exception as err:
        print(('FAIL' if strict else 'NOT_RUN')+' MV3: Chromium extension environment could not launch:',type(err).__name__,str(err)[:180])
        sys.exit(1 if strict else 0)
    try:
        workers=ctx.service_workers
        if not workers:
            try:workers=[ctx.wait_for_event('serviceworker',timeout=worker_wait_ms)]
            except PlaywrightTimeout:pass
        worker=next((w for w in workers if w.url.endswith('/background.js') and w.url.startswith('chrome-extension://')),None)
        if worker is None:
            print(('FAIL' if strict else 'NOT_RUN')+f' MV3: genuine unpacked extension worker not exposed after {worker_wait_ms}ms (mock tests are not acceptance)')
            sys.exit(1 if strict else 0)
        try:
            version=worker.evaluate('() => chrome.runtime.getManifest().version')
            assert version=='1.17.0',f'Unexpected manifest version: {version}'
            # Real Chrome worker, not a Web Locks polyfill or DOM mock. Absence
            # must fail physical acceptance: independent state contexts would
            # be left with merely advisory optimistic fencing.
            web_locks=worker.evaluate('() => typeof navigator.locks?.request === "function"')
            assert web_locks is True,'Chrome MV3 worker Web Locks API unavailable; physical acceptance fails'
            alarm=worker.evaluate('async () => { await new Promise(r => setTimeout(r,250)); return chrome.alarms.get("embasic-scheduler"); }')
            assert alarm and alarm['periodInMinutes']==1,alarm
            extension_id=urlparse(worker.url).netloc
            page=ctx.new_page()
            page.goto(f'chrome-extension://{extension_id}/dashboard.html',wait_until='domcontentloaded',timeout=10000)
            send_js="""msg => new Promise((resolve,reject) => chrome.runtime.sendMessage(msg,res=> {
              if(chrome.runtime.lastError)reject(Error(chrome.runtime.lastError.message));
              else if (!res)reject(Error('No response'));else resolve(res);
            }))"""
            def send(message):return page.evaluate(send_js,message)
            status=send({'type':'vaultStatus'})
            assert status['ok'] and status['data']['required'] is True,status
            denied=send({'type':'createTask','payload':{'project':'Synthetic','name':'Denied',
              'instructions':'Pre-vault task must fail', 'intervalHours':1,'maxRuns':1}})
            assert not denied['ok'],'Real worker allowed unsealed task creation'
            passphrase='safe-test-ONLY-throwaway-password-TUR004'
            created=send({'type':'vaultCreate','password':passphrase})
            assert created['ok'],created
            added=send({'type':'createTask','payload':{'project':'Synthetic MV3','name':'Hourly',
              'instructions':'Only synthetic data; no external accounts',
              'intervalHours':1,'maxRuns':1,'enabled':True,'repo':''}})
            assert added['ok'],added
            snap=send({'type':'snapshot'})
            assert snap['ok'] and len(snap['data']['tasks'])==1 and len(snap['data']['runs'])==1,snap
            assert snap['data']['runs'][0]['status']=='waiting'
            # Browser-backed storage, not a synthetic storage mock: no task data
            # may remain in local plaintext after the initial encrypted write.
            sealed_check=worker.evaluate('''async () => {const d=await chrome.storage.local.get(null);
              return {sealed:!!d.embasicSealedStateV3, plain:!!d.embasicStateV2||!!d.embasicStateV1,
                      recovery:!!d.embasicStateRecoveryV4};}''')
            assert sealed_check=={'sealed':True,'plain':False,'recovery':True},sealed_check
            assert send({'type':'vaultLock'})['ok']
            locked=send({'type':'snapshot'})
            assert not locked['ok'],'Real worker returned sensitive state while locked'
            key_after_lock=worker.evaluate('''async()=>!!(await chrome.storage.session.get('embasicStateKeyV3')).embasicStateKeyV3''')
            assert key_after_lock is False,'Session key survived explicit lock'
            assert send({'type':'vaultUnlock','password':passphrase})['ok']
            resumed=send({'type':'snapshot'})
            assert resumed['ok'] and len(resumed['data']['tasks'])==1,'Vault did not recover records'
            assert send({'type':'schedulerNow'})['ok']
            final=send({'type':'snapshot'})
            assert len(final['data']['runs'])==1,'Created duplicate waiting run'
            diag=send({'type':'diagnostics'})
            assert diag['ok'] and diag['data']['alarmRegistered'] is True,diag
            assert diag['data']['taskCount']==1,diag
            assert diag['data']['staleLeases']==0,diag
            assert diag['data']['uncertainDriveCommits']==0,diag
            assert diag['data']['uncertainDriveFolders']==0,diag
            assert diag['data']['lastSchedulerAt'],diag
            # TUR017: a REAL extension-origin contention probe (not a mock).
            # Two independent extension pages must serialize the same lock.
            # Keep this probe separate from the application's vault-write lock.
            other=ctx.new_page()
            other.goto(f'chrome-extension://{extension_id}/dashboard.html',wait_until='domcontentloaded',timeout=10000)
            first=page.evaluate("""() => {window.__held=false;window.__unlock=null;
              navigator.locks.request('embasic-tur017-real-acceptance-probe',{mode:'exclusive'},async lock=>{
                if(!lock)throw Error('No real Web Lock');window.__held=true;
                await new Promise(resolve=>window.__unlock=resolve);
              });return true;}""")
            page.wait_for_function('window.__held === true',timeout=5000)
            other.evaluate("""() => {window.__otherHeld=false;
              navigator.locks.request('embasic-tur017-real-acceptance-probe',{mode:'exclusive'},async lock=>{
                if(!lock)throw Error('No second Web Lock');window.__otherHeld=true;
              });return true;}""")
            other.wait_for_timeout(250)
            assert other.evaluate('window.__otherHeld') is False,'Two independent same-origin pages held exclusive Web Lock simultaneously'
            page.evaluate('window.__unlock()')
            other.wait_for_function('window.__otherHeld === true',timeout=5000)
            other.close()
            # Genuine browser restart using the SAME persistent profile: session
            # encryption key must disappear; ciphertext and pending tur survive.
            page.close()
            ctx.close()
            ctx=p.chromium.launch_persistent_context(
              directory,executable_path=chrome_bin,headless=headless,
              args=['--no-sandbox','--disable-dev-shm-usage',
                    f'--disable-extensions-except={extension}',f'--load-extension={extension}'],timeout=18000)
            reopened=ctx.new_page()
            reopened.goto(f'chrome-extension://{extension_id}/dashboard.html',wait_until='domcontentloaded',timeout=10000)
            def resumed_send(msg):return reopened.evaluate(send_js,msg)
            after_restart=resumed_send({'type':'vaultStatus'})
            assert after_restart['ok'] and after_restart['data']['sealed'] is True,after_restart
            assert after_restart['data']['unlocked'] is False,'Session encryption key survived browser restart'
            assert not resumed_send({'type':'snapshot'})['ok'],'Locked state leaked after restart'
            assert resumed_send({'type':'vaultUnlock','password':passphrase})['ok']
            restored=resumed_send({'type':'snapshot'})
            assert restored['ok'] and len(restored['data']['runs'])==1,'Pending run lost or duplicated after restart'
            assert resumed_send({'type':'schedulerNow'})['ok']
            assert len(resumed_send({'type':'snapshot'})['data']['runs'])==1
            restarted_diag=resumed_send({'type':'diagnostics'})
            assert restarted_diag['ok'] and restarted_diag['data']['alarmRegistered'] is True,restarted_diag
            assert restarted_diag['data']['uncertainDriveCommits']==0,restarted_diag
            print('PASS MV3 REAL worker: fresh install, alarm, vault lock/unlock, actual browser restart, no duplicate')
        except Exception as err:
            print('FAIL MV3 REAL worker:',type(err).__name__,str(err)[:350],file=sys.stderr)
            sys.exit(1)
    finally:
        ctx.close()
