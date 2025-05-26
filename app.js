class BurnerApp {
    constructor() {
        this.currentNote = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupServiceWorker();
        
        // Wait for DOM ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        // Small delay to ensure hash is parsed
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // If there's a hash, go straight to view flow
        if (window.location.hash.length > 1) {
            this.processHash();
        }
        
        // Also re-check on visibility/focus for mobile quirks
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) setTimeout(() => this.processHash(), 50);
        });
        window.addEventListener('focus', () => {
            setTimeout(() => this.processHash(), 50);
        });
    }

    setupEventListeners() {
        document.getElementById('createNote').addEventListener('click', () => this.generateNote());
        document.getElementById('unlockButton').addEventListener('click', () => this.handlePasswordSubmit());
        document.getElementById('newNote').addEventListener('click', () => location.reload());
        
        window.addEventListener('hashchange', () => {
            setTimeout(() => this.processHash(), 10);
        });
        
        window.addEventListener('load', () => {
            setTimeout(() => this.processHash(), 50);
        });
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
                expires: Date.now() + (document.getElementById('expiry').value * 1000)
            };
            
            const noteString = btoa(encodeURIComponent(JSON.stringify(noteData)));
            this.showShareView(noteString, noteData.expires);
        } catch (error) {
            alert('Error creating note: ' + error.message);
        }
    }

    async encryptContent(text, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            new TextEncoder().encode(DOMPurify.sanitize(text))
        );

        return {
            cipher: Array.from(new Uint8Array(encrypted)),
            iv:     Array.from(iv),
            salt:   Array.from(salt)
        };
    }

    showShareView(noteString, expiryTime) {
        const shareUrl = `${location.origin}/#${noteString}`;
        document.getElementById('createView').classList.add('hidden');
        document.getElementById('shareView').classList.remove('hidden');
        
        const qrEl = document.getElementById('qrcode');
        qrEl.innerHTML = '';
        new QRCode(qrEl, {
            text:         shareUrl,
            width:        256,
            height:       256,
            colorDark:    "#000000",
            colorLight:   "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        this.startCountdown(expiryTime, 'countdown');
    }

    startCountdown(endTime, elementId) {
        const updateTimer = () => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                document.getElementById(elementId).textContent = "EXPIRED";
                return;
            }

            const hours   = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);

            document.getElementById(elementId).textContent =
                `${hours.toString().padStart(2, '0')}:` +
                `${minutes.toString().padStart(2, '0')}:` +
                `${seconds.toString().padStart(2, '0')}`;

            requestAnimationFrame(updateTimer);
        };
        updateTimer();
    }

    processHash() {
        const hash       = window.location.hash.substring(1);
        const noteString = hash;
        
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
