'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const base={project:'PROJE_A',name:'Görev A',instructions:'PROJE_A talimatı',intervalHours:1,maxRuns:4,repo:'',repoFile:'README.md',baseBranch:''};
(async()=>{
  const h=harness();
  await assert.rejects(h.route('createTask',{payload:{...base,instructions:'-----BEGIN PRIVATE KEY----- secret'}}),/gizli anahtar/);
  const id=await h.route('createTask',{payload:base});
  let state=await h.route('snapshot');const first=state.runs[0];
  // Freeze all content that could mix two independent project contexts.
  await assert.rejects(h.route('updateTask',{id,payload:{...base,project:'PROJE_B'}}),/Proje kimliği/);
  await assert.rejects(h.route('updateTask',{id,payload:{...base,instructions:'PROJE_B gizli içerik'}}),/Bekleyen tur/);
  await assert.rejects(h.route('updateTask',{id,payload:{...base,repo:'owner/another'}}),/Bekleyen tur/);
  await h.route('completeRun',{id:first.id,output:'Yalnız PROJE_A kanıtları. SONRAKİ TUR ÖZETİ: önceki A bulguları'});
  state=await h.route('snapshot');assert.match(state.tasks[0].latestSummary,/önceki A/);
  // A new external source must start with fresh model memory.
  await h.route('updateTask',{id,payload:{...base,repo:'owner/another'}});
  state=await h.route('snapshot');assert.equal(state.tasks[0].latestSummary,'');
  await h.route('runNow',{id});state=await h.route('snapshot');
  assert.equal(state.runs[0].sourceRepo,'owner/another');
  assert.doesNotMatch(state.runs[0].prompt,/önceki A bulguları/);
  // Simulate corrupted old local state / stale job revision; fail closed on completion.
  state.runs[0].taskRevision=1;
  h.buckets.local.embasicStateV2=state;
  await assert.rejects(h.route('completeRun',{id:state.runs[0].id,output:'stale output from another project'}),/bağlamı değişmiş/);
  // Backup restore with network permissions off and no automatic export.
  const restored=harness();await restored.route('restoreBackup',{payload:JSON.parse(JSON.stringify(state))});
  const snapshot=await restored.route('snapshot');
  assert.equal(snapshot.tasks[0].enabled,false);
  assert.equal(snapshot.settings.githubEnabled,false);
  assert.ok(snapshot.runs.every(r=>r.syncConsent===false));
  const secretSource=harness({fetch:async()=>({ok:true,status:200,async json(){
    return {type:'file',content:btoa('-----BEGIN PRIVATE KEY-----\nSENSITIVE-MOCK-DATA')};
  }})});
  await secretSource.route('createTask',{payload:{...base,repo:'owner/repo'}});
  const sourceState=await secretSource.route('snapshot');
  assert.match(sourceState.runs[0].prompt,/içerik talimata alınmadı/);
  assert.doesNotMatch(sourceState.runs[0].prompt,/SENSITIVE-MOCK-DATA/);
  console.log('PASS isolation: immutable project, pending task freeze, reset memory, stale revision and secret context rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
