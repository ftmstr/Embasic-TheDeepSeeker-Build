'use strict';
/* TUR031: genuine loopback TCP/HTTP, synthetic conditional-ref provider.
 * Checks that an MV3-like lease changes across await boundaries fail closed.
 * NO real GitHub/Drive/OAuth, browser state or account mutations. */
const assert=require('node:assert/strict');
const http=require('node:http');
const cas=require('../extension/conditional-ref-cas.js');
const s={repositoryId:'R_testSyntheticRepo12345',refName:'refs/heads/embasic-fences/task-10001/run-20001',beforeOid:'a'.repeat(40),afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:'2'.repeat(64)};
let head=s.beforeOid, commits=0, posts=0, reads=0, commitMessage=cas.commitMessage(cas.validate(s));
const server=http.createServer(async(req,res)=>{
 const send=(n,p)=>{res.writeHead(n,{'content-type':'application/json'});res.end(JSON.stringify(p));};
 if(req.method==='GET'&&req.url==='/ref'){reads++;return send(200,{name:s.refName,oid:head});}
 if(req.method==='GET'&&req.url==='/commit/'+head){return send(200,{oid:head,message:commitMessage});}
 if(req.method==='POST'&&req.url==='/graphql'){
   let json='';for await(const chunk of req)json+=chunk;
   const body=JSON.parse(json),u=body.variables.input.refUpdates[0];
   posts++;assert.equal(u.force,false);assert.equal(u.name,s.refName);
   if(head!==u.beforeOid)return send(409,{errors:[{message:'stale beforeOid'}]});
   head=u.afterOid;commits++;
   return send(200,{data:{updateRefs:{clientMutationId:body.variables.input.clientMutationId}}});
 }
 send(404,{error:'unexpected synthetic endpoint'});
});
const deny=(code)=>Object.assign(new Error(code),{code});
(async()=>{
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 async function request(path,options={}){
   const response=await fetch(url+path,{...options,signal:AbortSignal.timeout(3000)});
   if(!response.ok)throw deny('HTTP_'+response.status);
   return response.json();
 }
 const journal=[];
 const deps=(checkLease,persistIntent=async v=>journal.push(structuredClone(v)))=>({
   readRef:()=>request('/ref'),
   verifyCommit:()=>request('/commit/'+s.afterOid),
   graphql:x=>request('/graphql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)}),
   persistIntent,checkLease
 });
 try{
   let checks=0;
   await assert.rejects(cas.commit(s,deps(async()=>++checks<3)),{code:'CAS_LEASE_DENIED'});
   assert.equal(checks,3);assert.equal(journal.length,1);
   assert.equal(posts,0);assert.equal(commits,0);
   await assert.rejects(cas.commit(s,{...deps(async()=>false),previousIntent:journal[0]}),{code:'CAS_LEASE_DENIED'});
   assert.equal(posts,0,'revoked worker did not send GraphQL POST');
   console.log('PASS TUR031 TCP: lease revoked after encrypted intent and before HTTP POST -> zero writes; live GitHub NOT_RUN');

   // Another owner may have advanced the clock while the first is suspended.
   // With a *new* authorized lease, a durable intent that did not POST is
   // still uncertain in this contract and MUST NOT be resubmitted blindly.
   await assert.rejects(cas.commit(s,{...deps(async()=>true),previousIntent:journal[0]}),{code:'CAS_UNCERTAIN_NO_REPLAY'});
   assert.equal(posts,0);

   journal.length=0;checks=0;
   await assert.rejects(cas.commit(s,deps(async()=>++checks<4)),{code:'CAS_LEASE_DENIED'});
   assert.equal(checks,4);assert.equal(posts,1);assert.equal(commits,1);
   assert.equal(journal.length,1);
   // HTTP success and remote commit do not authorize the suspended/revoked
   // local worker to mark completion. Independent owned readback may reconcile
   // exactly once after a FRESH positive lease decision, without GraphQL POST.
   let replay=0;
   const readBack=await cas.commit(s,{...deps(async()=>true),previousIntent:journal[0],
     graphql:async()=>{replay++;throw Error('MUTATION REPLAY FORBIDDEN')}});
   assert.equal(readBack.status,'owned');assert.equal(replay,0);assert.equal(posts,1);
   console.log('PASS TUR031 TCP: lease revoked after remote COMMIT -> local ACK denied; fresh owner-bound GET reconciles without replay');

   // Owner-bound immutable commit message is mandatory when a competing
   // profile tampers with the published digest/owner even at the right OID.
   commitMessage='malicious foreign owner';
   await assert.rejects(cas.commit(s,{...deps(async()=>true),previousIntent:journal[0]}),{code:'CAS_COMMIT_UNVERIFIED'});
   assert.equal(posts,1);
   console.log('PASS TUR031 TCP: same OID with foreign commit metadata rejected; no provider replay, physical devices NOT_RUN');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
