'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
async function scenario(competingSha){
  const h=harness();await h.route('createTask',{payload:{project:'Project B',name:'Two writers',instructions:'Sentinel test only',intervalHours:1,maxRuns:1,repo:'demo/repo'}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic approved report'});await h.route('saveSettings',{githubEnabled:true});
  const base='b'.repeat(40);h.scope.githubToken=async()=> 'fake-pat';
  let posts=0,puts=0,readback=false;
  h.scope.githubRequest=async(path,opts={})=>{
    if(path==='/repos/demo/repo')return {private:true,default_branch:'main'};
    if(path.endsWith('/git/ref/heads/main'))return {object:{sha:base}};
    if(path.includes('/git/ref/heads/embasic-agent/'))return readback?{object:{sha:competingSha}}:null;
    if(path.endsWith('/git/refs')&&opts.method==='POST'){
      posts++;readback=true;throw Object.assign(Error('GitHub API HTTP 422 (POST)'),{httpStatus:422});
    }
    if(path.includes('/contents/agent-reports/')){if(opts.method==='PUT'){puts++;return {}};return null;}
    throw Error('Unexpected '+path);
  };
  await h.route('syncNow',{id});const run=(await h.route('snapshot')).runs[0];
  assert.equal(posts,1);assert.equal(puts,competingSha===base?1:0);
  assert.equal(run.githubSync,competingSha===base?'synced':'blocked');
  if(competingSha!==base)assert.ok(run.githubUncertainBranch,'divergent branch remains quarantined');
}
(async()=>{
 await scenario('b'.repeat(40));
 await scenario('c'.repeat(40));
 console.log('PASS TUR014 competing independent writer: 422+matching branch reconciled, divergent branch fenced');
})().catch(e=>{console.error(e);process.exitCode=1});
