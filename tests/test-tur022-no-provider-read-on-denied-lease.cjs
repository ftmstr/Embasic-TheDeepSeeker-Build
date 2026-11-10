'use strict';
const assert=require('node:assert/strict');
const api=require('../extension/remote-claim.js');
const {githubServer}=require('./tur017-mock-github.cjs');
(async()=>{
  // Prevent reads, not merely POST, if the worker lost local authority.
  for (const answer of [undefined,false,null,0,'true']) {
    const server=githubServer(), claim=server.claim();
    let calls=0, stored=0;
    const request=async(...args)=>{calls++;return server.request(...args);};
    await assert.rejects(api.acquire(claim,{request,persistIntent:async()=>{stored++;},
      checkLease:async()=>answer}),{code:'CLAIM_LEASE_DENIED'});
    assert.equal(calls,0,'a denied lease may not read remote provider metadata');
    assert.equal(stored,0,'a denied lease may not create a durable POST intent');
    assert.equal(server.stats.post,0);
    await assert.rejects(api.acquire(claim,{request,persistIntent:async()=>true}),
      {code:'CLAIM_LEASE_DENIED'});
    assert.equal(calls,0,'absent checkLease may not fetch remote metadata');
  }
  // A valid checker permits the initial read, but a lease revoked DURING that
  // read must deny all subsequent mutation even if the provider says unknown.
  const s=githubServer(),c=s.claim();let valid=true,reads=0,writes=0;
  const request=async(path,opts)=>{reads++;if(path.includes('/git/ref/heads/')){
    valid=false;return null;
  }if(opts?.method==='POST')writes++;return s.request(path,opts);};
  await assert.rejects(api.acquire(c,{request,checkLease:async()=>valid,
    persistIntent:async()=>assert.fail('intent must never persist after revocation')}),
    {code:'CLAIM_LEASE_DENIED'});
  assert.equal(reads,1,'initial authorized GET is allowed');
  assert.equal(writes,0,'post-read revocation cannot authorize POST');
  assert.equal(s.stats.post,0);
  console.log('PASS TUR022 fail-closed preflight: revoked/missing lease sends zero provider GET/POST; mid-read revoke denies mutation (mock)');
})().catch(e=>{console.error(e);process.exitCode=1});
