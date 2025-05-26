const CACHE_NAME = 'burner-v4';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js' // Only cache local files
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .catch(console.error)
    );
});

self.addEventListener('fetch', (event) => {
    // Don't cache external resources
    if (event.request.url.startsWith('https://cdn.')) {
        return fetch(event.request);
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});