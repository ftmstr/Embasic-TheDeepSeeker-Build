'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();
 await h.route('createTask',{payload:{project:'Lease Project',name:'In-flight GitHub',instructions:'Synthetic only',intervalHours:1,maxRuns:1,repo:'test/repo'}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic response'});await h.route('saveSettings',{githubEnabled:true});
 h.scope.githubToken=async()=> 'fake';h.scope.ensureGithubBranch=async()=> 'embasic-agent/test';
 let writes=0;
 h.scope.githubRequest=async(path,opts={})=>{
   if(path==='/repos/test/repo')return {private:true};
   if(opts.method==='PUT'){writes++;return {content:{sha:'unknown'}};}
   if(path.includes('/contents/'))return null;
   throw Error('unexpected '+path);
 };
 const original=h.scope.modifyState;
 h.scope.modifyState=async fn=>{
   const result=await original(fn);
   if(h.buckets.local.embasicStateV2?.runs?.[0]?.githubUncertainCommit===true){
     // Race: lease is stolen after persistent journal but BEFORE PUT starts.
     h.buckets.local.embasicStateV2.runs[0].syncLease.github={id:'different-worker',until:Date.now()+500000};
   }
   return result;
 };
 await h.route('syncNow',{id});
 assert.equal(writes,0,'lease stolen before PUT must fence write');
 const r=(await h.route('snapshot')).runs[0];assert.equal(r.githubUncertainCommit,true);
 assert.notEqual(r.githubSync,'synced');
 console.log('PASS TUR013 pre-PUT stolen lease: journal retained, remote write fenced');
})().catch(e=>{console.error(e);process.exitCode=1});
