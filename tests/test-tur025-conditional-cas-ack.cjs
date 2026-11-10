'use strict';
const assert=require('node:assert/strict'),cas=require('../extension/conditional-ref-cas.js');
const a={repositoryId:'R_syntheticRepositoryID123',refName:'refs/heads/embasic-fences/task-12345/run-12345',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
(async()=>{
 let head=a.beforeOid,posts=0;const intents=[];
 const deps={readRef:async name=>({name,oid:head}),verifyCommit:async oid=>({oid,message:cas.commitMessage(cas.validate(a))}),persistIntent:async v=>intents.push(v),checkLease:async()=>true};
 const ok=await cas.commit(a,{...deps,graphql:async({variables})=>{posts++;head=a.afterOid;throw Error('network ACK lost');}});
 assert.equal(ok.status,'owned');assert.equal(posts,1);assert.equal(intents.length,1);
 const again=await cas.commit(a,{...deps,previousIntent:intents[0],graphql:async()=>{posts++;throw Error('SHOULD NOT POST');}});
 assert.equal(again.status,'owned');assert.equal(posts,1);
 head=a.beforeOid;
 await assert.rejects(cas.commit(a,{...deps,previousIntent:intents[0],graphql:async()=>{posts++;}}),{code:'CAS_UNCERTAIN_NO_REPLAY'});
 assert.equal(posts,1);
 // ACK w/o verified commit identity cannot be success; fail closed.
 const wrong={...deps,verifyCommit:async oid=>({oid,message:'FORGED'})};
 head=a.beforeOid;
 await assert.rejects(cas.commit(a,{...wrong,graphql:async({variables})=>{posts++;head=a.afterOid;return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};}}),{code:'CAS_COMMIT_UNVERIFIED'});
 assert.equal(posts,2);
 console.log('PASS TUR025 GraphQL lost ACK reconciliation, no repeated mutation, false/forged commit rejection; synthetic ONLY');
})().catch(e=>{console.error(e);process.exitCode=1});
