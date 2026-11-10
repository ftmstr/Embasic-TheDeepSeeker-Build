'use strict';
/* TUR029: Real Node HTTP loopback transport, SYNTHETIC in-memory provider.
 * NO live OAuth, GitHub, Drive or monotonic oracle. We test exact transport
 * uncertainty, NOT a server-enforced GitHub API or cross-provider transaction. */
const assert=require('node:assert/strict');
const http=require('node:http');
const cas=require('../extension/conditional-ref-cas.js');
const base={repositoryId:'R_syntheticRepositoryID123',refName:'refs/heads/embasic-fences/task-12345/run-12345',beforeOid:'a'.repeat(40)};
const A={...base,afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
const B={...base,afterOid:'c'.repeat(40),ownerNonce:'3'.repeat(32),reportDigest:'4'.repeat(64)};
const denied=(code)=>Object.assign(new Error(code),{code});
const state={head:base.beforeOid,commits:new Map(),postCount:0,successful:0,ackMode:'LOST_AFTER_COMMIT',read404:false};
const server=http.createServer(async(req,res)=>{
  function send(status,body){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));}
  if(req.method==='GET'&&req.url==='/ref'){
    if(state.read404){send(404,{error:'eventual visibility gap'});return;}
    send(200,{name:base.refName,oid:state.head});return;
  }
  if(req.method==='GET'&&req.url.startsWith('/commit/')){
    const oid=req.url.slice('/commit/'.length);const message=state.commits.get(oid);
    if(message)send(200,{oid,message});else send(404,{error:'not found'});
    return;
  }
  if(req.method==='POST'&&req.url==='/graphql'){
    state.postCount++;
    let body='';for await(const chunk of req)body+=chunk;
    const reqJson=JSON.parse(body);const u=reqJson.variables.input.refUpdates[0];
    assert.equal(u.name,base.refName);assert.equal(u.force,false);
    if(state.ackMode==='DENY_BEFORE_COMMIT'){send(429,{errors:[{message:'rate limited'}]});return;}
    if(u.beforeOid!==state.head){send(409,{errors:[{message:'beforeOid mismatch'}]});return;}
    const spec=u.afterOid===A.afterOid?A:B;
    state.head=u.afterOid;state.commits.set(u.afterOid,cas.commitMessage(cas.validate(spec)));state.successful++;
    if(state.ackMode==='LOST_AFTER_COMMIT')send(503,{errors:[{message:'ACK unavailable'}]});
    else send(200,{data:{updateRefs:{clientMutationId:reqJson.variables.input.clientMutationId}}});
    return;
  }
  send(404,{error:'unexpected path'});
});
async function run(){
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const httpRead=async path=>{
    const r=await fetch(url+path,{signal:AbortSignal.timeout(2500)});
    if(!r.ok)throw denied('SYNTHETIC_HTTP_'+r.status);
    return r.json();
  };
  let barrierCount=0,unlock;
  const barrier=new Promise(resolve=>unlock=resolve);
  const journal=[[],[]];
  function deps(i,barrierReads=false){
    return {
      readRef:async()=>{
        const observed=await httpRead('/ref');
        if(barrierReads && ++barrierCount<=2){if(barrierCount===2)unlock();await barrier;}
        return observed;
      },
      verifyCommit:oid=>httpRead('/commit/'+oid),
      graphql:async params=>{
        const r=await fetch(url+'/graphql',{
          method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(2500)
        });
        if(!r.ok)throw denied('SYNTHETIC_HTTP_'+r.status);
        return r.json();
      },
      persistIntent:async item=>{journal[i].push(structuredClone(item));},
      checkLease:async()=>true
    };
  }
  try{
    // Two separately held journals with real HTTP requests. The in-memory
    // server provides atomic mock beforeOid. The ACK is lost AFTER COMMIT.
    const outcomes=await Promise.allSettled([cas.commit(A,deps(0,true)),cas.commit(B,deps(1,true))]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
    assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'CAS_CONFLICT');
    assert.equal(state.successful,1);assert.equal(state.postCount,2);
    assert.equal(journal[0].length,1);assert.equal(journal[1].length,1);
    const winner=state.head===A.afterOid?A:B;
    const wi=winner===A?0:1;
    const owned=await cas.commit(winner,{...deps(wi),previousIntent:journal[wi][0],
      graphql:async()=>{throw Error('MUST NOT replay mutation')}});
    assert.equal(owned.status,'owned');assert.equal(state.postCount,2);
    console.log('PASS TUR029 LOOPBACK HTTP: independent writers with lost GraphQL ACK, exactly one mock CAS winner, no replay; live GitHub NOT_RUN');
    // An unreliable GET after a possibly committed POST is NOT proof of
    // absence; preserve uncertainty and forbid second HTTP mutation.
    state.head=base.beforeOid;state.commits.clear();state.postCount=0;state.successful=0;
    state.ackMode='LOST_AFTER_COMMIT';const uncertainJournal=[];
    const aDeps={...deps(0),persistIntent:async x=>uncertainJournal.push(x)};
    const originalGraphql=aDeps.graphql;
    aDeps.graphql=async x=>{try{return await originalGraphql(x)}finally{state.read404=true;}};
    await assert.rejects(cas.commit(A,aDeps),{code:'CAS_UNCERTAIN_NO_REPLAY'});
    assert.equal(state.successful,1);assert.equal(state.postCount,1);assert.equal(uncertainJournal.length,1);
    // During the 404 gap, initial observation fails closed before a GraphQL POST.
    await assert.rejects(cas.commit(A,{...aDeps,previousIntent:uncertainJournal[0],graphql:async()=>{throw Error('NOT ALLOWED')}}),{code:'SYNTHETIC_HTTP_404'});
    assert.equal(state.postCount,1);
    state.read404=false;
    const recovered=await cas.commit(A,{...deps(0),previousIntent:uncertainJournal[0],graphql:async()=>{throw Error('NOT ALLOWED')}});
    assert.equal(recovered.status,'owned');assert.equal(state.postCount,1);
    console.log('PASS TUR029 LOOPBACK HTTP: 404 after committed/lost ACK quarantined, exact owner-readback recovered without mutation');
    // A 429 before commit is STILL uncertain: no automatic retry even if
    // remote GET currently reports the old OID. Throttling is not a lease.
    state.head=base.beforeOid;state.commits.clear();state.successful=0;state.postCount=0;state.ackMode='DENY_BEFORE_COMMIT';
    const throttled=[];
    await assert.rejects(cas.commit(A,{...deps(0),persistIntent:async x=>throttled.push(x)}),{code:'CAS_UNCERTAIN_NO_REPLAY'});
    assert.equal(state.successful,0);assert.equal(state.postCount,1);assert.equal(throttled.length,1);
    await assert.rejects(cas.commit(A,{...deps(0),previousIntent:throttled[0],graphql:async()=>{throw Error('NOT ALLOWED')}}),{code:'CAS_UNCERTAIN_NO_REPLAY'});
    assert.equal(state.postCount,1);
    console.log('PASS TUR029 LOOPBACK HTTP: 429 precommit acknowledgement does not authorize replay; provider LIVE NOT_RUN');
  }finally{await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
