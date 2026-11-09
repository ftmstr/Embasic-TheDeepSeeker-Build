'use strict';
const assert=require('node:assert/strict');
const api=require('../extension/remote-claim.js');
const {githubServer}=require('./tur017-mock-github.cjs');
(async()=>{
  for(const denied of [false,null,undefined,0,'true']){
    const s=githubServer(),c=s.claim();
    await assert.rejects(api.acquire(c,{request:s.request,persistIntent:async()=>true,checkLease:async()=>denied}),{code:'CLAIM_LEASE_DENIED'});
    assert.equal(s.stats.post,0,'no POST when lease callback denies');
    await assert.rejects(api.verifyBeforeWrite(c,{request:s.request,checkLease:async()=>denied}),{code:'CLAIM_LEASE_DENIED'});
    assert.equal(s.stats.post,0);
  }
  const s=githubServer(),c=s.claim();
  await assert.rejects(api.acquire(c,{request:s.request,persistIntent:async()=>true,checkLease:()=>{throw Error('fenced');}}),/fenced/);
  assert.equal(s.stats.post,0);
  console.log('PASS TUR018 non-boolean lease decisions fail closed before remote mutation');
})().catch(e=>{console.error(e);process.exitCode=1});
