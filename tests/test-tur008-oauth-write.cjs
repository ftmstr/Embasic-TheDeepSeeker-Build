'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  let calls=0,tokenEvicted=0,issued=0;
  const h=harness({googleOauth:true,fetch:async()=>{calls++;return {ok:false,status:401,headers:{get:()=>null}};}});
  h.scope.chrome.identity.getAuthToken=async()=>({token:`synthetic-token-${++issued}`});
  h.scope.chrome.identity.removeCachedAuthToken=async()=>{tokenEvicted++;};
  let err;
  try{await h.scope.driveRequest('/drive/v3/files',{method:'POST',body:'{}',contentType:'application/json'});}
  catch(e){err=e;}
  assert.equal(err?.code,'AMBIGUOUS_WRITE_401');
  assert.equal(err.transient,true);
  assert.equal(calls,1,'a 401 on POST must not trigger an immediate second POST');
  assert.equal(tokenEvicted,1);assert.equal(issued,1);
  assert.ok(!JSON.stringify(h.buckets.local).includes('synthetic-token'));
  console.log('PASS TUR008 OAuth write: ambiguous 401 evicts token without replaying mutating request');
})().catch(e=>{console.error(e);process.exitCode=1});
