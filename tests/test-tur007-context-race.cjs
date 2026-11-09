'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const basic=(project,name,repo='')=>({project,name,instructions:'Only the original synthetic instruction.',
  repo,repoFile:'README.md',intervalHours:1,maxRuns:3,enabled:false});
(async()=>{
  const h=harness();
  const id=await h.route('createTask',{payload:basic('Isolated A','A','alpha/repo')});
  const b=await h.route('createTask',{payload:basic('Isolated B','B')});
  let release,entered;
  const pending=new Promise(res=>{release=res});
  const seen=new Promise(res=>{entered=res});
  let contextCalls=0;
  h.scope.githubContext=async task=>{
    contextCalls++;
    if(task.id===id&&contextCalls===1){entered();await pending;return 'OLD REPO CONTEXT MUST NEVER LEAK';}
    return task.repo?'NEW REPOSITORY CONTEXT':'No repository';
  };
  for(const t of h.buckets.local.embasicStateV2.tasks){t.enabled=true;t.nextRunAt=Date.now()-10;}
  const firstTick=h.route('schedulerNow');
  await seen;
  // User changes the repository and instructions while remote read is pending.
  const old=h.buckets.local.embasicStateV2.tasks.find(t=>t.id===id);
  await h.route('updateTask',{id,payload:{...old,repo:'beta/repo',instructions:'Only the NEW instruction is allowed.'}});
  release();await firstTick;
  let state=await h.route('snapshot');
  assert.equal(state.runs.filter(r=>r.taskId===id).length,0,'stale context was committed after edit');
  assert.equal(state.runs.filter(r=>r.taskId===b).length,1,'unrelated project starved');
  assert.ok(!JSON.stringify(state.runs).includes('OLD REPO CONTEXT'));
  await h.route('schedulerNow');state=await h.route('snapshot');
  const created=state.runs.find(r=>r.taskId===id);
  assert.ok(created,'new revision should become schedulable');
  assert.match(created.prompt,/Only the NEW instruction/);
  assert.match(created.prompt,/NEW REPOSITORY CONTEXT/);
  assert.doesNotMatch(created.prompt,/OLD REPO CONTEXT/);
  assert.equal(state.runs.filter(r=>r.taskId===b).length,1);
  console.log('PASS TUR007 context race: concurrent task edit cannot combine stale GitHub data with new instructions; independent task proceeds');
})().catch(e=>{console.error(e);process.exitCode=1});
