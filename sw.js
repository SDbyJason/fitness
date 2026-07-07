/* APEX FIT Service Worker – Offline-Cache + Web Push */
const CACHE = 'apexfit-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== 'apexfit-cfg') await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App-Navigation: Netz zuerst (frische Version), offline aus dem Cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Worker-API nie cachen
  if (url.pathname.startsWith('/api/')) return;

  // Alles andere (eigene Assets, Fonts, CDN-Skripte): Cache zuerst, sonst Netz + cachen
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && (url.origin === location.origin || ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com', 'www.gstatic.com'].includes(url.hostname))) {
        const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp));
      }
      return r;
    }).catch(() => hit))
  );
});

/* Push: kommt ohne Payload – Nachricht wird beim Worker abgeholt */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let body = 'Erinnerung – öffne APEX FIT';
    try {
      const cfg = await caches.open('apexfit-cfg');
      const r = await cfg.match('/cfg/workerUrl');
      if (r) {
        const wu = (await r.text()).replace(/\/$/, '');
        const sub = await self.registration.pushManager.getSubscription();
        if (wu && sub) {
          const res = await fetch(wu + '/api/push/pending?endpoint=' + encodeURIComponent(sub.endpoint));
          const d = await res.json();
          if (d.msg) body = d.msg;
        }
      }
    } catch { /* generische Nachricht reicht */ }
    await self.registration.showNotification('APEX FIT', { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'apexfit' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) return wins[0].focus();
    return self.clients.openWindow('./');
  })());
});
