'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const task=(project)=>({project,name:'Tur raporu',instructions:'Sadece kendi projesinin sonuçlarını raporla.',
  intervalHours:1,maxRuns:3,repo:'',repoFile:'README.md',baseBranch:'',enabled:true});
(async()=>{
  const h=harness();
  const id1=await h.route('createTask',{payload:task('Dosya A')});
  const id2=await h.route('createTask',{payload:task('Dosya B')});
  let snap=await h.route('snapshot');
  assert.equal(snap.tasks.length,2);
  assert.equal(snap.runs.length,2);
  assert.equal(snap.runs.filter(x=>x.project==='Dosya A').length,1);
  assert.equal(snap.runs.filter(x=>x.project==='Dosya B').length,1);
  assert.equal(h.buckets.local.embasicSealedStateV3,undefined);
  await assert.rejects(h.route('vaultCreate',{password:'short'}),/en az 12/);
  const password='LongUniqueVaultPassword-2026-OnlyForTests';
  assert.deepEqual(JSON.parse(JSON.stringify(await h.route('vaultCreate',{password}))),{tasks:2,runs:2});
  assert.equal(h.buckets.local.embasicStateV2,undefined,'plaintext V2 removed');
  assert.equal(h.buckets.local.embasicStateV1,undefined,'plaintext V1 removed');
  const envelope=h.buckets.local.embasicSealedStateV3;
  assert.equal(envelope.version,3);assert.equal(envelope.kdf,'PBKDF2-SHA256');
  assert.ok(!JSON.stringify(envelope).includes('Dosya A'));
  assert.ok(!JSON.stringify(envelope).includes('SONRAKİ TUR'));
  assert.equal((await h.route('vaultStatus')).unlocked,true);
  const first=h.buckets.local.embasicSealedStateV3.data;
  await h.route('completeRun',{id:snap.runs.find(r=>r.taskId===id1).id,
    output:'Dosya A bu tur başarılı. SONRAKİ TUR ÖZETİ: Yalnız Dosya A devam.'});
  assert.notEqual(h.buckets.local.embasicSealedStateV3.data,first,'fresh nonce / ciphertext on save');
  assert.equal(h.buckets.local.embasicStateV2,undefined);
  await h.route('vaultLock');
  assert.equal((await h.route('vaultStatus')).unlocked,false);
  assert.equal(h.buckets.session.embasicStateKeyV3,undefined);
  await assert.rejects(h.route('snapshot'),/KİLİTLİ/);
  await assert.rejects(h.route('createTask',{payload:task('C')}),/KİLİTLİ/);
  await assert.rejects(h.route('vaultUnlock',{password:'wrong-but-long-enough'}),/yanlış|bozuk/);
  await assert.rejects(h.route('snapshot'),/KİLİTLİ/);
  await h.route('vaultUnlock',{password});
  snap=await h.route('snapshot');
  assert.equal(snap.tasks.find(t=>t.id===id1).completedRuns,1);
  assert.equal(snap.tasks.find(t=>t.id===id2).completedRuns,0);
  assert.match(snap.tasks.find(t=>t.id===id1).latestSummary,/Yalnız Dosya A/);
  assert.equal(snap.tasks.find(t=>t.id===id2).latestSummary,'');
  // Simulated browser restart: copy disk ciphertext, not the in-memory session key.
  const reopened=harness();reopened.buckets.local.embasicSealedStateV3=JSON.parse(JSON.stringify(h.buckets.local.embasicSealedStateV3));
  assert.equal((await reopened.route('vaultStatus')).unlocked,false);
  await assert.rejects(reopened.route('snapshot'),/KİLİTLİ/);
  await reopened.route('vaultUnlock',{password});
  assert.equal((await reopened.route('snapshot')).tasks.length,2);
  // Interrupted V1.1->sealed migration: sealed prioritized, plaintext cleaned on unlock.
  reopened.buckets.local.embasicStateV2={tasks:[{id:'forgedtask123'}],runs:[]};
  await reopened.route('vaultLock');
  assert.equal((await reopened.route('vaultStatus')).needsCleanup,true);
  await reopened.route('vaultUnlock',{password});
  assert.equal(reopened.buckets.local.embasicStateV2,undefined);
  assert.equal((await reopened.route('snapshot')).tasks.length,2);
  // Tampered encrypted data must be rejected without fallback to plaintext.
  await reopened.route('vaultLock');
  const broken=reopened.buckets.local.embasicSealedStateV3;
  broken.data=broken.data.slice(0,-10)+'AAAAAAAAAA';
  await assert.rejects(reopened.route('vaultUnlock',{password}),/bozuk|yanlış/);
  await assert.rejects(reopened.route('snapshot'),/KİLİTLİ/);
  // Legacy V1 migration must preserve task and run history before encryption.
  const legacy=harness();
  legacy.buckets.local.embasicStateV1=JSON.parse(JSON.stringify(await h.route('snapshot')));
  delete legacy.buckets.local.embasicStateV2;
  await legacy.route('vaultCreate',{password});
  assert.equal(legacy.buckets.local.embasicStateV1,undefined);
  assert.equal(legacy.buckets.local.embasicStateV2,undefined);
  assert.equal((await legacy.route('snapshot')).tasks.length,2);
  console.log('PASS vault: AES-256-GCM at-rest, v1/v2 migration, wrong password, lock, restart, tamper, project isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
