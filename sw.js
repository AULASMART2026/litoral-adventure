/* Litoral Adventure · Service Worker (offline-first) */
const CACHE = 'litoral-adventure-v9';
const SPECIES = ['pinguino-humboldt','chungungo','pelicano','pilpilen','garza-grande','yeco','quillay','litre','peumo','doca','totora'];
const SOUNDS = ['./assets/sounds/garza-grande.ogg','./assets/sounds/pelicano.mp3','./assets/sounds/yeco.mp3'];
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/content.js',
  './data/i18n-en.js',
  './data/species-img.js',
  './data/species-audio.js',
  './assets/logo.svg',
  './assets/lib/qrcode.min.js',
  './manifest.webmanifest',
  ...SPECIES.map(id => `./assets/species/${id}.jpg`),
  ...SOUNDS
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first para recursos propios (siempre la última versión cuando hay
   internet); si no hay red, cae a la copia en caché → sigue funcionando offline. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === location.origin;

  if (sameOrigin){
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // recursos externos: caché si existe, si no red
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
