'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const unauthorized=()=>({ok:false,status:401,headers:{get:()=>null}});
(async()=>{
  const h=harness({googleOauth:true,fetch:async()=>unauthorized()});
  let i=0;const evicted=[];
  h.scope.chrome.identity.getAuthToken=async details=>{
    i++;assert.equal(details.interactive,false,'retry cannot trigger interactive reconsent');
    return {token:'invalid-'+i};
  };
  h.scope.chrome.identity.removeCachedAuthToken=async ({token})=>{evicted.push(token);};
  await assert.rejects(h.scope.driveRequest('/drive/v3/files?fields=id'),/HTTP 401/);
  assert.deepEqual(evicted,['invalid-1','invalid-2'],'both bad tokens must leave OAuth cache');
  assert.equal(i,2,'401 cannot cause unbounded refresh loop');
  assert.ok(!JSON.stringify(h.buckets.local).includes('invalid-1'));
  assert.ok(!JSON.stringify(h.buckets.local).includes('invalid-2'));
  console.log('PASS TUR006 OAuth: two consecutive HTTP 401 responses evict both bad tokens and stop retrying');
})().catch(e=>{console.error(e);process.exitCode=1});
