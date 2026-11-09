'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness();
  await h.listeners.startup();
  assert.equal(h.alarms.get('embasic-scheduler').periodInMinutes,1);
  await h.route('vaultCreate',{password:'Synthetic-scheduler-secure-passphrase'});
  const task=await h.route('createTask',{payload:{project:'OnlyOne',name:'Hourly',
    instructions:'Follow only this task history.',intervalHours:1,maxRuns:2,repo:'',enabled:true}});
  let s=await h.route('snapshot');
  assert.equal(s.runs.length,1);assert.equal(s.runs[0].status,'waiting');
  await h.listeners.alarm({name:'embasic-scheduler'});await h.route('schedulerNow');
  assert.equal((await h.route('snapshot')).runs.length,1,'no duplicate waiting run');
  await h.route('completeRun',{id:s.runs[0].id,output:'First completed run. SONRAKİ TUR ÖZETİ: Only this project.'});
  await h.scope.modifyState(x=>{x.tasks[0].nextRunAt=Date.now()-1000;});
  // Chrome restart must restore alarm and recover due task, without reusing old prompt.
  h.alarms.delete('embasic-scheduler');
  await h.listeners.startup();
  assert.equal(h.alarms.get('embasic-scheduler').periodInMinutes,1);
  s=await h.route('snapshot');
  assert.equal(s.runs.length,2);
  assert.equal(s.runs.filter(r=>r.status==='waiting').length,1);
  assert.match(s.runs[0].prompt,/Only this project/);
  await h.listeners.alarm({name:'embasic-scheduler'});
  assert.equal((await h.route('snapshot')).runs.length,2,'alarm cannot produce 2 pending turns');
  await h.route('completeRun',{id:s.runs[0].id,output:'Second completed run. SONRAKİ TUR ÖZETİ: Finished.'});
  s=await h.route('snapshot');assert.equal(s.tasks[0].enabled,false);
  assert.equal(s.tasks[0].completedRuns,2);
  // Persistent leases survive JSON state rehydration and are not processed early.
  await h.scope.modifyState(x=>{
    x.runs[0].driveSync='pending';x.runs[0].syncConsent=true;x.settings.driveEnabled=true;
    x.runs[0].syncLease={drive:{id:'previous-worker-lease',until:Date.now()+300000}};
  });
  await h.route('schedulerNow');
  assert.equal((await h.route('snapshot')).runs[0].driveSync,'pending','live lease not stolen');
  console.log('PASS TUR004 scheduler: reinstall alarm, startup catch-up, one pending run, max turns, persistent lease exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
