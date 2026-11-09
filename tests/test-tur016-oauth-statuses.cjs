'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const response=(status,headers={})=>({status,ok:status>=200&&status<300,headers:{get:k=>headers[k]||null},json:async()=>({}),text:async()=>''});
(async()=>{
 for(const status of [403,429]){
  let requests=0;
  const h=harness({googleOauth:true,fetch:async()=>{requests++;return response(status,{'Retry-After':'11'});}});
  await assert.rejects(h.scope.driveRequest('/drive/v3/files',{method:'POST',body:'{}'}),e=>{
    assert.equal(e.httpStatus,status);assert.equal(e.retryAfterMs,11000);
    if(status===403)assert.equal(e.transient,true);
    return true;
  });
  assert.equal(requests,1,`Google ${status} post should not replay`);
 }
 let gets=0,evictions=0;
 const read=harness({googleOauth:true,fetch:async()=>{gets++;return response(gets===1?401:403);}});
 read.scope.chrome.identity.removeCachedAuthToken=async()=>{evictions++};
 await assert.rejects(read.scope.driveRequest('/drive/v3/files',{method:'GET'}),e=>e.httpStatus===403);
 assert.equal(gets,2,'read-only Google 401 can refresh once but cannot loop after a 403');
 assert.equal(evictions,1);
 console.log('PASS TUR016 Google OAuth 403/429 mutation never replays; Retry-After respected, GET 401 refreshes at most once');
})().catch(e=>{console.error(e);process.exitCode=1});
