'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const run={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Synthetic',taskName:'Visibility flip',
  sourceRepo:'some/repo',status:'completed',prompt:'Synthetic',output:'Synthetic reviewed result'};
const task={id:'aaaaaaaaaaaaaaaa',project:'Synthetic',repo:'some/repo'};
(async()=>{
  const h=harness();let reads=0,writes=0;
  h.scope.githubToken=async()=> 'fake-local-token';
  h.scope.ensureGithubBranch=async()=> 'embasic-agent/aaaaaaaaaaaaaaaa';
  h.scope.githubRequest=async(path,opts={})=>{
    if(path==='/repos/some/repo')return {private:++reads===1,default_branch:'main'};
    if(path.includes('/contents/agent-reports/') && (!opts.method || opts.method==='GET'))return null;
    if(opts.method==='PUT'){writes++;return {content:{sha:'test'}};}
    throw Error('Unexpected request '+path);
  };
  await assert.rejects(h.scope.githubUpload(run,task),/görünürlüğü değişti/);
  assert.equal(reads,2,'repository must be rechecked before mutation');
  assert.equal(writes,0,'private-to-public visibility change allowed a write');
  // Explicit, per-run consent must remain the only exception; a task-level
  // preference alone is not sufficient for a previously completed run.
  reads=0;const reviewed={...run,publicConsentManual:true};
  await h.scope.githubUpload(reviewed,task);
  assert.equal(writes,1);
  console.log('PASS TUR010 GitHub privacy race: private-to-public flip fenced, explicit per-run approval');
})().catch(e=>{console.error(e);process.exitCode=1});
