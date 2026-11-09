'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness({googleOauth:true});
 for(const project of ['First project','Second project']){
   await h.route('createTask',{payload:{project,name:'App-owned root',instructions:'Synthetic only',intervalHours:1,maxRuns:1}});
 }
 const runs=(await h.route('snapshot')).runs;
 for(const r of runs)await h.route('completeRun',{id:r.id,output:'Reviewed unique synthetic response'});
 await h.route('saveSettings',{driveEnabled:true});
 let rootWrites=0;
 h.scope.driveRequest=async(path,opts={})=>{
   if(path.startsWith('/drive/v3/files?q='))return{files:[]};
   if(path==='/drive/v3/files?fields=id'&&opts.method==='POST'){
     rootWrites++;throw Error('network failed after possibly committed root create');
   }
   throw Error('Unexpected Drive '+path);
 };
 await h.route('syncNow',{id:runs[0].id});
 let state=await h.route('snapshot');
 assert.equal(rootWrites,1);
 assert.equal(Object.keys(state.driveFolderIntents).length,1);
 await h.route('syncNow',{id:runs[1].id});
 assert.equal(rootWrites,1,'different task cannot submit duplicate app-wide root POST on stale list');
 state=await h.route('snapshot');
 assert.ok(state.runs.some(r=>r.driveSync==='blocked'||r.driveSync==='retry'));
 console.log('PASS TUR015 cross-run app root journal: second independent project cannot replay uncertain folder POST');
})().catch(e=>{console.error(e);process.exitCode=1});
