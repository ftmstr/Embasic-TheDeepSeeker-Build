'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const success=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data});
(async()=>{
  let failContext=true,githubReads=0;
  const fetch=async(url)=>{
    if(url.includes('README.md')){
      githubReads++;
      if(failContext)throw Error('network failure from test fixture');
      return success({type:'file',content:btoa('Synthetic only')});
    }
    throw Error('unexpected URL '+url);
  };
  const h=harness({fetch});
  // Synthetic unexpected context-stage exception: normal network errors are
  // intentionally returned as contextual warnings for backward compatibility.
  const originalContext=h.scope.githubContext;
  h.scope.githubContext=async task=>{if(failContext&&task.repo)throw Error('synthetic unexpected context error');return originalContext(task);};
  // Prevent immediate task creation until we deliberately trigger a tick.
  const base={intervalHours:1,maxRuns:2,enabled:false,repoFile:'README.md',instructions:'Use synthetic data'};
  const a=await h.route('createTask',{payload:{...base,project:'Failing repo',name:'A',repo:'dummy/repo'}});
  const b=await h.route('createTask',{payload:{...base,project:'Independent',name:'B',repo:''}});
  for(const t of h.buckets.local.embasicStateV2.tasks){t.enabled=true;t.nextRunAt=Date.now()-1000;}
  await h.route('schedulerNow');
  let s=await h.route('snapshot');
  assert.equal(s.runs.length,1,'failed project starved independent scheduler task');
  assert.equal(s.runs[0].taskId,b);
  assert.equal(s.schedulerCheckpoint.deferredTasks,1);
  assert.ok(s.schedulerCheckpoint.lastTickAt&&Number.isFinite(Date.parse(s.schedulerCheckpoint.lastTickAt)));
  const locked=await h.route('diagnostics');
  assert.equal(locked.deferredTasks,null,'unsealed legacy data not exposed by safe diagnostics');
  assert.equal(locked.taskCount,null);
  failContext=false;
  await h.route('schedulerNow');s=await h.route('snapshot');
  assert.equal(s.runs.length,2);
  assert.equal(s.runs.filter(r=>r.taskId===a).length,1);
  assert.equal(s.runs.filter(r=>r.taskId===b).length,1,'waiting turn must not duplicate');
  assert.equal(s.schedulerCheckpoint.deferredTasks,0);
  assert.equal(githubReads,1);
  await h.route('vaultCreate',{password:'synthetic-password-for-tur006-vault'});
  const open=await h.route('diagnostics');
  assert.equal(open.deferredTasks,0);
  assert.equal(open.taskCount,2);
  await h.route('vaultLock');
  const d=await h.route('diagnostics');
  assert.equal(d.lastSchedulerAt,null,'checkpoint metadata leaked while locked');
  assert.equal(d.deferredTasks,null,'deferred counts leaked while locked');
  assert.equal(d.nextDueAt,null);
  console.log('PASS TUR006 scheduler: one failed project isolated, encrypted checkpoint, retry and no duplicate pending turn');
})().catch(e=>{console.error(e);process.exitCode=1});
