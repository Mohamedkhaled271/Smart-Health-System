// sw.js - Service Worker for Helios PWA
const CACHE_NAME = 'helios-pwa-v2';
const OFFLINE_URL = '/offline.html';

// الملفات التي سيتم تخزينها مؤقتاً
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/doctor.html',
  '/patient.html',
  '/offline.html',
  '/manifest.json',
  '/css/index.css',
  '/css/admin.css',
  '/js/index.js',
  '/js/admin.js',
  '/js/doctor.js',
  '/js/patient.js',
  '/js/auth.js',
  '/js/firebase.js',
  '/js/mqtt.js',
  '/js/notifications.js',
  '/js/theme.js',
  '/lib/apexcharts.min.js',
  '/lib/chart.min.js',
  '/assets/icons/heart-rate.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,100..900;1,100..900&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/apexcharts',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-storage.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// تنشيط Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية: Network First مع Fallback للكاش
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // استثناء Firebase و API الخارجية (Network Only)
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('cloudflare.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // للملفات الثابتة: Cache First ثم Network
  if (event.request.destination === 'style' ||
      event.request.destination === 'script' ||
      event.request.destination === 'font' ||
      event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).then(fetchResponse => {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, fetchResponse.clone());
              return fetchResponse;
            });
          });
        })
        .catch(() => {
          if (event.request.destination === 'image') {
            return caches.match('/assets/icons/heart-rate.png');
          }
        })
    );
    return;
  }
  
  // للصفحات: Network First ثم Fallback للـ Offline Page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(response => response || caches.match(OFFLINE_URL));
        })
    );
    return;
  }
  
  // للباقي: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      })
  );
});

// دعم الإشعارات الخلفية (Push Notifications)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Helios Alert', body: event.data.text() };
  }
  
  const options = {
    body: data.body || 'New health update available',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    sound: '/assets/sounds/alert.mp3',
    data: {
      url: data.url || '/patient.html',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'View Details', icon: '/assets/icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/assets/icons/icon-96x96.png' }
    ],
    tag: data.tag || 'health-alert',
    renotify: true,
    requireInteraction: data.emergency || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Helios Health Alert', options)
  );
});

// التعامل مع ضغط الإشعار
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          const url = event.notification.data?.url || '/patient.html';
          
          // تحقق إذا كانت هناك نافذة مفتوحة بالفعل
          for (let client of windowClients) {
            if (client.url.includes(url) && 'focus' in client) {
              return client.focus();
            }
          }
          // افتح نافذة جديدة
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
});

// مزامنة الخلفية (Background Sync)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-health-data') {
    event.waitUntil(syncHealthData());
  }
});

async function syncHealthData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingRequests = await cache.match('/pending-sync.json');
    
    if (pendingRequests) {
      const data = await pendingRequests.json();
      // إعادة محاولة إرسال البيانات المعلقة
      console.log('Syncing pending health data:', data);
      // هنا يمكن إضافة منطق إعادة إرسال البيانات إلى Firebase
    }
    return true;
  } catch (error) {
    console.error('Background sync failed:', error);
    return false;
  }
}
