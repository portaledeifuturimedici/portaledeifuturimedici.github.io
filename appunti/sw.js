/* Generato da site_pwa.py — NON modificare a mano.
   La versione e' l'impronta di css+js+elenco delle pagine pubblicate: se un
   episodio viene ritirato l'impronta cambia e ogni copia vecchia viene buttata
   al primo accesso in rete. */
const V = "70ea9c6fb9de";
const GUSCIO = "guscio-" + V;
const PAGINE = "pagine-" + V;
const IMMAGINI = "immagini-" + V;

/* LA RADICE SI CHIEDE ALLA REGISTRAZIONE, non si scrive qui al momento del
   build. Cotta dentro varrebbe `/appunti/` — giusta sul dominio e SBAGLIATA in
   prova locale, dove il sito si serve dalla radice: il worker si registrerebbe
   regolarmente e poi ignorerebbe ogni richiesta, perche' nessun percorso
   comincia per `/appunti/`. Offline morto, nessun errore, tutto verde. Lo
   scope invece e' quello vero ovunque. */
const BASE = new URL(self.registration.scope).pathname;
const OFFLINE = BASE + "offline.html";
const PRECACHE = ["", "index.html", "appunti/", "appunti/index.html", "assets/site.css", "assets/site.js", "brand/favicon.svg", "manifest.webmanifest", "offline.html", "brand/icona-192.png", "brand/icona-192-maskable.png", "brand/icona-512.png", "brand/icona-512-maskable.png", "brand/apple-touch-icon.png"].map(function (p) { return BASE + p; });
const SCADENZA = 2592000000;
const TETTO_IMMAGINI = 120;
const TERZE = ["upload.wikimedia.org"];
const MAI = ["/account/"];

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(GUSCIO);
    /* `addAll` e' tutto-o-niente: un file mancante farebbe fallire l'intera
       installazione e il sito resterebbe senza offline SENZA dirlo. Uno per
       uno, e chi manca si salta. */
    await Promise.all(PRECACHE.map((u) => c.add(new Request(u, {cache: "reload"}))
                                           .catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter((n) => !n.endsWith("-" + V))
                          .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Marca la risposta con l'ora del salvataggio: e' cosi' che una pagina puo'
   SCADERE. Va ricostruita perche' gli header di una Response sono immutabili. */
async function marca(resp) {
  const corpo = await resp.blob();
  const h = new Headers(resp.headers);
  h.set("x-salvata", String(Date.now()));
  return new Response(corpo, {status: resp.status, statusText: resp.statusText,
                              headers: h});
}
function fresca(resp) {
  const t = Number((resp && resp.headers.get("x-salvata")) || 0);
  return t > 0 && (Date.now() - t) < SCADENZA;
}

/* NAVIGAZIONI: prima la rete. Finche' c'e' campo si legge cio' che e' online
   adesso — la copia serve quando la rete manca, non al posto della rete. */
async function pagina(req) {
  const c = await caches.open(PAGINE);
  try {
    const rete = await fetch(req);
    if (rete && rete.ok) { c.put(req, await marca(rete.clone())); return rete; }
    if (rete && rete.status === 404) {
      /* Pagina RIMOSSA dal sito (episodio ritirato, muro spostato): si butta
         anche la copia, invece di continuare a servirla offline. */
      await c.delete(req);
      return rete;
    }
    throw new Error("risposta " + (rete && rete.status));
  } catch (_e) {
    const salvata = await c.match(req, {ignoreSearch: true});
    if (salvata && fresca(salvata)) return salvata;
    if (salvata) await c.delete(req);
    return (await caches.match(OFFLINE)) ||
           new Response("Non c'e' rete e questa pagina non e' stata salvata.",
                        {status: 503,
                         headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }
}

/* GUSCIO (css, js, icone): si serve subito la copia e si rinfresca dietro. */
async function risorsa(req) {
  const c = await caches.open(GUSCIO);
  const salvata = await c.match(req);
  const rete = fetch(req).then((r) => {
    if (r && r.ok) c.put(req, r.clone());
    return r;
  }).catch(() => null);
  return salvata || (await rete) ||
         new Response("", {status: 504, statusText: "Offline"});
}

/* IMMAGINI di terze parti: prima la copia (non cambiano mai), con un tetto. */
async function potatura(c) {
  const k = await c.keys();
  for (let i = 0; i < k.length - TETTO_IMMAGINI; i++) await c.delete(k[i]);
}
async function immagine(req) {
  const c = await caches.open(IMMAGINI);
  const salvata = await c.match(req);
  if (salvata) return salvata;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === "opaque")) { await c.put(req, r.clone()); potatura(c); }
    return r;
  } catch (_e) {
    return salvata || Response.error();
  }
}

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  let u;
  try { u = new URL(req.url); } catch (_e) { return; }

  if (u.origin !== self.location.origin) {
    if (TERZE.indexOf(u.hostname) >= 0) ev.respondWith(immagine(req));
    return;                       /* tutto il resto passa intatto */
  }
  if (u.pathname.indexOf(BASE) !== 0) return;
  for (let i = 0; i < MAI.length; i++) {
    if (u.pathname.indexOf(MAI[i]) >= 0) return;
  }
  if (req.mode === "navigate") { ev.respondWith(pagina(req)); return; }
  ev.respondWith(risorsa(req));
});

/* La pagina puo' chiedere due cose: salvare tutto per l'offline, o liberare lo
   spazio. Entrambe rispondono con un esito — un pulsante che non sa dire se ha
   funzionato e' un pulsante che mente. */
self.addEventListener("message", (ev) => {
  const dati = ev.data || {};
  const rispondi = (m) => { if (ev.source) ev.source.postMessage(m); };

  if (dati.tipo === "salva-tutto") {
    ev.waitUntil((async () => {
      const c = await caches.open(PAGINE);
      const elenco = dati.pagine || [];
      let fatte = 0;
      for (let i = 0; i < elenco.length; i++) {
        try {
          const r = await fetch(elenco[i], {cache: "reload"});
          if (r && r.ok) { await c.put(elenco[i], await marca(r)); fatte++; }
        } catch (_e) { /* si continua: una pagina persa non ferma le altre */ }
        rispondi({tipo: "salva-avanzamento", fatte: fatte, totale: elenco.length});
      }
      rispondi({tipo: "salva-finito", fatte: fatte, totale: elenco.length});
    })());
  }

  if (dati.tipo === "svuota") {
    ev.waitUntil((async () => {
      const nomi = await caches.keys();
      await Promise.all(nomi.map((n) => caches.delete(n)));
      rispondi({tipo: "svuotato"});
    })());
  }
});
