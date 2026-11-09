"""Local DOM smoke test with a mocked Chrome runtime; NOT a physical extension acceptance test.
Requires playwright and a Chromium binary, e.g. `python -m playwright install chromium`.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
chrome_bin=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
bootstrap=r'''(() => {
const state={tasks:[],runs:[],logs:[],settings:{driveEnabled:false,githubEnabled:false,desktopNotifications:false}};
let sealed=false,unlocked=false;
window.chrome={
 runtime:{id:'testextensionid',lastError:null,getManifest(){return{version:'1.13.0',oauth2:{client_id:'YOUR_GOOGLE_CHROME_EXTENSION_CLIENT_ID.apps.googleusercontent.com'}};},
 sendMessage(msg,callback){try{
  let data=true;
  if(msg.type==='vaultStatus')data={sealed,unlocked,legacyPlaintext:!sealed,required:false,hasRecovery:sealed};
  else if(msg.type==='vaultCreate'){sealed=true;unlocked=true;data={tasks:state.tasks.length,runs:state.runs.length};}
  else if(msg.type==='vaultLock'){unlocked=false;data=true;}
  else if(msg.type==='vaultUnlock'){if(msg.password!=='this-is-a-demo-vault-password')throw Error('Yanlış parola');unlocked=true;data=true;}
  else if(msg.type==='snapshot')data=JSON.parse(JSON.stringify(state));
  else if(msg.type==='githubTokenStatus')data={connected:false,encryptedVault:false};
  else if(msg.type==='googleStatus')data={connected:false,reason:'not configured'};
  else if(msg.type==='diagnostics')data={alarmRegistered:true,alarmPeriodMinutes:1,liveLeases:sealed&&unlocked?0:null,schedulerBusy:false,syncBusy:false};
  else if(msg.type==='createTask'){
   const id='task'+(state.tasks.length+1)+'123456789';
   state.tasks.push({id,...msg.payload,completedRuns:0,enabled:true,nextRunAt:Date.now()+3600000,latestSummary:''});
   state.runs.unshift({id:'run'+(state.runs.length+1)+'123456789',taskId:id,project:msg.payload.project,
   taskName:msg.payload.name,prompt:'Prepared prompt: '+msg.payload.instructions,status:'waiting',
   driveSync:'disabled',githubSync:'disabled',scheduledAt:new Date().toISOString()});data=id;
  }else if(msg.type==='completeRun'){
   const run=state.runs.find(r=>r.id===msg.id);run.status='completed';run.output=msg.output;
   const task=state.tasks.find(t=>t.id===run.taskId);task.completedRuns+=1;task.enabled=false;
  }
  callback({ok:true,data});
 }catch(e){callback({ok:false,error:e.message});}}
 },
 tabs:{create(){return Promise.resolve();}}
};
})();'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=chrome_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1420,'height':920},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    html=(root/'extension/dashboard.html').read_text()
    html=html.replace('<link rel="stylesheet" href="styles.css">','')
    html=html.replace('<script src="dashboard.js" defer></script>','')
    html=html.replace('<script src="backup-crypto.js" defer></script>','')
    page.set_content(html,wait_until='load')
    page.add_style_tag(content=(root/'extension/styles.css').read_text())
    page.evaluate(bootstrap)
    page.add_script_tag(content=(root/'extension/backup-crypto.js').read_text())
    page.add_script_tag(content=(root/'extension/dashboard.js').read_text())
    page.locator('#project').fill('Test Projesi')
    page.locator('#taskName').fill('Saatlik kalite kontrol')
    page.locator('#instructions').fill('Örnek çalışma talimatı')
    page.locator('#submitTask').click()
    page.locator('#statTasks').get_by_text('1').wait_for(timeout=10000)
    page.locator('button[data-tab="workspace"]').click()
    page.locator('#runsList button').first.click()
    assert 'Prepared prompt' in page.locator('#runPrompt').input_value()
    page.locator('#modelOutput').fill('Test sonucu: başarı. SONRAKİ TUR ÖZETİ: Devam edilecek.')
    page.locator('#saveResult').click()
    page.locator('#statComplete').get_by_text('1').wait_for(timeout=10000)
    page.locator('button[data-tab="help"]').click()
    page.locator('#diagnostics').click()
    assert 'Sürüm: 1.13.0' in page.locator('#diagnosticsOutput').inner_text()
    assert 'MV3 servis çalışanı: ÇALIŞIYOR / alarm mevcut' in page.locator('#diagnosticsOutput').inner_text()
    if errors: raise AssertionError('Browser JS error(s): '+'; '.join(errors))
    page.locator('#stateVaultPassword').fill('this-is-a-demo-vault-password')
    page.locator('#stateVaultConfirm').fill('this-is-a-demo-vault-password')
    page.on('dialog',lambda dialog:dialog.accept())
    page.locator('#stateVaultCreate').click()
    page.locator('#stateVaultStatus').get_by_text('ŞİFRELİ / AÇIK').wait_for(timeout=10000)
    page.locator('#stateVaultLock').click()
    assert page.locator('#vaultLockScreen').is_visible()
    page.locator('#vaultOverlayPassword').fill('this-is-a-demo-vault-password')
    page.locator('#vaultOverlayUnlock').click()
    page.locator('#vaultLockScreen').wait_for(state='hidden',timeout=10000)
    page.screenshot(path=str(root/'ui-smoke.png'),full_page=True)
    print('PASS UI smoke: dashboard, task, response, vault lock/unlock and diagnostics; Chrome runtime MOCKED')
    browser.close()
