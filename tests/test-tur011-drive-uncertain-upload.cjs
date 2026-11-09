'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  await h.route('createTask',{payload:{project:'Archive A',name:'Lost ACK',instructions:'Synthetic work only.',intervalHours:1,maxRuns:1,repo:''}});
  const id=(await h.route('snapshot')).runs[0].id;
  await h.route('completeRun',{id,output:'Synthetic evidence. SONRAKİ TUR ÖZETİ: completed.'});
  const st=h.buckets.local.embasicStateV2;
  st.settings.driveEnabled=true;st.runs[0].driveSync='pending';
  h.scope.ensureDriveFolder=async(_n,parent)=>parent?'project-id':'root-id';
  const content=h.scope.reportText(st.runs[0]);
  const sha=await h.scope.sha256Hex(content);
  let posts=0,remoteVisible=false,reads=0;
  h.scope.driveRequest=async(path,opts={})=>{
    if(path.startsWith('/drive/v3/files?')){
      reads++;
      return {files:remoteVisible?[{id:'created-file',name:id+'.md',mimeType:'text/markdown',parents:['project-id'],
        appProperties:{embasicRun:id,embasicTask:st.runs[0].taskId,embasicSha256:sha}}]:[]};
    }
    if(path.startsWith('/upload/drive/v3/files?')){posts++;throw Error('fetch failed after server committed');}
    if(path==='/drive/v3/files/created-file?alt=media')return content;
    throw Error('Unexpected request '+path);
  };
  await h.route('syncNow',{id});
  let r=(await h.route('snapshot')).runs[0];
  assert.equal(posts,1);
  assert.equal(r.driveSync,'retry');
  assert.equal(r.driveUncertainCommit,true,'uncertain remote commit must survive encrypted state normalization');
  await h.route('syncNow',{id}); // manual retry deliberately resets attempts, NOT uncertainty
  r=(await h.route('snapshot')).runs[0];
  assert.equal(posts,1,'stale provider list must NOT authorize another POST');
  assert.equal(r.driveUncertainCommit,true);
  assert.equal(r.driveSync,'retry');
  remoteVisible=true;
  await h.route('syncNow',{id});
  r=(await h.route('snapshot')).runs[0];
  assert.equal(r.driveSync,'synced','remote bytes+metadata can reconcile an earlier unknown write');
  assert.equal(r.driveUncertainCommit,false);
  assert.equal(posts,1);
  assert.ok(reads>=3);
  console.log('PASS TUR011 Drive upload ambiguity: persisted uncertain write prevents duplicate POST until authenticated byte readback');
})().catch(e=>{console.error(e);process.exitCode=1});
