'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const a=harness(),b=harness(),password='throwaway-tur015-cross-worker-vault';
 await a.route('vaultCreate',{password});
 // Two separate worker V8 contexts with independent in-memory serial queues.
 // They deliberately point to ONE synthetic Chrome local/session profile.
 b.buckets.local=a.buckets.local;b.buckets.session=a.buckets.session;
 let collisions=0;const original=a.scope.saveState;
 a.scope.saveState=async(...args)=>{
   if(!collisions++){
     await b.route('createTask',{payload:{project:'Second worker',name:'Surviving update',instructions:'Unrelated synthetic project B',intervalHours:1,maxRuns:2}});
   }
   return original(...args);
 };
 await assert.rejects(a.route('createTask',{payload:{project:'First worker',name:'Stale write',instructions:'Unrelated synthetic project A',intervalHours:1,maxRuns:2}}),/başka çalışan/);
 const s=await b.route('snapshot');
 assert.equal(s.tasks.length,1,'stale writer must not overwrite independent committed task');
 assert.equal(s.tasks[0].project,'Second worker');
 assert.ok(s.runs.every(r=>r.project==='Second worker'));
 console.log('PASS TUR015 encrypted optimistic revision fence: independent worker stale snapshot cannot overwrite newer sealed state (not a CAS guarantee)');
})().catch(e=>{console.error(e);process.exitCode=1});
