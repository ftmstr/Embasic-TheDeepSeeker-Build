'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness({googleOauth:true});
  const run={id:'bbbbbbbbbbbbbbbb',taskId:'aaaaaaaaaaaaaaaa',project:'Synthetic Project',taskName:'Test',
    completedAt:'2026-11-09T10:00:00Z',prompt:'Do not disclose anything',output:'Only fake data'};
  const digest=await h.scope.sha256Hex(h.scope.reportText(run));
  h.scope.ensureDriveFolder=async (_name,parent)=>parent?'project01':'root01';
  let mediaReads=0,posts=0;
  h.scope.driveRequest=async (url,options={})=>{
    if(options.method==='POST'){posts++;throw new Error('must not post');}
    if(url.includes('alt=media')){mediaReads++;throw new Error('must not read foreign file');}
    return {files:[{id:'file01',name:run.id+'.md',mimeType:'text/markdown',parents:['wrong_project_folder'],
      appProperties:{embasicRun:run.id,embasicTask:run.taskId,embasicSha256:digest}}]};
  };
  await assert.rejects(h.scope.driveUpload(run),/çakışan veya değişmiş rapor/);
  assert.equal(mediaReads,0);assert.equal(posts,0);
  console.log('PASS TUR008 Drive ownership: wrong parent rejects report despite valid run/digest metadata');
})().catch(e=>{console.error(e);process.exitCode=1});
