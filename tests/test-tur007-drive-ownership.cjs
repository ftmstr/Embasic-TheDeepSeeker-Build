'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data});
(async()=>{
  let posts=0;
  const h=harness({googleOauth:true,fetch:async(url,options={})=>{
    const u=new URL(url);
    if(u.pathname==='/drive/v3/files'&&(options.method||'GET')==='GET'){
      const query=u.searchParams.get('q');
      assert.ok(query.includes("appProperties has"));
      return ok({files:[{id:'wrong-parent',name:'Synthetic root',parents:['attacker-parent'],
        appProperties:{embasicApp:'EMBASIC'}}]});
    }
    if(options.method==='POST'){posts++;return ok({id:'unexpected'});}
    throw new Error('unexpected '+url);
  }});
  await assert.rejects(h.scope.ensureDriveFolder('Synthetic root',null),/belirsiz/);
  assert.equal(posts,0,'foreign-parent folder spoof could cause upload to wrong tree');
  // An app-owned folder whose claimed parent matches can be safely read.
  const legitimate=harness({googleOauth:true,fetch:async(url)=>ok({files:[{id:'trusted-root',name:'Synthetic root',
    parents:['root'],appProperties:{embasicApp:'EMBASIC'}}]})});
  assert.equal(await legitimate.scope.ensureDriveFolder('Synthetic root'), 'trusted-root');
  console.log('PASS TUR007 Drive ownership: unexpected parent metadata fails closed and prevents remote POST');
})().catch(e=>{console.error(e);process.exitCode=1});
