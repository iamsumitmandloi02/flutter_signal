const DB='flutter-signal';

function open(){return new Promise((res,rej)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('attempts',{keyPath:'id'});db.createObjectStore('audio');};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}

async function tx(store, mode='readonly'){const d=await open(); return d.transaction(store,mode).objectStore(store);}

export const db = {
  async saveAttempt(a){(await tx('attempts','readwrite')).put(a);},
  async getAttempts(){return new Promise(async r=>{const req=(await tx('attempts')).getAll(); req.onsuccess=()=>r(req.result||[]); req.onerror=()=>r([]);});},
  async putAudio(key, blob){(await tx('audio','readwrite')).put(blob,key);},
  async hasAudio(key){return new Promise(async r=>{const req=(await tx('audio')).get(key);req.onsuccess=()=>r(!!req.result);req.onerror=()=>r(false);});}
};
