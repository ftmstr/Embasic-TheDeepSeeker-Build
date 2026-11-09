'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const base={project:'Single-flight',name:'Late ACK',instructions:'Synthetic project only.',intervalHours:1,maxRuns:1,repo:''};
(async()=>{
  const h=harness();
  await h.route('createTask',{payload:base});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic evidence. SONRAKİ TUR ÖZETİ: Good.'});
  const stored=h.buckets.local.embasicStateV2;
  stored.settings.driveEnabled=true;stored.runs[0].driveSync='pending';
  let writes=0;
  h.scope.driveUpload=async(_run,checkLease)=>{
    await checkLease();writes++;
    // Simulate remote commit success arriving AFTER the persisted owner expired.
    h.buckets.local.embasicStateV2.runs[0].syncLease.drive.until=Date.now()-20;
  };
  await h.route('syncNow',{id});
  let run=(await h.route('snapshot')).runs[0];
  assert.equal(writes,1);
  assert.equal(run.driveSync,'retry','expired lease must never be declared synced');
  assert.ok(run.driveRetryAfter>Date.now());
  assert.match(run.driveError,/lease süresi doldu/);
  // Restart / lease reclamation: a remote readback (mock) confirms the same
  // already-created bytes. No second remote mutation is needed.
  h.scope.driveUpload=async(_run,checkLease)=>{await checkLease();return;};
  await h.route('syncNow',{id});
  run=(await h.route('snapshot')).runs[0];
  assert.equal(run.driveSync,'synced');
  assert.equal(writes,1,'retry must be safe to reconcile without duplicate write');
  console.log('PASS TUR007 late ACK: expired owner cannot mark committed; subsequent readback-safe recovery');
})().catch(e=>{console.error(e);process.exitCode=1});
