'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness(),password='tur015-synthetic-sealed-write-check';
 await h.route('vaultCreate',{password});
 const set=h.scope.chrome.storage.local.set;
 let changed=false;
 h.scope.chrome.storage.local.set=async data=>{
   if(data.embasicSealedStateV3 && !changed){
     changed=true;
     // Simulate another worker replacing local ciphertext after a successful
     // set but before the winning worker can read back its own commit.
     await set(data);
     await set({embasicSealedStateV3:{...data.embasicSealedStateV3,iv:'AAAAAAAAAAAAAAAA'}});
     return;
   }
   return set(data);
 };
 await assert.rejects(h.route('createTask',{payload:{project:'Synthetic',name:'Readback',instructions:'No remote data',intervalHours:1,maxRuns:1}}),/başka çalışan/);
 assert.equal(changed,true);
 await assert.rejects(h.route('snapshot'),/decrypt|OperationError|authentication|failed|data|veri|şifre|Arşiv/i);
 console.log('PASS TUR015 post-write encrypted readback detects another writer clobber; invalid ciphertext is never silently accepted');
})().catch(e=>{console.error(e);process.exitCode=1});
