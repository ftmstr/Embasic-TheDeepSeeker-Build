'use strict';
/* TUR030 synthetic signed witness *contract*, NOT a deployed independent
 * monotonic oracle. Authenticity != freshness; caller flags never authority. */
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const {publicKey:attackerKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const owner='synthetic-owner',vault='synthetic-vault',knownKeyId='pinned-test-key-01';
const oldSnapshot={owner,vault,generation:3,digest:'3'.repeat(64)};
const currentSnapshot={owner,vault,generation:4,digest:'4'.repeat(64)};
function canonical(envelope){return Buffer.from(JSON.stringify([envelope.keyId,envelope.owner,envelope.vault,envelope.requestNonce,envelope.generation,envelope.digest,envelope.issuedAt,envelope.expiresAt]));}
function signed(snapshot,nonce,issuedAt=1000,expiresAt=1100){
 const receipt={keyId:knownKeyId,owner:snapshot.owner,vault:snapshot.vault,requestNonce:nonce,generation:snapshot.generation,digest:snapshot.digest,issuedAt,expiresAt};
 return {...receipt,signature:crypto.sign('sha256',canonical(receipt),privateKey).toString('base64')};
}
function fail(code){throw Object.assign(new Error(code),{code});}
function assertBound(snapshot,receipt,nonce,{now=1030,minGeneration=4,pinnedKey=publicKey}={}){
 if(!pinnedKey || !receipt || receipt.keyId!==knownKeyId || receipt.owner!==owner||receipt.vault!==vault ||
 receipt.requestNonce!==nonce||!Number.isSafeInteger(receipt.issuedAt)||!Number.isSafeInteger(receipt.expiresAt)||
 receipt.issuedAt>now||receipt.expiresAt<=now||receipt.expiresAt-receipt.issuedAt>120)fail('WITNESS_FRESHNESS_UNPROVEN');
 if(!crypto.verify('sha256',canonical(receipt),pinnedKey,Buffer.from(receipt.signature||'', 'base64')))fail('WITNESS_SIGNATURE_INVALID');
 if(receipt.generation<minGeneration||snapshot.generation!==receipt.generation)fail('WITNESS_STALE');
 if(receipt.digest!==snapshot.digest)fail('WITNESS_EQUIVOCATION');
 return true;
}
const nonce1='nonce-A',nonce2='nonce-B', oldSigned=signed(oldSnapshot,nonce1), freshSigned=signed(currentSnapshot,nonce2);
assert.equal(assertBound(currentSnapshot,freshSigned,nonce2),true);
assert.throws(()=>assertBound(oldSnapshot,oldSigned,nonce1),{code:'WITNESS_STALE'});
assert.throws(()=>assertBound(currentSnapshot,freshSigned,nonce1),{code:'WITNESS_FRESHNESS_UNPROVEN'});
assert.throws(()=>assertBound(currentSnapshot,{...freshSigned,owner:'attacker'},nonce2),{code:'WITNESS_FRESHNESS_UNPROVEN'});
assert.throws(()=>assertBound(currentSnapshot,{...freshSigned,digest:oldSnapshot.digest},nonce2),{code:'WITNESS_SIGNATURE_INVALID'});
assert.throws(()=>assertBound(currentSnapshot,{...freshSigned,signature:oldSigned.signature},nonce2),{code:'WITNESS_SIGNATURE_INVALID'});
assert.throws(()=>assertBound(currentSnapshot,freshSigned,nonce2,{now:1101}),{code:'WITNESS_FRESHNESS_UNPROVEN'});
assert.throws(()=>assertBound(currentSnapshot,freshSigned,nonce2,{pinnedKey:attackerKey}),{code:'WITNESS_SIGNATURE_INVALID'});
assert.throws(()=>assertBound(currentSnapshot,freshSigned,nonce2,{pinnedKey:null}),{code:'WITNESS_FRESHNESS_UNPROVEN'});
// Without an independently protected last generation, replaying an old
// VALID signed reply plus old AES-GCM ciphertext still passes a fully
// authenticated local check if caller rolls minGeneration back too.
assert.equal(crypto.verify('sha256',canonical(oldSigned),publicKey,Buffer.from(oldSigned.signature,'base64')),true);
assert.equal(assertBound(oldSnapshot,oldSigned,nonce1,{minGeneration:3}),true);
// Even nonces cannot protect a lying or equivocating signer that issues a
// fresh valid signature of stale state; a real nonrollbackable witness must
// guard its own state and signing key, not just the browser's local flag.
assert.equal(assertBound(oldSnapshot,signed(oldSnapshot,'new-nonce'), 'new-nonce',{minGeneration:3}),true);
console.log('PASS TUR030 WITNESS negatives: nonce, owner, expiry, key pin, digest and generation; signed-valid-old replay persists without an EXTERNAL monotonic anchor NOT_RUN');
