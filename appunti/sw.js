/* Generato da site_pwa.py — NON modificare a mano.
   QUI STAVA IL WORKER DI PRIMA, con lo scope /appunti/. Dal 07/10 l'app e' tutto il portale e il
   worker sta alla radice (/sw.js). Chi aveva quello di prima lo ricontrolla qui: questo si toglie
   da solo e lascia il posto all'altro. Le cache di prima le butta il worker nuovo. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (ev) {
  ev.waitUntil(self.registration.unregister());
});
