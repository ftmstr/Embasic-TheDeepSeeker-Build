'use strict';
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const reply=(status,data={})=>({ok:status>=200&&status<300,status,
  headers:{get:()=>null},json:async()=>data,text:async()=>JSON.stringify(data)});
(async()=>{
  let seenOld=0,seenFresh=0,folderPosts=0;
  async function api(url,opt={}){
    const u=new URL(url);assert.equal(u.hostname,'www.googleapis.com');
    if(opt.headers.Authorization==='Bearer expired-token'){
      seenOld++;return reply(401);
    }
    assert.equal(opt.headers.Authorization,'Bearer fresh-token');seenFresh++;
    if(u.pathname==='/drive/v3/files'&&(!opt.method||opt.method==='GET'))return reply(200,{files:[]});
    if(u.pathname==='/drive/v3/files'&&opt.method==='POST'){
      folderPosts++;return reply(200,{id:'folder01'});
    }
    throw Error('unexpected Google endpoint');
  }
  const h=harness({fetch:api,googleOauth:true});
  let authCalls=0,cacheEvictions=0,interactiveCalls=0;
  h.scope.chrome.identity.getAuthToken=async details=>{
    authCalls++;if(details.interactive)interactiveCalls++;
    return {token:authCalls<=2?'expired-token':'fresh-token'};
  };
  h.scope.chrome.identity.removeCachedAuthToken=async ({token})=>{
    assert.equal(token,'expired-token');cacheEvictions++;
  };
  const ok=await h.route('googleConnect');
  assert.equal(ok.folderId,'folder01');
  assert.equal(authCalls,4,'one UI grant, one stale request, one 401 refresh, one later cached-token acquisition');
  assert.equal(interactiveCalls,1,'UI-authorized initial consent only');
  assert.equal(cacheEvictions,1);assert.equal(seenOld,1);
  assert.equal(seenFresh,2);assert.equal(folderPosts,1);
  assert.ok(!JSON.stringify(h.buckets.local).includes('expired-token'));
  assert.ok(!JSON.stringify(h.buckets.local).includes('fresh-token'));
  const missing=harness({googleOauth:false});
  await assert.rejects(missing.route('googleConnect'),/OAuth Client ID/);
  // A non-authz transient error is NOT an OAuth refresh trigger.
  let invalidations=0;
  const denied=harness({googleOauth:true,fetch:async()=>reply(403)});
  denied.scope.chrome.identity.removeCachedAuthToken=async()=>invalidations++;
  await assert.rejects(denied.route('googleConnect'),/HTTP 403/);
  assert.equal(invalidations,0);
  console.log('PASS TUR005 OAuth: 401 token-cache eviction/reacquire, no 403 refresh, credential isolation, unconfigured client denial');
})().catch(e=>{console.error(e);process.exitCode=1});
