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

// ===========================================
// PUSH NOTIFICATIONS
// ===========================================

// Réception d'une notification push
self.addEventListener('push', (event) => {
  console.log('[SW] Push reçu:', event);
  
  let data = {
    title: 'JobTracker',
    body: 'Nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    url: '/dashboard'
  };
  
  // Parser les données de la notification
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[SW] Erreur parsing push data:', e);
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: {
      url: data.url,
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ],
    tag: data.tag || 'jobtracker-notification',
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur une notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification cliquée:', event.notification.tag);
  
  event.notification.close();
  
  // Action "fermer" - ne rien faire
  if (event.action === 'close') {
    return;
  }
  
  // Ouvrir l'URL de la notification
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Chercher une fenêtre déjà ouverte
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Fermeture d'une notification
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification fermée:', event.notification.tag);
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
