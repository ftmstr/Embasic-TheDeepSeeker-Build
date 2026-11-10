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
console.log('PASS TUR026 signed-valid-old AES-GCM rollback negative; external oracle NOT_RUN');
