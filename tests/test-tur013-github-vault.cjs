'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();delete h.buckets.local.embasicRequireVaultV4;
 const password='synthetic secure passphrase never used elsewhere';
 await h.route('vaultCreate',{password});
 await h.route('createTask',{payload:{project:'Secret Project',name:'GitHub vault',instructions:'Synthetic only',intervalHours:1,maxRuns:1,repo:'test/repo'}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic content'});await h.route('saveSettings',{githubEnabled:true});
 h.scope.githubToken=async()=> 'fake';h.scope.ensureGithubBranch=async()=> 'embasic-agent/test';
 h.scope.githubRequest=async(path,opts={})=>{
   if(path==='/repos/test/repo')return {private:true};
   if(opts.method==='PUT')throw Error('fetch failed after remote commit');
   if(path.includes('/contents/'))return null;
   throw Error('unexpected '+path);
 };
 await h.route('syncNow',{id});
 assert.equal((await h.route('snapshot')).runs[0].githubUncertainCommit,true);
 assert.ok(!JSON.stringify(h.buckets.local).includes('Secret Project'),'plaintext leak in persistent state');
 await h.route('vaultLock');const locked=await h.route('diagnostics');
 assert.equal(locked.uncertainGithubCommits,null,'locked diagnostics leak aggregate job state');
 await h.route('vaultUnlock',{password});
 const r=(await h.route('snapshot')).runs[0];assert.equal(r.githubUncertainCommit,true);
 assert.equal((await h.route('diagnostics')).uncertainGithubCommits,1);
 console.log('PASS TUR013 GitHub pending journal survives encrypted lock/unlock without locked-state disclosure');
})().catch(e=>{console.error(e);process.exitCode=1});
