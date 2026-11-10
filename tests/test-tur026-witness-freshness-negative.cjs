'use strict';
/* TUR026: negative model only. A valid signature is not a freshness oracle.
 * No live credentials, provider writes, production wiring or deployed witness.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {namedCurve:'prime256v1'});
const secret=crypto.randomBytes(32);
const canonical = (x)=>Buffer.from(JSON.stringify([x.scope,x.generation,x.cipherDigest,x.previousDigest]));
function seal(scope,generation,plaintext,previousDigest) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',secret,iv);
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const ciphertext=Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
  const record={scope,generation,cipherDigest:crypto.createHash('sha256').update(ciphertext).digest('hex'),previousDigest};
  return {record,ciphertext,signature:crypto.sign('sha256',canonical(record),privateKey)};
}
function verifyAuthenticity(x) {
  assert.equal(crypto.createHash('sha256').update(x.ciphertext).digest('hex'),x.record.cipherDigest);
  return crypto.verify('sha256',canonical(x.record),publicKey,x.signature);
}
function open(x) {
  const iv=x.ciphertext.subarray(0,12),tag=x.ciphertext.subarray(12,28);
  const decipher=crypto.createDecipheriv('aes-256-gcm',secret,iv);decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(x.ciphertext.subarray(28)),decipher.final()]);
}
const scope='synthetic-vault-A', zero='0'.repeat(64);
const old=seal(scope,1,Buffer.from('old synthetic payload'),zero);
const current=seal(scope,2,Buffer.from('new synthetic payload'),old.record.cipherDigest);
assert.equal(verifyAuthenticity(old),true);
assert.equal(verifyAuthenticity(current),true);
assert.equal(open(old).toString(),'old synthetic payload');
assert.equal(open(current).toString(),'new synthetic payload');
// Attack: restoring the complete old valid snapshot also restores its valid signature.
const restored=structuredClone(old);
assert.equal(verifyAuthenticity(restored),true);
assert.equal(open(restored).toString(),'old synthetic payload');
// Only an independently authenticated, fresh, non-rollbackable latest generation rejects it.
function requireFresh(snapshot,oracle) {
  if(!oracle || oracle.authenticated!==true || oracle.scope!==snapshot.record.scope ||
     !Number.isSafeInteger(oracle.latest) || oracle.latest<0)
    throw Object.assign(new Error('No trusted fresh monotonic oracle'),{code:'WITNESS_FRESHNESS_UNPROVEN'});
  if(snapshot.record.generation!==oracle.latest)
    throw Object.assign(new Error('Rollback or equivocation'),{code:'WITNESS_STALE'});
  if(oracle.digest!==snapshot.record.cipherDigest)
    throw Object.assign(new Error('Same-generation equivocation'),{code:'WITNESS_EQUIVOCATION'});
  return true;
}
assert.throws(()=>requireFresh(restored,null),{code:'WITNESS_FRESHNESS_UNPROVEN'});
assert.throws(()=>requireFresh(restored,{authenticated:true,scope,latest:2,digest:current.record.cipherDigest}),{code:'WITNESS_STALE'});
assert.throws(()=>requireFresh(current,{authenticated:true,scope,latest:2,digest:old.record.cipherDigest}),{code:'WITNESS_EQUIVOCATION'});
assert.throws(()=>requireFresh(current,{authenticated:false,scope,latest:2,digest:current.record.cipherDigest}),{code:'WITNESS_FRESHNESS_UNPROVEN'});
assert.equal(requireFresh(current,{authenticated:true,scope,latest:2,digest:current.record.cipherDigest}),true);

// TUR027 negative: an in-process "authenticated" boolean is not a cryptographic
// oracle attestation. A restored old snapshot plus a forged old oracle passes
// this intentionally weak model. This MUST NOT be used as production acceptance.
const forgedOldOracle={authenticated:true,scope,latest:1,digest:old.record.cipherDigest};
assert.equal(requireFresh(restored,forgedOldOracle),true);

// Independent trusted-verifier contract: bind the witness to an immutable owner
// and vault identity, current nonce, expiration, and signed generation/digest.
// All assertions below are SYNTHETIC, not an external monotonic server.
const trustedOwner='synthetic-owner-A';
const trustedVault='synthetic-vault-A';
const trustedNonce='fresh-request-nonce-2';
const trustedTime=1000;
function requireBoundWitness(snapshot, witness, expected) {
  const deny=(code)=>{throw Object.assign(new Error(code),{code});};
  if (!witness || witness.signatureVerified!==true ||
      witness.owner!==expected.owner || witness.vault!==expected.vault ||
      witness.nonce!==expected.nonce ||
      !Number.isSafeInteger(witness.expiresAt) || witness.expiresAt<=expected.now)
    deny('WITNESS_ATTESTATION_UNPROVEN');
  if (!Number.isSafeInteger(witness.generation) || witness.generation<0 ||
      witness.generation!==snapshot.record.generation)
    deny('WITNESS_STALE');
  if (witness.digest!==snapshot.record.cipherDigest) deny('WITNESS_EQUIVOCATION');
  return true;
}
const expected={owner:trustedOwner,vault:trustedVault,nonce:trustedNonce,now:trustedTime};
const good={signatureVerified:true,owner:trustedOwner,vault:trustedVault,
  nonce:trustedNonce,expiresAt:trustedTime+30,generation:2,digest:current.record.cipherDigest};
assert.equal(requireBoundWitness(current,good,expected),true);
for (const patch of [
  {owner:'synthetic-owner-B'}, {vault:'synthetic-vault-B'},
  {nonce:'old-nonce'}, {expiresAt:trustedTime},
  {signatureVerified:false}
]) {
  assert.throws(()=>requireBoundWitness(current,{...good,...patch},expected),
    {code:'WITNESS_ATTESTATION_UNPROVEN'});
}
assert.throws(()=>requireBoundWitness(restored,good,expected),{code:'WITNESS_STALE'});
assert.throws(()=>requireBoundWitness(current,{...good,digest:old.record.cipherDigest},expected),
  {code:'WITNESS_EQUIVOCATION'});
// signatureVerified is supplied by a trusted verifier in this *contract only*.
// A hostile caller can forge it in this model; no real verification occurred.
assert.equal(requireBoundWitness(restored,{...good,generation:1,
  digest:old.record.cipherDigest},expected),true);
console.log('PASS TUR027 oracle flag forgery, owner/vault/nonce/expiry negatives; real witness NOT_RUN');

console.log('PASS TUR026 signed-valid-old AES-GCM rollback negative; external oracle NOT_RUN');
