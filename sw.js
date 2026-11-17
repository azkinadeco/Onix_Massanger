// Service worker sederhana: network-first, fallback ke cache (biar bisa dibuka offline)
const CACHE = 'onix-v24';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/_/') || e.request.method !== 'GET') return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// tap notifikasi -> buka/fokus app lalu langsung ke chat-nya
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const chatId = e.notification.data?.chatId;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = list[0];
    if (c) { await c.focus(); if (chatId) c.postMessage({ type: 'open-chat', chatId }); return; }
    await self.clients.openWindow('./' + (chatId ? '#chat=' + chatId : ''));
  })());
});
