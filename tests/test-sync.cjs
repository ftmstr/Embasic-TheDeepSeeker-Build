'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const ok=(data,status=200)=>({ok:true,status,async json(){return data;},async text(){return JSON.stringify(data);}});
const fail=(status)=>({ok:false,status,async json(){return{};},async text(){return 'failure';}});
function mockApi({isPublic=false,failFirstDrive=false}={}) {
  const folders={},folderParents={},uploadedFiles={},events=[];let counter=0;
  let failUpload=failFirstDrive;
  async function fetch(url,options={}) {
    const u=new URL(url);const method=options.method||'GET';events.push({u,method,options});
    if(u.hostname==='api.github.com') {
      if(u.pathname==='/repos/owner/repo')return ok({full_name:'owner/repo',default_branch:'main',private:!isPublic});
      if(u.pathname.includes('/contents/README.md'))return ok({type:'file',content:btoa('Test README file')});
      if(u.pathname.endsWith('/git/ref/heads/main'))return ok({object:{sha:'MAIN-SHA-1'}});
      if(u.pathname.includes('/git/ref/heads/embasic-agent/'))return fail(404);
      if(u.pathname.endsWith('/git/refs')&&method==='POST')return ok({ref:'test'},201);
      if(u.pathname.includes('/contents/agent-reports/')&&method==='GET')return fail(404);
      if(u.pathname.includes('/contents/agent-reports/')&&method==='PUT'){
        const body=JSON.parse(options.body);
        assert.match(body.branch,/^embasic-agent\/[a-z0-9]+$/);
        assert.match(body.message,/docs\(agent\):/);
        assert.equal(typeof body.content,'string');
        return ok({content:{sha:'result-sha'}},201);
      }
      throw new Error('Unhandled GitHub mock '+method+' '+u.pathname);
    }
    if(u.hostname==='www.googleapis.com') {
      if(u.pathname==='/drive/v3/files/drive-file-123'&&method==='GET') {
        if(u.searchParams.get('alt')==='media')
          return {ok:true,status:200,text:async()=>uploadedFiles.content};
        return ok({id:uploadedFiles.file,...uploadedFiles.metadata});
      }
      if(u.pathname==='/drive/v3/files'&&method==='GET') {
        const q=u.searchParams.get('q');
        assert.match(q,/trashed = false/);
        const name=q.match(/name = '([^']+)'/)?.[1];
        const id=name?folders[name]:uploadedFiles['file'];
        if(name&&id)return ok({files:[{id,name,parents:folderParents[name],appProperties:{embasicApp:'EMBASIC'}}]});
        // A prior HTTP 503 might arrive AFTER the server committed the upload.
        // Simulate eventual visibility and recover by both metadata and bytes,
        // rather than doing a second potentially duplicate POST.
        if(name&&uploadedFiles.metadata?.name===name)return ok({files:[{id:uploadedFiles.file,
          name,parents:uploadedFiles.metadata.parents,mimeType:'text/markdown',
          appProperties:uploadedFiles.metadata.appProperties}]});
        return ok({files:[]});
      }
      if(u.pathname==='/drive/v3/files'&&method==='POST'){
        const body=JSON.parse(options.body);const id='f'+(++counter);folders[body.name]=id;folderParents[body.name]=body.parents||['root'];
        if(body.parents?.[0])assert.ok(Object.values(folders).includes(body.parents[0]));
        return ok({id});
      }
      if(u.pathname==='/upload/drive/v3/files'&&method==='POST') {
        const uncertainAck=failUpload;
        if(uncertainAck)failUpload=false;
        const payload=await options.body.text();
        assert.match(payload,/SONRAKİ TUR ÖZETİ:/);
        assert.match(payload,/application\/json/);
        assert.match(payload,/text\/markdown/);
        assert.equal(options.headers.Authorization,'Bearer mock-google-token');
        uploadedFiles.file='drive-file-123';
        uploadedFiles.metadata=JSON.parse(payload.split('\r\n\r\n')[1].split('\r\n--')[0]);
        uploadedFiles.content=payload.split('\r\n\r\n')[2].split('\r\n--')[0];
        if(uncertainAck)return fail(503); // COMMIT succeeded; ACK is unreliable
        return ok({id:uploadedFiles.file},201);
      }
      if(u.pathname.includes('/upload/drive/v3/files/')&&method==='PATCH')return ok({id:uploadedFiles.file});
      throw new Error('Unhandled Drive mock '+method+' '+u.pathname);
    }
    throw new Error('Unexpected host '+u.hostname);
  }
  return{fetch,events,folders,uploadedFiles};
}
const taskBase={project:'EMBASIC Proje',name:'Teknik rapor',instructions:'Güvenli teknik rapor hazırlığı',
  intervalHours:1,maxRuns:1,repo:'owner/repo',repoFile:'README.md',baseBranch:'main',enabled:true};
