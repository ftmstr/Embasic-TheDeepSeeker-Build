'use strict';
const assert=require('node:assert/strict');
const api=require('../extension/remote-claim.js');
const {githubServer}=require('./tur017-mock-github.cjs');
(async()=>{
  const s=githubServer(),claim=s.claim();
  let lease=true;
  const deps={request:s.request,persistIntent:async()=>true,checkLease:async()=>lease};
  const first=await api.acquire(claim,deps);
  assert.equal(first.status,'owned');
  const posts=s.stats.post;
  lease=false;
  await assert.rejects(api.acquire(claim,deps),{code:'CLAIM_LEASE_DENIED'});
  assert.equal(s.stats.post,posts,'already-owned must not replay POST');
  lease=true;
  const prior={...claim};
  assert.equal((await api.acquire(claim,{...deps,previousIntent:prior})).status,'owned');
  lease=false;
  await assert.rejects(api.acquire(claim,{...deps,previousIntent:prior}),{code:'CLAIM_LEASE_DENIED'});
  assert.equal(s.stats.post,posts);
  // TUR020: omission of a caller-provided lease checker must fail closed,
  // including already-owned and verification-only paths. No mutation allowed.
  const before=s.stats.post;
  await assert.rejects(api.acquire(claim,{request:s.request,persistIntent:async()=>true}),
    {code:'CLAIM_LEASE_DENIED'});
  await assert.rejects(api.verifyBeforeWrite(claim,{request:s.request}),
    {code:'CLAIM_LEASE_DENIED'});
  await assert.rejects(api.acquire(claim,{request:s.request,persistIntent:async()=>true,
    checkLease:async()=>undefined}),{code:'CLAIM_LEASE_DENIED'});
  assert.equal(s.stats.post,before,'missing/indeterminate lease must never POST');
  console.log('PASS TUR020 explicit lease dependency fail-closed');
  console.log('PASS TUR019 already-owned claim revalidates live lease including persisted intent');
})().catch(e=>{console.error(e);process.exitCode=1});
