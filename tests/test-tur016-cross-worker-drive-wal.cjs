'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const buckets={local:{embasicRequireVaultV4:false},session:{}};
let holder=Promise.resolve(),postCount=0;
const locks={request(_name,_opts,cb){const next=holder.then(()=>cb({mode:'exclusive'}));holder=next.catch(()=>{});return next;}};
(async()=>{
 const a=harness({sharedBuckets:buckets,sharedLocks:locks,googleOauth:true});
 const b=harness({sharedBuckets:buckets,sharedLocks:locks,googleOauth:true});
 await a.route('vaultCreate',{password:'web-locked-encrypted-shared-drive'});
 for(const [h,project] of [[a,'alpha'],[b,'beta']]){
   await h.route('createTask',{payload:{project,name:'Independent writer',instructions:'Only synthetic data',intervalHours:1,maxRuns:1}});
 }
 const runs=(await a.route('snapshot')).runs;
 for(const run of runs)await a.route('completeRun',{id:run.id,output:'Approved synthetic unique data'});
 await a.route('saveSettings',{driveEnabled:true});
 const remote=async(path,opts={})=>{
   if(path.startsWith('/drive/v3/files?q='))return {files:[]};
   if(path==='/drive/v3/files?fields=id'&&opts.method==='POST'){
     postCount++;throw Error('network failed after possibly committed folder POST');
   }
   throw Error('Unexpected Drive request '+path);
 };
 a.scope.driveRequest=remote;b.scope.driveRequest=remote;
 await a.route('syncNow',{id:runs[0].id});
 assert.equal(postCount,1);
 const afterA=await a.route('snapshot');
 assert.equal(Object.keys(afterA.driveFolderIntents).length,1);
 await b.route('syncNow',{id:runs[1].id});
 assert.equal(postCount,1,'second worker must not recreate the possibly committed shared root');
 const afterB=await b.route('snapshot');
 assert.equal(Object.keys(afterB.driveFolderIntents).length,1);
 assert.ok(afterB.runs.some(r=>r.driveSync==='retry'||r.driveSync==='blocked'));
 console.log('PASS TUR016 separate workers share encrypted Drive root WAL; lost ACK plus stale list cannot trigger a second POST');
})().catch(e=>{console.error(e);process.exitCode=1});
