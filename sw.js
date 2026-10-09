/* Generato da site_pwa.py — NON modificare a mano.
   Il worker del PORTALE intero (dal 07/10): sta alla radice del dominio e serve la home, gli
   appunti, il kit, la guida e lo Studypack completo. La versione e' l'impronta di css+js+elenco
   delle pagine pubblicate: se una pagina viene ritirata l'impronta cambia, e al primo accesso in
   rete la sua copia salvata se ne va. */
const V = "ac8b220a7b55";
const GUSCIO = "portale-guscio-" + V;
const PAGINE = "portale-pagine";
const IMMAGINI = "portale-immagini";
const STUDIO = "portale-studio-";

/* LA RADICE SI CHIEDE ALLA REGISTRAZIONE, non si scrive qui al momento del build: cotta dentro
   varrebbe solo dove il sito e' stato costruito. Lo scope invece e' quello vero ovunque. */
const BASE = new URL(self.registration.scope).pathname;
const OFFLINE = BASE + "appunti/offline.html";
const PRECACHE = ["", "appunti/", "app/", "appunti/assets/site.css?v=2463470f8292", "appunti/assets/site.js?v=5f9e5aa6244d", "appunti/brand/favicon.svg", "manifest.webmanifest", "appunti/offline.html", "appunti/cerca.json", "offline.json"].map(function (p) { return BASE + p; });
/* LE PAGINE DEL SITO GRATUITO PUBBLICATE ADESSO. Una copia salvata di una pagina che non e' qui
   se ne va all'attivazione: una lezione ritirata, il muro spostato. */
const PUBBLICATE = new Set(["", "app/", "appunti/", "appunti/404.html", "appunti/appunti/", "appunti/appunti/s1c11.html", "appunti/appunti/s1c12.html", "appunti/appunti/s1c13.html", "appunti/appunti/s1c14.html", "appunti/appunti/s1c15.html", "appunti/appunti/s1c16.html", "appunti/appunti/s1c17.html", "appunti/appunti/s1c18.html", "appunti/appunti/s1c19.html", "appunti/appunti/s1c20.html", "appunti/appunti/s1c21.html", "appunti/appunti/s1c22.html", "appunti/appunti/s1c23.html", "appunti/appunti/s1c24.html", "appunti/appunti/s1c25.html", "appunti/appunti/s1c26.html", "appunti/appunti/s1c27.html", "appunti/appunti/s1c28.html", "appunti/appunti/s1c29.html", "appunti/appunti/s1c30.html", "appunti/appunti/s1f01.html", "appunti/appunti/s1f02.html", "appunti/appunti/s1f03.html", "appunti/appunti/s1f04.html", "appunti/appunti/s1f05.html", "appunti/appunti/s1f06.html", "appunti/appunti/s1f07.html", "appunti/appunti/s1f08.html", "appunti/appunti/s1f09.html", "appunti/appunti/s1f10.html", "appunti/appunti/s2b31.html", "appunti/appunti/s2b32.html", "appunti/appunti/s2b33.html", "appunti/appunti/s2b34.html", "appunti/appunti/s2b35.html", "appunti/appunti/s2b36.html", "appunti/appunti/s2b37.html", "appunti/appunti/s2b38.html", "appunti/appunti/s2b39.html", "appunti/appunti/s2b40.html", "appunti/appunti/s2b41.html", "appunti/appunti/s2b42.html", "appunti/appunti/s2b43.html", "appunti/appunti/s2b44.html", "appunti/appunti/s2b45.html", "appunti/appunti/s2b46.html", "appunti/appunti/s2b47.html", "appunti/appunti/s2b48.html", "appunti/appunti/s2b49.html", "appunti/appunti/s2b50.html", "appunti/appunti/s2b51.html", "appunti/appunti/s2b52.html", "appunti/appunti/s2b53.html", "appunti/appunti/s2b54.html", "appunti/appunti/s2b55.html", "appunti/appunti/s2b56.html", "appunti/appunti/s2b57.html", "appunti/appunti/s2b58.html", "appunti/appunti/s2b59.html", "appunti/appunti/s2b60.html", "appunti/brand/indice.html", "appunti/condizioni.html", "appunti/offline.html", "appunti/privacy.html", "appunti/recesso.html", "chi-siamo/", "contatti/", "dispense/", "evento-grazie/", "evento/", "fabrizio/", "guida/", "kit/", "kit/biologia/", "kit/chimica/", "kit/fisica/", "lezioni/", "luca/", "materiali/", "matteo/", "metodo/", "novita/", "pacchetto/", "studypack/"].map(function (p) { return BASE + p; }));
/* il foglio e gli script con l'impronta di oggi: le copie con l'impronta di prima se ne vanno */
const RISORSE = new Set(["appunti/assets/account.js?v=ffe645a628ac", "appunti/assets/site.css?v=2463470f8292", "appunti/assets/site.js?v=5f9e5aa6244d"].map(function (p) { return BASE + p; }));
const SCADENZA = 2592000000;
const ATTESA_RETE = 6000;
const TETTO_IMMAGINI = 300;
const TETTO_FIGURA = 3145728;
const TERZE = ["upload.wikimedia.org"];
const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/";
const MINIATURA = 960;
const MAI = ["/account/"];
const AREA_STUDIO = BASE + "studio/";
/* I DATI che si leggono prima dalla rete, come le pagine: l'indice della ricerca. */
const DATI = ["appunti/cerca.json"].map(function (p) { return BASE + p; });
/* le cache del worker che stava in /appunti/ fino al 06/10 */
const VECCHIE = new RegExp("^(?:guscio|pagine|immagini)-[0-9a-f]{12}$");

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(GUSCIO);
    /* `addAll` e' tutto-o-niente: un file mancante farebbe fallire l'installazione e il sito
       resterebbe senza offline SENZA dirlo. Uno per uno, e chi manca si salta. */
    await Promise.all(PRECACHE.map((u) => c.add(new Request(u, {cache: "reload"}))
                                           .catch(() => null)));
    await self.skipWaiting();
  })());
});

