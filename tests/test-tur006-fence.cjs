'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const success=data=>({ok:true,status:200,headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
const missing=()=>({ok:false,status:404,headers:{get:()=>null},json:async()=>({})});
const task=(repo='')=>({project:'Fenced Synthetic',name:'Lease fencing',instructions:'Synthetic work only.',
    repo,intervalHours:1,maxRuns:1,enabled:true});
(async()=>{
  // Simulate an MV3 worker that gets suspended after remote reads; the lease
  // expires before the Google Drive write. No server mutation is permitted.
  let driveWrites=0, h;
  const driveFetch=async(url,options={})=>{
    const u=new URL(url),method=options.method||'GET';
    assert.equal(u.hostname,'www.googleapis.com');
    if(u.pathname==='/drive/v3/files'&&method==='GET'){
      const q=u.searchParams.get('q')||'';
      if(q.includes('application/vnd.google-apps.folder')){
        const name=q.match(/name = '([^']+)'/)?.[1];
        const project=q.includes('Fenced Synthetic');
        return success({files:[{id:project?'project-id':'root-id',name,parents:project?['root-id']:['root'],appProperties:{embasicApp:'EMBASIC'}}]});
      }
      // End of preflight. Simulate clock jump / worker suspension.
      h.buckets.local.embasicStateV2.runs[0].syncLease.drive.until=Date.now()-5;
      return success({files:[]});
    }
    if(method==='POST'){driveWrites++;return success({id:'unexpected'});}
    throw Error('unexpected '+url);
  };
  h=harness({fetch:driveFetch,googleOauth:true});
  await h.route('createTask',{payload:task()});
  const run=(await h.route('snapshot')).runs[0];
  await h.route('completeRun',{id:run.id,output:'Test content. SONRAKİ TUR ÖZETİ: no remote write.'});
  const local=h.buckets.local.embasicStateV2;
  local.settings.driveEnabled=true;local.runs[0].driveSync='pending';
  await h.route('syncNow',{id:run.id});
  const saved=(await h.route('snapshot')).runs[0];
  assert.equal(driveWrites,0,'stale lease permitted a Drive POST');
  assert.equal(saved.driveSync,'retry');
  assert.match(saved.driveError,/lease süresi doldu/);

  // Independently test the GitHub PUT path: a stale lease must not mutate a
  // prepared branch even when the remote file was absent on preflight.
  let githubWrites=0,gh;
  const githubFetch=async(url,options={})=>{
    const u=new URL(url),method=options.method||'GET';
    assert.equal(u.hostname,'api.github.com');
    if(u.pathname==='/repos/synthetic/repo')return success({private:true,default_branch:'main'});
    if(u.pathname.endsWith('/contents/README.md'))return success({type:'file',content:btoa('Synthetic README')});
    if(u.pathname.includes('/git/ref/heads/embasic-agent/'))return success({object:{sha:'abc123'}});
    if(u.pathname.includes('/agent-reports/')&&method==='GET'){
      gh.buckets.local.embasicStateV2.runs[0].syncLease.github.until=Date.now()-10;
      return missing();
    }
    if(method==='PUT'||method==='POST'){githubWrites++;return success({sha:'unexpected'});}
    throw Error('unexpected '+method+' '+u.pathname);
  };
  gh=harness({fetch:githubFetch});
  await gh.route('saveGithubToken',{token:'github_pat_12345678901234567890',mode:'session'});
  await gh.route('createTask',{payload:task('synthetic/repo')});
  const grun=(await gh.route('snapshot')).runs[0];
  await gh.route('completeRun',{id:grun.id,output:'Synthetic evidence. SONRAKİ TUR ÖZETİ: safe.'});
  gh.buckets.local.embasicStateV2.settings.githubEnabled=true;
  gh.buckets.local.embasicStateV2.runs[0].githubSync='pending';
  await gh.route('syncNow',{id:grun.id});
  const result=(await gh.route('snapshot')).runs[0];
  assert.equal(githubWrites,0,'stale lease permitted GitHub PUT');
  assert.equal(result.githubSync,'retry');
  assert.match(result.githubError,/lease süresi doldu/);
  assert.equal((await gh.route('diagnostics')).staleLeases,null,'unsealed baseline diagnostics hide counts');
  console.log('PASS TUR006 fence: stale lease after remote preflight blocks both Google Drive POST and GitHub PUT');
})().catch(e=>{console.error(e);process.exitCode=1});
