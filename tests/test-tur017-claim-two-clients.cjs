'use strict';
const assert=require('node:assert/strict');
const {githubServer}=require('./tur017-mock-github.cjs');
const api=require('../extension/remote-claim.js');
(async()=>{
 const s=githubServer(),a=s.claim({ownerNonce:'1'.repeat(32)}),b=s.claim({ownerNonce:'2'.repeat(32)});
 const posted=[];let readBarrier=0,release;
 const gate=new Promise(resolve=>release=resolve);
 // Both devices observe missing ref BEFORE one of them creates it.
 const client=async c=>api.acquire(c,{request:async(path,opts)=>{
   if(path.includes('/git/ref/heads/')&&!opts?.method){
     if(readBarrier<2){readBarrier++;if(readBarrier===2)release();await gate;}
   }
   return s.request(path,opts);
 },persistIntent:async marker=>posted.push(marker),checkLease:async()=>true});
 const results=await Promise.allSettled([client(a),client(b)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'CLAIM_FOREIGN_OWNER');
 assert.equal(s.stats.post,2,'two independent clients attempted one server-enforced create each');
 assert.equal(s.refs.size,1,'only ONE claimant may own the unique remote ref');
 assert.equal(posted.length,2,'both writers persisted uncertainty BEFORE attempting POST');
 // TUR021 NEGATIVE ACCEPTANCE: a successful create-only claim does not fence
 // a later, independent GitHub branch PUT. This is a deliberately unguarded
 // synthetic provider, NOT a live GitHub API or a production integration.
 const winner=results.find(x=>x.status==='fulfilled');
 assert.equal(winner.value.status,'owned');
 const branchState={sha:'a'.repeat(40),putCount:0};
 const unsafePut=async nextSha=>{branchState.sha=nextSha;branchState.putCount++;};
 await unsafePut('b'.repeat(40)); // unrelated profile changes branch after claim
 await unsafePut('c'.repeat(40)); // claimant can overwrite without provider CAS
 assert.equal(branchState.putCount,2);
 assert.equal(branchState.sha,'c'.repeat(40));
 assert.equal(s.refs.size,1,'claim remains unique while branch writes race');
 console.log('PASS TUR021 NEGATIVE synthetic branch PUT race: unique create-ref does NOT enforce later branch fencing; live provider NOT_RUN, PRODUCTION_NO_GO');
 console.log('PASS TUR017 two independent device-like claimants: one GitHub create-ref winner, loser fail-closed; MOCK server, live NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
