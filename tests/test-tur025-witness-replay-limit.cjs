'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const witness=require('../extension/rollback-witness.js');
(async()=>{
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const pinned=Buffer.from(await webcrypto.subtle.exportKey('spki',pair.publicKey)).toString('base64');
 const old={vaultId:'syntheticVaultID',generation:4,cipherSha256:'d'.repeat(64)};
 const newState={...old,generation:5,cipherSha256:'e'.repeat(64)};
 const sign=async x=>({...x,signature:Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(witness.canonical(x)))).toString('base64')});
 const signedOld=await sign(old),signedNew=await sign(newState);
 // A cryptographically genuine old signed response can be replayed together with
 // an old but authenticated AES-GCM ciphertext. Signature alone is NOT freshness.
 const replay=await witness.verify({...old,readWitness:async()=>signedOld,pinnedPublicKeySpki:pinned,cryptoApi:webcrypto});
 assert.equal(replay.status,'current','replayed signed snapshot is indistinguishable without independently monotonic service');
 await assert.rejects(witness.verify({...old,readWitness:async()=>signedNew,pinnedPublicKeySpki:pinned,cryptoApi:webcrypto}),{code:'WITNESS_ROLLBACK_OR_FORK'});
 await assert.rejects(witness.verify({...newState,readWitness:async()=>{throw Error('network offline');},pinnedPublicKeySpki:pinned,cryptoApi:webcrypto}),{code:'WITNESS_OFFLINE'});
 console.log('PASS TUR025 EXPECTED LIMIT: genuine replayed ECDSA witness + old ciphertext passes without live monotonic freshness; live witness NOT_RUN');
})().catch(e=>{console.error(e);process.exitCode=1});
