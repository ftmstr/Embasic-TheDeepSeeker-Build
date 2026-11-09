'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  let found=0,posts=0;
  h.scope.findDriveFolder=async()=>{found++;return null;};
  h.scope.driveRequest=async(path,opts)=>{
    if(path==='/drive/v3/files?fields=id'&&opts.method==='POST'){
      posts++;return {id:'bad id with spaces'};
    }
    throw Error('unexpected request '+path);
  };
  let err;
  try{await h.scope.ensureDriveFolder('EMBASIC DeepSeek Agent');}catch(e){err=e;}
  assert.ok(err?.remoteFolderCommitUncertain);
  assert.equal(err.remoteFolderCommitUncertain.name,'EMBASIC DeepSeek Agent');
  assert.equal(posts,1);assert.equal(found,2);
  await assert.rejects(h.scope.ensureDriveFolder('EMBASIC DeepSeek Agent',null,async()=>true,
    err.remoteFolderCommitUncertain),/yeni POST engellendi/);
  assert.equal(posts,1);
  console.log('PASS TUR011 malformed folder receipt: post-commit uncertainty and durable scope guard');
})().catch(e=>{console.error(e);process.exitCode=1});
