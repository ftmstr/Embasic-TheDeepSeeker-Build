'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();const pass='synthetic-tur016-rollback-limit';
 await h.route('vaultCreate',{password:pass});
 await h.route('createTask',{payload:{project:'Early',name:'Before rollback',instructions:'Only synthetic',intervalHours:1,maxRuns:1}});
 const previouslyValid=structuredClone(h.buckets.local.embasicSealedStateV3);
 await h.route('createTask',{payload:{project:'Later',name:'After rollback',instructions:'Only synthetic',intervalHours:1,maxRuns:1}});
 assert.equal((await h.route('snapshot')).tasks.length,2);
 // Controlled adversarial replacement of browser storage: no external
 // append-only witness exists to establish which valid ciphertext is newer.
 h.buckets.local.embasicSealedStateV3=previouslyValid;
 await h.route('vaultLock');await h.route('vaultUnlock',{password:pass});
 const state=await h.route('snapshot');
 assert.equal(state.tasks.length,1,'valid older ciphertext can be replayed by an attacker with storage access');
 assert.equal((await h.route('diagnostics')).distributedCas,false);
 console.log('PASS TUR016 EXPECTED LIMIT: AES-GCM authenticates bytes but cannot detect attacker rollback of a complete valid ciphertext without external monotonic anchor; PRODUCTION_NO_GO');
})().catch(e=>{console.error(e);process.exitCode=1});
