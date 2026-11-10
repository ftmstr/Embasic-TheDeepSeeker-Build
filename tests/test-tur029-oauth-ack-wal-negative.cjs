'use strict';
// TUR029: synthetic OAuth/ambiguous-ACK cross-profile negative acceptance.
// No live accounts, network, tokens, or provider mutations.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const digest=crypto.createHash('sha256').update('synthetic-report').digest('hex');
const fail=(code)=>Object.assign(new Error(code),{code});
async function run(){
  for(const status of [401,403,429]){
    const journal=[{digest,state:'PREPARED',attempts:0}];
    let writes=0;
    const post=async()=>{writes++;throw fail('HTTP_'+status)};
    const attempt=async()=>{
      const row=journal[0];
      if(row.state!=='PREPARED')throw fail('INTENT_NOT_RETRYABLE');
      row.state='UNCERTAIN';row.attempts++;
      try{await post()}catch(e){assert.equal(e.code,'HTTP_'+status);throw e}
    };
    await assert.rejects(attempt(),{code:'HTTP_'+status});
    await assert.rejects(attempt(),{code:'INTENT_NOT_RETRYABLE'});
    assert.equal(writes,1);
    assert.equal(journal[0].state,'UNCERTAIN');
    // No provider confirmation: even 401/403 cannot safely establish absence.
    console.log('PASS TUR029 synthetic OAuth '+status+' uncertain journal fail-closed');
  }
  const remote={objects:[]};
  const profiles=[{wal:[]},{wal:[]}];
  async function uncertainPost(profile){
    profile.wal.push({digest,state:'UNCERTAIN'});
    remote.objects.push({digest});
    throw fail('ACK_LOST');
  }
  await Promise.all(profiles.map(p=>assert.rejects(uncertainPost(p),{code:'ACK_LOST'})));
  assert.equal(remote.objects.length,2);
  assert.equal(profiles.every(p=>p.wal.length===1),true);
  // Local encrypted WALs are independent; identical digests do not fence POST.
  const freshProfile={wal:[]};
  assert.equal(freshProfile.wal.length,0);
  console.log('PASS TUR029 NEGATIVE two-profile duplicate POST; global exactly-once NOT_PROVEN');
}
run().catch(e=>{console.error(e);process.exitCode=1});
