'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const response=(status,retry)=>({ok:false,status,headers:{get:(key)=>key==='Retry-After'?retry:null}});
(async()=>{
  let requests=0;
  const h=harness({googleOauth:true,fetch:async()=>{requests++;return response(429,'180');}});
  const start=Date.now();
  let err;try{await h.scope.driveRequest('/drive/v3/files',{method:'POST',contentType:'application/json',body:'{}'});}catch(e){err=e;}
  assert.equal(requests,1,'rate-limited writes must not auto replay');
  assert.equal(err?.httpStatus,429);assert.equal(err?.retryAfterMs,180_000);
  assert.equal(h.scope.transientSyncError(err.message),true);
  const raw=h.scope.apiHttpError('Google Drive',response(429,new Date(start+7200000).toUTCString()),'POST');
  assert.equal(raw.retryAfterMs,3600000,'HTTP date backoff must be capped at one hour');
  const gh=h.scope.apiHttpError('GitHub',{status:403,headers:{get:k=>k==='X-RateLimit-Remaining'?'0':k==='X-RateLimit-Reset'?String(Math.ceil((Date.now()+100000)/1000)):null}},'PUT');
  assert.equal(gh.transient,true);assert.ok(gh.retryAfterMs>0&&gh.retryAfterMs<=3600000);
  console.log('PASS TUR009 rate limits: Google 429 no replay, Retry-After seconds/date cap, GitHub rate-limit 403');
})().catch(e=>{console.error(e);process.exitCode=1});
