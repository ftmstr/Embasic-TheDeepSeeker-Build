'use strict';
/* TUR032: REAL localhost TCP transport, SYNTHETIC in-memory provider.
 * A disconnected HTTP POST can commit AFTER an initial old-ref readback.
 * NEVER interpret a stale observation as permission to retry. */
const assert = require('node:assert/strict');
const http = require('node:http');
const cas = require('../extension/conditional-ref-cas.js');
const s={repositoryId:'R_syntheticRepositoryID123',refName:'refs/heads/embasic-fences/task-13200/run-20400',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
const t={...s,afterOid:'c'.repeat(40),ownerNonce:'3'.repeat(32),reportDigest:'4'.repeat(64)};
const state={head:s.beforeOid,postCount:0,commits:0,pending:null,commitMessage:null,readCount:0};
const server=http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
  if(req.method==='GET'&&req.url==='/ref'){
    state.readCount++;send(200,{name:s.refName,oid:state.head});return;
  }
  if(req.method==='GET'&&req.url.startsWith('/commit/')){
    const id=req.url.slice(8);
    if(id===state.head&&state.commitMessage)send(200,{oid:id,message:state.commitMessage});
    else send(404,{error:'not found'});
    return;
  }
  if(req.method==='POST'&&req.url==='/graphql'){
    let raw='';for await(const chunk of req)raw+=chunk;
    const data=JSON.parse(raw),change=data.variables.input.refUpdates[0];
    state.postCount++;
    assert.equal(change.name,s.refName);assert.equal(change.force,false);
    assert.equal(change.beforeOid,state.head);
    assert.equal(state.pending,null,'Second mutation must not be sent');
    state.pending=change;
    // The transport is disconnected BEFORE the mock server persists the
    // mutation. The commit may still occur later, and the client cannot tell.
    req.socket.destroy();
    return;
  }
  send(404,{error:'unexpected route'});
});
async function main(){
  await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
  const base=`http://127.0.0.1:${server.address().port}`;
  const denied=(code)=>Object.assign(new Error(code),{code});
  const request=async(path,init={})=>{
    const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(3000)});
    if(!r.ok)throw denied('HTTP_'+r.status);
    return r.json();
  };
  const journals=[[],[]];
  const deps=(index,previousIntent)=>({
    readRef:()=>request('/ref'),verifyCommit:oid=>request('/commit/'+oid),
    graphql:payload=>request('/graphql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),
    persistIntent:async j=>{journals[index].push(structuredClone(j));},
    checkLease:async()=>true,
    ...(previousIntent?{previousIntent}:{})
  });
  try{
    // Real socket destruction yields an uncertain post; initial GET is old.
    await assert.rejects(cas.commit(s,deps(0)),{code:'CAS_UNCERTAIN_NO_REPLAY'});
    assert.equal(state.postCount,1);assert.equal(state.commits,0);
    assert.equal(journals[0].length,1);
    const initialReads=state.readCount;
    await assert.rejects(cas.commit(s,deps(0,journals[0][0])),{code:'CAS_UNCERTAIN_NO_REPLAY'});
    assert.equal(state.postCount,1);assert(state.readCount>initialReads);
    console.log('PASS TUR032 REAL TCP: socket-disconnect before delayed COMMIT; stale old-ref readback does not authorize POST replay');

    // Simulate the server committing *after* the client's old-ref readback.
    state.head=state.pending.afterOid;
    state.commitMessage=cas.commitMessage(cas.validate(s));
    state.commits++;
    const owned=await cas.commit(s,{...deps(0,journals[0][0]),graphql:async()=>{throw Error('forbidden replay')}});
    assert.equal(owned.status,'owned');assert.equal(state.postCount,1);assert.equal(state.commits,1);
    // A second independent device never inherits the first profile's WAL.
    // Seeing another owner's advanced OID is CONFLICT, not an owned result.
    await assert.rejects(cas.commit(t,deps(1)),{code:'CAS_CONFLICT'});
    assert.equal(journals[1].length,0);assert.equal(state.postCount,1);
    console.log('PASS TUR032 REAL TCP: late immutable COMMIT owner readback recovers without replay; independent competing profile denied');

    // Provider returned the expected OID but ownership metadata is forged.
    state.commitMessage=cas.commitMessage(cas.validate(t));
    await assert.rejects(cas.commit(s,deps(0,journals[0][0])),{code:'CAS_COMMIT_UNVERIFIED'});
    assert.equal(state.postCount,1);
    console.log('PASS TUR032 REAL TCP: same ref OID with another owner immutable commit metadata fails closed; provider LIVE NOT_RUN');
  }finally{await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
