'use strict';
const assert=require('node:assert/strict');
const {githubServer}=require('./tur017-mock-github.cjs');
const api=require('../extension/remote-claim.js');
(async()=>{
 const s=githubServer(),c=s.claim();
 await assert.rejects(api.acquire(c,{request:s.request,persistIntent:async()=>{throw Error('storage write failure');},checkLease:async()=>true}),/storage write failure/);
 assert.equal(s.stats.post,0);
 await assert.rejects(api.acquire(c,{request:s.request,checkLease:async()=>{throw Error('lease fenced');},persistIntent:async()=>true}),{code:'CLAIM_LEASE_DENIED'});
 assert.equal(s.stats.post,0);
 await assert.rejects(api.acquire({...c,ownerNonce:'invalid'},{request:s.request,persistIntent:async()=>true,checkLease:async()=>true}),{code:'CLAIM_INVALID'});
 assert.equal(s.stats.post,0);
 console.log('PASS TUR017 failed encrypted intent, stale lease and malformed identity prevent all GitHub mutations');
})().catch(e=>{console.error(e);process.exitCode=1});
