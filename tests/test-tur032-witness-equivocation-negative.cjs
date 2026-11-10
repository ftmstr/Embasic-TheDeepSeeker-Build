'use strict';
/* TUR032: P-256 ECDSA genuine cryptographic signatures, SYNTHETIC signer.
 * Two independent trusted local clients can accept conflicting valid signed
 * generation-digest receipts. No external, nonrollbackable oracle is deployed. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const key=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const rotated=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const make=(digest,nonce,epoch=4,generation=20)=>{
  const r={owner:'synthetic-owner',vault:'synthetic-vault',epoch,generation,digest,nonce,expires:2500};
  return {...r,signature:crypto.sign('sha256',Buffer.from(JSON.stringify(r)),epoch===4?key.privateKey:rotated.privateKey).toString('base64')};
};
function verify(r,client,pinned){
  const {signature,...payload}=r;
  assert.equal(r.owner,client.owner);assert.equal(r.vault,client.vault);
  assert.equal(r.nonce,client.nonce);assert.equal(r.epoch,client.epoch);
  assert.equal(r.generation,client.generation);assert.equal(r.digest,client.digest);
  assert(r.expires>2000);
  assert(crypto.verify('sha256',Buffer.from(JSON.stringify(payload)),pinned,Buffer.from(signature,'base64')));
  return true;
}
const a=make('a'.repeat(64),'nonce-profile-A');
const b=make('b'.repeat(64),'nonce-profile-B');
const profileA={owner:a.owner,vault:a.vault,nonce:a.nonce,epoch:a.epoch,generation:a.generation,digest:a.digest};
const profileB={owner:b.owner,vault:b.vault,nonce:b.nonce,epoch:b.epoch,generation:b.generation,digest:b.digest};
assert.equal(verify(a,profileA,key.publicKey),true);
assert.equal(verify(b,profileB,key.publicKey),true);
assert.notEqual(a.digest,b.digest);
const intersection=receipts=>{
 const first=receipts[0];
 if(!receipts.every(x=>x.owner===first.owner&&x.vault===first.vault&&x.epoch===first.epoch&&x.generation===first.generation&&x.digest===first.digest))
  return {status:'EQUIVOCATION_NO_GO'};
 return {status:'same-generation-and-digest'};
};
assert.equal(intersection([a,b]).status,'EQUIVOCATION_NO_GO');
assert.throws(()=>verify(b,{...profileB,epoch:5},rotated.publicKey));
assert.throws(()=>verify({...a,signature:b.signature},profileA,key.publicKey));
// Replaying a previously valid receipt plus rolled-back local checkpoint
// still passes if the verifier has no unforgeable independent anchor.
assert.equal(verify(a,profileA,key.publicKey),true);
console.log('PASS TUR032 ECDSA EQUIVOCATION negative: two valid signed same-generation conflicting digests accepted separately; aggregation detects but cannot prevent; external oracle NOT_RUN');
