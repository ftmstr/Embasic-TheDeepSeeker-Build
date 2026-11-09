'use strict';
const crypto=require('node:crypto');
// Synthetic in-memory provider. Its create-ref method is an ATOMIC first-writer
// wins operation, unlike Web Locks on separate profiles or a GET/PUT sequence.
function githubServer(){
 const refs=new Map(),commits=new Map(),stats={post:0,read:0};
 async function request(path,opts={}){
   if(path.includes('/git/commits/'))return {message:commits.get(path.split('/').at(-1))};
   if(path.includes('/git/ref/heads/embasic-claims/')){
     stats.read++;const ref='refs/heads/'+path.split('/git/ref/heads/')[1];
     const sha=refs.get(ref);return sha?{ref,object:{type:'commit',sha}}:null;
   }
   if(path.endsWith('/git/refs')&&opts.method==='POST'){
     stats.post++;const {ref,sha}=opts.body;
     if(refs.has(ref)){const e=Error('HTTP 422 (POST)');e.httpStatus=422;throw e;}
     refs.set(ref,sha);return {ref,object:{type:'commit',sha}};
   }
   throw Error('unexpected GitHub mock request: '+path);
 }
 function claim({taskId='aa11bb22',runId='11111111-2222-3333-4444-555555555555',ownerNonce='a'.repeat(32),reportDigest='1'.repeat(64)}={}){
   const id={repo:'synthetic/test-repo',taskId,runId,ownerNonce,reportDigest};
   const sha=crypto.createHash('sha1').update(JSON.stringify(id)).digest('hex');
   const c={...id,claimSha:sha};
   const api=require('../extension/remote-claim.js');
   commits.set(sha,api.messageFor(c));return c;
 }
 return{request,claim,refs,commits,stats};
}
module.exports={githubServer};
