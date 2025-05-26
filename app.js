// app.js
class BurnerApp {
  constructor() {
    this.currentNote = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupServiceWorker();
    if (document.readyState === 'loading') {
      await new Promise(r => document.addEventListener('DOMContentLoaded', r));
    }
    await new Promise(r => setTimeout(r, 50));
    if (window.location.hash.length > 1) {
      this.processHash();
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(() => this.processHash(), 50);
    });
    window.addEventListener('focus', () => setTimeout(() => this.processHash(), 50));
  }

  setupEventListeners() {
    document.getElementById('createNote').addEventListener('click', () => this.generateNote());
    document.getElementById('unlockButton').addEventListener('click', () => this.handlePasswordSubmit());
    document.querySelectorAll('#newNote').forEach(btn =>
      btn.addEventListener('click', () => location.reload())
    );
    window.addEventListener('hashchange', () => setTimeout(() => this.processHash(), 10));
    window.addEventListener('load', () => setTimeout(() => this.processHash(), 50));
  }

  async generateNote() {
    const content  = document.getElementById('noteContent').value;
    const password = document.getElementById('notePassword').value;
    if (!content || !password) {
      alert('Please enter both content and password!');
      return;
    }
    try {
      const encrypted = await this.encryptContent(content, password);
      const noteData  = {
        data:    encrypted,
        expires: Date.now() + (parseInt(document.getElementById('expiry').value, 10) * 1000)
      };
      const noteString = btoa(encodeURIComponent(JSON.stringify(noteData)));
      this.showShareView(noteString, noteData.expires);
    } catch (e) {
      alert('Error creating note: ' + e.message);
    }
  }

  async encryptContent(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const keyMat = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMat,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const buf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(DOMPurify.sanitize(text))
    );
    return {
      cipher: Array.from(new Uint8Array(buf)),
      iv:     Array.from(iv),
      salt:   Array.from(salt)
    };
  }

  showShareView(noteString, expiryTime) {
    const shareUrl = `${location.origin}/#${noteString}`;
    document.getElementById('createView').classList.add('hidden');
    document.getElementById('shareView').classList.remove('hidden');
    const linkEl = document.getElementById('shareLink');
    linkEl.value = shareUrl;
    document.getElementById('copyLink').onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied!');
      } catch {
        alert('Failed to copy link');
      }
    };
    this.startCountdown(expiryTime, 'countdown');
  }

  startCountdown(endTime, elementId) {
    const tick = () => {
      const rem = endTime - Date.now();
      if (rem <= 0) {
        document.getElementById(elementId).textContent = "EXPIRED";
        return;
      }
      const h = Math.floor(rem/3600000), 
            m = Math.floor((rem%3600000)/60000), 
            s = Math.floor((rem%60000)/1000);
      document.getElementById(elementId).textContent =
        `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  processHash() {
    const noteString = window.location.hash.substring(1);
    if (this.currentNote && this.currentNote.processed) return;
    if (!noteString || noteString.length < 10) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(noteString)));
      if (!decoded.data || !decoded.expires) return;
      if (decoded.expires < Date.now()) {
        alert('Note expired');
        history.replaceState({}, '', location.pathname);
        return;
      }
      this.currentNote = { ...decoded, processed: true };
      document.getElementById('passwordModal').classList.remove('hidden');
    } catch {
      if (noteString.length > 50) {
        alert('Invalid or corrupted note');
        history.replaceState({}, '', location.pathname);
      }
    }
  }

  async handlePasswordSubmit() {
    const pwd = document.getElementById('passwordInput').value;
    if (!pwd) return alert('Please enter a password');
    if (!this.currentNote) return alert('No note data available');
    try {
      const plain = await this.decryptContent(this.currentNote.data, pwd);
      this.showDecryptedNote(plain);
      history.replaceState({}, '', location.pathname);
    } catch {
      alert('Wrong password or corrupted note!');
    }
  }

  async decryptContent(encryptedData, password) {
    const keyMat = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt:new Uint8Array(encryptedData.salt), iterations:100000, hash:"SHA-256" },
      keyMat,
      { name:"AES-GCM", length:256 },
      false,
      ["decrypt"]
    );
    const buf = await crypto.subtle.decrypt(
      { name:"AES-GCM", iv:new Uint8Array(encryptedData.iv) },
      key,
      new Uint8Array(encryptedData.cipher)
    );
    return new TextDecoder().decode(buf);
  }

  showDecryptedNote(content) {
    document.getElementById('passwordModal').classList.add('hidden');
    document.getElementById('createView').classList.add('hidden');
    document.getElementById('noteView').classList.remove('hidden');
    document.getElementById('noteDisplay').textContent = content;
    this.startCountdown(this.currentNote.expires, 'viewCountdown');
  }

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW error:', err));
    }
  }
}

// Initialize app
const app = new BurnerApp();
