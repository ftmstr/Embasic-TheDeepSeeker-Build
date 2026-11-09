'use strict';
/* TUR017 opt-in proof-of-concept, not activated for production.
 * A *trusted external monotonic service* must keep an unrollbackable latest
 * generation. A Chrome-local signature/key or mutable GitHub ref is NOT a
 * sufficient independent anti-rollback anchor. Only public key is on client.
 */
(function(root){
  const HEX=/^[a-f0-9]{64}$/;
  const ID=/^[A-Za-z0-9_-]{8,100}$/;
  function fail(code,text){const e=new Error(text);e.code=code;return e;}
  const b64decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  function canonical(w){
    return ['EMBASIC-WITNESS-V1',`vault=${w.vaultId}`,`generation=${w.generation}`,
      `cipherSha256=${w.cipherSha256}`].join('\n');
  }
  async function verify({vaultId,generation,cipherSha256,readWitness,pinnedPublicKeySpki,cryptoApi=crypto}={}){
    if(!ID.test(vaultId||'')||!Number.isSafeInteger(generation)||generation<1||!HEX.test(cipherSha256||''))
      throw fail('WITNESS_SNAPSHOT_INVALID','Local authenticated snapshot identity is invalid.');
    if(typeof readWitness!=='function'||typeof pinnedPublicKeySpki!=='string'||!pinnedPublicKeySpki)
      throw fail('WITNESS_UNCONFIGURED','Independent witness is required but not configured.');
    let w;
    try{w=await readWitness();}catch{throw fail('WITNESS_OFFLINE','Independent witness is unreachable; open and remote writes blocked.');}
    if(!w||w.vaultId!==vaultId||!Number.isSafeInteger(w.generation)||w.generation<1||
       !HEX.test(w.cipherSha256||'')||typeof w.signature!=='string')
      throw fail('WITNESS_INVALID','Invalid or foreign witness response.');
    let authentic=false;
    try{
      const key=await cryptoApi.subtle.importKey('spki',b64decode(pinnedPublicKeySpki),
        {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
      authentic=await cryptoApi.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,
        b64decode(w.signature),new TextEncoder().encode(canonical(w)));
    }catch{throw fail('WITNESS_SIGNATURE_INVALID','Witness signature could not be verified.');}
    if(!authentic)throw fail('WITNESS_SIGNATURE_INVALID','Witness signature does not match pinned key.');
    if(w.generation!==generation||w.cipherSha256!==cipherSha256)
      throw fail('WITNESS_ROLLBACK_OR_FORK','Valid older/forked ciphertext is not latest according to trusted witness.');
    return Object.freeze({status:'current',generation});
  }
  const api=Object.freeze({canonical,verify});root.EmbasicRollbackWitness=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
