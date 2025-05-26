class BurnerApp {
    constructor() {
        this.currentNote = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupServiceWorker();
        
        // Wait for everything to be fully loaded before checking for shared notes
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        // Additional wait to ensure hash is fully loaded
        await new Promise(resolve => setTimeout(resolve, 50));
        
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
        window.addEventListener('hashchange', () => {
            console.log('Hash changed event triggered');
            setTimeout(() => this.processHash(), 10);
        });
        
        // Add load event listener to catch late-loading hashes
        window.addEventListener('load', () => {
            console.log('Window load event triggered');
            setTimeout(() => this.checkForSharedNote(), 50);
        });
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
        // Use hash fragment (revert back since you can see the hash in URL)
        const shareUrl = `${location.origin}/note.html#${noteString}`;
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
        console.log('=== CHECKING FOR SHARED NOTE ===');
        console.log('Document ready state:', document.readyState);
        console.log('Current timestamp:', Date.now());
        
        // Multiple attempts with different timing
        this.processHash();
        
        // Progressive delays to catch hash at different loading stages
        const delays = [10, 50, 100, 200, 500, 1000];
        delays.forEach(delay => {
            setTimeout(() => {
                console.log(`Checking hash after ${delay}ms delay`);
                this.processHash();
            }, delay);
        });
    }

    checkURLParams() {
        console.log('Checking URL params...');
        console.log('Search params:', window.location.search);
        
        // Check for 'n' parameter (note data)
        const urlParams = new URLSearchParams(window.location.search);
        const noteString = urlParams.get('n');
        
        console.log('Note string from params:', noteString);
        
        if (noteString) {
            try {
                this.currentNote = JSON.parse(decodeURIComponent(atob(noteString)));
                console.log('Parsed note from params:', this.currentNote);
                
                if (this.currentNote.expires < Date.now()) {
                    alert('Note expired');
                    history.replaceState({}, '', window.location.pathname);
                    return;
                }
                
                console.log('Showing password modal from params');
                document.getElementById('passwordModal').classList.remove('hidden');
                return;
            } catch (error) {
                console.error('URL params parsing error:', error);
                alert('Invalid or corrupted note');
                history.replaceState({}, '', window.location.pathname);
                return;
            }
        }
        
        // Fallback: Check if the entire URL after domain contains encoded data
        const fullPath = window.location.href;
        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const possibleNote = fullPath.replace(baseUrl, '').replace(/^[#?]/, '');
        
        if (possibleNote && possibleNote.length > 50 && !possibleNote.includes('n=')) {
            console.log('Found possible note data in URL path:', possibleNote);
            try {
                const noteData = JSON.parse(decodeURIComponent(atob(possibleNote)));
                if (noteData.data && noteData.expires) {
                    console.log('Successfully parsed note from URL path');
                    this.currentNote = noteData;
                    if (this.currentNote.expires < Date.now()) {
                        alert('Note expired');
                        history.replaceState({}, '', window.location.pathname);
                        return;
                    }
                    document.getElementById('passwordModal').classList.remove('hidden');
                }
            } catch (e) {
                console.log('Could not parse URL path as note data:', e.message);
            }
        }
    }

    processHash() {
        const currentUrl = window.location.href;
        const hash = window.location.hash;
        const noteString = hash.substring(1);
        
        console.log('--- Processing Hash ---');
        console.log('Full URL:', currentUrl);
        console.log('Hash:', hash);
        console.log('Note string length:', noteString.length);
        console.log('Note string preview:', noteString.substring(0, 50) + '...');
        
        // Skip if we already processed this note
        if (this.currentNote && this.currentNote.processed) {
            console.log('Note already processed, skipping');
            return;
        }
        
        if (!noteString || noteString.length < 10) {
            console.log('No valid hash found or hash too short');
            return;
        }

        try {
            console.log('Attempting to decode note...');
            const decodedNote = JSON.parse(decodeURIComponent(atob(noteString)));
            console.log('Successfully decoded note:', decodedNote);
            
            if (!decodedNote.data || !decodedNote.expires) {
                console.log('Invalid note structure - missing data or expires');
                return;
            }
            
            if (decodedNote.expires < Date.now()) {
                console.log('Note has expired');
                alert('Note expired');
                history.replaceState({}, '', location.pathname);
                return;
            }
            
            console.log('Valid note found, setting as current note');
            this.currentNote = { ...decodedNote, processed: true };
            
            console.log('Showing password modal');
            const passwordModal = document.getElementById('passwordModal');
            if (passwordModal) {
                passwordModal.classList.remove('hidden');
                console.log('Password modal should now be visible');
            } else {
                console.error('Password modal element not found!');
            }
            
        } catch (error) {
            console.error('Error processing hash:', error);
            console.error('Error details:', error.message);
            // Only show alert if this looks like it should be a valid note
            if (noteString.length > 50) {
                alert('Invalid or corrupted note');
                history.replaceState({}, '', location.pathname);
            }
        }
    }
    
    async handlePasswordSubmit() {
        const password = document.getElementById('passwordInput').value;
        if (!password) {
            alert('Please enter a password');
            return;
        }
        
        if (!this.currentNote) {
            alert('No note data available');
            return;
        }
        
        try {
            console.log('Attempting to decrypt with password...');
            const decrypted = await this.decryptContent(this.currentNote.data, password);
            console.log('Decryption successful');
            this.showDecryptedNote(decrypted);
            // Clean up URL after successful decryption
            history.replaceState({}, '', location.pathname);
        } catch (error) {
            console.error('Decryption error:', error);
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
