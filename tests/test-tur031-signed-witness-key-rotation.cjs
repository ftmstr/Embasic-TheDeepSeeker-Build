'use strict';
/* TUR031 synthetic independent witness rotation gate. Signing + JWT-like
 * booleans alone do NOT create a nonrollbackable external monotonic anchor. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const old=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const fresh=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const owner='synthetic-owner',vault='synthetic-vault';
const digestA='a'.repeat(64),digestB='b'.repeat(64);
const canonical=e=>Buffer.from(JSON.stringify([e.owner,e.vault,e.epoch,e.generation,e.digest,e.nonce,e.expires]));
const sign=(epoch,generation,digest,nonce,key)=>{
 const record={owner,vault,epoch,generation,digest,nonce,expires:1100};
 return {...record,signature:crypto.sign('sha256',canonical(record),key).toString('base64')};
};
const stale=sign(1,12,digestA,'request-1',old.privateKey);
const newer=sign(2,13,digestB,'request-2',fresh.privateKey);
const deny=code=>{throw Object.assign(new Error(code),{code});};
function verify(receipt,snapshot,request,anchor){
 if(!anchor || anchor.independentlyFresh!==true || !Number.isSafeInteger(anchor.epoch) ||
   !Number.isSafeInteger(anchor.generation) || !/^[a-f0-9]{64}$/.test(anchor.digest||'')) deny('WITNESS_EXTERNAL_ANCHOR_NOT_PROVEN');
 if(receipt.owner!==owner || receipt.vault!==vault || receipt.nonce!==request || receipt.expires<=1000)
    deny('WITNESS_BINDING_INVALID');
 const trustedKey=anchor.publicKeys[receipt.epoch];
 if(!trustedKey || receipt.epoch!==anchor.epoch) deny('WITNESS_ROTATED_KEY_REJECTED');
 const verified=crypto.verify('sha256',canonical(receipt),trustedKey,Buffer.from(receipt.signature||'','base64'));
 if(!verified)deny('WITNESS_SIGNATURE_INVALID');
 if(receipt.generation!==anchor.generation || receipt.digest!==anchor.digest ||
  snapshot.generation!==receipt.generation || snapshot.digest!==receipt.digest)
   deny('WITNESS_STALE_OR_EQUIVOCATED');
 return true;
}
const snapshotA={generation:12,digest:digestA},snapshotB={generation:13,digest:digestB};
const truth={independentlyFresh:true,epoch:2,generation:13,digest:digestB,publicKeys:{1:old.publicKey,2:fresh.publicKey}};
assert.equal(verify(newer,snapshotB,'request-2',truth),true);
assert.throws(()=>verify(stale,snapshotA,'request-1',truth),{code:'WITNESS_ROTATED_KEY_REJECTED'});
assert.throws(()=>verify(newer,snapshotA,'request-2',truth),{code:'WITNESS_STALE_OR_EQUIVOCATED'});
assert.throws(()=>verify(newer,snapshotB,'request-1',truth),{code:'WITNESS_BINDING_INVALID'});
assert.throws(()=>verify({...newer,signature:stale.signature},snapshotB,'request-2',truth),{code:'WITNESS_SIGNATURE_INVALID'});
assert.throws(()=>verify(newer,snapshotB,'request-2',null),{code:'WITNESS_EXTERNAL_ANCHOR_NOT_PROVEN'});
assert.throws(()=>verify(newer,snapshotB,'request-2',{...truth,independentlyFresh:false}),{code:'WITNESS_EXTERNAL_ANCHOR_NOT_PROVEN'});
// Negative proof: a fully restored local trust anchor + correctly signed old
// ciphertext/authentication can be replayed; the caller can forge a boolean.
const rolledBack={...truth,epoch:1,generation:12,digest:digestA};
assert.equal(verify(stale,snapshotA,'request-1',rolledBack),true);
console.log('PASS TUR031 witness rotation synthetic: epoch/key/owner/nonce/digest gates; old signed state accepted with rolled-back local anchor; LIVE witness NOT_RUN');
