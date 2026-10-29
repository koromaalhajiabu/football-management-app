const CACHE_NAME = 'football-management-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './background.jpg'
];
// Third-party files the page needs to run. Cached so the page opens offline.
const STATIC_CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];
// Live database and login traffic is never cached.
const NEVER_CACHE_HOSTS = ['supabase.co', 'supabase.in'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await Promise.all(STATIC_CDN.map(url =>
      cache.add(new Request(url, { mode: url.startsWith('https://fonts.googleapis') ? 'no-cors' : 'cors' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER_CACHE_HOSTS.some(h => url.hostname.endsWith(h))) return;

  const isPage = url.origin === self.location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'));

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isPage) {
      // Pages: network first, so design and content updates appear straight away.
      // The saved copy is used only when the phone is offline.
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put('./index.html', res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
        throw err;
      }
    }
    // Other files (icons, background, manifest): saved copy first, then network.
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  })());
});
