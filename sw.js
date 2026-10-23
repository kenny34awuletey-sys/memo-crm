/* MEMO — service worker : affiche les notifications « un client a répondu », même MEMO fermé.
   Il ne met rien en cache et ne voit passer aucune page : il ne sert qu'aux notifications. */
self.addEventListener('install', function () { self.skipWaiting(); });

/* Pastille sur l'icône de l'appli (iPhone en appli d'écran d'accueil, Android, ordinateur) :
   le nombre de réponses pas encore vues. MEMO le recale à l'ouverture (message « memo-badge »). */
async function lireCompteur() {
  try { var r = await (await caches.open('memo-badge')).match('/compteur'); return r ? (parseInt(await r.text(), 10) || 0) : 0; }
  catch (_) { return 0; }
}
async function ecrireCompteur(n) {
  try { await (await caches.open('memo-badge')).put('/compteur', new Response(String(n))); } catch (_) { }
  try {
    if (self.navigator && 'setAppBadge' in self.navigator) { n > 0 ? await self.navigator.setAppBadge(n) : await self.navigator.clearAppBadge(); }
  } catch (_) { }
}
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'memo-badge') e.waitUntil(ecrireCompteur(Math.max(0, parseInt(d.n, 10) || 0)));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil((async function () {
    var fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // MEMO ouvert quelque part : il relève les réponses tout de suite au lieu d'attendre 90 s.
    fenetres.forEach(function (c) { c.postMessage({ type: 'memo-nouvelle-reponse' }); });
    await ecrireCompteur((await lireCompteur()) + 1);
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
