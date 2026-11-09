'use strict';
/* TUR017 — EXPERIMENTAL GitHub create-once ref protocol.
 * This component is intentionally NOT wired into production uploads: a GitHub
 * ref claim is an atomic first-writer-wins *claim*, NOT an atomic GitHub+Drive
 * transaction, transferable lease or monotonic anti-rollback witness.
 * Provider tests are simulated; real official API acceptance is NOT_RUN.
 */
(function(root){
  const ID=/^[a-zA-Z0-9-]{8,72}$/;
  const SHA=/^[a-f0-9]{40}$/;
  const DIGEST=/^[a-f0-9]{64}$/;
  const NONCE=/^[a-f0-9]{32,64}$/;
  const REPO=/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
  function fail(code,message){const e=new Error(message);e.code=code;return e;}
  function validate(o){
    if(!o||!REPO.test(o.repo||'')||o.repo.includes('..')||!ID.test(o.taskId||'')||!ID.test(o.runId||'')||
       !SHA.test(o.claimSha||'')||!DIGEST.test(o.reportDigest||'')||!NONCE.test(o.ownerNonce||''))
      throw fail('CLAIM_INVALID','Remote claim identity has invalid repository, run, nonce, digest or SHA.');
    return Object.freeze({repo:o.repo,taskId:o.taskId,runId:o.runId,claimSha:o.claimSha,
      reportDigest:o.reportDigest,ownerNonce:o.ownerNonce});
  }
  const refFor=claim=>`refs/heads/embasic-claims/${claim.taskId}/${claim.runId}`;
  const pathFor=claim=>`/repos/${claim.repo.split('/').map(encodeURIComponent).join('/')}`;
  function messageFor(claim){return ['EMBASIC-CLAIM-V1',`repo=${claim.repo}`,`task=${claim.taskId}`,
    `run=${claim.runId}`,`sha256=${claim.reportDigest}`,`nonce=${claim.ownerNonce}`].join('\n');}
  function same(a,b){return a&&b&&['repo','taskId','runId','claimSha','reportDigest','ownerNonce'].every(k=>a[k]===b[k]);}
  async function readRef(claim,request){
    const ref=await request(`${pathFor(claim)}/git/ref/heads/embasic-claims/${claim.taskId}/${claim.runId}`,{allow404:true});
    if(ref===null)return null;
    if(!ref||ref.ref!==refFor(claim)||ref.object?.type!=='commit'||!SHA.test(ref.object?.sha||''))
      throw fail('CLAIM_REF_MALFORMED','Remote ref identity or commit SHA could not be verified.');
    return ref.object.sha;
  }
  async function verifyClaimCommit(claim,request){
    // A SHA equality alone does not establish that the claim object binds the
    // report digest + owner nonce. Verify the immutable Git commit message.
    const c=await request(`${pathFor(claim)}/git/commits/${claim.claimSha}`);
    if(!c||c.message!==messageFor(claim))
      throw fail('CLAIM_COMMIT_MISMATCH','Claim commit does not bind the expected owner and report bytes.');
  }
  async function observe(claim,request){
    const sha=await readRef(claim,request);
    if(sha===null)return {status:'unknown'};
    if(sha!==claim.claimSha)throw fail('CLAIM_FOREIGN_OWNER','A different independent writer owns the remote claim; do not write.');
    await verifyClaimCommit(claim,request);
    return {status:'owned',ref:refFor(claim),sha};
  }
  async function requireLease(checkLease){
    if(typeof checkLease!=='function'||await checkLease()!==true)
      throw fail('CLAIM_LEASE_DENIED','A current positive lease/fence decision is required.');
  }
  async function acquire(raw,{request,persistIntent,checkLease=async()=>true,previousIntent=null}={}){
    const claim=validate(raw);
    if(typeof request!=='function'||typeof persistIntent!=='function')
      throw fail('CLAIM_MISSING_DEPENDENCY','Remote claim requires provider read/write and durable encrypted journal.');
    if(previousIntent && !same(claim,previousIntent))
      throw fail('CLAIM_STALE_INTENT','A durable claim exists for another owner or report digest.');
    // Reconcile before creating. A remote ref may already exist for this run.
    const first=await observe(claim,request);
    if(first.status==='owned'){await requireLease(checkLease);return first;}
    if(previousIntent)throw fail('CLAIM_UNCERTAIN_NO_REPLAY',
      'Previous remote claim POST may have committed; stale GET 404 does not authorize replay.');
    await requireLease(checkLease);
    // Caller MUST persist intent before a potentially committed POST. If this
    // fails, no GitHub mutation is attempted.
    await persistIntent({...claim,ref:refFor(claim),status:'uncertain'});
    await requireLease(checkLease);
    try {
      await request(`${pathFor(claim)}/git/refs`,{method:'POST',
        body:{ref:refFor(claim),sha:claim.claimSha}});
    } catch(error){
      // 401/403/409/422/429 and transport errors can follow a remote COMMIT.
      // ONE read-only reconciliation, never a second POST in this call.
      try {const result=await observe(claim,request);if(result.status==='owned'){await requireLease(checkLease);return result;}}
      catch(e){if(e.code==='CLAIM_FOREIGN_OWNER'||e.code==='CLAIM_COMMIT_MISMATCH'||e.code==='CLAIM_REF_MALFORMED')throw e;}
      throw fail('CLAIM_UNCERTAIN_NO_REPLAY',
        'Claim POST ACK is uncertain; remote identity must be reconciled without replay.');
    }
    const verified=await observe(claim,request);
    if(verified.status!=='owned')throw fail('CLAIM_UNCERTAIN_NO_REPLAY',
      'Successful POST receipt without remote readback is not write authority.');
    await requireLease(checkLease);return verified;
  }
  async function verifyBeforeWrite(raw,{request,checkLease=async()=>true}={}){
    const claim=validate(raw);await requireLease(checkLease);
    const verified=await observe(claim,request);
    if(verified.status!=='owned')throw fail('CLAIM_NOT_VISIBLE','Claim is not visible; deny remote mutation.');
    await requireLease(checkLease);return verified;
  }
  const api=Object.freeze({validate,refFor,messageFor,acquire,verifyBeforeWrite});
  root.EmbasicRemoteClaim=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
