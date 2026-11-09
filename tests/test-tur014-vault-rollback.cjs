'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();const password='synthetic vault recovery password never reused';
 await h.route('vaultCreate',{password});
 await h.route('createTask',{payload:{project:'No replay project',name:'Recovery fence',instructions:'Use only fake data',intervalHours:1,maxRuns:2,repo:'demo/repo'}});
 const rid=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id:rid,output:'Approved synthetic response'});
 await h.route('saveSettings',{driveEnabled:true,githubEnabled:true});
 // Recovery now points to the snapshot before the latest write.
 h.buckets.local.embasicSealedStateV3={...h.buckets.local.embasicSealedStateV3,data:'AAAA'};
 await h.route('vaultRecover',{password,confirmation:'KURTAR'});
 const s=await h.route('snapshot');
 assert.equal(s.tasks.length,1);assert.equal(s.runs[0].status,'completed');
 assert.equal(s.tasks[0].enabled,false,'recovered scheduler must remain paused');
 assert.equal(s.runs[0].syncConsent,false,'checkpoint rollback cannot authorize old uploads');
 assert.equal(s.runs[0].githubSync,'blocked');assert.equal(s.runs[0].driveSync,'blocked');
 assert.deepEqual(Object.keys(s.runs[0].syncLease),[]);
 const before=s.runs.length;await h.route('schedulerNow');
 assert.equal((await h.route('snapshot')).runs.length,before);
 await h.route('vaultLock');await h.route('vaultUnlock',{password});
 assert.equal((await h.route('snapshot')).runs[0].syncConsent,false,'recovery quarantine must remain encrypted + durable');
 console.log('PASS TUR014 vault rollback quarantine: old consent, leases, scheduler suspended and encrypted');
})().catch(e=>{console.error(e);process.exitCode=1});
