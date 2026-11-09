'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  h.scope.ensureDriveFolder=async (_n,parent)=>parent?'project-id':'root-id';
  let posts=0,reads=0;
  h.scope.driveRequest=async (path,opts={})=>{
    if(path.startsWith('/drive/v3/files?'))return {files:[]};
    if(path.startsWith('/upload/drive/v3/files?')){posts++;return {id:'remote-file'};}
    if(path.startsWith('/drive/v3/files/remote-file?fields=')){
      reads++;const e=new Error('Google Drive API HTTP 404 (GET)');e.httpStatus=404;throw e;
    }
    throw new Error('Unexpected request '+path);
  };
  const r={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Synthetic',taskName:'Eventual',prompt:'p',output:'o'};
  await assert.rejects(h.scope.driveUpload(r), e=>e.httpStatus===404 && e.transient===true);
  assert.equal(posts,1,'eventually consistent read must not replay POST');assert.equal(reads,1);
  console.log('PASS TUR010 Drive eventual consistency: post-commit 404 is transient, no automatic mutating replay');
})().catch(e=>{console.error(e);process.exitCode=1});
