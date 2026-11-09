'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=(data,status=200)=>({ok:true,status,headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
(async()=>{
  let folderId=0,uploads=0,patches=0,remote=null,remoteContent='';const folders=new Map();const folderParents=new Map();
  async function fetch(url,options={}){
    const u=new URL(url),method=options.method||'GET';
    assert.equal(u.hostname,'www.googleapis.com','Drive must be official API only');
    if(u.pathname==='/drive/v3/files'&&method==='GET'){
      const q=u.searchParams.get('q')||'';
      const folder=q.includes('application/vnd.google-apps.folder');
      if(folder){
        const name=q.match(/name = '([^']+)'/)?.[1];
        return ok({files:folders.has(name)?[{id:folders.get(name),name,parents:folderParents.get(name),appProperties:{embasicApp:'EMBASIC'}}]:[]});
      }
      return ok({files:remote?[{id:'file001',...remote}]:[]});
    }
    if(u.pathname==='/drive/v3/files'&&method==='POST'){
      const meta=JSON.parse(options.body);
      assert.equal(meta.appProperties.embasicApp,'EMBASIC');
      const id='folder'+(++folderId);folders.set(meta.name,id);folderParents.set(meta.name,meta.parents||['root']);return ok({id});
    }
    if(u.pathname==='/upload/drive/v3/files'&&method==='POST'){
      uploads++;
      const body=await options.body.text();
      remote=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n--')[0]);
      remoteContent=body.split('\r\n\r\n')[2].split('\r\n--')[0];
      assert.match(remote.appProperties.embasicSha256,/^[a-f0-9]{64}$/);
      assert.match(options.headers.Authorization,/^Bearer /);
      if(uploads===1)throw Error('network lost after Drive commit');
      return ok({id:'file001'});
    }
    if(u.pathname==='/drive/v3/files/file001'&&u.searchParams.get('alt')==='media'){
      return {ok:true,status:200,headers:{get:()=>null},text:async()=>remoteContent};
    }
    if(u.pathname.startsWith('/upload/drive/v3/files/')&&method==='PATCH'){
      patches++;return ok({id:'file001'});
    }
    throw Error('unhandled request '+method+' '+u.pathname);
  }
  const h=harness({fetch,googleOauth:true});
  await h.route('saveSettings',{driveEnabled:true});
  await h.route('createTask',{payload:{project:'Secret Vault Project',name:'Monthly report',
    instructions:'Report on a synthetic test only.',intervalHours:1,maxRuns:1,repo:'',enabled:true}});
  const run=(await h.route('snapshot')).runs[0];
  await h.route('completeRun',{id:run.id,output:'Synthetic test result. SONRAKİ TUR ÖZETİ: Continue.'});
  assert.equal((await h.route('snapshot')).runs[0].driveSync,'retry');
  assert.equal(uploads,1);
  remoteContent+='\nMALICIOUS CONTENT MODIFICATION'; // preserve metadata but change remote bytes
  await h.route('syncNow',{id:run.id});
  const state=await h.route('snapshot');
  assert.equal(state.runs[0].driveSync,'blocked','stale metadata hash must not allow silent recovery');
  assert.match(state.runs[0].driveError,/uzak içeriği değişmiş/);
  assert.equal(uploads,1,'no second file');assert.equal(patches,0,'never overwrite existing Drive file');
  assert.ok(!JSON.stringify(h.buckets.local).includes('mock-google-token'),'Google bearer token is session/identity only');
  console.log('PASS TUR004 cloud: official Drive API, remote-byte integrity, metadata digest, loss-of-ACK recovery guard, no overwrite');
})().catch(e=>{console.error(e);process.exitCode=1});
