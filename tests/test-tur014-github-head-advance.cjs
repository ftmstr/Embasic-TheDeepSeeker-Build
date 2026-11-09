'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 const h=harness();await h.route('createTask',{payload:{project:'X',name:'Lost PUT ACK',instructions:'Only synthetic data',intervalHours:1,maxRuns:1,repo:'fake/repo'}});
 const id=(await h.route('snapshot')).runs[0].id;
 await h.route('completeRun',{id,output:'Synthetic reviewed report'});await h.route('saveSettings',{githubEnabled:true});
 h.scope.githubToken=async()=> 'test';const base='a'.repeat(40),advanced='b'.repeat(40);
 let branchExists=false,reportExists=false,posts=0,puts=0;
 let writtenText=null;
 h.scope.githubRequest=async(path,opts={})=>{
   if(path==='/repos/fake/repo')return{private:true,default_branch:'main'};
   if(path.endsWith('/git/ref/heads/main'))return{object:{sha:base}};
   if(path.includes('/git/ref/heads/embasic-agent/'))return branchExists?{object:{sha:reportExists?advanced:base}}:null;
   if(path.endsWith('/git/refs')&&opts.method==='POST'){posts++;branchExists=true;return{};}
   if(path.includes('/contents/agent-reports/')){
     if(opts.method==='PUT'){
       puts++;reportExists=true;writtenText=opts.body.content;
       throw Error('ACK lost AFTER successful report PUT and branch HEAD advance');
     }
     return reportExists?{type:'file',content:writtenText}:null;
   }
   throw Error('Unexpected '+path);
 };
 await h.route('syncNow',{id});let r=(await h.route('snapshot')).runs[0];
 assert.equal(posts,1);assert.equal(puts,1);assert.equal(r.githubUncertainCommit,true);
 assert.equal(r.githubUncertainBranch.baseSha,base);
 await h.route('syncNow',{id});r=(await h.route('snapshot')).runs[0];
 assert.equal(r.githubSync,'synced','remote report bytes must reconcile despite HEAD move after our PUT');
 assert.equal(puts,1);assert.equal(posts,1);
 assert.equal(r.githubUncertainBranch,null);assert.equal(r.githubUncertainCommit,false);
 console.log('PASS TUR014 lost PUT ACK + advanced branch HEAD: exact remote report verified without replay');
})().catch(e=>{console.error(e);process.exitCode=1});
