'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const {runInContext}=require('node:vm');
const task={project:'A',name:'Görev',instructions:'A talimat',intervalHours:1,maxRuns:1,repo:'',repoFile:'README.md',baseBranch:''};
const ok=(data,status=200)=>({ok:true,status,headers:{get(){return null;}},async json(){return data;}});
let signalUpload,releaseUpload;
const uploaded=new Promise(resolve=>signalUpload=resolve);
const release=new Promise(resolve=>releaseUpload=resolve);
let folderIndex=0;
let committedMetadata=null,committedContent=null;
async function blockedUpload(url,options){
  const u=new URL(url);if(u.pathname==='/drive/v3/files'&&options.method==='GET')return ok({files:[]});
  if(u.pathname==='/drive/v3/files'&&options.method==='POST')return ok({id:`folder${++folderIndex}`});
  if(u.pathname==='/upload/drive/v3/files'&&options.method==='POST'){
    const payload=await options.body.text();
    committedMetadata=JSON.parse(payload.split('\r\n\r\n')[1].split('\r\n--')[0]);
    committedContent=payload.split('\r\n\r\n')[2].split('\r\n--')[0];
    signalUpload();await release;return ok({id:'uploaded'},201);
  }
  if(u.pathname==='/drive/v3/files/uploaded'&&options.method==='GET'){
    if(u.searchParams.get('alt')==='media')return {ok:true,status:200,text:async()=>committedContent};
    return ok({id:'uploaded',...committedMetadata});
  }
  throw new Error('unexpected '+u.pathname);
}
(async()=>{
  const h=harness({fetch:blockedUpload,googleOauth:true});
  await h.route('saveSettings',{driveEnabled:true});
  const id=await h.route('createTask',{payload:task});
  const snapshot=await h.route('snapshot');const run=snapshot.runs[0];
  const saving=h.route('completeRun',{id:run.id,output:'A raporu: SONRAKİ TUR ÖZETİ: doğrulandı.'});
  await uploaded;
  await assert.rejects(h.route('saveSettings',{driveEnabled:false}),/Senkronizasyon devam/);
  await assert.rejects(h.route('restoreBackup',{payload:snapshot}),/Aktif görev veya senkronizasyon/);
  await assert.rejects(h.route('deleteTask',{id}),/Bulut aktarımı sürerken/);
  await assert.rejects(h.route('updateTask',{id,payload:task}),/Bulut aktarımı sürüyor/);
  releaseUpload();await saving;
  const complete=await h.route('snapshot');assert.equal(complete.runs[0].driveSync,'synced');
  await h.route('saveSettings',{driveEnabled:false});
  const structured=runInContext("apiHttpError('Google Drive',{status:429,headers:{get(){return '900';}}},'POST')",h.scope);
  assert.equal(structured.httpStatus,429);
  assert.equal(structured.retryAfterMs,900000);
  const clamp=runInContext("apiHttpError('GitHub',{status:429,headers:{get(){return '36000';}}},'GET')",h.scope);
  assert.equal(clamp.retryAfterMs,3600000);
  const limited=runInContext("apiHttpError('GitHub',{status:403,headers:{get(k){if(k==='X-RateLimit-Remaining')return '0';if(k==='X-RateLimit-Reset')return String(Math.ceil(Date.now()/1000)+120);return null;}}},'GET')",h.scope);
  assert.equal(limited.transient,true);assert.ok(limited.retryAfterMs>=100000);
  const forbidden=runInContext("apiHttpError('GitHub',{status:403,headers:{get(){return null;}}},'PUT')",h.scope);
  assert.equal(forbidden.transient,undefined,'ordinary 403 must fail closed');
  console.log('PASS races & limits: in-flight settings/restore/delete/edit blocked, Retry-After respected and capped');
})().catch(e=>{console.error(e);process.exitCode=1});
