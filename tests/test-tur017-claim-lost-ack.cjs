'use strict';
const assert=require('node:assert/strict');
const {githubServer}=require('./tur017-mock-github.cjs');
const api=require('../extension/remote-claim.js');
(async()=>{
 const s=githubServer(),c=s.claim(),intents=[];
 const lost=async(path,opts)=>{
   const r=await s.request(path,opts);
   if(opts?.method==='POST')throw Error('lost ACK after server COMMIT');
   return r;
 };
 const ok=await api.acquire(c,{request:lost,persistIntent:async m=>intents.push(m)});
 assert.equal(ok.status,'owned');assert.equal(s.stats.post,1);
 const resumed=await api.acquire(c,{request:s.request,previousIntent:intents[0],persistIntent:async()=>assert.fail('no new journal')});
 assert.equal(resumed.status,'owned');assert.equal(s.stats.post,1);
 // Even if read-after-write returns a stale 404, persisted intent forbids replay.
 let staleReads=0;
 const stale=async(path,opts)=>{if(path.includes('/git/ref/heads/')){staleReads++;return null;}return s.request(path,opts);};
 await assert.rejects(api.acquire(c,{request:stale,previousIntent:intents[0],persistIntent:async()=>assert.fail()}),{code:'CLAIM_UNCERTAIN_NO_REPLAY'});
 assert.equal(s.stats.post,1);assert.ok(staleReads===1);
 console.log('PASS TUR017 GitHub lost create-ref ACK reconciles matching owner; stale GET 404 never replays POST (mock)');
})().catch(e=>{console.error(e);process.exitCode=1});
