'use strict';
const assert=require('node:assert/strict');
const {githubServer}=require('./tur017-mock-github.cjs');
const api=require('../extension/remote-claim.js');
(async()=>{
 const s=githubServer(),c=s.claim(),foreign=s.claim({ownerNonce:'f'.repeat(32)});
 await api.acquire(c,{request:s.request,persistIntent:async()=>true,checkLease:async()=>true});
 await api.verifyBeforeWrite(c,{request:s.request,checkLease:async()=>true});
 const ref=api.refFor(c);s.refs.set(ref,foreign.claimSha);
 await assert.rejects(api.verifyBeforeWrite(c,{request:s.request,checkLease:async()=>true}),{code:'CLAIM_FOREIGN_OWNER'});
 s.refs.set(ref,c.claimSha);s.commits.set(c.claimSha,'FORGED OBJECT');
 await assert.rejects(api.verifyBeforeWrite(c,{request:s.request,checkLease:async()=>true}),{code:'CLAIM_COMMIT_MISMATCH'});
 s.commits.set(c.claimSha,api.messageFor(c));
 await assert.rejects(api.acquire({...c,reportDigest:'2'.repeat(64)},
   {request:s.request,previousIntent:c,persistIntent:async()=>assert.fail(),checkLease:async()=>true}),{code:'CLAIM_STALE_INTENT'});
 console.log('PASS TUR017 claim ref owner drift, forged commit metadata and changed report digest all fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
