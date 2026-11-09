'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
(async()=>{
  let posts=0,reads=0;let folder=null;
  async function fetch(url,options={}){
    const u=new URL(url),method=options.method||'GET';
    assert.equal(u.hostname,'www.googleapis.com');
    if(u.pathname==='/drive/v3/files'&&method==='GET'){
      reads++;const q=u.searchParams.get('q');
      assert.ok(q.includes("appProperties has { key = 'embasicApp'"));
      return ok({files:folder?[{id:folder.id,name:folder.name,appProperties:{embasicApp:'EMBASIC'},parents:folder.parents}]:[]});
    }
    if(u.pathname==='/drive/v3/files'&&method==='POST'){
      posts++;const b=JSON.parse(options.body);assert.equal(b.appProperties.embasicApp,'EMBASIC');
      folder={id:'folder-'+posts,name:b.name,parents:b.parents||['root']};
      throw Error('network lost after server created folder');
    }
    throw Error('Unexpected request '+method+u.pathname);
  }
  const h=harness({fetch,googleOauth:true});
  // Test concurrent folder requests. The second must share the same Promise,
  // not create a second folder. The first call loses its server acknowledgement.
  const [first,second]=await Promise.all([
    h.scope.ensureDriveFolder('Agent Test Root'),h.scope.ensureDriveFolder('Agent Test Root')]);
  assert.equal(first,'folder-1');assert.equal(second,'folder-1');
  assert.equal(posts,1);assert.equal(reads,2);
  // Detect remote ambiguity and refuse unsafe reuse.
  const ambiguous=harness({googleOauth:true,fetch:async(url,options={})=>{
    const u=new URL(url);const q=u.searchParams.get('q')||'';
    if(u.pathname==='/drive/v3/files'&&q.includes('mimeType'))return ok({files:[
      {id:'a',name:'Colliding',appProperties:{embasicApp:'EMBASIC'}},
      {id:'b',name:'Colliding',appProperties:{embasicApp:'EMBASIC'}}]});
    throw Error('Unexpected request');
  }});
  await assert.rejects(ambiguous.scope.ensureDriveFolder('Colliding'),/belirsiz/);
  console.log('PASS TUR005 cloud: Drive folder response-loss reconciliation, single-flight concurrency, ambiguous remote fail-closed');
})().catch(e=>{console.error(e);process.exitCode=1});
