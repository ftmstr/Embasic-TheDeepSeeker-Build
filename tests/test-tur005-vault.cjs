'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const vm=require('node:vm');
const password='TUR005-safe-long-passphrase-synthetic-ONLY';
const task=(project)=>({project,name:'Isolated workflow',instructions:'Only synthetic project.',intervalHours:1,maxRuns:2,repo:'',enabled:true});
(async()=>{
  const h=harness();
  await h.route('vaultCreate',{password});
  await h.route('createTask',{payload:task('Alpha')});
  await h.route('createTask',{payload:task('Beta')});
  const oldRecovery=JSON.parse(JSON.stringify(h.buckets.local.embasicStateRecoveryV4));
  const oldActive=JSON.parse(JSON.stringify(h.buckets.local.embasicSealedStateV3));
  // Mimic a future password-based rekey which uses a fresh salt while keeping
  // a valid active envelope. TUR004 mistakenly tested it using the OLD key.
  h.scope.__pass=password;
  const updated=await vm.runInContext(`(async()=>{
    const active=await loadState();
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const key=await deriveStateBytes(__pass,salt);
    return encryptEnvelope(active,key,salt);
  })()`,h.scope);
  h.buckets.local.embasicSealedStateV3=JSON.parse(JSON.stringify(updated));
  assert.notEqual(updated.salt,oldRecovery.salt);
  await assert.rejects(h.route('vaultRecover',{password,confirmation:'KURTAR'}),/Etkin arşiv sağlam/);
  assert.equal(h.buckets.local.embasicSealedStateV3.salt,updated.salt,'healthy active vault must never be rolled back');
  // Corrupted active vault may be explicitly restored from the valid checkpoint.
  h.buckets.local.embasicSealedStateV3.data='AAAA';
  await h.route('vaultRecover',{password,confirmation:'KURTAR'});
  assert.equal(h.buckets.local.embasicSealedStateV3.salt,oldRecovery.salt);
  const state=await h.route('snapshot');
  assert.equal(state.tasks.length,2);
  assert.equal(state.tasks[0].project,'Alpha');
  assert.equal(state.tasks[1].project,'Beta');
  assert.ok(!JSON.stringify(h.buckets.local).includes('Only synthetic project'));
  console.log('PASS TUR005 vault: cross-salt healthy vault cannot be rolled back; corrupted active recovered explicitly; isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
