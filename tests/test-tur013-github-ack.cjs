'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();
 await h.route('createTask',{payload:{project:'A',name:'GitHub ack',instructions:'Synthetic only',intervalHours:1,maxRuns:1,repo:'test/repo'}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic output. SONRAKİ TUR ÖZETİ: complete.'});
 await h.route('saveSettings',{githubEnabled:true,driveEnabled:false});
 h.scope.githubToken=async()=> 'synthetic';
 h.scope.ensureGithubBranch=async()=> 'embasic-agent/test';
 let puts=0,visible=false,reads=0,expected;
 h.scope.githubRequest=async(path,options={})=>{
   if(path==='/repos/test/repo')return {private:true,default_branch:'main'};
   if(path.includes('/contents/agent-reports/')){
     if(options.method==='PUT') {puts++;throw Error('fetch failed after GitHub commit');}
     reads++;return visible?{type:'file',content:h.scope.encodeBase64Utf8(expected)}:null;
   }
   throw Error('unexpected '+path);
 };
 expected=h.scope.reportText((await h.route('snapshot')).runs[0]);
 await h.route('syncNow',{id});
 let r=(await h.route('snapshot')).runs[0];
 assert.equal(puts,1);assert.equal(r.githubUncertainCommit,true);assert.equal(r.githubSync,'retry');
 await h.route('syncNow',{id});
 r=(await h.route('snapshot')).runs[0];
 assert.equal(puts,1,'remote 404 must not reauthorize a second PUT');assert.equal(r.githubUncertainCommit,true);
 visible=true;
 await h.route('syncNow',{id});
 r=(await h.route('snapshot')).runs[0];
 assert.equal(r.githubSync,'synced');assert.equal(r.githubUncertainCommit,false);assert.equal(puts,1);assert.ok(reads>=3);
 console.log('PASS TUR013 GitHub unknown ACK: sealed intent, no duplicate PUT, authenticated remote-byte recovery');
})().catch(e=>{console.error(e);process.exitCode=1});
