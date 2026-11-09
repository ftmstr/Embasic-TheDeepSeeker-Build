'use strict';
const assert=require('node:assert/strict');
const {harness,manifest}=require('./harness.cjs');
(async()=>{
  const {route,scope,buckets}=harness();
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.version,'1.14.0');
  assert.deepEqual(manifest.host_permissions.slice().sort(),['https://api.github.com/*','https://www.googleapis.com/*'].sort());
  assert.ok(!manifest.permissions.includes('scripting'));
  assert.ok(!manifest.permissions.includes('cookies'));
  await route('saveSettings',{driveEnabled:false,githubEnabled:false});
  const payload={project:'Proje: Dosya-A',name:'Ajan güvenlik',instructions:'Baska dosyaları karıştırmadan rapor üret.',
    intervalHours:1,maxRuns:2,repo:'',repoFile:'README.md',baseBranch:'',enabled:true};
  const id=await route('createTask',{payload});
  let s=await route('snapshot');
  assert.equal(s.tasks.length,1);assert.equal(s.runs.length,1);assert.equal(s.runs[0].status,'waiting');
  assert.match(s.runs[0].prompt,/Proje: Dosya-A/);
  await route('schedulerNow');s=await route('snapshot');assert.equal(s.runs.length,1,'one outstanding turn');
  const first=s.runs[0].id;
  await route('completeRun',{id:first,output:'İlk görev bitti. SONRAKİ TUR ÖZETİ: İkinci turda hata testleri.'});
  s=await route('snapshot');assert.equal(s.tasks[0].completedRuns,1);
  assert.match(s.tasks[0].latestSummary,/İkinci turda hata testleri/);
  await route('runNow',{id});s=await route('snapshot');
  assert.equal(s.runs.length,2);assert.match(s.runs[0].prompt,/İkinci turda hata testleri/);
  await route('completeRun',{id:s.runs[0].id,output:'İkinci tur güvenli ve başarıyla tamamlandı.'});
  s=await route('snapshot');assert.equal(s.tasks[0].completedRuns,2);assert.equal(s.tasks[0].enabled,false);
  await assert.rejects(route('runNow',{id}),/tur sınırına ulaştı/);
  await assert.rejects(route('createTask',{payload:{...payload,repo:'not a repo'}}),/owner\/repo/);
  await assert.rejects(route('createTask',{payload:{...payload,repoFile:'../secret.txt'}}),/yolu/);
  const unicode=vmEval(scope,'decodeBase64Utf8(encodeBase64Utf8("Türkçe: ğüşİ ☑️"))');
  assert.equal(unicode,'Türkçe: ğüşİ ☑️');
  const original=await route('snapshot');
  await route('restoreBackup',{payload:JSON.parse(JSON.stringify(original))});
  const restored=await route('snapshot');
  assert.equal(restored.tasks[0].enabled,false);
  assert.equal(restored.settings.driveEnabled,false);
  assert.equal(restored.runs[0].syncConsent,false);
  await assert.rejects(route('restoreBackup',{payload:{tasks:[{id:'oops'}],runs:[]}}),/kimliği/);
  // Legacy migration never retains plaintext github key.
  const legacy=harness();
  legacy.buckets.local.embasicStateV1={tasks:[],runs:[],logs:[],settings:{driveEnabled:false,githubEnabled:false}};
  legacy.buckets.local.githubPersistentToken='ghp_secretshouldnotpersist';
  await legacy.route('snapshot');assert.equal(legacy.buckets.local.githubPersistentToken,undefined);
  console.log('PASS core: MV3 permissions; task isolation; scheduled de-dup; max turns; summary; Unicode; backup restore; legacy token purge');
})().catch(e=>{console.error(e);process.exitCode=1});
function vmEval(scope,expression){return require('node:vm').runInContext(expression,scope);}
