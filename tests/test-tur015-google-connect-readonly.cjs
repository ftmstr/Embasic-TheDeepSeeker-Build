'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
(async()=>{
 let read=0,mutations=0;
 const h=harness({googleOauth:true,fetch:async(url,opt={})=>{
   if((opt.method||'GET')!=='GET'){mutations++;throw Error('unexpected remote mutation');}
   if(new URL(url).pathname==='/drive/v3/files'){
     read++;return{ok:true,status:200,json:async()=>({files:[]})};
   }
   throw Error('Unexpected URL');
 }});
 const connected=await h.route('googleConnect');
 assert.equal(connected.folderId,null);
 assert.equal(read,1);assert.equal(mutations,0);
 assert.equal((await h.route('snapshot')).runs.length,0);
 console.log('PASS TUR015 Google OAuth connection performs read-only ownership check; no unjournaled folder POST');
})().catch(e=>{console.error(e);process.exitCode=1});
