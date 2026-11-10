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
import os, sys, time
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
            assert version=='1.18.0',f'Unexpected manifest version: {version}'
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
            # TUR029: two genuinely separate persistent Chrome profiles do NOT
            # share a vault or Web Locks namespace, even when the extension ID
            # is the same. This is a NEGATIVE boundary, not cross-profile CAS.
            if os.environ.get('EMBASIC_TUR029_PROFILE_PROBE','0')=='1':
                with TemporaryDirectory() as independent_dir:
                    separate=p.chromium.launch_persistent_context(
                      independent_dir, executable_path=chrome_bin,headless=headless,
                      args=['--no-sandbox','--disable-dev-shm-usage',
                            f'--disable-extensions-except={extension}',f'--load-extension={extension}'],
                      timeout=18000)
                    try:
                        independent_workers=separate.service_workers
                        if not independent_workers:
                            independent_workers=[separate.wait_for_event('serviceworker',timeout=worker_wait_ms)]
                        independent_worker=next((w for w in independent_workers if w.url.endswith('/background.js') and w.url.startswith('chrome-extension://')),None)
                        assert independent_worker is not None,'Second real profile MV3 worker unavailable'
                        second_id=urlparse(independent_worker.url).netloc
                        independent_page=separate.new_page()
                        independent_page.goto(f'chrome-extension://{second_id}/dashboard.html',wait_until='domcontentloaded',timeout=10000)
                        fresh=independent_page.evaluate(send_js,{'type':'vaultStatus'})
                        assert fresh['ok'] and fresh['data']['required'] is True,fresh
                        assert fresh['data']['sealed'] is False,'Independent Chrome profile inherited first profile vault'
                        first_view=resumed_send({'type':'vaultStatus'})
                        assert first_view['ok'] and first_view['data']['sealed'] is True
                        reopened.evaluate("""() => {window.__tur029Held=false;window.__tur029Release=null;
                          navigator.locks.request('embasic-tur029-independent-profiles',async ()=>{
                            window.__tur029Held=true;
                            await new Promise(resolve=>window.__tur029Release=resolve);
                          });} """)
                        reopened.wait_for_function('window.__tur029Held === true',timeout=5000)
                        independent_page.evaluate("""() => {window.__tur029OtherHeld=false;
                          navigator.locks.request('embasic-tur029-independent-profiles',async ()=>{
                            window.__tur029OtherHeld=true;
                          });} """)
                        independent_page.wait_for_function('window.__tur029OtherHeld === true',timeout=5000)
                        reopened.evaluate('window.__tur029Release()')
                        independent_page.close()
                        print('PASS MV3 TUR029: two real Chrome profiles have isolated vault and Web Locks; cross-profile CAS NOT_PROVEN')
                    finally:
                        separate.close()
            # TUR029: real native chrome.alarms dispatch, not schedulerNow.
            # Optional (CI) because Chrome may impose a >=30s alarm floor.
            if os.environ.get('EMBASIC_TUR029_NATIVE_ALARM','0')=='1':
                before_tick=resumed_send({'type':'diagnostics'})['data']['lastSchedulerAt']
                assert before_tick,'No persisted scheduler checkpoint before genuine alarm'
                reopened.evaluate("""async () => {
                  await chrome.alarms.create('embasic-scheduler',{
                    when:Date.now()+2500,periodInMinutes:1});
                }""")
                cap=float(os.environ.get('EMBASIC_TUR029_ALARM_TIMEOUT_S','65'))
                observed=False; deadline=time.monotonic()+cap
                while time.monotonic()<deadline:
                    time.sleep(0.8)
                    info=resumed_send({'type':'diagnostics'})
                    assert info['ok'],info
                    if info['data']['lastSchedulerAt']!=before_tick:
                        observed=True;break
                assert observed,f'Native Chrome alarm did not advance persisted scheduler checkpoint within {cap}s'
                after_alarm=resumed_send({'type':'snapshot'})
                assert after_alarm['ok'] and len(after_alarm['data']['runs'])==1,'Real alarm duplicated or erased waiting run'
                assert after_alarm['data']['runs'][0]['status']=='waiting','Native alarm unexpectedly executed a synthetic waiting run'
                assert info['data']['alarmRegistered'] and info['data']['alarmPeriodMinutes']==1,info
                assert info['data']['uncertainGithubCommits']==0 and info['data']['uncertainDriveCommits']==0,info
                print('PASS MV3 TUR029 NATIVE ALARM: genuine chrome.alarms dispatch updated durable checkpoint; no duplicate run; physical Windows 24h NOT_RUN')
            # TUR030: AFTER a native alarm has advanced the encrypted checkpoint,
            # restart the entire browser again with the SAME disposable profile.
            # The state must return locked and pending run unique; then a SECOND
            # genuinely delivered native alarm must advance durable checkpoint.
            if os.environ.get('EMBASIC_TUR030_RESTART_ALARM','0')=='1':
                assert os.environ.get('EMBASIC_TUR029_NATIVE_ALARM','0')=='1', 'TUR030 depends on native alarm TUR029 evidence'
                pre_reboot=resumed_send({'type':'diagnostics'})
                assert pre_reboot['ok'] and pre_reboot['data']['lastSchedulerAt'],pre_reboot
                checkpoint_before=pre_reboot['data']['lastSchedulerAt']
                current_runs=resumed_send({'type':'snapshot'})
                assert current_runs['ok'] and len(current_runs['data']['runs'])==1,current_runs
                expected_run_id=current_runs['data']['runs'][0]['id']
                reopened.close()
                ctx.close()
                ctx=p.chromium.launch_persistent_context(
                  directory,executable_path=chrome_bin,headless=headless,
                  args=['--no-sandbox','--disable-dev-shm-usage',
                        f'--disable-extensions-except={extension}',f'--load-extension={extension}'],timeout=18000)
                second_boot=ctx.new_page()
                second_boot.goto(f'chrome-extension://{extension_id}/dashboard.html',wait_until='domcontentloaded',timeout=10000)
                second_send=lambda msg:second_boot.evaluate(send_js,msg)
                locked_again=second_send({'type':'vaultStatus'})
                assert locked_again['ok'] and locked_again['data']['sealed'] is True,locked_again
                assert locked_again['data']['unlocked'] is False,'Sensitive session key persisted across second restart'
                assert second_send({'type':'snapshot'})['ok'] is False,'Locked vault exposed pending run after restart'
                assert second_send({'type':'vaultUnlock','password':passphrase})['ok']
                persisted=second_send({'type':'diagnostics'})
                assert persisted['ok'] and persisted['data']['alarmRegistered'] is True,persisted
                assert persisted['data']['lastSchedulerAt']>=checkpoint_before,'Encrypted scheduler checkpoint regressed on restart'
                pre_alarm=persisted['data']['lastSchedulerAt']
                second_boot.evaluate("""async () => {
                    await chrome.alarms.create('embasic-scheduler',{when:Date.now()+2500,periodInMinutes:1});
                }""")
                deadline=time.monotonic()+float(os.environ.get('EMBASIC_TUR030_ALARM_TIMEOUT_S','70'))
                observed=False
                while time.monotonic()<deadline:
                    time.sleep(0.7)
                    checkpoint_now=second_send({'type':'diagnostics'})
                    assert checkpoint_now['ok'],checkpoint_now
                    if checkpoint_now['data']['lastSchedulerAt']>pre_alarm:
                        observed=True
                        break
                assert observed,'Second actual native Chrome alarm failed to advance persisted checkpoint'
                persisted_runs=second_send({'type':'snapshot'})
                assert persisted_runs['ok'] and len(persisted_runs['data']['runs'])==1,persisted_runs
                assert persisted_runs['data']['runs'][0]['id']==expected_run_id,'Native alarm created/replaced pending run after restart'
                assert persisted_runs['data']['runs'][0]['status']=='waiting'
                assert checkpoint_now['data']['uncertainGithubCommits']==0 and checkpoint_now['data']['uncertainDriveCommits']==0
                assert checkpoint_now['data']['liveLeases']==0 and checkpoint_now['data']['staleLeases']==0
                print('PASS MV3 TUR030 RESTART-ALARM: second real Chrome restart clears key, preserves encrypted checkpoint and unique run, second native alarm advances checkpoint, zero leases')
            # TUR031: An alarm delivered while the authenticated vault is LOCKED
            # must not advance encrypted scheduler state or resurrect a lease.
            # A second native alarm after explicit unlock must work normally.
            if os.environ.get('EMBASIC_TUR031_LOCKED_ALARM','0')=='1':
                assert os.environ.get('EMBASIC_TUR030_RESTART_ALARM','0')=='1','TUR031 needs prior real Chrome restart evidence'
                checkpoint_before=second_send({'type':'diagnostics'})['data']['lastSchedulerAt']
                state_before=second_send({'type':'snapshot'})
                assert state_before['ok'] and len(state_before['data']['runs'])==1
                expected_run_id=state_before['data']['runs'][0]['id']
                encrypted_before=second_boot.evaluate("""async ()=>(await chrome.storage.local.get('embasicSealedStateV3')).embasicSealedStateV3""")
                assert encrypted_before and encrypted_before['data'],'No encrypted vault before locked alarm'
                assert second_send({'type':'vaultLock'})['ok'],'Cannot lock vault before alarm'
                locked_diagnostics=second_send({'type':'diagnostics'})
                assert locked_diagnostics['ok'] and locked_diagnostics['data']['vaultSealed'] and not locked_diagnostics['data']['vaultUnlocked']
                assert not second_send({'type':'snapshot'})['ok'],'Locked MV3 worker leaked protected data'
                second_boot.evaluate("""async()=>{
                  window.__tur031AlarmSeen=false;
                  chrome.alarms.onAlarm.addListener(a=>{
                    if(a.name==='embasic-scheduler')window.__tur031AlarmSeen=true;
                  });
                  await chrome.alarms.create('embasic-scheduler',{when:Date.now()+2500,periodInMinutes:1});
                }""")
                alarm_seen=False
                locked_alarm_deadline=time.monotonic()+30
                while time.monotonic()<locked_alarm_deadline:
                    second_boot.wait_for_timeout(400)
                    if second_boot.evaluate('() => window.__tur031AlarmSeen === true'):
                        alarm_seen=True
                        break
                assert alarm_seen,'Native Chrome alarm was not observed by extension-page alarm listener'
                second_boot.wait_for_timeout(450)
                encrypted_locked=second_boot.evaluate("""async ()=>(await chrome.storage.local.get('embasicSealedStateV3')).embasicSealedStateV3""")
                assert encrypted_locked==encrypted_before,'Native alarm rewrote ciphertext while vault was locked'
                assert second_send({'type':'vaultUnlock','password':passphrase})['ok']
                restored_checkpoint=second_send({'type':'diagnostics'})['data']['lastSchedulerAt']
                assert restored_checkpoint==checkpoint_before,'Locked native alarm advanced protected scheduler checkpoint'
                after_locked=second_send({'type':'snapshot'})
                assert after_locked['ok'] and len(after_locked['data']['runs'])==1
                assert after_locked['data']['runs'][0]['id']==expected_run_id
                assert after_locked['data']['runs'][0]['status']=='waiting'
                print('PASS MV3 TUR031 LOCKED-ALARM: real chrome.alarms delivered while sealed vault locked, ciphertext/checkpoint unchanged, no lease/replay')
                second_boot.evaluate("""async()=>{
                    await chrome.alarms.create('embasic-scheduler',{when:Date.now()+2500,periodInMinutes:1});
                }""")
                deadline=time.monotonic()+float(os.environ.get('EMBASIC_TUR031_ALARM_TIMEOUT_S','70'))
                advanced=False
                while time.monotonic()<deadline:
                    time.sleep(0.8)
                    diag=second_send({'type':'diagnostics'})
                    assert diag['ok']
                    if diag['data']['lastSchedulerAt']>restored_checkpoint:
                        advanced=True
                        break
                assert advanced,'Native Chrome alarm did not advance after explicit vault unlock'
                final_state=second_send({'type':'snapshot'})
                assert final_state['ok'] and len(final_state['data']['runs'])==1
                assert final_state['data']['runs'][0]['id']==expected_run_id
                assert diag['data']['liveLeases']==0 and diag['data']['staleLeases']==0
                assert diag['data']['uncertainGithubCommits']==0 and diag['data']['uncertainDriveCommits']==0
                print('PASS MV3 TUR031 UNLOCK-ALARM: actual native alarm advances checkpoint after unlock, stable run ID and zero stale/live leases')
            print('PASS MV3 REAL worker: fresh install, alarm, vault lock/unlock, actual browser restart, no duplicate')
        except Exception as err:
            print('FAIL MV3 REAL worker:',type(err).__name__,str(err)[:350],file=sys.stderr)
            sys.exit(1)
    finally:
        ctx.close()
