'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.join(__dirname,'..','extension');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
function harness({fetch=async()=>{throw new Error('offline mock');},googleConnected=true,googleOauth=false,sharedBuckets=null,sharedLocks=null}={}) {
  // Existing regression fixtures emulate a pre-TUR004 installation; fresh-install tests clear this flag.
  const buckets=sharedBuckets||{local:{embasicRequireVaultV4:false},session:{}};const calls=[];const listeners={};const alarms=new Map();
  function area(kind) {return {
    async get(keys){
      const store=buckets[kind];
      if(typeof keys==='string')return {[keys]:store[keys]};
      if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));
      if(!keys)return {...store};
      return Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,store[k]===undefined?v:store[k]]));
    },
    async set(data){Object.assign(buckets[kind],data);},
    async setAccessLevel(){return true;},
    async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete buckets[kind][key];}
  };}
  const chrome={
    storage:{local:area('local'),session:area('session')},
    alarms:{async get(name){return alarms.get(name);},async create(name,settings){alarms.set(name,{name,...settings});},onAlarm:{addListener(f){listeners.alarm=f;}}},
    action:{async setBadgeText(){},async setBadgeBackgroundColor(){}},
    notifications:{async create(){return 'notification';}},
    identity:{async getAuthToken(){if(!googleConnected)throw new Error('not authenticated');return{token:'mock-google-token'};},
      async removeCachedAuthToken(){},async clearAllCachedAuthTokens(){}},
    runtime:{onInstalled:{addListener(f){listeners.installed=f;}},onStartup:{addListener(f){listeners.startup=f;}},
      onMessage:{addListener(f){listeners.message=f;}},getManifest(){return googleOauth?{...manifest,oauth2:{...manifest.oauth2,client_id:'mock-client.apps.googleusercontent.com'}}:manifest;}}
  };
  const scope=vm.createContext({chrome,...(sharedLocks?{navigator:{locks:sharedLocks}}:{}),crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Blob,URL,AbortController,
    atob,btoa,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url:String(url),options});return fetch(String(url),options);},console});
  vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),scope,{filename:'background.js'});
  async function route(type,args={}){scope.__message={type,...args};return vm.runInContext('route(__message)',scope);}
  return{route,scope,buckets,calls,manifest,listeners,alarms};
}
module.exports={harness,manifest};
