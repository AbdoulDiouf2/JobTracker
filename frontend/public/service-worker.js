// MAADEC Job Tracker - Service Worker
const CACHE_NAME = 'jobtracker-v1';
const DYNAMIC_CACHE = 'jobtracker-dynamic-v1';

// Assets à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Tech-driven_job_tracking_logo_design-removebg-preview.png'
];

// Routes API à ne jamais mettre en cache
const API_ROUTES = ['/api/'];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Suppression ancien cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Stratégie de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes API (toujours réseau)
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    return;
  }

  // Ignorer les requêtes externes (analytics, fonts, etc.)
  if (url.origin !== location.origin) {
    return;
  }

  // Stratégie: Network First avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone la réponse pour la mettre en cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        // Fallback vers le cache si réseau indisponible
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Pour les navigations, retourner index.html (SPA)
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        
        // Réponse offline par défaut
        return new Response('Contenu non disponible hors ligne', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// Gestion des messages (pour forcer la mise à jour)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notification de mise à jour disponible
self.addEventListener('controllerchange', () => {
  console.log('[SW] Nouveau Service Worker activé');
});
