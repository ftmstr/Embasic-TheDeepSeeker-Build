'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness(),password='tur015-recovery-import-replay-test';
 await h.route('vaultCreate',{password});
 await h.route('createTask',{payload:{project:'Recovered',name:'Old run',instructions:'Sentinel only',repo:'synthetic/repo',intervalHours:1,maxRuns:2}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Safe previous completion'});
 await h.route('saveSettings',{driveEnabled:true,githubEnabled:true});
 h.buckets.local.embasicSealedStateV3={...h.buckets.local.embasicSealedStateV3,data:'AAAA'};
 await h.route('vaultRecover',{password,confirmation:'KURTAR'});
 let state=await h.route('snapshot');
 assert.equal(state.runs[0].recoveryQuarantined,true);
 await assert.rejects(h.route('syncNow',{id}),/yeniden yayımlanamaz/);
 await assert.rejects(h.route('approvePublicRun',{id}),/public aktarım onayı yeniden verilemez/);
 state=await h.route('snapshot');assert.equal(state.runs[0].syncConsent,false);
 await h.route('vaultLock');await h.route('vaultUnlock',{password});
 await assert.rejects(h.route('syncNow',{id}),/yeniden yayımlanamaz/);
 // A distinct NEW run remains usable when user explicitly resumes the task;
 // the old quarantined run must never be synced by a bulk retry.
 await h.route('toggleTask',{id:state.tasks[0].id,enabled:true});
 let fresh=await h.route('snapshot');
 assert.ok(fresh.runs.some(r=>r.status==='waiting'&&r.recoveryQuarantined!==true));
 await assert.rejects(h.route('syncNow'),/yeniden yayımlanamaz/);
 console.log('PASS TUR015 recovered ciphertext cannot regain old remote consent via manual retry/public approval/lock-unlock');
})().catch(e=>{console.error(e);process.exitCode=1});
