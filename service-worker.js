/* ============================================================
   SERVICE WORKER — AR1 Manager
   Gestisce cache offline e aggiornamenti PWA
   ============================================================ */

const VERSIONE_CACHE = 'ar1manager-v8';
const RISORSE_DA_CACHARE = [
  './index.html',
  './style.css',
  './data.js',
  './game-engine.js',
  './ui.js',
  './audio.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* Installazione: pre-carica le risorse principali */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSIONE_CACHE).then((cache) => {
      return cache.addAll(RISORSE_DA_CACHARE);
    }).catch(() => {
      /* Se il pre-caching fallisce (es. primo avvio senza connessione), ignora */
    })
  );
  self.skipWaiting();
});

/* Attivazione: rimuove cache vecchie */
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chiavi) => {
      return Promise.all(
        chiavi
          .filter((chiave) => chiave !== VERSIONE_CACHE)
          .map((chiave) => caches.delete(chiave))
      );
    })
  );
  self.clients.claim();
});

/* Fetch: serve dalla cache, fallback su rete */
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request).then((rispostaCachata) => {
      if (rispostaCachata) return rispostaCachata;
      return fetch(evento.request).then((rispostaRete) => {
        if (!rispostaRete || rispostaRete.status !== 200) return rispostaRete;
        const rispostaClonata = rispostaRete.clone();
        caches.open(VERSIONE_CACHE).then((cache) => {
          cache.put(evento.request, rispostaClonata);
        });
        return rispostaRete;
      });
    }).catch(() => {
      /* Offline e risorsa non in cache: restituisce pagina principale.
         Path relativo compatibile con qualsiasi sotto-percorso (es. GitHub Pages). */
      return caches.match('./index.html');
    })
  );
});
