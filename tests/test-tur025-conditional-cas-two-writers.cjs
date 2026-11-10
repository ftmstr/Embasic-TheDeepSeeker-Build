'use strict';
const assert=require('node:assert/strict');const cas=require('../extension/conditional-ref-cas.js');
const A={repositoryId:'R_syntheticRepositoryID123',refName:'refs/heads/embasic-fences/task-12345/run-12345',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
const B={...A,afterOid:'c'.repeat(40),ownerNonce:'3'.repeat(32),reportDigest:'4'.repeat(64)};
(async()=>{
 let head=A.beforeOid,mutations=0;const intents=[];const calls=[];let readBarrier=0,release;
 const barrier=new Promise(resolve=>release=resolve);
 const provider={
 readRef:async(name)=>{const observed=head;if(readBarrier<2){readBarrier++;if(readBarrier===2)release();await barrier;}return {name,oid:observed};},
 verifyCommit:async(oid)=>({oid,message:cas.commitMessage(oid===A.afterOid?cas.validate(A):cas.validate(B))}),
 graphql:async ({query,variables})=>{
   calls.push({query,variables});const u=variables.input.refUpdates[0];
   assert.match(query,/updateRefs/);assert.equal(u.force,false);assert.equal(u.beforeOid,A.beforeOid);
   if(head!==u.beforeOid)throw Error('synthetic server rejects stale beforeOid');
   head=u.afterOid;mutations++;
   return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};
 },persistIntent:async (v)=>intents.push(v),checkLease:async()=>true};
 const results=await Promise.allSettled([cas.commit(A,provider),cas.commit(B,provider)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'CAS_CONFLICT');
 assert.equal(mutations,1);assert.equal(intents.length,2);assert.equal(calls.length,2);
 assert([A.afterOid,B.afterOid].includes(head));
 console.log('PASS TUR025 conditional updateRefs independent writer synthetic atomic BEFORE_OID one-winner; live provider NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
