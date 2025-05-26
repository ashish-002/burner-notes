self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('periodicsync',e=> {
  if(e.tag==='purge-notes') e.waitUntil((async()=>{
    const db = await new Promise(r=> {
      const req=indexedDB.open('BurnerNotesDB',1);
      req.onsuccess=e=>r(e.target.result);
    });
    const tx = db.transaction('notes','readwrite'), store=tx.objectStore('notes'), now=Date.now();
    store.openCursor().onsuccess=e=> {
      const c=e.target.result;
      if(c && now-c.value.created>c.value.expiry) c.delete();
      c&&c.continue();
    };
  })());
});