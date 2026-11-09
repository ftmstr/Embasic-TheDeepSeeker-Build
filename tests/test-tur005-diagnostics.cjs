'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
  const h=harness();
  await h.listeners.startup();
  let d=await h.route('diagnostics');
  assert.equal(d.version,'1.15.0');assert.equal(d.deepseekWebAutomation,false);
  assert.equal(d.taskCount,null);assert.equal(d.alarmRegistered,true);
  assert.equal(d.alarmPeriodMinutes,1);
  const password='TUR005-synthetic-private-passphrase';
  await h.route('vaultCreate',{password});
  await h.route('createTask',{payload:{project:'Project VERY PRIVATE NAME',name:'Task',
    instructions:'Never leave my private room.',intervalHours:1,maxRuns:1,repo:'',enabled:true}});
  d=await h.route('diagnostics');
  assert.equal(d.vaultUnlocked,true);assert.equal(d.taskCount,1);assert.equal(d.waitingCount,1);
  assert.ok(!JSON.stringify(d).includes('PRIVATE'));
  assert.ok(!JSON.stringify(d).includes('passphrase'));
  await h.route('vaultLock');
  d=await h.route('diagnostics');
  assert.equal(d.taskCount,null);assert.equal(d.waitingCount,null);
  h.alarms.delete('embasic-scheduler');
  d=await h.route('diagnostics');assert.equal(d.alarmRegistered,false);
  await h.listeners.startup();
  d=await h.route('diagnostics');assert.equal(d.alarmRegistered,true);
  console.log('PASS TUR005 diagnostics: alarm/worker state, safe counts, no task data leaked while locked, restart');
})().catch(e=>{console.error(e);process.exitCode=1});
