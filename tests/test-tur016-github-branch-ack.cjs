'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();const baseSha='a'.repeat(40);let writes=0,marker=null,refReads=0;
 const task={repo:'synthetic/repo',id:'12345678ABCD',baseBranch:'main'};
 const branch='embasic-agent/'+task.id;
 h.scope.githubRequest=async(path,opts={})=>{
   if(path.endsWith('/git/ref/heads/'+branch)){refReads++;return null;}
   if(path==='/repos/synthetic/repo')return {default_branch:'main'};
   if(path.endsWith('/git/ref/heads/main'))return {object:{sha:baseSha}};
   if(path.endsWith('/git/refs')&&opts.method==='POST') {writes++;const e=Error('GitHub HTTP 422 (POST)');e.httpStatus=422;throw e;}
   throw Error('Unexpected GitHub '+path);
 };
 await assert.rejects(h.scope.ensureGithubBranch(task,async()=>true,async m=>{marker=m}),e=>e.remoteBranchUncertain===true);
 assert.equal(writes,1);assert.equal(marker.baseSha,baseSha);
 await assert.rejects(h.scope.ensureGithubBranch(task,async()=>true,async()=>{throw Error('unexpected intent rewrite')},marker),e=>e.remoteBranchUncertain===true);
 assert.equal(writes,1,'ambiguous branch create with 404 and recorded intent must never issue a second POST');
 assert.ok(refReads>=3);
 console.log('PASS TUR016 GitHub branch POST HTTP 422 / ACK ambiguity plus stale 404 keeps journal and forbids replay');
})().catch(e=>{console.error(e);process.exitCode=1});
