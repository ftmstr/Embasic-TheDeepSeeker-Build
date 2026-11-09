'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness({googleOauth:true});
 await h.route('createTask',{payload:{project:'Synthetic',name:'Malformed list',instructions:'Synthetic only.',intervalHours:1,maxRuns:1,repo:''}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic result. SONRAKİ TUR ÖZETİ: complete.'});
 const st=h.buckets.local.embasicStateV2;st.settings.driveEnabled=true;st.runs[0].driveSync='pending';
 h.scope.ensureDriveFolder=async(_name,parent)=>parent?'project-id':'root-id';
 let posts=0;
 h.scope.driveRequest=async(path,opts={})=>{if(opts.method==='POST')posts++;return {files:{length:0}};};
 await h.route('syncNow',{id});
 const run=(await h.route('snapshot')).runs[0];
 assert.equal(posts,0,'malformed report search must never authorize upload');
 assert.notEqual(run.driveSync,'synced');
 console.log('PASS TUR012 malformed Drive report list: object masquerading as files never authorizes upload');
})().catch(e=>{console.error(e);process.exitCode=1});
