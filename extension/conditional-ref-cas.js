'use strict';
/* TUR025 EXPERIMENTAL GraphQL updateRefs beforeOid protocol.
 * NOT used by production githubUpload/driveUpload. Requires independent live
 * capability/authorization checks before enabling. No distributed lease,
 * multi-provider atomicity, hardware anti-rollback or exactly-once claim.
 */
(function(root){
  const SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/, NONCE=/^[0-9a-f]{32,64}$/;
  const REPO_ID=/^[A-Za-z0-9_=-]{8,180}$/;
  const REF=/^refs\/heads\/embasic-fences\/[a-zA-Z0-9-]{8,72}\/[a-zA-Z0-9-]{8,72}$/;
  const QUERY='mutation($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }';
  function fail(code,msg){const e=new Error(msg);e.code=code;return e;}
  function validate(raw){
    if(!raw||!REPO_ID.test(raw.repositoryId||'')||!REF.test(raw.refName||'')||
      !SHA.test(raw.beforeOid||'')||!SHA.test(raw.afterOid||'')||raw.beforeOid===raw.afterOid||
      !DIGEST.test(raw.reportDigest||'')||!NONCE.test(raw.ownerNonce||''))
      throw fail('CAS_INVALID','Invalid immutable commit, reference or owner/digest identity.');
    const clientMutationId=`EMBASIC-CAS-V1:${raw.ownerNonce}:${raw.afterOid}`;
    return Object.freeze({repositoryId:raw.repositoryId,refName:raw.refName,
      beforeOid:raw.beforeOid,afterOid:raw.afterOid,reportDigest:raw.reportDigest,
      ownerNonce:raw.ownerNonce,clientMutationId});
  }
  function commitMessage(s){return ['EMBASIC-CAS-V1',`ref=${s.refName}`,`parent=${s.beforeOid}`,
    `sha256=${s.reportDigest}`,`nonce=${s.ownerNonce}`].join('\n');}
  function same(a,b){return !!a&&!!b&&['repositoryId','refName','beforeOid','afterOid','ownerNonce','reportDigest','clientMutationId']
    .every(k=>a[k]===b[k]);}
  async function lease(checkLease){
    if(typeof checkLease!=='function')throw fail('CAS_LEASE_DENIED','Positive live lease checker required.');
    let d=false;try { d=await checkLease(); }catch(_){}
    if(d!==true)throw fail('CAS_LEASE_DENIED','Lease decision missing, denied or failed.');
  }
  function parseRef(ref,s){
    if(!ref||ref.name!==s.refName||!SHA.test(ref.oid||''))
      throw fail('CAS_REF_UNVERIFIED','Remote exact ref name and OID must be independently verified.');
    return ref.oid;
  }
  async function observe(s,readRef,verifyCommit){
    if(typeof readRef!=='function'||typeof verifyCommit!=='function')
      throw fail('CAS_MISSING_DEPENDENCY','Remote read and immutable commit verification required.');
    const oid=parseRef(await readRef(s.refName),s);
    if(oid===s.afterOid){
      const c=await verifyCommit(oid);
      if(!c||c.oid!==s.afterOid||c.message!==commitMessage(s))
        throw fail('CAS_COMMIT_UNVERIFIED','Immutable commit must bind owner, ref, parent, and digest.');
      // An immutable commit proves identity, not that the mutable ref still
      // points at it. Re-read the exact ref after commit verification to
      // close the observable GET(ref) -> GET(commit) -> ref-move window.
      // This is only a detection gate, NOT a global linearizable snapshot.
      const confirmed=parseRef(await readRef(s.refName),s);
      if(confirmed!==s.afterOid)
        throw fail('CAS_REF_MOVED','Ref moved during immutable owner verification; deny stale ownership.');
      return {status:'owned',ref:s.refName,oid};
    }
    if(oid===s.beforeOid)return {status:'old',ref:s.refName,oid};
    return {status:'advanced',ref:s.refName,oid};
  }
  async function commit(raw,{graphql,readRef,verifyCommit,persistIntent,checkLease,previousIntent=null}={}){
    const s=validate(raw);
    if(typeof graphql!=='function'||typeof readRef!=='function'||typeof verifyCommit!=='function'||
       typeof persistIntent!=='function')throw fail('CAS_MISSING_DEPENDENCY','Provider and durable encrypted journal required.');
    if(previousIntent&&!same(previousIntent,s))throw fail('CAS_STALE_INTENT','Prior uncertain intent does not match this owner/report/ref.');
    await lease(checkLease);
    const initial=await observe(s,readRef,verifyCommit);
    await lease(checkLease);
    if(initial.status==='owned'){
      if(!previousIntent)throw fail('CAS_UNOWNED_EXISTING','Remote commit exists without a matching durable local intent.');
      return initial;
    }
    if(initial.status==='advanced')throw fail('CAS_CONFLICT','Expected ref head has advanced or belongs to a competing writer.');
    if(previousIntent)throw fail('CAS_UNCERTAIN_NO_REPLAY','Previous mutation may have committed. Never resubmit automatically.');
    await persistIntent({...s,status:'uncertain',kind:'GRAPHQL_UPDATE_REFS'});
    await lease(checkLease);
    const input={repositoryId:s.repositoryId,clientMutationId:s.clientMutationId,
      refUpdates:[{name:s.refName,beforeOid:s.beforeOid,afterOid:s.afterOid,force:false}]};
    let mutationError=null;
    try {
      const result=await graphql({query:QUERY,variables:{input}});
      if(!result||!result.data||!result.data.updateRefs||
         result.data.updateRefs.clientMutationId!==s.clientMutationId||
         (Array.isArray(result.errors)&&result.errors.length))
        throw fail('CAS_ACK_UNVERIFIED','GraphQL response did not prove accepted mutation receipt.');
    } catch(e) {mutationError=e;}
    // ACK does not constitute a durable CAS result. Verify fresh remote ref and
    // immutable owner-bound commit; never replay under any error or stale 404.
    let verified;
    try {verified=await observe(s,readRef,verifyCommit);}catch(e){
      if(e.code==='CAS_COMMIT_UNVERIFIED'||e.code==='CAS_REF_UNVERIFIED')throw e;
      throw fail('CAS_UNCERTAIN_NO_REPLAY','Readback failed after possible GraphQL COMMIT.');
    }
    if(verified.status==='owned'){
      await lease(checkLease);return verified;
    }
    if(verified.status==='advanced')throw fail('CAS_CONFLICT','Ref advanced; never overwrite or replay conditional mutation.');
    throw fail('CAS_UNCERTAIN_NO_REPLAY',mutationError?
      'GraphQL response failed and ref still old; mutation outcome unknown.':
      'GraphQL receipt not independently visible; do not retry.');
  }
  const api=Object.freeze({validate,commitMessage,commit,observe,QUERY});
  root.EmbasicConditionalRefCas=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
