'use strict';
const assert=require('node:assert/strict'),cas=require('../extension/conditional-ref-cas.js');
const a={repositoryId:'R_syntheticRepositoryID123',refName:'refs/heads/embasic-fences/task-12345/run-12345',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
(async()=>{
 let reads=0,writes=0,intents=0,goodLease=true;
 const d={readRef:async name=>{reads++;return {name,oid:a.beforeOid}},verifyCommit:async()=>{throw Error('should not read commit')},graphql:async()=>{writes++;return {}},persistIntent:async()=>{intents++},checkLease:async()=>goodLease};
 for(const decision of [false,null,undefined,0,'true']){
   reads=writes=intents=0;
   await assert.rejects(cas.commit(a,{...d,checkLease:async()=>decision}),{code:'CAS_LEASE_DENIED'});
   assert.equal(reads+writes+intents,0);
 }
 await assert.rejects(cas.commit(a,{...d,checkLease:async()=>{throw Error('revoked')}}),{code:'CAS_LEASE_DENIED'});
 assert.equal(reads,0);
 reads=writes=intents=0;
 await assert.rejects(cas.commit(a,{...d,persistIntent:async()=>{throw Error('disk full')}}));assert.equal(writes,0);
 reads=writes=intents=0;let calls=0;
 await assert.rejects(cas.commit(a,{...d,checkLease:async()=>++calls===1}),{code:'CAS_LEASE_DENIED'});
 assert.equal(writes,0);assert.equal(intents,0);
 for(const invalid of [{...a,beforeOid:a.afterOid},{...a,refName:'refs/heads/main'},{...a,ownerNonce:'x'}])
   await assert.rejects(cas.commit(invalid,d),{code:'CAS_INVALID'});
 // Cannot delegate GraphQL CAS semantics to an untrusted fake response.
 let after=a.beforeOid;
 const ignored={...d,readRef:async n=>({name:n,oid:after}),graphql:async()=>{writes++;return {data:{updateRefs:{clientMutationId:cas.validate(a).clientMutationId}}};}};
 await assert.rejects(cas.commit(a,ignored),{code:'CAS_UNCERTAIN_NO_REPLAY'});
 // TUR032: a fake successful GraphQL ACK plus matching ref OID is insufficient
 // if immutable commit metadata does not bind the original owner/digest.
 writes=intents=0;
 const forged={...d,
   readRef:async n=>({name:n,oid:writes?a.afterOid:a.beforeOid}),
   verifyCommit:async oid=>({oid,message:'FORGED OWNER OR REPORT DIGEST'}),
   graphql:async()=>{writes++;return {data:{updateRefs:{clientMutationId:cas.validate(a).clientMutationId}}};}};
 await assert.rejects(cas.commit(a,forged),{code:'CAS_COMMIT_UNVERIFIED'});
 assert.equal(writes,1);assert.equal(intents,1);
 // A durable uncertain intent must not be replayed, even if the ref still
 // appears unchanged after a lost ACK. A matching intent is not a retry permit.
 writes=intents=0;
 const previous=cas.validate(a);
 await assert.rejects(cas.commit(a,{...d,previousIntent:previous}),{code:'CAS_UNCERTAIN_NO_REPLAY'});
 assert.equal(writes,0);assert.equal(intents,0);
 // Different owner nonce cannot adopt another writer's durable intent.
 await assert.rejects(cas.commit({...a,ownerNonce:'3'.repeat(32)},
   {...d,previousIntent:previous}),{code:'CAS_STALE_INTENT'});
 assert.equal(writes,0);
 // TUR033: immutable commit verification alone cannot prove the mutable
 // ref still points to the owner's OID. A second exact-ref read is mandatory.
 const signed={oid:a.afterOid,message:cas.commitMessage(cas.validate(a))};
 let raceReads=0;
 await assert.rejects(cas.observe(cas.validate(a),async name=>({name,oid:++raceReads===1?a.afterOid:'c'.repeat(40)}),async()=>signed),{code:'CAS_REF_MOVED'});
 assert.equal(raceReads,2);
 raceReads=0;
 await assert.rejects(cas.observe(cas.validate(a),async name=>++raceReads===1?{name,oid:a.afterOid}:{name:'refs/heads/other',oid:a.afterOid},async()=>signed),{code:'CAS_REF_UNVERIFIED'});
 assert.equal(raceReads,2);
 raceReads=0;
 const stable=await cas.observe(cas.validate(a),async name=>{raceReads++;return {name,oid:a.afterOid}},async()=>signed);
 assert.equal(stable.status,'owned');assert.equal(raceReads,2);
 // A post-mutation status check cannot turn a stale writer into authority.
 // Before and after cases require external monotonic witness: NOT_PROVEN.
 console.log('PASS TUR025 fail-closed lease / journal / invalid ref / fake GraphQL receipt; real CAS & witness NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
