'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const lockQueue=new Map();let grants=0;
const sharedLocks={request(name,opts,cb){
  assert.equal(opts.mode,'exclusive');
  const prior=lockQueue.get(name)||Promise.resolve();
  const current=prior.then(async()=>{grants++;return cb({name,mode:'exclusive'});});
  lockQueue.set(name,current.catch(()=>{}));return current;
}};
const sharedBuckets={local:{embasicRequireVaultV4:false},session:{}};
const task=(project)=>({project,name:`Synthetic ${project}`,instructions:'Only non-sensitive synthetic records',intervalHours:1,maxRuns:1});
(async()=>{
  const a=harness({sharedLocks,sharedBuckets});
  const b=harness({sharedLocks,sharedBuckets});
  await a.route('vaultCreate',{password:'tur016-shared-web-lock-test-pass'});
  await Promise.all([a.route('createTask',{payload:task('alpha')}),b.route('createTask',{payload:task('beta')})]);
  const snap=await b.route('snapshot');
  assert.equal(snap.tasks.length,2,'a second independent worker must not lose the first writer');
  assert.deepEqual(new Set(snap.tasks.map(t=>t.project)),new Set(['alpha','beta']));
  assert.equal(snap.runs.length,2,'due runs must remain one per task');
  assert.equal(new Set(snap.runs.map(r=>r.taskId)).size,2);
  assert.equal((await a.route('diagnostics')).crossContextWebLock,true);
  assert.equal((await a.route('diagnostics')).distributedCas,false);
  assert.ok(grants>=4,`expected shared browser-origin write locks, got ${grants}`);
  assert.ok(!JSON.stringify(sharedBuckets.local).includes('Synthetic alpha'), 'encrypted state leaked plaintext');
  console.log('PASS TUR016 two independent MV3-like isolates use one Web Locks queue for encrypted state edits (mock, not physical MV3)');
})().catch(e=>{console.error(e);process.exitCode=1});
