// Wrap everything to avoid globals
(() => {
  // 1. Open (or create) the IndexedDB database
  const dbReq = indexedDB.open('BurnerNotesDB', 1);
  dbReq.onupgradeneeded = e => {
    e.target.result.createObjectStore('notes', { keyPath: 'id' });
  };
  dbReq.onerror = e => console.error('IndexedDB error:', e);

  // 2. Once the DB is open, purge expired and init page logic
  dbReq.onsuccess = () => {
    const db = dbReq.result;

    // Purge any expired notes immediately
    purgeExpired(db);

    // Decide which flow to run
    if (location.pathname.endsWith('note.html')) {
      initViewNoteFlow(db);
    } else {
      initCreateNoteFlow(db);
    }
  };

  // 3. Create-Note flow (home page)
  function initCreateNoteFlow(db) {
    const btn = document.getElementById('create-btn');
    if (!btn) {
      console.warn('Create button not found – are you on the right page?');
      return;
    }
    btn.addEventListener('click', async () => {
      // Generate random ID (16 bytes) and key (32 bytes)
      const idArr  = crypto.getRandomValues(new Uint8Array(16));
      const keyArr = crypto.getRandomValues(new Uint8Array(32));
      const iv     = crypto.getRandomValues(new Uint8Array(12));

      // Import the key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyArr, 'AES-GCM', false, ['encrypt']
      );

      // Encrypt the note text
      const text       = document.getElementById('note-input').value;
      const textBytes  = new TextEncoder().encode(text);
      const cipherBuf  = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, cryptoKey, textBytes
      );

      // Combine IV + ciphertext into one Base64 string
      const combined   = btoa(String.fromCharCode(...iv, ...new Uint8Array(cipherBuf)));

      // Store in IndexedDB with TTL from the select
      const expiryMs = parseInt(document.getElementById('expiry-select').value, 10);
      const storeTx  = db.transaction('notes','readwrite').objectStore('notes');
      storeTx.put({
        id: btoa(String.fromCharCode(...idArr)),
        data: combined,
        created: Date.now(),
        expiry: expiryMs
      });

      // Build the share URL with fragment (id, data, key)
      const frag = new URLSearchParams({
        id:    btoa(String.fromCharCode(...idArr)),
        data: combined, 
        key:   btoa(String.fromCharCode(...keyArr))
      }).toString();
      const shareUrl = `${location.origin}/note.html#${frag}`;
      console.log('QR encoding this URL:', shareUrl);

      // Generate the QR code
      const qrDiv = document.getElementById('qr-code');
      qrDiv.innerHTML = ''; // clear previous
      new QRCode(qrDiv, { text: shareUrl, width: 200, height: 200 });
    });
  }

  // 4. View-Note flow (note.html)
  function initViewNoteFlow(db) {
    // Parse fragment params
    const params    = new URLSearchParams(location.hash.slice(1));
    const noteId    = params.get('id');
    const encrypted = decodeURIComponent(params.get('data'));
    const keyRaw    = Uint8Array.from(atob(params.get('key')), c => c.charCodeAt(0));

    // Fetch record from IndexedDB
    const tx    = db.transaction('notes','readwrite');
    const store = tx.objectStore('notes');
    store.get(noteId).onsuccess = async e => {
      const record = e.target.result;

      // 4.1 Expiry check
      if (!record || Date.now() - record.created > record.expiry) {
        document.getElementById('output').textContent = 'Note expired';
        if (record) store.delete(noteId);
        return;
      }

      // 4.2 AES-GCM decryption
      const rawBytes  = atob(encrypted);
      const iv        = Uint8Array.from(rawBytes.slice(0,12), c => c.charCodeAt(0));
      const ctBytes   = Uint8Array.from(rawBytes.slice(12),  c => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyRaw, 'AES-GCM', false, ['decrypt']
      );
      const plainBuf  = await crypto.subtle.decrypt(
        { name:'AES-GCM', iv }, cryptoKey, ctBytes
      );
      const plainText = new TextDecoder().decode(plainBuf);

      // 4.3 Display & clean up
      document.getElementById('output').textContent = plainText;
      store.delete(noteId);

      // 4.4 Start countdown timer
      const endTime = record.created + record.expiry;
      const timerEl = document.getElementById('timer');
      const interval = setInterval(() => {
        const remain = endTime - Date.now();
        if (remain <= 0) {
          clearInterval(interval);
          document.getElementById('output').textContent = 'Note expired';
          return;
        }
        timerEl.textContent = `Expires in ${Math.ceil(remain/1000)}s`;
      }, 500);

      // 4.5 Wire up PDF export
      document.getElementById('export-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(plainText, 10, 10);
        doc.save('burner-note.pdf');
      });
    };
  }

  // 5. Purge expired records helper
  function purgeExpired(db) {
    const tx = db.transaction('notes','readwrite');
    const store = tx.objectStore('notes');
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) return;
      const note = cursor.value;
      if (Date.now() - note.created > note.expiry) {
        cursor.delete();
      }
      cursor.continue();
    };
  }
})();