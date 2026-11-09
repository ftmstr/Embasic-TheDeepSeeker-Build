'use strict';
/* Standalone, audited-size encrypted JSON backup wrapper. Never stores passwords. */
(function(){
  const te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
  function base64(bytes){
    let result='';for(let i=0;i<bytes.length;i+=16384)result+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return btoa(result);
  }
  function fromBase64(value){
    if(typeof value!=='string'||value.length>50_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
      throw new Error('Yedek kodlaması geçersiz.');
    return Uint8Array.from(atob(value),x=>x.charCodeAt(0));
  }
  async function key(password,salt,iterations=310000){
    if(typeof password!=='string'||password.length<12)throw new Error('Yedek parolası en az 12 karakter olmalı.');
    const input=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},input,
      {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(data,password){
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(password,salt),te.encode(JSON.stringify(data)));
    return {kind:'embasic-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',cipher:'AES-256-GCM',iterations:310000,
      salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(cipher))};
  }
  async function decrypt(blob,password){
    if(!blob||blob.kind!=='embasic-encrypted-backup'||blob.version!==1||blob.kdf!=='PBKDF2-SHA256'||
        blob.cipher!=='AES-256-GCM'||blob.iterations!==310000)throw new Error('Desteklenmeyen şifreli yedek biçimi.');
    const salt=fromBase64(blob.salt),iv=fromBase64(blob.iv),cipher=fromBase64(blob.data);
    if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>32_000_000)
      throw new Error('Yedek alanları veya boyutları geçersiz.');
    try {
      const result=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt),cipher);
      return JSON.parse(td.decode(result));
    }catch {throw new Error('Yedek parolası yanlış veya yedek dosyası bozuk.');}
  }
  globalThis.embasicBackupCrypto=Object.freeze({encrypt,decrypt});
})();
