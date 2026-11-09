'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  await h.route('createTask',{payload:{project:'Archive B',name:'Lost folder ACK',instructions:'Synthetic work only.',intervalHours:1,maxRuns:1,repo:''}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic result. SONRAKİ TUR ÖZETİ: completed.'});
  const st=h.buckets.local.embasicStateV2;
  st.settings.driveEnabled=true;st.runs[0].driveSync='pending';
  let folders=0,uploads=0,rootVisible=false;
  const report=h.scope.reportText(st.runs[0]);const digest=await h.scope.sha256Hex(report);
  h.scope.findDriveFolder=async(name,parent)=>{
    if(name==='EMBASIC DeepSeek Agent')return rootVisible?'root-owned':null;
    if(parent==='root-owned')return 'project-owned';
    throw Error('Unexpected folder lookup');
  };
  h.scope.driveRequest=async(path,opts={})=>{
    if(path==='/drive/v3/files?fields=id'&&opts.method==='POST'){
      folders++;throw Error('network lost after folder created');
    }
    if(path.startsWith('/drive/v3/files?'))return {files:[]};
    if(path.startsWith('/upload/drive/v3/files?')){uploads++;return {id:'report-owned'};}
    if(path.startsWith('/drive/v3/files/report-owned?fields='))return {
      id:'report-owned',name:id+'.md',mimeType:'text/markdown',parents:['project-owned'],
      appProperties:{embasicApp:'EMBASIC',embasicRun:id,embasicTask:st.runs[0].taskId,embasicSha256:digest}
    };
    if(path==='/drive/v3/files/report-owned?alt=media')return report;
    throw Error('Unexpected '+path);
  };
  await h.route('syncNow',{id});
  let r=(await h.route('snapshot')).runs[0];
  assert.equal(r.driveSync,'retry');
  assert.equal(folders,1);
  assert.equal(r.driveUncertainFolder.name,'EMBASIC DeepSeek Agent');
  assert.equal(r.driveUncertainFolder.parent,'root');
  await h.route('syncNow',{id});
  assert.equal(folders,1,'missing folder after unknown commit must not cause another POST');
  assert.equal(uploads,0);
  rootVisible=true;
  await h.route('syncNow',{id});
  r=(await h.route('snapshot')).runs[0];
  assert.equal(r.driveSync,'synced');
  assert.equal(r.driveUncertainFolder,null);
  assert.equal(folders,1);assert.equal(uploads,1);
  console.log('PASS TUR011 Drive folder ambiguity: root parent scoped durable marker prevents duplicate folder POST');
})().catch(e=>{console.error(e);process.exitCode=1});
