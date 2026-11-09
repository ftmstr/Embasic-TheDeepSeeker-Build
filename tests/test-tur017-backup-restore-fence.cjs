'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness(),password='synthetic-tur017-backup-revision';
 await h.route('vaultCreate',{password});
 const mk=project=>({project,name:'Task',instructions:'Synthetic only',intervalHours:1,maxRuns:2});
 await h.route('createTask',{payload:mk('Original')});
 const old=structuredClone(h.buckets.local.embasicSealedStateV3);
 const backup=structuredClone(await h.route('snapshot'));
 await h.route('createTask',{payload:mk('Independent newer writer')});
 const newer=structuredClone(h.buckets.local.embasicSealedStateV3);
 assert.equal((await h.route('snapshot')).tasks.length,2);
 // Simulate a stale worker starting against the earlier ciphertext, then an
 // independent worker committing the latest ciphertext BEFORE the final save.
 h.buckets.local.embasicSealedStateV3=old;
 const original=h.scope.saveState;let injected=0;
 h.scope.saveState=async(state,expectedStamp)=>{
   if(!injected++){h.buckets.local.embasicSealedStateV3=newer;}
   return original(state,expectedStamp);
 };
 await assert.rejects(h.route('restoreBackup',{payload:backup}),/başka çalışan/);
 assert.equal(injected,1);
 assert.deepEqual(h.buckets.local.embasicSealedStateV3,newer);
 assert.equal((await h.route('snapshot')).tasks.length,2,
   'restored stale backup MUST NOT clobber independent newer state');
 console.log('PASS TUR017 restoreBackup carries expected encrypted snapshot stamp; newer independent write cannot be lost');
})().catch(e=>{console.error(e);process.exitCode=1});
