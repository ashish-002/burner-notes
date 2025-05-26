class BurnerApp {
    constructor() {
        this.currentNote = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupServiceWorker();
        this.checkForSharedNote();
    }

    setupEventListeners() {
        document.getElementById('createNote').addEventListener('click', () => this.generateNote());
        document.getElementById('unlockButton').addEventListener('click', () => this.handlePasswordSubmit());
        document.getElementById('newNote').addEventListener('click', () => location.reload());
    }

    async generateNote() {
        const content = document.getElementById('noteContent').value;
        const password = document.getElementById('notePassword').value;
        
        if (!content || !password) {
            alert('Please enter both content and password!');
            return;
        }

        try {
            const encrypted = await this.encryptContent(content, password);
            const noteData = {
                data: encrypted,
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
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
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
            iv: Array.from(iv),
            salt: Array.from(salt)
        };
    }

    showShareView(noteString, expiryTime) {
        const shareUrl = `${location.origin}${location.pathname}#${noteString}`;
        document.getElementById('createView').classList.add('hidden');
        document.getElementById('shareView').classList.remove('hidden');
        
        // Clear previous QR code
        document.getElementById('qrcode').innerHTML = '';
        new QRCode(document.getElementById('qrcode'), {
            text: shareUrl,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
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

            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);

            document.getElementById(elementId).textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            requestAnimationFrame(updateTimer);
        };
        updateTimer();
    }

    checkForSharedNote() {
        const noteString = window.location.hash.substring(1);
        if (!noteString) return;

        try {
            this.currentNote = JSON.parse(decodeURIComponent(atob(noteString)));
            if (this.currentNote.expires < Date.now()) {
                alert('Note expired');
                history.replaceState({}, '', location.pathname);
                return;
            }
            document.getElementById('passwordModal').classList.remove('hidden');
        } catch (error) {
            alert('Invalid or corrupted note');
            history.replaceState({}, '', location.pathname);
        }
    }
    
    async handlePasswordSubmit() {
        const password = document.getElementById('passwordInput').value;
        try {
            const decrypted = await this.decryptContent(this.currentNote.data, password);
            this.showDecryptedNote(decrypted);
            history.replaceState({}, '', location.pathname);
        } catch (error) {
            alert('Wrong password or corrupted note!');
        }
    }

    async decryptContent(encryptedData, password) {
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            { 
                name: "PBKDF2",
                salt: new Uint8Array(encryptedData.salt),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
            key,
            new Uint8Array(encryptedData.cipher)
        );

        return new TextDecoder().decode(decrypted);
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
            navigator.serviceWorker.register('/sw.js')
                .then(() => console.log('SW registered'))
                .catch(err => console.error('SW error:', err));
        }
    }
}

// Initialize app
const app = new BurnerApp();
