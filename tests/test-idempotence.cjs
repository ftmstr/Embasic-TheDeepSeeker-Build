'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=(data,status=200)=>({ok:true,status,headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
const miss=()=>({ok:false,status:404,headers:{get:()=>null},text:async()=> 'not found'});
(async()=>{
  let githubPuts=0,drivePosts=0,drivePatches=0;
  let remoteContent=null,driveFile=null;let folderNumber=0;let remoteDriveMetadata=null,remoteDriveContent=null;
  const folders=new Map();const folderParents=new Map();
  async function fetch(url,options={}){
    const u=new URL(url);const method=options.method||'GET';
    if(u.hostname==='api.github.com'){
      if(u.pathname==='/repos/test/repo')return ok({default_branch:'main',private:true});
      if(u.pathname.endsWith('/contents/README.md'))return ok({type:'file',content:btoa('Safe README')});
      if(u.pathname.endsWith('/git/ref/heads/main'))return ok({object:{sha:'base'}});
      if(u.pathname.includes('/git/ref/heads/embasic-agent/'))return miss();
      if(u.pathname.endsWith('/git/refs')&&method==='POST')return ok({ref:'created'});
      if(u.pathname.includes('/agent-reports/')&&method==='GET')return remoteContent?ok({type:'file',content:remoteContent,sha:'stored'}):miss();
      if(u.pathname.includes('/agent-reports/')&&method==='PUT'){
        githubPuts++;remoteContent=JSON.parse(options.body).content;
        if(githubPuts===1)throw Error('network lost after GitHub commit');
        return ok({sha:'stored'});
      }
      throw Error('unknown github '+method+' '+u.pathname);
    }
    if(u.hostname==='www.googleapis.com'){
      if(u.pathname.startsWith('/drive/v3/files/drive-run-')&&method==='GET'&&u.searchParams.get('alt')==='media')
        return {ok:true,status:200,headers:{get:()=>null},text:async()=>remoteDriveContent};
      if(u.pathname==='/drive/v3/files'&&method==='GET'){
        const q=u.searchParams.get('q')||'';
        const folder=q.includes("mimeType = 'application/vnd.google-apps.folder'");
        const name=q.match(/name = '([^']+)'/)?.[1];
        if(folder)return ok({files:folders.has(name)?[{id:folders.get(name),name,appProperties:{embasicApp:'EMBASIC'},parents:folderParents.get(name)}]:[]});
        return ok({files:driveFile?[{id:driveFile,...remoteDriveMetadata}]:[]});
      }
      if(u.pathname==='/drive/v3/files'&&method==='POST'){
        const body=JSON.parse(options.body);const id='folder'+(++folderNumber);
        folders.set(body.name,id);folderParents.set(body.name,body.parents||['root']);return ok({id});
      }
      if(u.pathname==='/upload/drive/v3/files'&&method==='POST'){
        drivePosts++;driveFile='drive-run-001';
        const body=await options.body.text();
        assert.match(body,/embasicRun/);
        remoteDriveMetadata=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n--')[0]);
        remoteDriveContent=body.split('\r\n\r\n')[2].split('\r\n--')[0];
        if(drivePosts===1)throw Error('network lost after Drive create');
        return ok({id:driveFile});
      }
      if(u.pathname.startsWith('/upload/drive/v3/files/')&&method==='PATCH'){
        drivePatches++;return ok({id:driveFile});
      }
      throw Error('unknown drive '+method+' '+u.pathname);
    }
    throw Error('unexpected origin');
  }
  const h=harness({fetch,googleOauth:true});
  await h.route('saveGithubToken',{token:'github_pat_12345678901234567890',mode:'session'});
  await h.route('saveSettings',{githubEnabled:true,driveEnabled:true});
  await h.route('createTask',{payload:{project:'Exclusive project',name:'Task',instructions:'Safe instructions',
    repo:'test/repo',repoFile:'README.md',baseBranch:'main',intervalHours:1,maxRuns:1,enabled:true}});
  const run=(await h.route('snapshot')).runs[0];
  await h.route('completeRun',{id:run.id,output:'Recorded result. SONRAKİ TUR ÖZETİ: all done'});
  let state=await h.route('snapshot');
  assert.equal(state.runs[0].githubSync,'retry');assert.equal(state.runs[0].driveSync,'retry');
  await h.route('syncNow',{id:run.id});state=await h.route('snapshot');
  assert.equal(state.runs[0].githubSync,'synced');
  assert.equal(state.runs[0].driveSync,'synced');
  assert.equal(githubPuts,1,'no duplicate GitHub commit after lost response');
  assert.equal(drivePosts,1,'no duplicate Drive create after lost response');
  assert.equal(drivePatches,0,'never overwrite previously created Drive report');
  console.log('PASS idempotence: GitHub same-content skip and Drive digest identity after lost server acknowledgment');
})().catch(e=>{console.error(e);process.exitCode=1});
