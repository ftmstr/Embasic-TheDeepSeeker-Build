'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const payload={project:'Unavailable lock',name:'Do not commit',instructions:'Purely synthetic test',intervalHours:1,maxRuns:1};
(async()=>{
 const unsupported=harness();
 const diag=await unsupported.route('diagnostics');
 assert.equal(diag.crossContextWebLock,false);
 assert.equal(diag.distributedCas,false);
 const broken=harness({sharedLocks:{async request(){throw Error('Web Lock manager failed');}}});
 await assert.rejects(broken.route('createTask',{payload}),/Lock manager failed/);
 assert.equal((await broken.route('snapshot')).tasks.length,0,'a broken lock cannot downgrade silently to unsafe write');
 console.log('PASS TUR016 Web Locks unsupported is disclosed; a failed lock request never silently falls back to an unsafe write');
})().catch(e=>{console.error(e);process.exitCode=1});
