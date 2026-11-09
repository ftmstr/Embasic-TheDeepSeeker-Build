'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const task={project:'Synthetic test',name:'Do not duplicate',instructions:'Never include other projects.',
  intervalHours:1,maxRuns:1,repo:'test/repo',enabled:true};
(async()=>{
  const h=harness();
  await h.route('createTask',{payload:task});
  const r=(await h.route('snapshot')).runs[0];
  await h.route('completeRun',{id:r.id,output:'Test result. SONRAKİ TUR ÖZETİ: completed.'});
  const state=h.buckets.local.embasicStateV2;
  state.settings.driveEnabled=true;state.settings.githubEnabled=true;
  const run=state.runs[0];run.driveSync='retry';run.githubSync='retry';run.syncConsent=true;
  run.driveAttempts=3;run.githubAttempts=3;
  const liveLease={id:'stale-but-live-lease',until:Date.now()+240_000};
  run.syncLease={drive:liveLease,github:liveLease};
  const future=Date.now()+180_000;run.driveRetryAfter=future;run.githubRetryAfter=future;
  await h.route('syncNow',{id:r.id});
  let after=await h.route('snapshot');
  assert.equal(after.runs[0].syncLease.drive.id,liveLease.id);
  assert.equal(after.runs[0].syncLease.github.id,liveLease.id);
  assert.equal(after.runs[0].driveAttempts,3);
  assert.equal(after.runs[0].githubAttempts,3);
  assert.equal(after.runs[0].driveRetryAfter,future);
  assert.equal(after.runs[0].githubRetryAfter,future);
  // A live Drive lease must not prevent independently resetting an expired
  // GitHub retry. Use a paused/blocked state to avoid external mock fetch.
  after.runs[0].syncLease.github.until=Date.now()-1;
  after.settings.githubEnabled=true;
  after.settings.driveEnabled=false;
  h.buckets.local.embasicStateV2=after;
  await h.route('syncNow',{id:r.id});
  after=await h.route('snapshot');
  assert.equal(after.runs[0].syncLease.drive.id,liveLease.id);
  assert.equal(after.runs[0].githubAttempts,1,'expired lease should permit a new attempt');
  assert.equal(after.runs[0].githubSync,'blocked','missing GitHub token fails closed');
  assert.equal(after.runs[0].driveAttempts,3,'different provider unchanged');
  console.log('PASS TUR005 leases: manual retry cannot steal persisted live leases; provider isolation; expired lease recovers');
})().catch(e=>{console.error(e);process.exitCode=1});
