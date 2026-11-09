'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();
 await h.route('createTask',{payload:{project:'Synthetic',name:'Journal fail',instructions:'Only synthetic',intervalHours:1,maxRuns:1,repo:'test/repo'}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic reviewed output'});
 await h.route('saveSettings',{githubEnabled:true});
 h.scope.githubToken=async()=> 'fake';h.scope.ensureGithubBranch=async()=> 'embasic-agent/test';
 let writes=0;
 h.scope.githubRequest=async(path,opts={})=>{
   if(path==='/repos/test/repo')return {private:true};
   if(opts.method==='PUT'){writes++;return {content:{sha:'ok'}};}
   if(path.includes('/contents/'))return null;
   throw Error('unexpected request '+path);
 };
 const original=h.scope.chrome.storage.local.set;
 h.scope.chrome.storage.local.set=async obj=>{
   if(obj.embasicStateV2?.runs?.some(r=>r.githubUncertainCommit===true))throw Error('simulated storage crash before Github PUT');
   return original(obj);
 };
 await h.route('syncNow',{id});
 assert.equal(writes,0,'failed durable intent must fence remote write');
 const r=(await h.route('snapshot')).runs[0];assert.notEqual(r.githubSync,'synced');
 console.log('PASS TUR013 journal write failure: zero remote mutations when durable intent cannot commit');
})().catch(e=>{console.error(e);process.exitCode=1});
