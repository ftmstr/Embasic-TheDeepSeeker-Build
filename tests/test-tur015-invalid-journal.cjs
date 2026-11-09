'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const vm=require('node:vm');
(async()=>{
 const h=harness({googleOauth:true});
 const base={tasks:[],runs:[],logs:[],settings:{driveEnabled:true}};
 assert.throws(()=>h.scope.normalizeState({...base,driveFolderIntents:{broken:{name:'EMBASIC DeepSeek Agent',parent:'root',runId:'validrun123456',leaseId:'lease-one'}}}),/journal kimlik eşleşmesi/);
 assert.throws(()=>h.scope.normalizeState({...base,driveFolderIntents:[]}),/journal şeması/);
 const name='EMBASIC DeepSeek Agent';const key=JSON.stringify(['root',name]);
 const good=h.scope.normalizeState({...base,driveFolderIntents:{[key]:{name,parent:'root',runId:'run123456',leaseId:'lease-one'}}});
 assert.ok(good.driveFolderIntents[key]);
 // Rejected ciphertext cannot be silently normalized into an empty ledger.
 const password='tur015-invalid-journal-vault-test';await h.route('vaultCreate',{password});
 const env=h.buckets.local.embasicSealedStateV3;
 const session=h.buckets.session.embasicStateKeyV3;
 h.scope.__session=session;const keyBytes=vm.runInContext('unb64(__session)',h.scope);
 const decoded=await h.scope.decryptEnvelope(env,keyBytes);
 decoded.driveFolderIntents={broken:{name,parent:'root',runId:'validrun123456',leaseId:'lease-two'}};
 h.buckets.local.embasicSealedStateV3=await h.scope.encryptEnvelope(decoded,keyBytes,h.scope.checkEnvelope(env).salt);
 await assert.rejects(h.route('snapshot'),/journal kimlik eşleşmesi/);
 console.log('PASS TUR015 malformed authenticated folder ledger fails closed instead of silently losing a remote POST fence');
})().catch(e=>{console.error(e);process.exitCode=1});