/* «kit/» e «kit/index.html» sono la stessa pagina, e i link usano le due forme */
function varianti(p) {
  if (p.endsWith("/")) return [p, p + "index.html"];
  if (p.endsWith("/index.html")) return [p, p.slice(0, -10)];
  return [p];
}
function ePagina(p) { return p.endsWith("/") || p.endsWith(".html"); }
function pubblicata(p) { return varianti(p).some((x) => PUBBLICATE.has(x)); }

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    const nomi = await caches.keys();
    /* il guscio delle versioni di prima e le cache del worker di /appunti/ */
    await Promise.all(nomi.filter((n) => (n.indexOf("portale-guscio-") === 0 && n !== GUSCIO)
                                         || VECCHIE.test(n))
                          .map((n) => caches.delete(n)));
    /* LE COPIE DEL SITO GRATUITO restano, tranne le pagine ritirate e i fogli di prima: e' la
       difesa che tiene fuori dal telefono una lezione tolta dal sito. */
    const c = await caches.open(PAGINE);
    for (const r of await c.keys()) {
      const u = new URL(r.url);
      if (u.origin !== self.location.origin || u.pathname.indexOf(BASE) !== 0) continue;
      const via = ePagina(u.pathname) ? !pubblicata(u.pathname)
                : (u.search.indexOf("?v=") === 0 && !RISORSE.has(u.pathname + u.search));
      if (via) await c.delete(r);
    }
    await self.clients.claim();
  })());
});

/* Marca la risposta con l'ora del salvataggio: e' cosi' che una pagina puo' SCADERE. Va
   ricostruita perche' gli header di una Response sono immutabili. La stessa marca la mette la
   pagina quando salva tutto (`site_build._app_js`). */
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

