'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/backup-crypto.js'),'utf8'),context);
(async()=>{
  const {encrypt,decrypt}=context.embasicBackupCrypto;
  const obj={tasks:[{project:'Türkçe: Ağrı 🧠',instructions:'Gizli bilgi örneği'}],runs:[{output:'İnceleme ı İ ş Щ'}]};
  const secret='Strong Backup Password 2026!';
  const enc=await encrypt(obj,secret);
  assert.equal(enc.kind,'embasic-encrypted-backup');
  assert.equal(enc.cipher,'AES-256-GCM');
  assert.ok(!JSON.stringify(enc).includes('Gizli bilgi'));
  const result=await decrypt(enc,secret);
  assert.equal(JSON.stringify(result),JSON.stringify(obj));
  await assert.rejects(decrypt(enc,'Another Strong Password 2026!'),/yanlış|bozuk/);
  await assert.rejects(encrypt(obj,'short'),/en az 12/);
  await assert.rejects(decrypt({...enc,iv:'AA=='},secret),/geçersiz/);
  await assert.rejects(decrypt({...enc,data:enc.data.slice(0,-4)+'ABCD'},secret),/yanlış|bozuk/);
  await assert.rejects(decrypt({...enc,iterations:500},secret),/Desteklenmeyen/);
  // Large UTF-8 backups use chunked base64 conversion to avoid stack overflow.
  const bulky='Ü'.repeat(1_000_000);
  const large=await encrypt({output:bulky},secret);
  assert.equal((await decrypt(large,secret)).output,bulky);
  console.log('PASS backup: AES-256-GCM, Unicode, wrong password/tampering, KDF downgrade prevention, 1M chars');
})().catch(e=>{console.error(e);process.exitCode=1});
