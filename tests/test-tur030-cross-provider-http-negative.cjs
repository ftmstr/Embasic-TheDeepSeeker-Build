'use strict';
/* TUR030 adversarial REAL loopback sockets; SYNTHETIC providers. The GitHub
 * ref-CAS and Drive upload endpoint do not share a transaction or identity.
 * No external account, secrets, user payload, live OAuth or web automation. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const cas=require('../extension/conditional-ref-cas.js');
const repo='R_syntheticRepositoryID123', oldOid='a'.repeat(40), digest=crypto.createHash('sha256').update('synthetic-report-TUR030').digest('hex');
const identities=[
 {repositoryId:repo,refName:'refs/heads/embasic-fences/task-10001/run-20001',beforeOid:oldOid,afterOid:'b'.repeat(40),ownerNonce:'1'.repeat(32),reportDigest:digest},
 {repositoryId:repo,refName:'refs/heads/embasic-fences/task-10002/run-20002',beforeOid:oldOid,afterOid:'c'.repeat(40),ownerNonce:'2'.repeat(32),reportDigest:digest}
];
function server() {
 const records=new Map(identities.map(x=>[x.refName,oldOid])),receipts=new Map(),uploads=[];
 let casCalls=0,driveCalls=0;
 const instance=http.createServer(async(req,res)=>{
   const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
   const uri=new URL(req.url,'http://localhost');
   if(req.method==='GET' && uri.pathname==='/ref'){
     const name=uri.searchParams.get('name');return records.has(name)?send(200,{name,oid:records.get(name)}):send(404,{error:'ref-not-found'});
   }
   if(req.method==='GET' && uri.pathname==='/commit'){
     const oid=uri.searchParams.get('oid');return receipts.has(oid)?send(200,receipts.get(oid)):send(404,{error:'no immutable commit'});
   }
   let input='';for await(const chunk of req)input+=chunk;
   const body=JSON.parse(input||'{}');
   if(req.method==='POST'&&uri.pathname==='/graphql'){
     casCalls++;const u=body.variables?.input?.refUpdates?.[0];
     if(!u || u.force!==false || !records.has(u.name))return send(400,{errors:[{message:'invalid CAS'}]});
     if(records.get(u.name)!==u.beforeOid)return send(409,{errors:[{message:'beforeOid conflict'}]});
     const spec=identities.find(x=>x.refName===u.name&&x.afterOid===u.afterOid);
     if(!spec)return send(403,{errors:[{message:'not an owned commit'}]});
     records.set(u.name,u.afterOid);
     receipts.set(u.afterOid,{oid:u.afterOid,message:cas.commitMessage(cas.validate(spec))});
     return send(200,{data:{updateRefs:{clientMutationId:body.variables.input.clientMutationId}}});
   }
   if(req.method==='POST'&&uri.pathname==='/drive-upload'){
     driveCalls++;
     if(body.parent!=='synthetic-owned-folder'||body.sha256!==digest||body.ownerNonce?.length!==32)
       return send(403,{error:'invalid parent/digest/owner'});
     uploads.push({parent:body.parent,digest:body.sha256,owner:body.ownerNonce});
     // Dropbox-like ACK loss is represented as 503 AFTER server has committed.
     return send(503,{error:'synthetic post-commit ACK loss'});
   }
   send(404,{error:'unexpected route'});
 });
 return {instance,records,receipts,uploads,get casCalls(){return casCalls},get driveCalls(){return driveCalls}};
}
(async()=>{
 const remote=server();await new Promise(r=>remote.instance.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${remote.instance.address().port}`;
 const get=async(path)=>{const r=await fetch(url+path,{signal:AbortSignal.timeout(2500)});if(!r.ok)throw Object.assign(Error('read'),{code:'HTTP_'+r.status});return r.json();};
 const post=async(path,value)=>{const r=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(2500)});if(!r.ok)throw Object.assign(Error('write uncertain'),{code:'HTTP_'+r.status});return r.json();};
 const journals=[[],[]],driveJournals=[[],[]];
 try{
   // Ref protection is correct but two distinct refs are not a global fence.
   const results=await Promise.all(identities.map((s,i)=>cas.commit(s,{
     readRef:()=>get('/ref?name='+encodeURIComponent(s.refName)),
     verifyCommit:oid=>get('/commit?oid='+oid),
     graphql:q=>post('/graphql',q),
     checkLease:async()=>true,
     persistIntent:async j=>{journals[i].push(structuredClone(j));}
   })));
   assert(results.every(x=>x.status==='owned'));
   assert.equal(remote.casCalls,2);assert(journals.every(x=>x.length===1));
   console.log('PASS TUR030 loopback: two distinct GitHub ref CAS commits each verified, no cross-ref/global fence; LIVE NOT_RUN');
   // Identical Drive payload uploads twice from independent Chrome profiles.
   for(const [i,s] of identities.entries()){
     driveJournals[i].push({digest,status:'UNCERTAIN',ownerNonce:s.ownerNonce});
   }
   await Promise.all(identities.map(s=>assert.rejects(post('/drive-upload',{parent:'synthetic-owned-folder',sha256:digest,ownerNonce:s.ownerNonce}),{code:'HTTP_503'})));
   assert.equal(remote.driveCalls,2);assert.equal(remote.uploads.length,2);
   assert.equal(remote.uploads[0].digest,remote.uploads[1].digest);
   assert(driveJournals.every(x=>x.length===1&&x[0].status==='UNCERTAIN'));
   assert.equal(remote.records.size,2);
   // Same-profile recovery refuses a second POST, but a third independent
   // profile has no ledger and cannot infer what the server committed.
   function canRetry(profile){return profile.some(x=>x.status==='UNCERTAIN')?false:true;}
   assert(!canRetry(driveJournals[0]));assert(!canRetry(driveJournals[1]));
   assert(canRetry([]));
   console.log('PASS TUR030 loopback NEGATIVE: two post-COMMIT Drive ACK losses, two uploads despite per-ref CAS; global exactly-once NOT_PROVEN');
   await assert.rejects(post('/drive-upload',{parent:'wrong-folder',sha256:digest,ownerNonce:'1'.repeat(32)}),{code:'HTTP_403'});
   assert.equal(remote.uploads.length,2);
   console.log('PASS TUR030 loopback: wrong Drive parent denied in mock; real Google Drive authorization NOT_RUN');
 }finally{await new Promise(resolve=>remote.instance.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