/* la rete, senza aspettarla oltre `ms` quando una copia c'e' gia': null se non arriva */
function entro(promessa, ms) {
  return new Promise((ok) => {
    const t = setTimeout(() => ok(null), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, () => { clearTimeout(t); ok(null); });
  });
}

async function senzaRete() {
  return (await caches.match(OFFLINE)) ||
         new Response("Non c'e' rete e questa pagina non e' stata salvata.",
                      {status: 503,
                       headers: {"Content-Type": "text/plain; charset=utf-8"}});
}

/* La copia di una pagina del sito gratuito: fra quelle salvate (se non e' scaduta), poi nel
   guscio, che si rifa' a ogni versione e non scade. */
async function salvataGratuita(u) {
  const c = await caches.open(PAGINE);
  for (const p of varianti(u.pathname)) {
    const r = await c.match(u.origin + p);
    if (r && fresca(r)) return r;
    if (r) await c.delete(u.origin + p);
  }
  const g = await caches.open(GUSCIO);
  for (const p of varianti(u.pathname)) {
    const r = await g.match(u.origin + p);
    if (r) return r;
  }
  return null;
}

/* NAVIGAZIONI del sito gratuito: prima la rete. Finche' c'e' campo si legge cio' che e' online
   adesso; la copia serve quando la rete manca (o non risponde), non al posto della rete. */
async function pagina(ev) {
  const req = ev.request;
  const u = new URL(req.url);
  const c = await caches.open(PAGINE);
  const salvata = await salvataGratuita(u);
  const rete = fetch(req).then(async (r) => {
    /* UN RINVIO (voce 29 del registro, 09/10). Un indirizzo senza la barra finale (`/evento`)
       GitHub Pages lo rinvia con un 301 a `/evento/`. Una navigazione chiede i rinvii a mano
       (`redirect: "manual"`), quindi qui arriva una risposta `opaqueredirect`, con `ok` falso
       e stato 0: si restituisce cosi' com'e', e il browser segue il rinvio da se', con
       l'indirizzo giusto nella barra. Trattata come un errore, chi aveva gia' il worker vedeva
       «Sei senza rete» con la rete (ogni link senza barra finale: bio, gruppi, messaggi). Non
       si salva: non e' una pagina. E non si segue qui (`redirect: "follow"`): una risposta
       rinviata data a una navigazione col rinvio a mano il browser la rifiuta, e anche dove la
       accettasse la barra direbbe `/evento` e i link relativi partirebbero dalla cartella
       sbagliata. */
    if (r && r.type === "opaqueredirect") return r;
    if (r && r.ok) { await c.put(u.origin + u.pathname, await marca(r.clone())); return r; }
    if (r && r.status === 404) {
      /* Pagina RIMOSSA dal sito (lezione ritirata, muro spostato): si butta anche la copia,
         invece di continuare a servirla offline. */
      for (const p of varianti(u.pathname)) await c.delete(u.origin + p);
      return r;
    }
    /* Il server ha risposto, con un errore (un 5xx): senza una copia, la sua risposta e' piu'
       vera di «Sei senza rete» (stessa famiglia della voce 29: una risposta letta come rete
       assente). Con la copia si serve la copia, come prima. */
    if (r && !salvata) return r;
    throw new Error("risposta " + (r && r.status));
  });
  ev.waitUntil(rete.catch(() => null));
  try {
    const r = salvata ? await entro(rete, ATTESA_RETE) : await rete;
    if (r) return r;
  } catch (_e) { /* niente rete */ }
  return salvata || (await senzaRete());
}

/* LO STUDYPACK COMPLETO salvato: le sue pagine e i suoi dati COSI' COME SONO ONLINE, cifrati.
   Si cercano solo nelle cache dello Studypack, mai nelle copie di passaggio: pagine e dati di
   due pubblicazioni diverse non si aprono con la stessa chiave. NON SCADONO per la data della
   copia (G2, 2026-10-07): la scadenza dello Studypack e' UNA, quella della sua chiave sul
   dispositivo (30 giorni dall'ultimo «si'» dell'account con la rete, la conta il cancello).
   Con la data della copia, al trentesimo giorno dal salvataggio il worker smetteva di servire
   pagine che la chiave, rinnovata ogni volta che le apri con la rete, apriva ancora. */
