'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const pass='TUR007 synthetic very strong vault passphrase';
const task=p=>({project:p,name:'Crash-safe vault',instructions:'Synthetic-only plaintext never persisted',intervalHours:1,maxRuns:2});
(async()=>{
  const h=harness();delete h.buckets.local.embasicRequireVaultV4;
  await assert.rejects(h.route('createTask',{payload:task('Preinit')}),/şifreli arşiv/);
  await h.route('vaultCreate',{password:pass});
  await h.route('createTask',{payload:task('Good')});
  const initial=(await h.route('snapshot')).tasks;
  assert.equal(initial.length,1);
  const original=h.scope.chrome.storage.local.set;
  let fail=true;
  h.scope.chrome.storage.local.set=async function(data){
    if(fail&&Object.hasOwn(data,'embasicSealedStateV3')){fail=false;throw new Error('simulated crash BEFORE commit');}
    return original.call(this,data);
  };
  await assert.rejects(h.route('createTask',{payload:task('Uncommitted')}),/simulated crash/);
  h.scope.chrome.storage.local.set=original;
  assert.equal((await h.route('snapshot')).tasks.length,1);
  assert.ok(!JSON.stringify(h.buckets.local).includes('Uncommitted'));
  await h.route('vaultLock');
  await assert.rejects(h.route('snapshot'),/KİLİTLİ/);
  await h.route('vaultUnlock',{password:pass});
  assert.equal((await h.route('snapshot')).tasks[0].project,'Good');
  // Healthy active cannot be silently rolled back to old ciphertext.
  await assert.rejects(h.route('vaultRecover',{password:pass,confirmation:'KURTAR'}),/Etkin arşiv sağlam/);
  // Corruption must fail closed until explicit recovery, not revert silently.
  h.buckets.local.embasicSealedStateV3={...h.buckets.local.embasicSealedStateV3,data:'AAAA'};
  await assert.rejects(h.route('snapshot'),/OperationError|şifreli|authenticated|decrypt/i);
  await h.route('vaultRecover',{password:pass,confirmation:'KURTAR'});
  assert.equal((await h.route('snapshot')).tasks.length,1);
  assert.equal(h.buckets.local.embasicStateV2,undefined);
  console.log('PASS TUR007 vault crash: durable checkpoint, strict lock, explicit recovery and no plaintext fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
