'use strict';
// All remote data is rendered via textContent/value, never via innerHTML.
const $=id=>document.getElementById(id);
let snapshot={tasks:[],runs:[],logs:[],settings:{}};
let selectedRunId=null;
let activeDraftRunId=null;
let notifyTimer=null;
let refreshBusy=false;
let currentVaultStatus={sealed:false,unlocked:false,legacyPlaintext:false,required:false,hasRecovery:false};
const send=message=>new Promise((resolve,reject)=>{
  chrome.runtime.sendMessage(message,response=>{
    const error=chrome.runtime.lastError;
    if(error)return reject(new Error(error.message));
    if(!response)return reject(new Error('Eklenti arka planı yanıt vermedi.'));
    if(!response.ok)return reject(new Error(response.error));
    resolve(response.data);
  });
});
function node(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;
  if(text!==undefined)x.textContent=String(text);return x;}
function button(label,handler,kind='secondary'){const x=node('button',kind,label);x.type='button';x.addEventListener('click',handler);return x;}
function notice(message,isError=false){$('status').textContent=message;$('status').classList.toggle('error',isError);
  clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>{$('status').textContent='';},10000);}
async function act(job,success='İşlem tamamlandı.'){
  try{await job;notice(success);await refresh();return true;}
  catch(error){notice(error.message||String(error),true);return false;}
}
function dateText(value){if(!value)return '—';const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});}
function badge(text,state){return node('span','pill '+state,text);}
async function refresh(){
  if(refreshBusy)return;refreshBusy=true;
  try{
    currentVaultStatus=await send({type:'vaultStatus'});
    renderVaultStatus();
    if(currentVaultStatus.sealed&&!currentVaultStatus.unlocked){
      snapshot={tasks:[],runs:[],logs:[],settings:{}};
      selectedRunId=null;activeDraftRunId=null;
      $('runPrompt').value='';$('modelOutput').value='';$('taskForm').reset();$('editingId').value='';
      renderStats();renderTasks();renderRuns();renderLogs();return;
    }
    snapshot=await send({type:'snapshot'});
    renderStats();renderTasks();renderRuns();renderLogs();
    $('driveEnabled').checked=snapshot.settings.driveEnabled===true;
    $('githubEnabled').checked=snapshot.settings.githubEnabled===true;
    $('desktopNotifications').checked=snapshot.settings.desktopNotifications===true;
  }finally{refreshBusy=false;}
}
function renderStats(){
  $('statTasks').textContent=snapshot.tasks.length;
  $('statActive').textContent=snapshot.tasks.filter(t=>t.enabled).length;
  $('statWaiting').textContent=snapshot.runs.filter(r=>r.status==='waiting').length;
  $('statComplete').textContent=snapshot.runs.filter(r=>r.status==='completed').length;
  $('taskCount').textContent=`${snapshot.tasks.length} görev`;
}
const empty=(list,message)=>list.replaceChildren(node('div','empty',message));
function renderTasks(){
  const list=$('tasksList');list.replaceChildren();
  if(!snapshot.tasks.length)return empty(list,'İlk proje ve görevini soldaki formdan oluştur.');
  for(const task of snapshot.tasks){
    const box=node('article','list-item'),top=node('div','item-top'),nameBox=node('div');
    nameBox.append(node('div','item-title',task.name),node('div','item-meta',`${task.project}${task.repo?' · '+task.repo:''}`));
    top.append(nameBox,badge(task.enabled?'Etkin':'Duraklatıldı',task.enabled?'success':'warning'));
    box.append(top);
    box.append(node('div','item-meta time',`Her ${task.intervalHours} saat · ${task.completedRuns}/${task.maxRuns||'∞'} tur · Sıradaki: ${dateText(task.nextRunAt)}`));
    const actions=node('div','item-actions');
    const pending=snapshot.runs.find(r=>r.taskId===task.id&&r.status==='waiting');
    const prepared=button('Hemen hazırla',()=>act(send({type:'runNow',id:task.id}),'Tur çalışma alanına eklendi.'),'primary');
    prepared.disabled=!!pending||(task.maxRuns>0&&task.completedRuns>=task.maxRuns);
    actions.append(prepared,button(task.enabled?'Duraklat':'Başlat',()=>act(send({type:'toggleTask',id:task.id,enabled:!task.enabled}))));
    actions.append(button('Düzenle',()=>editTask(task),'ghost'));
    if(pending)actions.append(button('Bekleyen tur',()=>selectRun(pending.id),'ghost'));
    actions.append(button('Sil',()=>{
      if(confirm(`${task.project} / ${task.name} ve yerel rapor geçmişi kalıcı olarak silinsin mi? Bulut kopyaları kalır.`))
        act(send({type:'deleteTask',id:task.id}),'Görev ve yerel geçmiş silindi.');
    },'ghost'));
    box.append(actions);list.append(box);
  }
}
function resetForm(){
  $('taskForm').reset();$('editingId').value='';$('intervalHours').value=1;$('maxRuns').value=5;
  $('repoFile').value='README.md';$('submitTask').textContent='Görevi kaydet';
}
function editTask(task){
  for(const [id,value] of Object.entries({project:task.project,taskName:task.name,instructions:task.instructions,
    repo:task.repo,baseBranch:task.baseBranch,repoFile:task.repoFile,
    intervalHours:task.intervalHours,maxRuns:task.maxRuns}))$(id).value=value;
  $('allowPublicGitHub').checked=task.allowPublicGitHub===true;
  $('editingId').value=task.id;$('submitTask').textContent='Değişiklikleri kaydet';
  showTab('tasks');window.scrollTo({top:140,behavior:'smooth'});
}
function taskPayload(){return {
  project:$('project').value,name:$('taskName').value,instructions:$('instructions').value,
  repo:$('repo').value,baseBranch:$('baseBranch').value,repoFile:$('repoFile').value,
  intervalHours:Number($('intervalHours').value),maxRuns:Number($('maxRuns').value),
  allowPublicGitHub:$('allowPublicGitHub').checked,
  enabled:snapshot.tasks.find(t=>t.id===$('editingId').value)?.enabled??true
};}
function syncLabel(status,error){return `${status||'—'}${error?' ('+error+')':''}`;}
function renderRuns(){
  const list=$('runsList');list.replaceChildren();
  if(!snapshot.runs.length)return empty(list,'Görev hazırlandığında çalışma turları burada görüntülenecek.');
  for(const run of snapshot.runs.slice(0,100)){
    const box=node('article','list-item'),top=node('div','item-top');
    top.append(node('div','item-title',run.taskName),badge(run.status==='waiting'?'Yanıt bekliyor':run.status==='completed'?'Kaydedildi':'Atlandı',
      run.status==='waiting'?'warning':run.status==='completed'?'success':''));box.append(top);
    box.append(node('div','item-meta',`${run.project} · ${dateText(run.scheduledAt)}`));
    if(run.status==='completed'){
      box.append(node('div','item-meta',`Google Drive: ${syncLabel(run.driveSync,run.driveError)} · GitHub: ${syncLabel(run.githubSync,run.githubError)}`));
    }
    const actions=node('div','item-actions');
    actions.append(button(run.status==='waiting'?'Tura devam et':'Raporu aç',()=>selectRun(run.id),'primary'));
    if(run.status==='completed'&&run.output)actions.append(button('Yanıtı kopyala',()=>copy(run.output)));
    box.append(actions);list.append(box);
  }
  if(selectedRunId&&snapshot.runs.some(r=>r.id===selectedRunId))displayRun(selectedRunId,false);
}
function displayRun(id,resetOutput){
  const run=snapshot.runs.find(r=>r.id===id);if(!run)return;
  $('selectedRunInfo').textContent=`${run.project} / ${run.taskName} / ${run.status==='waiting'?'Yanıt bekleniyor':run.status}`;
  $('runPrompt').value=run.prompt;
  if(run.status==='completed'){$('modelOutput').value=run.output;$('modelOutput').readOnly=true;}
  else if(run.status==='waiting'){
    if(resetOutput||activeDraftRunId!==id)$('modelOutput').value='';
    $('modelOutput').readOnly=false;
  }else{$('modelOutput').value='';$('modelOutput').readOnly=true;}
  activeDraftRunId=id;
  $('saveResult').disabled=run.status!=='waiting';
  $('skipRun').disabled=run.status!=='waiting';
  $('retryRunSync').disabled=run.status!=='completed';
  $('approvePublicRun').disabled=run.status!=='completed'||!run.sourceRepo||run.githubSync==='synced';
}
function selectRun(id){
  if(selectedRunId!==id&&activeDraftRunId===selectedRunId&&$('modelOutput').value.trim()&&
    snapshot.runs.some(r=>r.id===selectedRunId&&r.status==='waiting')&&
    !confirm('Kaydedilmemiş yanıt taslağı temizlenecek. Farklı tura geçilsin mi?'))return;
  const change=selectedRunId!==id;selectedRunId=id;showTab('workspace');displayRun(id,change);
}
function renderLogs(){
  const list=$('logsList');list.replaceChildren();
  if(!snapshot.logs.length)return empty(list,'Henüz işlem kaydı yok.');
  for(const event of snapshot.logs){const box=node('div','list-item');
    box.append(node('div','item-meta',`${dateText(event.time)} · ${event.level}`),node('div','item-title',event.message));list.append(box);}
}
function showTab(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===name));
}
async function copy(text){
  if(!text)return notice('Kopyalanacak talimat yok.',true);
  try{await navigator.clipboard.writeText(text);notice('Metin panoya kopyalandı.');}
  catch(e){notice('Panoya yazılamadı: '+e.message,true);}
}
async function updateConnections(){
  try{
    const gh=await send({type:'githubTokenStatus'});
    $('githubStatus').textContent=gh.connected?'Bağlı · oturum':'Bağlı değil'+(gh.encryptedVault?' · şifreli kasa var':'');
    $('githubStatus').className='pill '+(gh.connected?'success':'warning');
    const google=await send({type:'googleStatus'});
    $('googleStatus').textContent=google.connected?'Yetkili':'Yetki yok';
    $('googleStatus').className='pill '+(google.connected?'success':'warning');
    $('googleStatus').title=google.reason||'';
  }catch(e){notice(e.message,true);}
}
function downloadJson(data,filename){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function exportBackup(encrypted=true){
  // Fresh read prevents exporting a stale snapshot while another task is completing.
  const data={...(await send({type:'snapshot'})),exportedAt:new Date().toISOString()};
  const date=new Date().toISOString().slice(0,10);
  if(encrypted){
    const password=$('backupPassword').value;
    const wrapped=await embasicBackupCrypto.encrypt(data,password);
    downloadJson(wrapped,`embasic-agent-v1.5-${date}.emback`);
    notice('AES-256-GCM şifreli yedek kaydedildi. Parolanı güvenli sakla.');
  }else{
    if(!confirm('DÜZ JSON YEDEĞİN İÇİNDE BÜTÜN PROJE TALİMATLARI VE YANITLAR OKUNABİLİR. Gerçekten şifrelemeden kaydetmek istiyor musun?'))return;
    downloadJson(data,`embasic-agent-v1.5-ACIK-METIN-${date}.json`);
    notice('ŞİFRELENMEMİŞ JSON yedek kaydedildi; güvenli bir yerde sakla.',true);
  }
}
async function restoreBackup(file){
  if(!file)return;
  if(file.size>32_000_000)throw new Error('Yedek en fazla 32 MB olmalı.');
  let data=JSON.parse(await file.text());
  if(data?.kind==='embasic-encrypted-backup'){
    data=await embasicBackupCrypto.decrypt(data,$('backupPassword').value);
  }else if(!confirm('Seçilen yedek ŞİFRELENMEMİŞ bir JSON. İçindeki hassas verileri daha önce kontrol ettin mi?'))return;
  if(!confirm('Mevcut görevler ve yerel geçmiş bu yedekle değişecek. İçe aktarılan görevler ile senkronizasyon kapalı olacak. Devam edilsin mi?'))return;
  const result=await send({type:'restoreBackup',payload:data});
  selectedRunId=null;activeDraftRunId=null;$('runPrompt').value='';$('modelOutput').value='';
  notice(`${result.tasks} görev ve ${result.runs} tur duraklatılarak geri yüklendi.`);
  await refresh();
}
async function runDiagnostics(){
  const state=await send({type:'snapshot'});
  const gh=await send({type:'githubTokenStatus'}),drive=await send({type:'googleStatus'});
  const worker=await send({type:'diagnostics'});
  const manifest=chrome.runtime.getManifest();
  const oauth=!!manifest.oauth2?.client_id&&!manifest.oauth2.client_id.startsWith('YOUR_');
  const lines=[
    'EMBASIC DEEPSEEK AGENT — YEREL TANILAMA',
    `Sürüm: ${manifest.version}`,
    `MV3 servis çalışanı: ${worker.alarmRegistered?'ÇALIŞIYOR / alarm mevcut':'ALARM EKSİK'}`,
    `Zamanlayıcı aralığı (dakika): ${worker.alarmPeriodMinutes??'YOK'}`,
    `Aktif senkronizasyon lease sayısı: ${worker.liveLeases??'KASA KİLİTLİ'}`,
    `Süresi geçmiş lease sayısı: ${worker.staleLeases??'KASA KİLİTLİ'}`,
    `Son zamanlayıcı checkpoint: ${worker.lastSchedulerAt??'KASA KİLİTLİ / YOK'}`,
    `Ertelenen GitHub bağlamı: ${worker.deferredTasks??'KASA KİLİTLİ'}`,
    `Sıradaki görev zamanı: ${worker.nextDueAt?new Date(worker.nextDueAt).toLocaleString('tr-TR'):'KASA KİLİTLİ / YOK'}`,
    `Zamanlayıcı / aktarım meşgul: ${worker.schedulerBusy?'EVET':'hayır'} / ${worker.syncBusy?'EVET':'hayır'}`,
    `Şifreleme zorunluluğu: ${currentVaultStatus.required?'ETKİN':'eski profil / kurulum bekliyor'}`,
    `Kurtarma kontrol noktası: ${currentVaultStatus.hasRecovery?'var':'yok'}`,
    `Yerel arşiv: ${currentVaultStatus.sealed?(currentVaultStatus.unlocked?'ŞİFRELİ / AÇIK':'KİLİTLİ'):'AÇIK METİN'}`,
    `Uzantı kimliği: ${chrome.runtime.id}`,
    `Google OAuth istemci kimliği: ${oauth?'yapılandırılmış':'YAPILANDIRILMADI'}`,
    `Google Drive yetkilendirmesi: ${drive.connected?'mevcut':'yok'}`,
    `GitHub token (oturum): ${gh.connected?'mevcut':'yok'}`,
    `Şifreli GitHub kasası: ${gh.encryptedVault?'mevcut':'yok'}`,
    `Tanımlı / etkin görev: ${state.tasks.length} / ${state.tasks.filter(x=>x.enabled).length}`,
    `Bekleyen tur: ${state.runs.filter(x=>x.status==='waiting').length}`,
    `Senkronizasyonu takılmış tur: ${state.runs.filter(r=>['retry','blocked'].includes(r.driveSync)||['retry','blocked'].includes(r.githubSync)).length}`,
    `GitHub belirsiz dal oluşturma: ${worker.uncertainGithubBranches??'KASA KİLİTLİ'}`,
    `GitHub belirsiz dosya PUT: ${worker.uncertainGithubCommits??'KASA KİLİTLİ'}`,
    `Drive belirsiz dosya oluşturma: ${worker.uncertainDriveCommits??'KASA KİLİTLİ'}`,
    `Drive belirsiz klasör oluşturma: ${worker.uncertainDriveFolders??'KASA KİLİTLİ'}`,
    'DeepSeek sohbet otomasyonu: KAPALI (tasarım gereği)',
    'Şifreli dışa aktarma: AES-256-GCM; yerel çalışma arşivi: kasa etkinse AES-256-GCM',
    'Canlı API uçtan uca testi: ayrıca PC üzerinde gerekli'
  ];
  $('diagnosticsOutput').textContent=lines.join('\n');notice('Yerel tanılama tamamlandı.');
}
function renderVaultStatus(){
  const state=currentVaultStatus,locked=state.sealed&&!state.unlocked;
  $('vaultLockScreen').hidden=!locked;
  $('stateVaultStatus').textContent=locked?'KİLİTLİ':state.sealed?'ŞİFRELİ / AÇIK':state.required?'KASA KURULUMU ZORUNLU':'AÇIK METİN — KASA KURULMADI';
  $('stateVaultStatus').className='pill '+(locked?'error':state.sealed?'success':'warning');
  $('stateVaultCreate').disabled=state.sealed;
  $('stateVaultUnlock').disabled=!locked;
  $('stateVaultLock').disabled=!state.sealed||locked;
  $('vaultOverlayRecover').hidden=!locked||!state.hasRecovery;
  $('stateVaultMessage').textContent=locked?'Arşiv kilitli. Kasa parolasını girerek açmadan görev ve senkronizasyon işlemleri çalışmaz.':
    state.sealed?'Proje verileri artık yalnızca şifreli arşivde saklanır. Tarayıcı kapanınca tekrar parola gerekir.':state.required?'YENİ SÜRÜM KORUMASI: Görev değiştirmeden, model yanıtı kaydetmeden veya buluta bağlanmadan önce güçlü parola ile yerel şifreli kasayı oluştur. Eski açık veriler kasaya güvenli biçimde taşınır.':
    'ÖNEMLİ: Yerel görev ve yanıtlar açık metin. Kasayı oluşturursan mevcut v1.0/v1.1 verileri şifreli depoya taşınır. Önce ayrı şifreli yedek al.';
}
function clearVaultPasswords(){
  ['stateVaultPassword','stateVaultConfirm','vaultOverlayPassword'].forEach(id=>$(id).value='');
}
async function vaultUnlock(password){
  try{await send({type:'vaultUnlock',password});clearVaultPasswords();
    $('vaultLockError').textContent='';notice('Arşiv kasası açıldı.');await refresh();return true;
  }catch(e){$('vaultLockError').textContent=e.message;notice(e.message,true);return false;}
}
function wireUI(){
  $('stateVaultCreate').addEventListener('click',async()=>{
    const password=$('stateVaultPassword').value;
    if(password!==$('stateVaultConfirm').value){notice('Yeni kasa parolaları eşleşmiyor.',true);return;}
    if(!confirm('Mevcut yerel görev ve raporlar şifrelenerek taşınacak. Parolayı kaybedersen verilerin kurtarılamaz. Önceden yedeğini aldın mı?'))return;
    if(await act(send({type:'vaultCreate',password}),'Yerel arşiv kasası oluşturuldu.')){
      clearVaultPasswords();await refresh();}
  });
  $('stateVaultUnlock').addEventListener('click',()=>vaultUnlock($('stateVaultPassword').value));
  $('vaultOverlayUnlock').addEventListener('click',()=>vaultUnlock($('vaultOverlayPassword').value));
  $('vaultOverlayRecover').addEventListener('click',async()=>{
    if(!confirm('UYARI: Son şifreli kurtarma kontrol noktasına dönüş, en son kaydedilen değişikliği kaybettirebilir. Yalnızca mevcut kasa açılmıyorsa kullan.'))return;
    const confirmation=prompt('Geri almak için KURTAR yaz:');
    if(confirmation!=='KURTAR')return;
    if(await act(send({type:'vaultRecover',password:$('vaultOverlayPassword').value,confirmation}),'Son sağlam şifreli kontrol noktası geri yüklendi.'))
      {clearVaultPasswords();await refresh();}
  });
  $('vaultOverlayPassword').addEventListener('keydown',e=>{if(e.key==='Enter')vaultUnlock($('vaultOverlayPassword').value);});
  $('stateVaultLock').addEventListener('click',async()=>{
    if(!confirm('Arşiv kilitlenecek. Görev oluşturma ve otomatik bulut aktarımı parola girilene kadar duracak.'))return;
    if(await act(send({type:'vaultLock'}),'Arşiv kilitlendi.')){clearVaultPasswords();await refresh();}
  });
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.tab)));
  $('taskForm').addEventListener('submit',async e=>{
    e.preventDefault();const id=$('editingId').value;
    if($('allowPublicGitHub').checked&&!confirm('Bu görevde onaylanan raporlar herkese açık GitHub dalında görülebilir. Devam edilsin mi?'))return;
    if(await act(send({type:id?'updateTask':'createTask',...(id?{id}:{}),payload:taskPayload()}),'Görev kaydedildi.'))resetForm();
  });
  $('clearTask').addEventListener('click',resetForm);
  const open=()=>chrome.tabs.create({url:'https://chat.deepseek.com/'});
  $('openDeepSeek').addEventListener('click',open);$('openChat').addEventListener('click',open);
  $('copyPrompt').addEventListener('click',()=>copy($('runPrompt').value));
  $('saveResult').addEventListener('click',async()=>{
    if(!selectedRunId)return notice('Önce bir tur seç.',true);
    if(await act(send({type:'completeRun',id:selectedRunId,output:$('modelOutput').value}),
      'Yanıt kaydedildi; seçilen bağlantılara aktarım denendi.'))await updateConnections();
  });
  $('skipRun').addEventListener('click',()=>{
    if(!selectedRunId)return;
    if(confirm('Bu bekleyen tur atlanacak. Yanıt kaydedilmeyecek.'))act(send({type:'skipRun',id:selectedRunId}),'Tur atlandı.');
  });
  $('retryRunSync').addEventListener('click',()=>{
    if(!selectedRunId)return;
    if(confirm('Seçilen onaylı rapor için aktif Google Drive/GitHub aktarımını yeniden denemek istiyor musun?'))
      act(send({type:'syncNow',id:selectedRunId}),'Bu tur için senkronizasyon denendi.');
  });
  $('approvePublicRun').addEventListener('click',()=>{
    if(!selectedRunId)return;
    const run=snapshot.runs.find(r=>r.id===selectedRunId);
    if(!run?.sourceRepo)return notice('Turun deposu bulunamadı.',true);
    if(confirm(`${run.sourceRepo} deposu herkese açık olabilir. Bu turdaki TALİMAT VE YANIT tamamen yayımlanabilir. Bütün içeriği inceledin mi ve SADECE BU TURU açık GitHub aktarımına onaylıyor musun?`))
      act(send({type:'approvePublicRun',id:selectedRunId}),'Bu tura özel açık GitHub onayı kaydedildi. Tekrar senkronize et.');
  });
  $('syncAll').addEventListener('click',()=>{
    if(confirm('Tüm tamamlanmış raporların etkin bulut hedeflerine yeniden aktarılmasını denemek istiyor musun?'))
      act(send({type:'syncNow'}),'Aktarımlar yeniden denendi.');
  });
  $('exportBackup').addEventListener('click',()=>exportBackup(true).catch(e=>notice(e.message,true)));
  $('exportPlainBackup').addEventListener('click',()=>exportBackup(false).catch(e=>notice(e.message,true)));
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{
    try{await restoreBackup(e.target.files?.[0]);}catch(error){notice(error.message,true);}finally{$('importFile').value='';}
  });
  $('saveGithub').addEventListener('click',async()=>{
    const mode=$('encryptToken').checked?'encrypted':'session';
    const ok=await act(send({type:'saveGithubToken',mode,token:$('githubToken').value,password:$('vaultPassword').value}),
      mode==='encrypted'?'GitHub token şifreli kasaya kaydedildi.':'GitHub token oturuma kaydedildi.');
    if(ok){$('githubToken').value='';$('vaultPassword').value='';await updateConnections();}
  });
  $('unlockGithub').addEventListener('click',async()=>{
    if(await act(send({type:'unlockGithubToken',password:$('unlockPassword').value}),'GitHub kasası açıldı.')){
      $('unlockPassword').value='';await updateConnections();}
  });
  $('clearGithub').addEventListener('click',async()=>{
    if(!confirm('GitHub token ve şifreli kasa yerel olarak silinsin mi?'))return;
    await act(send({type:'clearGithubToken'}),'GitHub token ve kasa silindi.');await updateConnections();
  });
  $('testGithub').addEventListener('click',async()=>{
    try{const data=await send({type:'githubTest',repo:$('githubTestRepo').value});
      notice(`GitHub erişimi başarılı: ${data.name||$('githubTestRepo').value} / ${data.default_branch}${data.private?' · private':' · public'}`);
    }catch(e){notice(e.message,true);}
  });
  $('googleConnect').addEventListener('click',async()=>{
    await act(send({type:'googleConnect'}),'Google Drive bağlantısı kuruldu; uygulama klasörü hazır.');await updateConnections();
  });
  $('googleDisconnect').addEventListener('click',async()=>{
    if(!confirm('Eklentideki Google yetki önbelleği temizlensin mi? (Google hesabından erişimi ayrıca kaldırabilirsin.)'))return;
    await act(send({type:'googleDisconnect'}),'Google yetki önbelleği temizlendi.');await updateConnections();
  });
  $('saveSettings').addEventListener('click',()=>{
    if($('githubEnabled').checked&&!confirm('GitHub aktarımı yalnızca görev bazında ayrıca izin verilen public depolar ve private depolar için etkinleşecek. Devam edilsin mi?'))return;
    act(send({type:'saveSettings',driveEnabled:$('driveEnabled').checked,githubEnabled:$('githubEnabled').checked,
      desktopNotifications:$('desktopNotifications').checked}),'Tercihler kaydedildi.');
  });
  $('diagnostics').addEventListener('click',()=>runDiagnostics().catch(e=>notice(e.message,true)));
  $('runSchedulerNow').addEventListener('click',()=>act(send({type:'schedulerNow'}),'Zamanlayıcı kontrolü tamamlandı.'));
}
wireUI();refresh().catch(e=>notice(e.message,true));updateConnections();
setInterval(()=>refresh().catch(()=>{}),45000);
