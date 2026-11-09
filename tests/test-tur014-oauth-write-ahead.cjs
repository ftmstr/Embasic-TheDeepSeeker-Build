'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const response=(status,data={})=>({status,ok:status>=200&&status<300,
 headers:{get:name=>name==='Retry-After'?'1':null},json:async()=>data,text:async()=>JSON.stringify(data)});
async function scenario(status){
 let writes=0,evictions=0,remote=false;
 const h=harness({googleOauth:true,fetch:async(url,opts={})=>{
   const u=new URL(url);
   if(u.pathname==='/drive/v3/files' && (opts.method||'GET')==='GET')return response(200,{files:remote?[{id:'file-id',name:(h.scope.__reportRunId||'')+'.md',mimeType:'text/markdown',parents:['project-id'],appProperties:{embasicRun:h.scope.__reportRunId,embasicTask:h.scope.__taskId,embasicSha256:h.scope.__hash}}]:[]});
   if(u.pathname==='/upload/drive/v3/files' && opts.method==='POST'){
     writes++;return response(status);
   }
   if(u.pathname==='/drive/v3/files/file-id' && u.searchParams.get('alt')==='media')return{ok:true,status:200,text:async()=>h.scope.__reportContent};
   throw Error('Unexpected '+u.pathname);
 }});
 h.scope.ensureDriveFolder=async(_name,parent)=>parent?'project-id':'root-id';
 h.scope.chrome.identity.removeCachedAuthToken=async()=>{evictions++};
 await h.route('createTask',{payload:{project:'OAuth Project',name:'Transient write',instructions:'Only mock',intervalHours:1,maxRuns:1}});
 const run=(await h.route('snapshot')).runs[0];
 h.scope.__reportRunId=run.id;h.scope.__taskId=run.taskId;h.scope.__reportContent=h.scope.reportText(run);h.scope.__hash=await h.scope.sha256Hex(h.scope.__reportContent);
 await h.route('completeRun',{id:run.id,output:'Synthetic result reviewed'});
 // CompleteRun happened before enabling Drive. Manual retry deliberately requests upload.
 await h.route('saveSettings',{driveEnabled:true});
 // Report content changes after completeRun: compute digest from completed record.
 const current=(await h.route('snapshot')).runs[0];h.scope.__reportContent=h.scope.reportText(current);h.scope.__hash=await h.scope.sha256Hex(h.scope.__reportContent);
 await h.route('syncNow',{id:run.id});
 let r=(await h.route('snapshot')).runs[0];
 assert.equal(writes,1);assert.equal(r.driveUncertainCommit,true);
 assert.equal(evictions,status===401?1:0);
 await h.route('syncNow',{id:run.id});assert.equal(writes,1,'OAuth 401/429 cannot auto-replay mutable POST');
 remote=true;
 await h.route('syncNow',{id:run.id});r=(await h.route('snapshot')).runs[0];
 assert.equal(r.driveSync,'synced');assert.equal(writes,1);
}
(async()=>{
 await scenario(401);await scenario(429);
 console.log('PASS TUR014 Drive OAuth 401/429 post-intent: token invalidation, no mutation replay, remote reconciliation');
})().catch(e=>{console.error(e);process.exitCode=1});
