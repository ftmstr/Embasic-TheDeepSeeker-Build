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
 // TUR024: a local compare/read before an unconditional PUT is a TOCTOU race.
 // Only a provider-enforced atomic expected-head predicate could fence a
 // competing writer. The simulation deliberately does NOT assert that GitHub
 // refs PATCH or Drive files.update implements that primitive.
 const head={sha:'d'.repeat(40),writes:0};
 const readHead=async()=>head.sha;
 const unconditionalPut=async sha=>{head.sha=sha;head.writes++;return {ok:true};};
 const observed=await readHead();
 await unconditionalPut('e'.repeat(40)); // independent writer wins meanwhile
 assert.equal(observed,'d'.repeat(40));
 await unconditionalPut('f'.repeat(40)); // stale claimant overwrites it
 assert.equal(head.sha,'f'.repeat(40),'read-then-PUT is NOT atomic CAS');
 const conditionalPut=async(expected,next)=>{
   if(head.sha!==expected)return {ok:false,code:'HEAD_MISMATCH'};
   head.sha=next;head.writes++;return {ok:true};
 };
 const denied=await conditionalPut('e'.repeat(40),'0'.repeat(40));
 assert.deepEqual(denied,{ok:false,code:'HEAD_MISMATCH'});
 assert.equal(head.sha,'f'.repeat(40),'a stale writer must not mutate');
 // A 2xx ACK or a readback alone is not evidence of a conditional primitive.
 const claimedCondition={expected:'f'.repeat(40),next:'1'.repeat(40)};
 await unconditionalPut('2'.repeat(40)); // concurrent commit after preflight
 await unconditionalPut(claimedCondition.next); // mock server ignores condition
 assert.equal(head.sha,claimedCondition.next);
 assert.notEqual(head.sha,'2'.repeat(40));
 console.log('PASS TUR024 NEGATIVE synthetic TOCTOU/ignored-condition PUT: provider CAS capability NOT_PROVEN; no live provider acceptance');
 console.log('PASS TUR021 NEGATIVE synthetic branch PUT race: unique create-ref does NOT enforce later branch fencing; live provider NOT_RUN, PRODUCTION_NO_GO');
 console.log('PASS TUR017 two independent device-like claimants: one GitHub create-ref winner, loser fail-closed; MOCK server, live NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