(async()=>{
  // Happy-path on official providers; idempotent after success.
  const api=mockApi();const h=harness({fetch:api.fetch,googleOauth:true});
  await h.route('saveGithubToken',{token:'github_pat_12345678901234567890',mode:'session'});
  await h.route('saveSettings',{driveEnabled:true,githubEnabled:true});
  await h.route('createTask',{payload:taskBase});
  let s=await h.route('snapshot');
  assert.match(s.runs[0].prompt,/Test README file/);
  await h.route('completeRun',{id:s.runs[0].id,output:'Onaylı çıktı. SONRAKİ TUR ÖZETİ: İş tamamlandı.'});
  s=await h.route('snapshot');
  assert.equal(s.runs[0].githubSync,'synced');
  assert.equal(s.runs[0].driveSync,'synced');
  const puts=api.events.filter(e=>e.method==='PUT'&&e.u.hostname==='api.github.com');
  assert.equal(puts.length,1);assert.match(puts[0].u.pathname,/\/agent-reports\//);
  assert.equal(api.events.some(e=>e.u.pathname.includes('/merges')),false);
  assert.equal(api.events.some(e=>e.u.pathname==='/repos/owner/repo/git/refs'&&e.method==='PATCH'),false);
  assert.equal(Object.keys(api.folders).length,2);
  assert.ok(Object.keys(api.folders).some(k=>k.includes('EMBASIC Proje [')));
  await h.route('schedulerNow');await h.route('syncNow');
  assert.equal(api.events.filter(e=>e.method==='PUT'&&e.u.hostname==='api.github.com').length,1,'idempotent sync');

  // Public repositories are blocked unless each task explicitly opted in.
  const pub=mockApi({isPublic:true});const p=harness({fetch:pub.fetch,googleOauth:true});
  await p.route('saveGithubToken',{token:'github_pat_12345678901234567890',mode:'session'});
  await p.route('saveSettings',{githubEnabled:true,driveEnabled:false});
  const id=await p.route('createTask',{payload:taskBase});
  let ps=await p.route('snapshot');
  await p.route('completeRun',{id:ps.runs[0].id,output:'Public repo gizlilik kontrolü başarıyla yapıldı.'});
  ps=await p.route('snapshot');assert.equal(ps.runs[0].githubSync,'blocked');
  assert.match(ps.runs[0].githubError,/açık aktarım onayı/);
  assert.equal(pub.events.filter(e=>e.method==='PUT').length,0);
  await p.route('updateTask',{id,payload:{...taskBase,allowPublicGitHub:true}});
  await p.route('syncNow',{id:ps.runs[0].id});
  ps=await p.route('snapshot');assert.equal(ps.runs[0].githubSync,'blocked',
    'changing task consent after completion must not authorize publication retroactively');
  await p.route('approvePublicRun',{id:ps.runs[0].id});
  await p.route('syncNow',{id:ps.runs[0].id});
  ps=await p.route('snapshot');assert.equal(ps.runs[0].githubSync,'synced');

  // Temporary 503 may conceal a committed upload: retry must reconcile, not POST twice.
  const transient=mockApi({failFirstDrive:true});const t=harness({fetch:transient.fetch,googleOauth:true});
  await t.route('saveSettings',{driveEnabled:true,githubEnabled:false});
  await t.route('createTask',{payload:{...taskBase,repo:''}});
  let ts=await t.route('snapshot');
  await t.route('completeRun',{id:ts.runs[0].id,output:'Yanıt. SONRAKİ TUR ÖZETİ: Yeniden deneme kontrolü.'});
  ts=await t.route('snapshot');assert.equal(ts.runs[0].driveSync,'retry');
  assert.ok(ts.runs[0].driveRetryAfter>Date.now());
  await t.route('syncNow',{id:ts.runs[0].id});
  ts=await t.route('snapshot');assert.equal(ts.runs[0].driveSync,'synced');
  console.log('PASS sync: mocked official API, scoped branch, Drive folder, no merge, public consent, 503 retry and idempotence');
})().catch(e=>{console.error(e);process.exitCode=1});