async function salvataStudio(href, pagina) {
  const u = new URL(href);
  const prove = pagina ? varianti(u.pathname).map((p) => u.origin + p) : [href];
  const nomi = (await caches.keys()).filter((n) => n.indexOf(STUDIO) === 0);
  for (const n of nomi) {
    for (const x of prove) {
      const r = await caches.match(x, {cacheName: n});
      if (r) return r;
    }
    if (!pagina && u.search.indexOf("?v=") === 0) {
      const r = await caches.match(href, {cacheName: n, ignoreSearch: true});
      if (r) return r;
    }
  }
  return null;
}

/* NAVIGAZIONI dentro /studio: prima la rete, come le altre. Online non si salva niente di
   passaggio: lo Studypack si salva solo tutto insieme, da «Salva tutto». */
async function paginaStudio(ev) {
  const req = ev.request;
  const salvata = await salvataStudio(req.url, true);
  const rete = fetch(req);
  ev.waitUntil(rete.catch(() => null));
  try {
    const r = salvata ? await entro(rete, ATTESA_RETE) : await rete;
    if (r) return r;
  } catch (_e) { /* niente rete */ }
  return salvata || (await senzaRete());
}

/* I file di /studio (script, foglio, dati cifrati): prima la rete, poi la copia salvata. */
async function risorsaStudio(ev) {
  const req = ev.request;
  const salvata = await salvataStudio(req.url, false);
  const rete = fetch(req);
  ev.waitUntil(rete.catch(() => null));
  try {
    const r = salvata ? await entro(rete, ATTESA_RETE) : await rete;
    if (r && (r.ok || !salvata)) return r;
  } catch (_e) { /* niente rete */ }
  return salvata || new Response("", {status: 504, statusText: "Offline"});
}

/* I DATI (l'indice della ricerca, cerca.json): prima la rete, come le pagine. Sono CONTENUTO,
   cambiano con le lezioni e non col guscio, e la versione non li conta (verifica del sito del
   02/10, rilievo REG-6). La copia serve quando la rete manca, e si rinfresca a ogni lettura. */
async function dati(req) {
  const c = await caches.open(GUSCIO);
  let rete = null;
  try { rete = await fetch(req); } catch (_e) { rete = null; }
  if (rete && rete.ok) { c.put(req, rete.clone()); return rete; }
  return (await c.match(req)) || (await (await caches.open(PAGINE)).match(req)) || rete ||
         new Response("", {status: 504, statusText: "Offline"});
}

/* SENZA RETE, un foglio o uno script con l'impronta che non e' fra le copie (una pagina salvata
   con la versione di prima): si da' quello di oggi, invece di lasciare la pagina senza stile. */
async function simile(req) {
  const u = new URL(req.url);
  if (u.search.indexOf("?v=") !== 0) return null;
  return (await caches.match(req, {ignoreSearch: true})) || null;
}

/* GUSCIO e file del sito gratuito: si serve subito la copia e si rinfresca dietro. */
async function risorsa(req) {
  const c = await caches.open(GUSCIO);
  const salvata = await c.match(req);
  const rete = fetch(req).then((r) => {
    if (r && r.ok) c.put(req, r.clone());
    return r;
  }).catch(() => null);
  if (salvata) return salvata;
  const tenuta = await (await caches.open(PAGINE)).match(req);
  if (tenuta) return tenuta;
  return (await rete) || (await simile(req)) ||
         new Response("", {status: 504, statusText: "Offline"});
}

