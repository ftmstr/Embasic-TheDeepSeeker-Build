'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 // This is an intentional NEGATIVE test of Chrome profile isolation, not a
 // claim that Web Locks or a local folder WAL works across devices.
 let posts=0;
 const clients=[harness({googleOauth:true}),harness({googleOauth:true})];
 for(let i=0;i<clients.length;i++){
   const h=clients[i];await h.route('vaultCreate',{password:`synthetic-different-profile-${i}`});
   await h.route('createTask',{payload:{project:'Same-name project',name:'Task',
      instructions:'Synthetic only',intervalHours:1,maxRuns:1}});
   const run=(await h.route('snapshot')).runs[0];
   await h.route('completeRun',{id:run.id,output:'Synthetic reviewed response'});
   await h.route('saveSettings',{driveEnabled:true});
   h.scope.driveRequest=async(path,opt={})=>{
     if(path.startsWith('/drive/v3/files?q='))return {files:[]};
     if(path==='/drive/v3/files?fields=id'&&opt.method==='POST'){
       posts++;throw Error('network failed after ambiguous folder COMMIT');
     }
     throw Error('unexpected mock request '+path);
   };
 }
 await Promise.all(clients.map(async h=>h.route('syncNow')));
 assert.equal(posts,2,'independent profiles can BOTH POST: local journals are NOT a distributed CAS');
 assert.equal(Object.keys((await clients[0].route('snapshot')).driveFolderIntents).length,1);
 assert.equal(Object.keys((await clients[1].route('snapshot')).driveFolderIntents).length,1);
 console.log('PASS TUR017 EXPECTED LIMIT: separate Chrome profiles have separate Drive folder WAL; duplicate remote POST risk remains, production NO_GO');
})().catch(e=>{console.error(e);process.exitCode=1});
