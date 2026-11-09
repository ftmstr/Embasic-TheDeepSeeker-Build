'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness();
  await h.route('createTask',{payload:{project:'Fence A',name:'Atomic commit',instructions:'Only synthetic.',intervalHours:1,maxRuns:1,repo:''}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic answer. SONRAKİ TUR ÖZETİ: finished.'});
  h.buckets.local.embasicStateV2.settings.driveEnabled=true;
  h.buckets.local.embasicStateV2.runs[0].driveSync='pending';
  let remoteCalls=0,expireDuringCommit=false;
  h.scope.driveUpload=async (_run,checkLease)=>{await checkLease();remoteCalls++;expireDuringCommit=true;};
  const original=h.scope.modifyState;
  h.scope.modifyState=fn=>original(async state=>{
    // Simulate a suspension between the final preflight check and the serialized
    // durable 'synced' write. This is the check that TUR008 must fence.
    if(expireDuringCommit&&state.runs[0]?.syncLease?.drive){
      state.runs[0].syncLease.drive.until=Date.now()-1;
      expireDuringCommit=false;
    }
    return fn(state);
  });
  await h.route('syncNow',{id});
  const run=(await h.route('snapshot')).runs[0];
  assert.equal(remoteCalls,1);
  assert.equal(run.driveSync,'retry','last-millisecond lease expiry cannot become durable success');
  assert.match(run.driveError,/lease süresi doldu/);
  assert.equal(run.syncLease?.drive,undefined);
  console.log('PASS TUR008 atomic fencing: expiry between preflight and state commit becomes retry');
})().catch(e=>{console.error(e);process.exitCode=1});
