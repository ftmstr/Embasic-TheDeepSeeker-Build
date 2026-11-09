'use strict';
const open = url => chrome.tabs.create({url});
document.getElementById('dashboard').addEventListener('click',()=>open(chrome.runtime.getURL('dashboard.html')));
document.getElementById('deepseek').addEventListener('click',()=>open('https://chat.deepseek.com/'));
chrome.runtime.sendMessage({type:'vaultStatus'},status=>{
  if(status?.ok&&status.data.sealed&&!status.data.unlocked){
    document.getElementById('active').textContent='🔒';
    document.getElementById('waiting').textContent='🔒';
    return;
  }
  chrome.runtime.sendMessage({type:'snapshot'},response=>{
  if(chrome.runtime.lastError || !response?.ok)return;
  const state=response.data;
  document.getElementById('active').textContent=state.tasks.filter(x=>x.enabled).length;
  document.getElementById('waiting').textContent=state.runs.filter(x=>x.status==='waiting').length;
  });
});
