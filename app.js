// app.js — Revised snippet to detect and handle note.html context

// Open IndexedDB
const dbReq = indexedDB.open('BurnerNotesDB', 1);
dbReq.onsuccess = () => {
  const db = dbReq.result;

  // 1) Purge expired notes now that `db` is ready:
  purgeExpired(db);

  // 2) Safe to bind your click handler:
  document.getElementById('create-btn').onclick = async () => {
    const tx = db.transaction('notes', 'readwrite');
    // … rest of your logic …
  };
};

function purgeExpired(db) {
  const tx = db.transaction('notes', 'readwrite');
  const store = tx.objectStore('notes');
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const note = cursor.value;
      if (Date.now() - note.created > note.expiry) {
        store.delete(cursor.primaryKey);
      }
      cursor.continue();
    }
  };
}
window.addEventListener('load', purgeExpired);

// Note retrieval & decryption (note.html context)
if (location.pathname.endsWith('note.html')) {
  const params = new URLSearchParams(location.hash.substring(1));
  const noteId    = params.get('id');
  const encrypted = decodeURIComponent(params.get('data'));
  const keyRaw    = Uint8Array.from(atob(params.get('key')), c => c.charCodeAt(0));

  dbReq.onsuccess = () => {
    const db = dbReq.result;
    document.getElementById('create-btn').onclick = async () => {
      // now db is defined
      const tx = db.transaction('notes','readwrite');
      // …
    };
  };


    // Handle missing or expired note
    if (!record || Date.now() - record.created > record.expiry) {
      document.getElementById('output').textContent = 'Note expired';
      if (record) store.delete(noteId);
      return;
    }

    // Decrypt
    const dataBytes = atob(encrypted);
    const iv         = Uint8Array.from(dataBytes.slice(0, 12), c => c.charCodeAt(0));
    const ctBytes    = Uint8Array.from(dataBytes.slice(12), c => c.charCodeAt(0));
    const cryptoKey  = await crypto.subtle.importKey(
      'raw',
      keyRaw,
      'AES-GCM',
      false,
      ['decrypt']
    );
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ctBytes
    );
    const plainText = new TextDecoder().decode(plainBuffer);

    // Display and remove from storage
    document.getElementById('output').textContent = plainText;
    store.delete(noteId);

    // Countdown timer
    const endTime = record.created + record.expiry;
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        document.getElementById('output').textContent = 'Note expired';
        return;
      }
      timerEl.textContent = `Expires in ${Math.ceil(remaining / 1000)}s`;
    }, 500);

    // PDF export
    document.getElementById('export-pdf').onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text(plainText, 10, 10);
      doc.save('burner-note.pdf');
    };
  };
}