'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const fail=(status,headers={})=>({ok:false,status,headers:{get:key=>headers[key]||null}});
(async()=>{
  for(const status of [403,429]){
    let count=0;const h=harness({googleOauth:true,fetch:async()=>{count++;return fail(status,{'Retry-After':'4'});}});
    await assert.rejects(h.scope.driveRequest('/upload/drive/v3/files?uploadType=multipart',{method:'POST',body:new Blob(['synthetic'])}),
      err=>err.httpStatus===status);
    assert.equal(count,1,`Google Drive ${status} mutated request retried`);
  }
  const h=harness({googleOauth:true,fetch:async()=>fail(429,{'Retry-After':'90000'})});
  await assert.rejects(h.scope.driveRequest('/drive/v3/files'),err=>err.httpStatus===429&&err.retryAfterMs===3600000);
  console.log('PASS TUR010 OAuth/rate policy: Drive 403/429 never auto-repeat POST, Retry-After capped');
})().catch(e=>{console.error(e);process.exitCode=1});
