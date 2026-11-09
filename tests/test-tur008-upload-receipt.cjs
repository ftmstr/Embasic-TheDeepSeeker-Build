'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  h.scope.ensureDriveFolder=async (_name,parent)=>parent?'project01':'root01';
  let posts=0;
  h.scope.driveRequest=async (_url,opts={})=>{
    if(opts.method==='POST'){posts++;return {id:'invalid / id'};}
    return {files:[]};
  };
  const run={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Synthetic',taskName:'Receipt test',
    completedAt:'2026-11-09T10:00:00Z',prompt:'Synthetic prompt',output:'Synthetic answer'};
  await assert.rejects(h.scope.driveUpload(run),/belirsiz kimlik/);
  assert.equal(posts,1);
  console.log('PASS TUR008 Drive receipt: malformed upload id cannot mark run as synced');
})().catch(e=>{console.error(e);process.exitCode=1});
