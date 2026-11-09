'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const run={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Project A',taskName:'Receipt',
    completedAt:'2026-11-09T00:00:00Z',prompt:'synthetic prompt',output:'Synthetic result; no secrets'};
(async()=>{
  for(const mode of ['valid','wrong-parent','wrong-bytes','wrong-task','missing-metadata']){
    const h=harness({googleOauth:true});
    h.scope.ensureDriveFolder=async (_name,parent)=>parent?'project-id':'root-id';
    let uploads=0,reads=0;
    const text=h.scope.reportText(run);
    const sha=await h.scope.sha256Hex(text);
    h.scope.driveRequest=async(path,opts={})=>{
      if(path.startsWith('/drive/v3/files?'))return {files:[]};
      if(path.startsWith('/upload/drive/v3/files?')){uploads++;return {id:'receipt-id'};}
      if(path==='/drive/v3/files/receipt-id?fields=id,name,mimeType,parents,appProperties'){
        reads++;return {id:'receipt-id',name:run.id+'.md',mimeType:'text/markdown',
          parents:[mode==='wrong-parent'?'other-project':'project-id'],
          appProperties:mode==='missing-metadata'?{}:{embasicApp:'EMBASIC',embasicRun:run.id,
            embasicTask:mode==='wrong-task'?'other-task':run.taskId,embasicSha256:sha}};
      }
      if(path==='/drive/v3/files/receipt-id?alt=media'){
        reads++;return mode==='wrong-bytes'?text+' altered':text;
      }
      throw Error('Unexpected Drive URL: '+path);
    };
    if(mode==='valid')await h.scope.driveUpload(run);
    else await assert.rejects(h.scope.driveUpload(run),/yükleme makbuzunun uzak/);
    assert.equal(uploads,1,'readback failure must never automatically replay POST');
    assert.ok(reads>=1,'successful-looking receipt must be verified remotely');
  }
  console.log('PASS TUR010 Drive receipt: correct parent/task/digest/content accepted; forged readbacks fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
