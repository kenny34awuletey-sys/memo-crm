/* MEMO — service worker : affiche les notifications « un client a répondu », même MEMO fermé.
   Il ne met rien en cache et ne voit passer aucune page : il ne sert qu'aux notifications. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil((async function () {
    var fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // MEMO ouvert quelque part : il relève les réponses tout de suite au lieu d'attendre 90 s.
    fenetres.forEach(function (c) { c.postMessage({ type: 'memo-nouvelle-reponse' }); });
    // Toujours afficher la notification : iPhone et Chrome l'exigent pour chaque envoi.
    await self.registration.showNotification(d.titre || 'MEMO', {
      body: d.corps || '',
      tag: d.tag || 'memo',
      renotify: true,
      icon: '/icone-192.png',
      badge: '/icone-badge.png',
      data: { url: d.url || '/?ouvrir=messages' }
    });
  })());
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var cible = new URL((e.notification.data && e.notification.data.url) || '/?ouvrir=messages', self.location.origin);
  if (cible.origin !== self.location.origin) cible = new URL('/?ouvrir=messages', self.location.origin);
  e.waitUntil((async function () {
    var fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < fenetres.length; i++) {
      var c = fenetres[i];
      if (new URL(c.url).origin === self.location.origin && !/\/reponse\//.test(c.url)) {
        await c.focus();
        c.postMessage({ type: 'memo-ouvrir', vue: 'messages' });
        return;
      }
    }
    await self.clients.openWindow(cible.href);
  })());
});
