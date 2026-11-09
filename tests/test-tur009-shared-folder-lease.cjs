'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data});
(async()=>{
  let openPost,signal,posts=0;
  const gate=new Promise(r=>openPost=r);const entered=new Promise(r=>signal=r);
  const h=harness({googleOauth:true,fetch:async(_url,opt={})=>{
    if(opt.method==='POST'){posts++;signal();await gate;return ok({id:'shared01'});}
    return ok({files:[]});
  }});
  let firstValid=true,secondValid=true;
  const first=h.scope.ensureDriveFolder('Parallel synthetic',null,async()=>{if(!firstValid)throw Error('first expired');});
  await entered;
  const second=h.scope.ensureDriveFolder('Parallel synthetic',null,async()=>{if(!secondValid)throw Error('second expired');});
  // Simulate second task losing its lease while awaiting the shared folder request.
  secondValid=false;openPost();
  assert.equal(await first,'shared01');
  await assert.rejects(second,/second expired/);
  assert.equal(posts,1,'concurrent callers should share one folder creation');
  console.log('PASS TUR009 folder coalescing: second caller must revalidate its own lease before reusing shared result');
})().catch(e=>{console.error(e);process.exitCode=1});
