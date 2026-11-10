'use strict';
/* TUR028 synthetic, adversarial NON-PROOF: two independent browser profiles
 * cannot coordinate by local journals, Web Locks, or a caller-authenticated
 * witness flag. Uses NO Google/GitHub account or real network mutation. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cas = require('../extension/conditional-ref-cas.js');
const beforeOid='a'.repeat(40);
const refName='refs/heads/embasic-fences/task-12345/run-12345';
const baseline={repositoryId:'R_syntheticRepositoryID123',refName,beforeOid};
const A={...baseline,afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
const B={...baseline,afterOid:'c'.repeat(40),ownerNonce:'3'.repeat(32),reportDigest:'4'.repeat(64)};
function fail(code){return Object.assign(new Error(code),{code});}
async function testIndependentProfileCas(){
  let head=beforeOid, mutations=0, requests=0, readers=0;
  let release;const sameInitialRead=new Promise(resolve=>{release=resolve});
  const journals=[[],[]];
  const remote={
    readRef:async name=>{
      const observed=head;
      if(++readers<=2){if(readers===2)release();await sameInitialRead;}
      return {name,oid:observed};
    },
    verifyCommit:async oid=>({oid,message:cas.commitMessage(cas.validate(oid===A.afterOid?A:B))}),
    graphql:async ({variables})=>{
      requests++;
      const update=variables.input.refUpdates[0];
      assert.equal(update.force,false);
      assert.equal(update.beforeOid,beforeOid);
      assert.equal(update.name,refName);
      // This is a deliberately ATOMIC synthetic provider, NOT real GitHub.
      if(head!==update.beforeOid)throw fail('SYNTHETIC_SERVER_REJECTS_STALE_OID');
      head=update.afterOid;mutations++;
      return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};
    }
  };
  const clients=[A,B].map((candidate,i)=>cas.commit(candidate,{
    ...remote,checkLease:async()=>true,
    persistIntent:async intent=>{journals[i].push(structuredClone(intent));}
  }));
  const outcomes=await Promise.allSettled(clients);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'CAS_CONFLICT');
  assert.equal(mutations,1);assert.equal(requests,2);
  assert.equal(journals[0].length,1);assert.equal(journals[1].length,1);
  const loser=head===A.afterOid?B:A;
  const loserIndex=loser===A?0:1;
  let replayRequests=0;
  await assert.rejects(cas.commit(loser,{
    ...remote,
    graphql:async()=>{replayRequests++;throw Error('PROHIBITED REPLAY')},
    persistIntent:async()=>{throw Error('PROHIBITED RE-JOURNAL')},
    previousIntent:journals[loserIndex][0],checkLease:async()=>true
  }),{code:'CAS_CONFLICT'});
  assert.equal(replayRequests,0,'cross-profile stale intent must not replay');
  console.log('PASS TUR028 SYNTHETIC: independent profiles, atomic mock GraphQL beforeOid one winner; live GraphQL NOT_RUN');
}
async function testDriveCrossProfileAckLoss(){
  // Each Chrome profile owns a distinct local journal and Web Locks namespace.
  // No server-enforced Drive idempotency key is present in the hypothetical
  // multipart POST: even genuine local AES-GCM journals cannot fence it.
  const profileA={journal:[]},profileB={journal:[]},server={uploads:[]};
  const payload=Buffer.from('synthetic Drive report, no user content');
  const digest=crypto.createHash('sha256').update(payload).digest('hex');
  async function upload(profile,owner){
    profile.journal.push({owner,digest,status:'UNCERTAIN_ACK'});
    server.uploads.push({owner,digest});
    throw fail('SYNTHETIC_DRIVE_POST_ACK_LOST');
  }
  await assert.rejects(upload(profileA,'profile-A'),{code:'SYNTHETIC_DRIVE_POST_ACK_LOST'});
  await assert.rejects(upload(profileB,'profile-B'),{code:'SYNTHETIC_DRIVE_POST_ACK_LOST'});
  assert.equal(server.uploads.length,2,'two independent profiles can POST twice');
  assert.equal(profileA.journal.length,1);assert.equal(profileB.journal.length,1);
  assert.equal(server.uploads[0].digest,server.uploads[1].digest);
  const localRetry=profile=>profile.journal.some(r=>r.status==='UNCERTAIN_ACK')?'DENY':'ALLOW';
  assert.equal(localRetry(profileA),'DENY');assert.equal(localRetry(profileB),'DENY');
  assert.equal(localRetry({journal:[]}), 'ALLOW', 'new profile cannot know old uncertain POST');
  console.log('PASS TUR028 NEGATIVE: two browser-profile Drive POSTs on lost ACK; cross-profile exactly-once NOT_PROVEN');
}
async function testSignedOldWitnessReplay(){
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const owner='synthetic-owner-A',vault='synthetic-vault-A';
  const old={owner,vault,generation:1,digest:'7'.repeat(64)};
  const fresh={owner,vault,generation:2,digest:'8'.repeat(64)};
  function sign(record){return crypto.sign('sha256',Buffer.from(JSON.stringify(record)),privateKey)}
  const oldSignature=sign(old),freshSignature=sign(fresh);
  const verify=(record,sig)=>crypto.verify('sha256',Buffer.from(JSON.stringify(record)),publicKey,sig);
  assert.equal(verify(old,oldSignature),true);
  assert.equal(verify(fresh,freshSignature),true);
  assert.equal(verify({...old,owner:'attacker'},oldSignature),false);
  // Both signatures remain valid even after current generation advances.
  const attackerRollback={record:structuredClone(old),signature:oldSignature};
  assert.equal(verify(attackerRollback.record,attackerRollback.signature),true,
    'ECDSA authenticity alone cannot prove freshest generation');
  const requireIndependentFreshness=async (record,anchor)=>{
    if(typeof anchor?.readLatest!=='function')throw fail('TRUSTED_MONOTONIC_WITNESS_NOT_CONFIGURED');
    const latest=await anchor.readLatest(owner,vault);
    if(!latest || latest.generation!==record.generation || latest.digest!==record.digest)
      throw fail('WITNESS_STALE_OR_EQUIVOCATED');
    return true;
  };
  await assert.rejects(requireIndependentFreshness(old,null),{code:'TRUSTED_MONOTONIC_WITNESS_NOT_CONFIGURED'});
  // Mock-only: proof of rejection assuming a fresh protected oracle, NOT an
  // implementation or availability claim for such a service.
  const syntheticAnchor={readLatest:async()=>fresh};
  await assert.rejects(requireIndependentFreshness(old,syntheticAnchor),{code:'WITNESS_STALE_OR_EQUIVOCATED'});
  assert.equal(await requireIndependentFreshness(fresh,syntheticAnchor),true);
  console.log('PASS TUR028 NEGATIVE: genuine old ECDSA signature replay; independent monotonic oracle NOT_RUN');
}
(async()=>{await testIndependentProfileCas();await testDriveCrossProfileAckLoss();await testSignedOldWitnessReplay();})()
  .catch(e=>{console.error(e);process.exitCode=1});
