'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness();
  await h.route('createTask',{payload:{project:'Test Alpha',name:'Git branch ACK',instructions:'Only synthetic content',intervalHours:1,maxRuns:1,repo:'demo/repo'}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Reviewed synthetic response: complete.'});
  await h.route('saveSettings',{githubEnabled:true});
  h.scope.githubToken=async()=> 'fake-pat';
  const base='a'.repeat(40);let posts=0,puts=0,visible=false;
  h.scope.githubRequest=async(path,opts={})=>{
    if(path==='/repos/demo/repo')return {private:true,default_branch:'main'};
    if(path.endsWith('/git/ref/heads/main'))return {object:{sha:base}};
    if(path.includes('/git/ref/heads/embasic-agent/'))return visible?{object:{sha:base}}:null;
    if(path.endsWith('/git/refs')&&opts.method==='POST'){posts++;throw Error('network lost AFTER branch creation');}
    if(path.includes('/contents/agent-reports/')){
      if(opts.method==='PUT'){puts++;return {content:{sha:'safe'}};}
      return null;
    }
    throw Error('Unexpected '+path);
  };
  await h.route('syncNow',{id});
  let run=(await h.route('snapshot')).runs[0];
  assert.equal(posts,1);assert.equal(puts,0);assert.equal(run.githubSync,'retry');
  assert.equal(run.githubUncertainBranch.repo,'demo/repo');assert.equal(run.githubUncertainBranch.baseSha,base);
  await h.route('syncNow',{id});
  assert.equal(posts,1,'eventual GitHub ref 404 must never replay branch POST');assert.equal(puts,0);
  visible=true;
  await h.route('syncNow',{id});
  run=(await h.route('snapshot')).runs[0];
  assert.equal(posts,1);assert.equal(puts,1);assert.equal(run.githubSync,'synced');
  assert.equal(run.githubUncertainBranch,null);assert.equal(run.githubUncertainCommit,false);
  console.log('PASS TUR014 GitHub branch-create ACK loss: persisted branch fence, 404 no replay, readback reconciliation');
})().catch(e=>{console.error(e);process.exitCode=1});
