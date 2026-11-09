'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const wit=require('../extension/rollback-witness.js');
const b64=x=>Buffer.from(x).toString('base64');
(async()=>{
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const other=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const pub=b64(await webcrypto.subtle.exportKey('spki',pair.publicKey));
 const fresh={vaultId:'syntheticVaultID',generation:5,cipherSha256:'e'.repeat(64)};
 const old={...fresh,generation:4,cipherSha256:'d'.repeat(64)};
 const signed=async(value,key=pair.privateKey)=>({...value,signature:b64(await webcrypto.subtle.sign(
   {name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(wit.canonical(value))))});
 const current=await signed(fresh),backedUp=await signed(old);
 assert.equal((await wit.verify({...fresh,readWitness:async()=>current,pinnedPublicKeySpki:pub,cryptoApi:webcrypto})).status,'current');
 await assert.rejects(wit.verify({...old,readWitness:async()=>current,pinnedPublicKeySpki:pub,cryptoApi:webcrypto}),{code:'WITNESS_ROLLBACK_OR_FORK'});
 await assert.rejects(wit.verify({...fresh,readWitness:async()=>backedUp,pinnedPublicKeySpki:pub,cryptoApi:webcrypto}),{code:'WITNESS_ROLLBACK_OR_FORK'});
 const forgery=await signed(fresh,other.privateKey);
 await assert.rejects(wit.verify({...fresh,readWitness:async()=>forgery,pinnedPublicKeySpki:pub,cryptoApi:webcrypto}),{code:'WITNESS_SIGNATURE_INVALID'});
 await assert.rejects(wit.verify({...fresh,readWitness:async()=>{throw Error('offline');},pinnedPublicKeySpki:pub,cryptoApi:webcrypto}),{code:'WITNESS_OFFLINE'});
 await assert.rejects(wit.verify({...fresh,readWitness:async()=>current,cryptoApi:webcrypto}),{code:'WITNESS_UNCONFIGURED'});
 console.log('PASS TUR017 independent signed ECDSA witness PoC detects older valid ciphertext / forged or unavailable attestation; real witness NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