/* IMMAGINI di terze parti: prima la copia (non cambiano mai), con un tetto. Si chiedono in CORS
   (Wikimedia lo consente): una risposta opaca il browser la conta come sette megabyte nello
   spazio occupato, una vera per quello che pesa. Di Wikimedia si chiede la MINIATURA della
   misura che serve, e la si tiene sotto l'indirizzo dell'originale (`miniatura`): gli appunti
   linkano originali fino a 21 MB. La stessa regola la usa «Salva tutto» nella pagina. */
async function potatura(c) {
  const k = await c.keys();
  for (let i = 0; i < k.length - TETTO_IMMAGINI; i++) await c.delete(k[i]);
}
function miniatura(u) {
  if (u.indexOf(COMMONS) !== 0) return u;
  const m = /^([0-9a-f]\/[0-9a-f]{2}\/)([^\/?#]+\.(?:jpe?g|png|gif|webp))$/i.exec(u.slice(COMMONS.length));
  return m ? COMMONS + "thumb/" + m[1] + m[2] + "/" + MINIATURA + "px-" + m[2] : u;
}
async function figura(u) {
  const prove = miniatura(u) === u ? [u] : [miniatura(u), u];
  for (const x of prove) {
    try {
      const r = await fetch(x, {mode: "cors", credentials: "omit"});
      if (r && r.ok) return r;
    } catch (_e) { /* la prossima prova */ }
  }
  return null;
}
async function immagine(req) {
  const c = await caches.open(IMMAGINI);
  const salvata = await c.match(req.url);
  if (salvata) return salvata;
  const r = await figura(req.url);
  if (r) {
    if (Number(r.headers.get("content-length") || 0) <= TETTO_FIGURA) {
      await c.put(req.url, r.clone()); potatura(c);
    }
    return r;
  }
  try { return await fetch(req); } catch (_e) { return Response.error(); }
}

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  /* una richiesta con una CREDENZIALE (il token dell'account) non passa mai da una cache: la
     risposta e' di quella persona e di quel momento. Misurato con le prove sui dispositivi:
     con l'account sullo stesso dominio, la chiave dello Studypack finiva nel guscio e lo apriva
     senza rete anche in una scheda nuova, cioe' scavalcava il cancello. */
  if (req.headers && req.headers.get("Authorization")) return;
  /* un download di «Salva tutto» (o di «Aggiorna»): va in rete, sempre, e la pagina salva da
     se' cio' che riceve. Servirlo dalla copia salverebbe di nuovo la copia. */
  if (req.cache === "reload" && req.mode !== "navigate") return;
  let u;
  try { u = new URL(req.url); } catch (_e) { return; }

  if (u.origin !== self.location.origin) {
    if (TERZE.indexOf(u.hostname) >= 0) ev.respondWith(immagine(req));
    return;                       /* tutto il resto passa intatto */
  }
  if (u.pathname.indexOf(BASE) !== 0) return;
  for (let i = 0; i < MAI.length; i++) {
    if (u.pathname.indexOf(MAI[i]) >= 0) {
      /* l'area account non passa MAI da una cache. Ma senza rete una NAVIGAZIONE verso di lei
         (il link «Il tuo account» sta in testa a ogni pagina, anche su quella senza rete)
         apriva l'errore del browser: nell'app installata, senza barra dell'indirizzo, un vicolo
         cieco (verifica del 07/10, OFF-5). Con la rete non cambia niente e non si salva niente;
         senza, esce la pagina senza rete del sito. */
      if (req.mode === "navigate") ev.respondWith(fetch(req).catch(() => senzaRete()));
      return;
    }
  }
  const studio = u.pathname.indexOf(AREA_STUDIO) === 0;
  if (req.mode === "navigate") { ev.respondWith(studio ? paginaStudio(ev) : pagina(ev)); return; }
  if (studio) { ev.respondWith(risorsaStudio(ev)); return; }
  if (DATI.indexOf(u.pathname) >= 0) { ev.respondWith(dati(req)); return; }
  ev.respondWith(risorsa(req));
});
