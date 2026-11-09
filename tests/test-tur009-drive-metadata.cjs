'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
(async()=>{
  let posts=0;
  const h=harness({googleOauth:true,fetch:async(_url,opt={})=>{
    if(opt.method==='POST'){posts++;return ok({id:'should-not-create'});}
    return ok({files:[{id:'folder01',name:'Synthetic root',appProperties:{embasicApp:'EMBASIC'}}]});
  }});
  await assert.rejects(h.scope.ensureDriveFolder('Synthetic root'),/belirsiz/);
  assert.equal(posts,0,'missing parent metadata cannot be trusted');
  const h2=harness({googleOauth:true});
  h2.scope.ensureDriveFolder=async (_name,parent)=>parent?'project01':'root01';
  let mediaReads=0,uploads=0;
  const run={id:'aaaaaaaaaaaaaaaa',taskId:'bbbbbbbbbbbbbbbb',project:'Synthetic',taskName:'Synthetic',
    prompt:'Synthetic prompt',output:'Synthetic answer',completedAt:'2026-11-09'};
  const digest=await h2.scope.sha256Hex(h2.scope.reportText(run));
  h2.scope.driveRequest=async (url,options={})=>{
    if(options.method==='POST')uploads++;
    if(url.includes('alt=media'))mediaReads++;
    return {files:[{id:'file001',name:run.id+'.md',mimeType:'text/markdown',
      appProperties:{embasicRun:run.id,embasicTask:run.taskId,embasicSha256:digest}}]};
  };
  await assert.rejects(h2.scope.driveUpload(run),/çakışan veya değişmiş/);
  assert.equal(uploads,0);assert.equal(mediaReads,0);
  const h3=harness({googleOauth:true,fetch:async(_url,opt={})=>{
    if(opt.method==='POST'){posts++;return ok({id:'not a safe ID'});}
    return ok({files:[]});
  }});
  await assert.rejects(h3.scope.ensureDriveFolder('New synthetic'),/geçerli kimlik/);
  assert.equal(posts,1);
  console.log('PASS TUR009 Drive metadata: absent parent, invalid folder ID and missing report ownership fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
