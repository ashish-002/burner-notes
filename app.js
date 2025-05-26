// Wrap everything to avoid globals
(() => {
  // 1. Open (or create) the IndexedDB database (still used only for purgeExpired; you can leave it or remove if unused)
  const dbReq = indexedDB.open('BurnerNotesDB', 1);
  dbReq.onupgradeneeded = e => {
    e.target.result.createObjectStore('notes', { keyPath: 'id' });
  };
  dbReq.onerror = e => console.error('IndexedDB error:', e);

  // 2. Once the DB is open, purge expired (optional) and init page logic
  dbReq.onsuccess = () => {
    const db = dbReq.result;

    // Purge any expired notes immediately
    purgeExpired(db);

    // Decide which flow to run
    if (location.pathname.endsWith('note.html')) {
      initViewNoteFlow();
    } else {
      initCreateNoteFlow();
    }
  };

  // 3. Create-Note flow (home page) — now uses serverless storeNote function
  function initCreateNoteFlow() {
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
      const text      = document.getElementById('note-input').value;
      const textBytes = new TextEncoder().encode(text);
      const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, cryptoKey, textBytes
      );

      // Combine IV + ciphertext into one Base64 string
      const combined = btoa(String.fromCharCode(...iv, ...new Uint8Array(cipherBuf)));

      // Read TTL
      const expiryMs = parseInt(document.getElementById('expiry-select').value, 10);

      // ——— Serverless upload ———
      const resp = await fetch('/.netlify/functions/storeNote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: combined, created: Date.now(), expiry: expiryMs })
      });
      const { shortId } = await resp.json();

      // Build the share URL: shortId in query + key in fragment
      const keyB64   = btoa(String.fromCharCode(...keyArr));
      const shareUrl = `${location.origin}/note.html?id=${shortId}&key=${keyB64}`;
      console.log('QR encoding this URL:', shareUrl);

      // Generate the QR code
      const qrDiv = document.getElementById('qr-code');
      qrDiv.innerHTML = ''; // clear previous
      new QRCode(qrDiv, {
        text: shareUrl,
        width: 200,
        height: 200,
        version: 40,
        correctLevel: QRCode.CorrectLevel.L
      });
    });
  }

  // 4. View-Note flow (note.html) — now uses serverless getNote function
  async function initViewNoteFlow() {
    // 4.1 Parse shortId from query
    const params  = new URLSearchParams(location.search);
    const shortId = params.get('id');
    const keyB64  = params.get('key');
    if (!shortId) {
      return document.getElementById('output').textContent = 'Missing note ID';
    }
      if (!keyB64) {
    document.getElementById('output').textContent = 'Missing decryption key';
    return;
    }

    // Convert base64 key to Uint8Array
    const keyRaw = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));

    // 4.2 Fetch encrypted payload & metadata from serverless function
  let record;
  try {
    const resp = await fetch(`/.netlify/functions/getNote?shortId=${encodeURIComponent(shortId)}`);
    if (!resp.ok) {
      document.getElementById('output').textContent = resp.status === 410
        ? 'Note expired'
        : 'Failed to retrieve note';
      return;
    }
    record = await resp.json();
  } catch (err) {
    document.getElementById('output').textContent = 'Network error';
    return;
  }

  const { data: combined, created, expiry } = record;

  // 4.3 Expiry check
  if (Date.now() - created > expiry) {
    document.getElementById('output').textContent = 'Note expired';
    return;
  }

  // 4.4 AES-GCM decryption
  const rawBytes = atob(combined);
  const iv       = Uint8Array.from(rawBytes.slice(0,12), c => c.charCodeAt(0));
  const ctBytes  = Uint8Array.from(rawBytes.slice(12),  c => c.charCodeAt(0));
  const cryptoKey= await crypto.subtle.importKey(
    'raw', keyRaw, 'AES-GCM', false, ['decrypt']
  );
  let plainText;
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name:'AES-GCM', iv }, cryptoKey, ctBytes
    );
    plainText = new TextDecoder().decode(plainBuf);
  } catch {
    document.getElementById('output').textContent = 'Decryption failed';
    return;
  }

  // 4.5 Display plaintext
  document.getElementById('output').textContent = plainText;

  // 4.6 Start countdown timer
  const endTime = created + expiry;
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

  // 4.7 Wire up PDF export
  document.getElementById('export-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(plainText, 10, 10);
    doc.save('burner-note.pdf');
  });
}

  // 5. Purge expired records helper (optional; indexedDB no longer used for storage)
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