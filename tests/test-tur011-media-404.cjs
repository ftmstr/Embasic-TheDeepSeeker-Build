'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  const r={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Synthetic',taskName:'Media 404',prompt:'s',output:'result'};
  h.scope.ensureDriveFolder=async(_n,parent)=>parent?'project-id':'root-id';
  const content=h.scope.reportText(r),digest=await h.scope.sha256Hex(content);
  let posts=0,mediaReads=0;
  h.scope.driveRequest=async(path,opts={})=>{
    if(path.startsWith('/drive/v3/files?'))return {files:[]};
    if(path.startsWith('/upload/drive/v3/files?')){posts++;return {id:'receipt-id'};}
    if(path.includes('receipt-id?fields='))return {id:'receipt-id',name:r.id+'.md',mimeType:'text/markdown',
      parents:['project-id'],appProperties:{embasicApp:'EMBASIC',embasicRun:r.id,embasicTask:r.taskId,embasicSha256:digest}};
    if(path.includes('receipt-id?alt=media')){
      mediaReads++;const e=new Error('Google Drive API HTTP 404 (GET)');e.httpStatus=404;throw e;
    }
    throw Error('Unexpected '+path);
  };
  await assert.rejects(h.scope.driveUpload(r),e=>e.httpStatus===404&&e.transient===true&&e.remoteCommitUncertain===true);
  assert.equal(posts,1);assert.equal(mediaReads,1);
  console.log('PASS TUR011 delayed media readback: 404 after accepted receipt is ambiguous, no second POST');
})().catch(e=>{console.error(e);process.exitCode=1});
