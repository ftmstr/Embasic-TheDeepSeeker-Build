'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const base={project:'Isolated A',name:'Original',instructions:'Synthetic version ONE',repo:'',intervalHours:1,maxRuns:2,enabled:true};
(async()=>{
  const h=harness();
  const taskId=await h.route('createTask',{payload:base});
  const run=(await h.route('snapshot')).runs[0];
  await h.route('completeRun',{id:run.id,output:'Reviewed original answer. SONRAKİ TUR ÖZETİ: Original only.'});
  await h.scope.modifyState(s=>{s.settings.driveEnabled=true;s.runs[0].driveSync='pending';});
  let writes=0;h.scope.driveUpload=async()=>{writes++};
  const old= (await h.route('snapshot')).tasks[0];
  await h.route('updateTask',{id:taskId,payload:{...old,instructions:'Synthetic version TWO',enabled:false}});
  // A run that predates an instruction revision is never automatically published.
  await h.route('syncNow',{id:run.id});
  assert.equal(writes,0,'old revision was sent to Drive');
  const state=await h.route('snapshot');
  assert.equal(state.runs[0].driveSync,'blocked');
  assert.match(state.runs[0].driveError,/Görev talimatı\/deposu değişti/);
  assert.ok(!state.tasks[0].latestSummary,'old summary must not survive instruction change');
  await h.scope.modifyState(s=>{s.runs[0].syncLease={drive:{id:'owner',until:Date.now()+300000}};});
  await assert.rejects(h.scope.assertLiveSyncLease(run.id,'drive','owner'),/yetkisi|sahibi/);
  assert.equal(writes,0);
  console.log('PASS TUR009 revision fence: stale instruction revision blocks outgoing sync, lease, and context reuse');
})().catch(e=>{console.error(e);process.exitCode=1});
