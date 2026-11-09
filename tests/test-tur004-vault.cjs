'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const vm=require('node:vm');
const task=name=>({project:name,name:'Tek görev',instructions:'Yalnız bu proje raporlansın.',intervalHours:1,maxRuns:3,repo:'',enabled:true});
const pass='TUR004 strong local vault password for tests 2026';
(async()=>{
  const fresh=harness();delete fresh.buckets.local.embasicRequireVaultV4;
  assert.equal((await fresh.route('vaultStatus')).required,true,'fresh installs require encryption');
  await assert.rejects(fresh.route('createTask',{payload:task('New')}),/önce şifreli arşiv/);
  await fresh.listeners.installed({reason:'install'});
  assert.equal(fresh.buckets.local.embasicRequireVaultV4,true);
  await assert.rejects(fresh.route('saveSettings',{driveEnabled:true}),/önce şifreli arşiv/);
  await fresh.route('vaultCreate',{password:pass});
  const first=await fresh.route('createTask',{payload:task('Alpha')});
  const second=await fresh.route('createTask',{payload:task('Beta')});
  assert.equal((await fresh.route('snapshot')).tasks.length,2);
  await fresh.route('vaultLock');
  await assert.rejects(fresh.route('snapshot'),/KİLİTLİ/);
  await assert.rejects(fresh.route('schedulerNow'),/KİLİTLİ/);
  await fresh.route('vaultUnlock',{password:pass});
  let state=await fresh.route('snapshot');
  assert.equal(state.tasks.find(x=>x.id===first).project,'Alpha');
  assert.equal(state.tasks.find(x=>x.id===second).project,'Beta');
  // Corrupt current ciphertext; no plaintext fallback, manual recovery is required.
  await fresh.route('vaultLock');
  const sealed=fresh.buckets.local.embasicSealedStateV3;
  sealed.data=sealed.data.slice(0,-24)+'A'.repeat(24);
  await assert.rejects(fresh.route('vaultUnlock',{password:pass}),/yanlış|bozuk/);
  await assert.rejects(fresh.route('vaultRecover',{password:pass,confirmation:'EVET'}),/onayı/);
  await fresh.route('vaultRecover',{password:pass,confirmation:'KURTAR'});
  state=await fresh.route('snapshot');
  assert.equal(state.tasks.length,2,'last checkpoint survives latest ciphertext corruption');
  assert.equal(fresh.buckets.local.embasicStateV2,undefined);
  assert.equal(fresh.buckets.local.embasicStateV1,undefined);
  await assert.rejects(fresh.route('vaultRecover',{password:pass,confirmation:'KURTAR'}),/Etkin arşiv sağlam/);

  // Fault injected exactly at second save: backup checkpoint retains previous complete state.
  const faults=harness();await faults.route('vaultCreate',{password:pass});
  const alpha=await faults.route('createTask',{payload:task('Alpha')});
  const base=await faults.route('snapshot');assert.equal(base.tasks.length,1);
  const original=faults.scope.chrome.storage.local.set;
  let injected=false;
  faults.scope.chrome.storage.local.set=async function(data){
    if(Object.hasOwn(data,'embasicSealedStateV3')&&!injected){injected=true;throw Error('simulated power failure on sealed commit');}
    return original.call(this,data);
  };
  await assert.rejects(faults.route('createTask',{payload:task('Never committed')}),/power failure/);
  faults.scope.chrome.storage.local.set=original;
  state=await faults.route('snapshot');
  assert.equal(state.tasks.length,1);
  assert.equal(state.tasks[0].id,alpha);
  // On new install, a pre-existing cleartext v1.1 state can be read and migrated, not modified.
  const legacy=harness();legacy.buckets.local.embasicStateV2=JSON.parse(JSON.stringify(base));
  await legacy.listeners.installed({reason:'update'});
  assert.equal((await legacy.route('vaultStatus')).required,true);
  await assert.rejects(legacy.route('createTask',{payload:task('Unsealed mutation')}),/önce şifreli arşiv/);
  await legacy.route('vaultCreate',{password:pass});
  assert.equal((await legacy.route('snapshot')).tasks.length,1);
  assert.ok(!JSON.stringify(legacy.buckets.local).includes('Yalnız bu proje'));
  console.log('PASS TUR004 vault: mandatory fresh install, upgrade migration, locked scheduler, ciphertext recovery, crash consistency');
})().catch(e=>{console.error(e);process.exitCode=1});
