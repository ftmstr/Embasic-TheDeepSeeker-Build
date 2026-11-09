'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness({googleOauth:true});
 let posts=0;
 h.scope.driveRequest=async()=>({nextPageToken:null});
 await assert.rejects(()=>h.scope.findDriveFolder('EMBASIC DeepSeek Agent',null),/geçersiz|invalid|belirsiz/i);
 h.scope.driveRequest=async(path,opts={})=>{if(opts.method==='POST')posts++;return {files:null};};
 await assert.rejects(()=>h.scope.ensureDriveFolder('EMBASIC DeepSeek Agent'),/geçersiz|invalid|belirsiz/i);
 assert.equal(posts,0,'malformed list must never authorize folder creation');
 console.log('PASS TUR012 malformed Drive folder list: absent/null files never authorize POST');
})().catch(e=>{console.error(e);process.exitCode=1});
