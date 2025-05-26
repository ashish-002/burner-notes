class BurnerApp {
    constructor() {
        this.currentNote = null;
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        this.setupEventListeners();
        this.setupServiceWorker();
        
        // Check for shared note with multiple strategies
        this.checkForSharedNote();
        
        // Also check when page becomes visible (for mobile browsers)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.checkForSharedNote(), 50);
            }
        });
        
        // Check when window gains focus (for mobile browsers)
        window.addEventListener('focus', () => {
            setTimeout(() => this.checkForSharedNote(), 50);
        });
    }

    setupEventListeners() {
        document.getElementById('createNote').addEventListener('click', () => this.generateNote());
        document.getElementById('unlockButton').addEventListener('click', () => this.handlePasswordSubmit());
        document.getElementById('newNote').addEventListener('click', () => location.reload());
        
        // Add hash change listener
        window.addEventListener('hashchange', () => this.checkForSharedNote());
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
        // Check immediately
        this.processHash();
        
        // Also check after delays in case hash loads later
        setTimeout(() => this.processHash(), 100);
        setTimeout(() => this.processHash(), 500);
        setTimeout(() => this.processHash(), 1000);
        
        // Check if there's a note in the current URL (sometimes hash gets lost)
        this.checkURLParams();
    }

    checkURLParams() {
        // Check if the entire URL after domain contains encoded data
        const fullPath = window.location.href;
        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        
        // Look for patterns that might be encoded note data
        const possibleNote = fullPath.replace(baseUrl, '').replace(/^[#?]/, '');
        
        if (possibleNote && possibleNote.length > 50) {
            console.log('Found possible note data in URL:', possibleNote);
            try {
                // Try to parse it as a note
                const noteData = JSON.parse(decodeURIComponent(atob(possibleNote)));
                if (noteData.data && noteData.expires) {
                    console.log('Successfully parsed note from URL params');
                    this.currentNote = noteData;
                    if (this.currentNote.expires < Date.now()) {
                        alert('Note expired');
                        history.replaceState({}, '', window.location.pathname);
                        return;
                    }
                    document.getElementById('passwordModal').classList.remove('hidden');
                }
            } catch (e) {
                console.log('Could not parse URL as note data:', e.message);
            }
        }
    }

    processHash() {
        console.log('Current URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        console.log('Search:', window.location.search);
        console.log('Pathname:', window.location.pathname);
        
        const noteString = window.location.hash.substring(1);
        console.log('Note string from hash:', noteString);
        
        if (!noteString) {
            console.log('No hash found');
            return;
        }

        try {
            this.currentNote = JSON.parse(decodeURIComponent(atob(noteString)));
            console.log('Parsed note:', this.currentNote);
            
            if (this.currentNote.expires < Date.now()) {
                alert('Note expired');
                history.replaceState({}, '', location.pathname);
                return;
            }
            
            console.log('Showing password modal');
            document.getElementById('passwordModal').classList.remove('hidden');
        } catch (error) {
            console.error('Hash parsing error:', error);
            // Don't show alert here since we also try other methods
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
