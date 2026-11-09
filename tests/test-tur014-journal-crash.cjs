'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  // Failure of durable GitHub branch-create intent prevents ANY ref POST.
  const h=harness();
  await h.route('createTask',{payload:{project:'X',name:'Crash before remote mutation',instructions:'Test',intervalHours:1,maxRuns:1,repo:'x/repo'}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic result reviewed.'});await h.route('saveSettings',{githubEnabled:true});
  h.scope.githubToken=async()=> 'fake';const base='1'.repeat(40);
  let posts=0;
  h.scope.githubRequest=async(path,opts={})=>{
    if(path==='/repos/x/repo')return {private:true,default_branch:'main'};
    if(path.endsWith('/git/ref/heads/main'))return {object:{sha:base}};
    if(path.includes('/git/ref/heads/embasic-agent/'))return null;
    if(path.endsWith('/git/refs')&&opts.method==='POST'){posts++;return {};}
    throw Error('Unexpected '+path);
  };
  const save=h.scope.chrome.storage.local.set;
  h.scope.chrome.storage.local.set=async data=>{
    if(data.embasicStateV2?.runs?.some(x=>x.githubUncertainBranch))throw Error('synthetic sealed journal disk full');
    return save(data);
  };
  await h.route('syncNow',{id});assert.equal(posts,0);
  // Same fail-closed rule for Drive multipart intent; skip folder creation.
  const d=harness({googleOauth:true});await d.route('createTask',{payload:{project:'Y',name:'Drive disk full',instructions:'Synthetic',intervalHours:1,maxRuns:1}});
  const rid=(await d.route('snapshot')).runs[0].id;
  await d.route('completeRun',{id:rid,output:'Reviewed test response.'});
  await d.route('saveSettings',{driveEnabled:true});
  d.scope.ensureDriveFolder=async(n,parent)=>parent?'projectId':'rootId';
  let uploads=0;d.scope.driveRequest=async(path,opts={})=>{
    if(path.startsWith('/drive/v3/files?q='))return {files:[]};
    if(path.startsWith('/upload/drive/v3/files?')&&opts.method==='POST'){uploads++;return{id:'must-not-happen'};}
    throw Error('Unexpected Drive '+path);
  };
  const dsave=d.scope.chrome.storage.local.set;
  d.scope.chrome.storage.local.set=async data=>{
    if(data.embasicStateV2?.runs?.some(x=>x.driveUncertainCommit))throw Error('synthetic write-intent failure');
    return dsave(data);
  };
  await d.route('syncNow',{id:rid});assert.equal(uploads,0);
  console.log('PASS TUR014 crash before branch/Drive multipart durable intent: remote POST count zero');
})().catch(e=>{console.error(e);process.exitCode=1});
