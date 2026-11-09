'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness({googleOauth:true});
 await h.route('createTask',{payload:{project:'Drive Alpha',name:'Write-ahead',instructions:'Synthetic approved',intervalHours:1,maxRuns:1}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic completed output'});
 await h.route('saveSettings',{driveEnabled:true});
 // Deliberate network / worker stop after POST. Search remains stale until remote visible.
 let folderPost=0,folderVisible=false,uploads=0,uploadVisible=false;
 const st=(await h.route('snapshot')).runs[0];const expected=h.scope.reportText(st),digest=await h.scope.sha256Hex(expected);
 h.scope.driveRequest=async(path,opts={})=>{
   if(path.startsWith('/drive/v3/files?q=')){
     const q=decodeURIComponent((path.split('?q=')[1]||'').split('&fields=')[0]);
     if(q.includes('mimeType')){
       if(q.includes('EMBASIC DeepSeek Agent'))return{files:folderVisible?[{id:'root-id',name:'EMBASIC DeepSeek Agent',parents:['root'],appProperties:{embasicApp:'EMBASIC'}}]:[]};
       return{files:[{id:'project-id',name:`Drive Alpha [${st.taskId.slice(0,12)}]`,parents:['root-id'],appProperties:{embasicApp:'EMBASIC'}}]};
     }
     return{files:uploadVisible?[{id:'report-id',name:id+'.md',mimeType:'text/markdown',parents:['project-id'],appProperties:{embasicRun:id,embasicTask:st.taskId,embasicSha256:digest}}]:[]};
   }
   if(path==='/drive/v3/files?fields=id'&&opts.method==='POST'){folderPost++;throw Error('network failed after folder create');}
   if(path.startsWith('/upload/drive/v3/files?')&&opts.method==='POST'){uploads++;throw Error('network failed after upload');}
   if(path==='/drive/v3/files/report-id?alt=media')return expected;
   throw Error('Unexpected '+path);
 };
 await h.route('syncNow',{id});let state=(await h.route('snapshot')).runs[0];
 assert.equal(folderPost,1);assert.equal(state.driveUncertainFolder?.name,'EMBASIC DeepSeek Agent');
 assert.equal(folderPost,1);assert.equal(state.driveUncertainFolder?.name,'EMBASIC DeepSeek Agent');
 await h.route('syncNow',{id});assert.equal(folderPost,1,'folder POST must not replay even after 404');
 folderVisible=true;await h.route('syncNow',{id});state=(await h.route('snapshot')).runs[0];
 assert.equal(uploads,1);assert.equal(state.driveUncertainCommit,true);
 await h.route('syncNow',{id});assert.equal(uploads,1,'upload POST must not replay after stale list');
 uploadVisible=true;await h.route('syncNow',{id});state=(await h.route('snapshot')).runs[0];
 assert.equal(state.driveSync,'synced');assert.equal(folderPost,1);assert.equal(uploads,1);
 console.log('PASS TUR014 Drive write-ahead intents: folder+upload ACK loss, stale lists, readback no replay');
})().catch(e=>{console.error(e);process.exitCode=1});
