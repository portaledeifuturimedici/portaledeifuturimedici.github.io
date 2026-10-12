/* =====================================================================
   studio_sync.js — i progressi di studio FRA DISPOSITIVI (fetta S2 del lancio)
   Vanilla JS, ZERO dipendenze, niente CDN, niente DOM. Compatibile ES5 come
   gli altri motori (var/function, nessuna arrow, nessun template literal):
   gira identico nel browser e in node.

   PERCHE' ESISTE. Decisione dell'utente (piano del sito, gruppo 10):
   «Progressi SUL SERVER con l'account: cambio dispositivo = si ritrova tutto».
   Il Worker degli account ha lo stato (migrazione 0011): `GET /studio/stato
   ?since=` consegna cio' che e' cambiato dopo un cursore, `PUT /studio/kv`
   salva un valore per nome SE chi salva ha visto la versione che c'e'. Questo
   modulo e' la meta' del browser: unisce cio' che c'e' qui con cio' che c'e'
   la'.

   LA REGOLA (riscritta dopo la revisione del 2026-09-29, che ha trovato un
   mese di progressi cancellato da un telefono rimasto spento). Per ogni nome:
     1. un valore che NON e' stato toccato qui (uguale alla versione del server
        da cui parte) cede SEMPRE a una versione piu' nuova del server, qualunque
        ora dica il suo orologio;
     2. un valore toccato qui su una versione vecchia si UNISCE a quella nuova
        dove si sa unire: le tappe tappa per tappa, le scatole esame per esame,
        argomento per argomento e giorno per giorno (vince il ripasso piu'
        recente); cio' che uno dei due ha cancellato e l'altro non ha toccato
        resta cancellato;
     3. dove non si unisce vince il salvataggio piu' recente, con l'ORA DEL
        SERVER (lo scarto dell'orologio si misura a ogni lettura); a pari ora
        vince uno solo, lo stesso per tutti i dispositivi;
     4. cio' che perde si METTE DA PARTE (`studio-sync.precedente`, una lista per
        chiave e per account), anche quando a perdere e' la versione del server.
   «Toccato» si misura sul CONTENUTO (la copia della versione di base sta in
   `studio-sync.basi`): un motore che risalva lo stesso valore all'apertura
   della pagina non lo rende piu' recente di niente.

   COLLEGATO DAL SECONDO TEMPO DI S2 (2026-09-29). Lo carica ogni pagina del
   COMPLETO subito dopo studio_fetch.js (`page()` in site_build.py; nessuna
   pagina gratuita: lo controlla `check()`), e parte da solo con `avvia` quando
   site.js gli ha scritto dov'e' il Worker (`window.STUDIO_SYNC`). I motori NON
   aspettano la rete: si montano sulla memoria di questo browser, e quando una
   lettura scrive qualcosa (`studio:stato`) rileggono. Il debito del primo tempo
   «montare i motori dopo la prima tira» e' chiuso cosi' dal lato del motore:
   scatole.js, prima di scrivere, UNISCE (unisciScatole) cio' che la lettura ha
   scritto nel frattempo, invece di coprirlo con la copia che aveva in memoria.
   Chi chiama `spingi`: scatole.js a ogni salvataggio (`scatole`), site.js del
   completo per il segno di lettura (`letto:<pagina>`, quando la pagina si
   nasconde e al piu' ogni cinque minuti). `studio-tappe`, `studio-masterplan`,
   `studio-lezione` li scrivera' la home di /studio (S4).

   NIENTE account.js. Il token si legge da `appunti-tok`, come fa gia' la coda
   degli eventi (`_coda_studio_js` in site_build.py): /studio non carica i
   70 KB dell'account per sapere chi sei.

   API — global.Sync (e module.exports in node)
     unisci(locale, remoto)         -> {voci, scrivi, spingi, guasti, persi,
                                        uniti, daParte}                       PURA
     unisciTappe(base, qui, la, ctx), unisciScatole(base, qui, la, ctx)       PURE
     fondiItems(cache, righe)       -> cache nuova                             PURA
     perPiano(stato[, opz])         -> {tappe, sbagliate, scatole, fonti}       PURA
     itemTappa(parte, tappa), leggiItemTappa(item), parteDi(item)              PURE
     canon(x), impronta(testo)                                                 PURE
     leggi(storage)                 -> lo stato di qui (quello che perPiano legge)
     tira(opz)                      -> Promise<rapporto>   legge dal server e unisce
     spingi(nome[, opz])            -> bool                segna «da spedire»
     svuota(opz)                    -> Promise<rapporto>   spedisce cio' che e' segnato
     avvia(opz)                     -> Promise<rapporto>   la pagina: predefinite + prima
                                       lettura + nascosta/in vista (una volta sola)
     rileggi(forza)                 -> Promise<rapporto|null> una lettura, col freno
     legato([opz])                  -> utente | null       di chi sono i dati, se il
                                       token di adesso e' quello del legame
     inAttesa([opz])                -> bool                dati legati a un account e
                                       token non (ancora) confermato: chi li mostra
                                       aspetta (revisione S2b)
     chiaveLocale(nome), sincronizzabile(nome), ESITO_TAPPA, TAPPE, VERSIONE
   `opz` delle tre strade: {api (l'indirizzo del Worker, obbligatorio), storage
   (localStorage), fetch, adesso (-> millisecondi), token (-> stringa), timer
   ({set, clear}), subito (spingi spedisce senza aspettare)}. Tutto si puo'
   passare da fuori: e' cosi' che le prove girano senza browser e senza rete.

   I SALVATAGGI (`study_kv` sul server) — REGISTRO qui sotto
     Un NOME sul server corrisponde a UNA chiave del browser. Si sincronizza
     SOLO cio' che sta nel registro: un nome che arriva dal server e non ci sta
     non viene mai scritto nel browser (`appunti-tok`, `appunti-chi`,
     `studio-coda` e le chiavi di questo modulo non sono sincronizzabili, e non
     lo diventano per un valore arrivato da fuori).
     Sul server il valore e' una busta JSON {t, d}: `d` il dato, `t` quando e'
     stato salvato (millisecondi, ORA DEL SERVER stimata dal dispositivo).

   UN BROWSER, UN ACCOUNT. Il primo `tira` riuscito lega i salvataggi di questo
   browser all'account del token (`utente`) e a un'impronta del token. `svuota`
   non spedisce niente se il token di adesso non e' quello del legame (serve
   prima una lettura), e manda `utente` al Worker, che rifiuta con 409 dati di un
   altro account. Se sul browser entra un altro account, i salvataggi di prima si
   mettono da parte col nome del loro account e si tolgono; quando quell'account
   rientra, cio' che non era mai arrivato al server torna in gioco — ma solo se il
   contenuto e' quello che uno `spingi` ha segnato col token del legame (`h`):
   un valore cambiato quando il token non era quello del legame resta «dubbio»
   (revisione S2b, vedi cambiaAccount), e finche' il token non e' confermato
   `inAttesa()` dice a chi mostra i dati di aspettare.

   LO STATO DI QUI, in localStorage (la fetta legale deve dichiararle tutte):
     studio-sync             {v, utente, impronta, since, scarto, legato,
                              voci:{nome:{base, t, sporca, h, stato}}}
                             utente = di chi sono i salvataggi di questo browser;
                             impronta = del token del legame (non il token);
                             since = il cursore; scarto = ora del server meno
                             ora di qui; legato = quando e' entrato l'account
                             di adesso; base = la versione del server da cui
                             parte il valore di qui; t = quando e' stato
                             toccato; sporca = da spedire; stato = perche' non
                             parte («troppo-grande» o il motivo del Worker);
                             h = l'impronta del contenuto segnato col token del
                             legame (di chi e' il valore, vedi cambiaAccount)
     studio-sync.basi        {v, voci:{nome:{base, g}}}: il CONTENUTO della
                             versione di base (forma canonica): dice se un
                             valore e' stato toccato e serve all'unione
     studio-sync.items       {v, items:{item:{k, e, u, a}}}: dal server, solo cio'
                             che serve al piano (tappe; domande ancora sbagliate)
     studio-sync.precedente  {v, voci:{chiave:[{grezzo, motivo, quando, utente,
                             ...}]}}: cio' che un salvataggio non poteva tenere e
                             che NON si butta, al massimo MAX_DA_PARTE voci per
                             chiave e per account (la piu' vecchia di QUELL'account
                             esce; le voci di un altro account mai)
     studio-tappe, studio-masterplan, studio-lezione   (nuove: le scrive la home
                             di /studio, S4; qui si sincronizzano soltanto)
   ===================================================================== */

(function (global) {
  'use strict';

  var VERSIONE = 2;
  var CHIAVE_META = 'studio-sync';
  var CHIAVE_ITEMS = 'studio-sync.items';
  var CHIAVE_PRECEDENTE = 'studio-sync.precedente';
  var CHIAVE_BASI = 'studio-sync.basi';
  var CHIAVE_TOKEN = 'appunti-tok';
  var CHIAVE_REGISTRO_QUIZ = 'quiz.v1.sbagliate';   // di quiz.js: qui si LEGGE soltanto

  /* Gli stessi numeri del Worker (account/worker.js): se cambiano la', qui si
     cambiano insieme (un collaudo li confronta). Un valore troppo grande non si
     manda nemmeno: resta segnato e lo si dice. */
  var KV_MAX_VOCI = 25;
  var KV_VALORE_MAX = 65536;
  var RE_NOME = /^[A-Za-z0-9][A-Za-z0-9._:\/#-]{0,63}$/;   /* = KV_NOME_RE del Worker */
  var MAX_PAGINE = 20;            // una lettura non gira all'infinito
  var MAX_GIRI_SPINTA = 3;        // conflitto -> unione -> nuova spinta: non oltre
  var ATTESA_SPINTA_MS = 2000;    // spingi aspetta 2 s di quiete
  var MAX_DA_PARTE = 5;           // voci messe da parte per chiave e per account

  /* La tappa si giudica con gli esiti degli eventi (Worker, ESITO_TAPPA). */
  var ESITO_TAPPA = { ok: 'so', quasi: 'incerto', ko: 'no' };
  var TAPPE = ['capisci', 'fai', 'richiama', 'nonCascarci'];
  var RE_GIORNO = /^(\d{4})-(\d{2})-(\d{2})$/;
  /* La PARTE di un item. Gli id delle domande hanno anche il TITOLO nello slug
     (s1f07_termodinamica_..._e-A-mcq-001: STUDY_IDS.json, 1304 domande su 15037
     il 2026-09-29), quelli delle carte e degli esercizi la forma corta
     (s1f01-A#A01): tutte e due danno la parte `s1f07-A`. La prima stesura
     leggeva solo la forma corta e perdeva in silenzio le domande sbagliate di
     meta' delle lezioni di fisica. */
  var RE_PARTE = /^(s[12][fcb]\d{2})(?:_[a-z0-9_]*)?-([AB])(?:-|#)/;
  var RE_TAPPA = /^tappa:(s[12][fcb]\d{2}-[AB]):([A-Za-z]+)$/;
  var RE_PAGINA_LEZIONE = /(?:^|\/)(s[12][fcb]\d{2})\.html$/;

  /* ------------------------------------------------------------------ *
   * piccoli attrezzi                                                    *
   * ------------------------------------------------------------------ */
  function eArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function eOggetto(x) { return !!x && typeof x === 'object' && !eArray(x); }
  function proprio(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function presente(x) { return x !== undefined && x !== null; }
  function eNumero(x) { return typeof x === 'number' && isFinite(x); }
  function eIntero(x) { return eNumero(x) && Math.floor(x) === x && x >= 0; }
  function eGiorno(s) {
    var m = typeof s === 'string' ? RE_GIORNO.exec(s) : null;
    if (!m) return false;
    var a = Number(m[1]), mm = Number(m[2]), g = Number(m[3]);
    var d = new Date(Date.UTC(a, mm - 1, g));
    return d.getUTCFullYear() === a && d.getUTCMonth() === mm - 1 && d.getUTCDate() === g;
  }
  /* un giorno 'AAAA-MM-GG' -> millisecondi del suo INIZIO (per confrontarlo
     con un `t` vero: a pari giorno vince chi ha l'ora) */
  function msGiorno(s) {
    if (!eGiorno(s)) return null;
    var p = s.split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* il giorno LOCALE del dispositivo (non toISOString, che e' UTC e fra
     mezzanotte e l'una dice ancora ieri) */
  function giornoLocale(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function maxGiorno(a, b) { return !a ? b : (!b ? a : (a > b ? a : b)); }
  function chiavi(o) {
    var l = [], k;
    if (eOggetto(o)) for (k in o) if (proprio(o, k)) l.push(k);
    return l;
  }
  function unione(a, b) {
    var visti = {}, l = [], i;
    for (i = 0; i < a.length; i++) if (!proprio(visti, a[i])) { visti[a[i]] = true; l.push(a[i]); }
    for (i = 0; i < b.length; i++) if (!proprio(visti, b[i])) { visti[b[i]] = true; l.push(b[i]); }
    return l;
  }

  /* LA FORMA CANONICA di un dato: JSON con le chiavi in ordine. Due dati uguali
     hanno la stessa forma qualunque sia l'ordine in cui un motore ha scritto le
     chiavi: e' cosi' che «toccato» si misura sul contenuto e non sulla forma. */
  function canon(x) {
    if (x === undefined) return undefined;
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    var i, p = [];
    if (eArray(x)) {
      for (i = 0; i < x.length; i++) p.push(x[i] === undefined || typeof x[i] === 'function' ? 'null' : canon(x[i]));
      return '[' + p.join(',') + ']';
    }
    var k = chiavi(x).sort();
    for (i = 0; i < k.length; i++) {
      if (x[k[i]] === undefined || typeof x[k[i]] === 'function') continue;
      p.push(JSON.stringify(k[i]) + ':' + canon(x[k[i]]));
    }
    return '{' + p.join(',') + '}';
  }
  function uguale(a, b) { return canon(a) === canon(b); }

  /* L'IMPRONTA di un testo: 16 cifre esadecimali (FNV-1a a 32 bit, due volte con
     due semi). Serve a riconoscere se il token e' ancora quello del legame e se
     un valore e' cambiato: non e' un segreto (il token sta in chiaro accanto). */
  function hash32(s, seme) {
    var h = seme >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h;
  }
  function esa8(n) { var s = n.toString(16); while (s.length < 8) s = '0' + s; return s; }
  function impronta(testo) {
    var s = String(testo);
    return esa8(hash32(s, 0x811c9dc5)) + esa8(hash32(s, 0x01000193 ^ s.length));
  }

  /* ------------------------------------------------------------------ *
   * le UNIONI per record (regola 2)                                     *
   * ------------------------------------------------------------------ */
  /* `ctx` = {tQui, tLa}: quando e' stato toccato il valore di qui e quello del
     server. Quando un campo e' cambiato da tutte e due le parti vince quello
     salvato piu' tardi; a pari ora vince la forma canonica maggiore (una regola
     uguale per tutti i dispositivi). `st` tiene il conto di chi ha perso qualcosa:
     persiQui = una modifica di qui battuta, persiLa = una del server. */
  function vinceQui(ctx, q, l) {
    var tq = eNumero(ctx && ctx.tQui) ? ctx.tQui : -Infinity;
    var tl = eNumero(ctx && ctx.tLa) ? ctx.tLa : -Infinity;
    if (tq !== tl) return tq > tl;
    return String(canon(q)) > String(canon(l));
  }
  /* un campo, a tre vie: cambiato da una parte sola -> quella; da tutte e due ->
     il salvataggio piu' recente (e chi perde lo si annota) */
  function campo3(b, q, l, st) {
    if (uguale(q, l)) return q;
    if (b !== undefined && uguale(q, b)) return l;
    if (b !== undefined && uguale(l, b)) return q;
    if (vinceQui(st.ctx, q, l)) { if (l !== undefined) st.persiLa = true; return q; }
    if (q !== undefined) st.persiQui = true;
    return l;
  }
  /* un oggetto per chiave, a tre vie: una chiave che c'era nella base e che una
     parte ha tolto senza che l'altra la toccasse resta tolta; una tolta da una
     parte e cambiata dall'altra resta, cambiata (e chi l'aveva tolta «perde»).
     `perVoce(b, q, l, st)` decide quando ci sono tutte e due. */
  function unisciPerChiave(base, qui, la, perVoce, st) {
    var B = eOggetto(base) ? base : null, Q = eOggetto(qui) ? qui : {}, L = eOggetto(la) ? la : {};
    var out = {}, nomi = unione(chiavi(L), chiavi(Q)).sort(), i;
    for (i = 0; i < nomi.length; i++) {
      var k = nomi[i], q = Q[k], l = L[k], b = B ? B[k] : undefined;
      if (q !== undefined && l !== undefined) { var v = perVoce(b, q, l, st); if (v !== undefined) out[k] = v; continue; }
      var solo = q !== undefined ? q : l;
      if (b !== undefined && uguale(solo, b)) continue;              // tolta dall'altra parte
      if (b !== undefined) { if (q !== undefined) st.persiLa = true; else st.persiQui = true; }
      out[k] = solo;
    }
    return out;
  }

  /* LE TAPPE {parte: {tappa: 'AAAA-MM-GG' | {fatto, esito}}}: tappa per tappa,
     vince il giorno piu' recente; a pari giorno il salvataggio piu' recente. */
  function giornoTappa(x) { return typeof x === 'string' ? x : (eOggetto(x) && typeof x.fatto === 'string' ? x.fatto : ''); }
  function unisciTappa(b, q, l, st) {
    if (uguale(q, l)) return q;
    if (b !== undefined && uguale(q, b)) return l;
    if (b !== undefined && uguale(l, b)) return q;
    var gq = giornoTappa(q), gl = giornoTappa(l);
    var qui = gq !== gl ? gq > gl : vinceQui(st.ctx, q, l);
    if (qui) st.persiLa = true; else st.persiQui = true;
    return qui ? q : l;
  }
  function unisciTappe(base, qui, la, ctx) {
    var st = { persiQui: false, persiLa: false, ctx: ctx || {} };
    var d = unisciPerChiave(base, qui, la, function (b, q, l, s) {
      if (!eOggetto(q) || !eOggetto(l)) return campo3(b, q, l, s);   // una parte illeggibile: a tre vie intera
      return unisciPerChiave(eOggetto(b) ? b : null, q, l, unisciTappa, s);
    }, st);
    return { d: d, persiQui: st.persiQui, persiLa: st.persiLa };
  }

  /* LE SCATOLE (`scatole.v1.studio`, la forma di scatole.js):
       esami      per id: i campi a tre vie; il calendario (`giorni`) giorno per
                  giorno, e un ripasso fatto (con `esito`) batte un'uscita
                  ancora aperta; `ultimoGiorno` e' il piu' avanti dei due;
       argomenti  per id: il RIPASSO (track, box, ultimo, ripassi) viaggia intero
                  dalla parte con il ripasso piu' recente (poi la scatola piu'
                  alta, poi piu' ripassi, poi il salvataggio piu' recente); gli
                  altri campi a tre vie;
     poi si rimette d'accordo il calendario con `pendente`, come fa scatole.js:
     un'uscita aperta rende «pendente» il suo argomento in quel giorno, un
     argomento senza uscita aperta non e' pendente, un'uscita di un argomento
     che non c'e' piu' se ne va (come fa `elimina`). Un argomento di un esame che
     non c'e' piu' invece RESTA: lo toglie il motore quando carica (`normalizza`),
     e la sincronizzazione non butta dati che non e' lei a interpretare.
     Per dire se un record e' stato «toccato» (e quindi se una cancellazione
     dall'altra parte vale) non contano i campi che il motore ricalcola da solo:
     `ultimoGiorno`, le uscite ancora aperte, `pendente`, `piano`. */
  var GRUPPO_RIPASSO = ['track', 'box', 'ultimo', 'ripassi'];
  var DERIVATI_ARGOMENTO = ['pendente', 'piano'];
  function senza(x, via) {
    var o = {}, k = chiavi(x), i;
    for (i = 0; i < k.length; i++) if (via.indexOf(k[i]) < 0) o[k[i]] = x[k[i]];
    return o;
  }
  function essenzaEsame(e) {
    if (!eOggetto(e)) return e;
    var o = senza(e, ['ultimoGiorno', 'giorni']), g = {}, k = chiavi(e.giorni), i;
    for (i = 0; i < k.length; i++) if (eOggetto(e.giorni[k[i]]) && e.giorni[k[i]].esito) g[k[i]] = e.giorni[k[i]];
    o.giorni = g;
    return o;
  }
  function essenzaArgomento(a) { return eOggetto(a) ? senza(a, DERIVATI_ARGOMENTO) : a; }
  function numero(x) { return eNumero(Number(x)) ? Number(x) : 0; }

  function unisciUscita(b, q, l, st) {
    if (uguale(q, l)) return q;
    if (b !== undefined && uguale(q, b)) return l;
    if (b !== undefined && uguale(l, b)) return q;
    var fq = eOggetto(q) && !!q.esito, fl = eOggetto(l) && !!l.esito;
    var qui = fq !== fl ? fq : vinceQui(st.ctx, q, l);
    /* perde qualcosa solo chi perde un ripasso FATTO: un'uscita ancora aperta la
       ricalcola il motore */
    if (qui && fl) st.persiLa = true;
    if (!qui && fq) st.persiQui = true;
    return qui ? q : l;
  }
  function unisciEsame(b, q, l, st) {
    if (uguale(q, l)) return q;
    var out = {}, nomi = unione(chiavi(l), chiavi(q)), i;
    for (i = 0; i < nomi.length; i++) {
      var k = nomi[i];
      if (k === 'giorni' || k === 'ultimoGiorno') continue;
      var v = campo3(eOggetto(b) ? b[k] : undefined, q[k], l[k], st);
      if (v !== undefined) out[k] = v;
    }
    out.giorni = unisciPerChiave(eOggetto(b) ? b.giorni : null, q.giorni, l.giorni, unisciUscita, st);
    var ug = maxGiorno(eGiorno(q.ultimoGiorno) ? q.ultimoGiorno : null, eGiorno(l.ultimoGiorno) ? l.ultimoGiorno : null);
    out.ultimoGiorno = ug || (presente(l.ultimoGiorno) ? l.ultimoGiorno : (presente(q.ultimoGiorno) ? q.ultimoGiorno : null));
    return out;
  }
  function gruppo(a) { var o = {}, i; for (i = 0; i < GRUPPO_RIPASSO.length; i++) o[GRUPPO_RIPASSO[i]] = a[GRUPPO_RIPASSO[i]]; return o; }
  function unisciArgomento(b, q, l, st) {
    if (uguale(q, l)) return q;
    var gq = gruppo(q), gl = gruppo(l), gb = eOggetto(b) ? gruppo(b) : undefined, daQui;
    if (uguale(gq, gl)) daQui = true;
    else if (gb !== undefined && uguale(gq, gb)) daQui = false;
    else if (gb !== undefined && uguale(gl, gb)) daQui = true;
    else {
      var uq = eGiorno(q.ultimo) ? q.ultimo : '', ul = eGiorno(l.ultimo) ? l.ultimo : '';
      if (uq !== ul) daQui = uq > ul;
      else if (numero(q.box) !== numero(l.box)) daQui = numero(q.box) > numero(l.box);
      else if (numero(q.ripassi) !== numero(l.ripassi)) daQui = numero(q.ripassi) > numero(l.ripassi);
      else daQui = vinceQui(st.ctx, gq, gl);
      if (daQui) st.persiLa = true; else st.persiQui = true;
    }
    var src = daQui ? q : l, out = {}, nomi = unione(chiavi(l), chiavi(q)), i, k;
    for (i = 0; i < nomi.length; i++) {
      k = nomi[i];
      if (GRUPPO_RIPASSO.indexOf(k) >= 0 || DERIVATI_ARGOMENTO.indexOf(k) >= 0) {
        if (proprio(src, k)) out[k] = src[k];
        continue;
      }
      var v = campo3(eOggetto(b) ? b[k] : undefined, q[k], l[k], st);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  /* una lista di record con `id`: l'ordine del server, poi i nuovi di qui. Un
     record senza `id` (fuori dalla forma di scatole.js) non si sa accoppiare: resta
     quello del server, e di qui quelli che il server non ha uguali */
  function unisciLista(base, qui, la, perRecord, essenza, st) {
    function indice(lista) {
      var m = {}, ordine = [], anonimi = [], i;
      for (i = 0; eArray(lista) && i < lista.length; i++) {
        var x = lista[i];
        if (eOggetto(x) && typeof x.id === 'string') {
          if (!proprio(m, x.id)) { m[x.id] = x; ordine.push(x.id); }
        } else anonimi.push(x);
      }
      return { m: m, ordine: ordine, anonimi: anonimi };
    }
    var B = eArray(base) ? indice(base) : null, Q = indice(qui), L = indice(la);
    var ordine = unione(L.ordine, Q.ordine), out = [], i;
    for (i = 0; i < ordine.length; i++) {
      var id = ordine[i];
      var q = proprio(Q.m, id) ? Q.m[id] : undefined, l = proprio(L.m, id) ? L.m[id] : undefined;
      var b = B && proprio(B.m, id) ? B.m[id] : undefined;
      if (q !== undefined && l !== undefined) { out.push(perRecord(b, q, l, st)); continue; }
      var solo = q !== undefined ? q : l;
      if (b !== undefined && uguale(essenza(solo), essenza(b))) continue;   // cancellato dall'altra parte
      if (b !== undefined) { if (q !== undefined) st.persiLa = true; else st.persiQui = true; }
      out.push(solo);
    }
    var visti = {};
    for (i = 0; i < L.anonimi.length; i++) { out.push(L.anonimi[i]); visti[canon(L.anonimi[i])] = true; }
    for (i = 0; i < Q.anonimi.length; i++) if (!proprio(visti, canon(Q.anonimi[i]))) out.push(Q.anonimi[i]);
    return out;
  }
  function unisciScatole(base, qui, la, ctx) {
    var st = { persiQui: false, persiLa: false, ctx: ctx || {} };
    var b = leggeScatole(base) ? base : null;
    /* (copie: il ritocco qui sotto non deve toccare gli ingressi, che possono
       essere gli stessi oggetti) */
    var esami = JSON.parse(JSON.stringify(unisciLista(b && b.esami, qui.esami, la.esami, unisciEsame, essenzaEsame, st)));
    var perEsame = {}, i, j, k;
    for (i = 0; i < esami.length; i++) if (eOggetto(esami[i]) && typeof esami[i].id === 'string') perEsame[esami[i].id] = esami[i];
    /* un argomento il cui esame non c'e' piu' RESTA: lo toglie il motore quando
       carica (`normalizza`), non la sincronizzazione, che non butta cio' che non
       e' suo decidere */
    var argomenti = JSON.parse(JSON.stringify(unisciLista(b && b.argomenti, qui.argomenti, la.argomenti, unisciArgomento, essenzaArgomento, st)));
    var perId = {};
    for (i = 0; i < argomenti.length; i++) if (eOggetto(argomenti[i]) && typeof argomenti[i].id === 'string') perId[argomenti[i].id] = argomenti[i];
    /* il calendario e `pendente` d'accordo */
    for (i = 0; i < esami.length; i++) {
      if (!eOggetto(esami[i]) || !eOggetto(esami[i].giorni)) continue;
      var g = esami[i].giorni, date = chiavi(g);
      for (j = 0; j < date.length; j++) {
        var u = g[date[j]];
        if (!eOggetto(u) || !proprio(perId, u.t) || perId[u.t].esame !== esami[i].id) delete g[date[j]];
      }
    }
    for (i = 0; i < argomenti.length; i++) {
      var a = argomenti[i];
      if (!eOggetto(a) || !a.pendente) continue;
      var e = proprio(perEsame, a.esame) ? perEsame[a.esame] : null;
      var slot = e && eOggetto(e.giorni) && proprio(e.giorni, a.pendente) ? e.giorni[a.pendente] : undefined;
      if (!eOggetto(slot) || slot.t !== a.id || slot.esito) a.pendente = null;
    }
    for (i = 0; i < esami.length; i++) {
      if (!eOggetto(esami[i]) || !eOggetto(esami[i].giorni)) continue;
      var gg = esami[i].giorni, dd = chiavi(gg).sort();
      for (k = 0; k < dd.length; k++) {
        var s = gg[dd[k]], ar = s && !s.esito ? perId[s.t] : null;
        if (ar && !ar.pendente) ar.pendente = dd[k];
      }
    }
    var out = {}, nomi = unione(chiavi(la), chiavi(qui));
    for (i = 0; i < nomi.length; i++) if (nomi[i] !== 'esami' && nomi[i] !== 'argomenti') out[nomi[i]] = proprio(la, nomi[i]) ? la[nomi[i]] : qui[nomi[i]];
    out.esami = esami;
    out.argomenti = argomenti;
    return { d: out, persiQui: st.persiQui, persiLa: st.persiLa };
  }

  /* ------------------------------------------------------------------ *
   * IL REGISTRO dei salvataggi sincronizzati                            *
   * ------------------------------------------------------------------ */
  /* `tempo(d)`: quando e' stato salvato un valore di cui il browser non sa
     l'ora (dati di prima della sincronizzazione), letto dal dato stesso. Serve
     alla prima unione di un dispositivo: senza, un valore di qui senza ora
     perderebbe SEMPRE contro quello del server, anche se e' il piu' recente. */
  function tempoTappe(d) {
    var m = null, p, t, x;
    for (p in d) {
      if (!proprio(d, p) || !eOggetto(d[p])) continue;
      for (t = 0; t < TAPPE.length; t++) {
        x = d[p][TAPPE[t]];
        m = maxGiorno(m, typeof x === 'string' ? x : (eOggetto(x) ? x.fatto : null));
      }
    }
    return eGiorno(m) ? msGiorno(m) : null;
  }
  function tempoMasterplan(d) {
    if (eNumero(d.aggiornato)) return d.aggiornato;
    return eGiorno(d.aggiornato) ? msGiorno(d.aggiornato) : null;
  }
  function tempoScatole(d) {
    var m = null, i, k, a, e;
    for (i = 0; i < d.argomenti.length; i++) {
      a = d.argomenti[i];
      if (!eOggetto(a)) continue;
      if (eGiorno(a.ultimo)) m = maxGiorno(m, a.ultimo);
      if (eGiorno(a.creato)) m = maxGiorno(m, a.creato);
    }
    for (i = 0; i < d.esami.length; i++) {
      e = d.esami[i];
      if (!eOggetto(e)) continue;
      if (eGiorno(e.inizio)) m = maxGiorno(m, e.inizio);
      if (eOggetto(e.giorni)) for (k in e.giorni) if (proprio(e.giorni, k) && eGiorno(k)) m = maxGiorno(m, k);
    }
    return m ? msGiorno(m) : null;
  }
  function tempoLetto(d) {
    var m = /\|(\d{9,12})$/.exec(d);
    return m ? Number(m[1]) * 1000 : null;
  }
  function leggeScatole(d) { return eOggetto(d) && eArray(d.esami) && eArray(d.argomenti); }
  function leggeLetto(d) { return typeof d === 'string' && d.length <= 300; }

  var REGISTRO = [
    { nome: 'studio-tappe', chiave: 'studio-tappe', forma: 'json', legge: eOggetto, tempo: tempoTappe,
      unisci: unisciTappe },
    { nome: 'studio-masterplan', chiave: 'studio-masterplan', forma: 'json', legge: eOggetto, tempo: tempoMasterplan },
    { nome: 'studio-lezione', chiave: 'studio-lezione', forma: 'json', legge: presente, tempo: null },
    { nome: 'scatole', chiave: 'scatole.v1.studio', forma: 'json', legge: leggeScatole, tempo: tempoScatole,
      unisci: unisciScatole },
    /* il punto di lettura: `appunti-letto:<pagina>` -> `letto:<pagina>`, uno per pagina */
    { prefisso: 'letto:', chiave: 'appunti-letto:', forma: 'testo', legge: leggeLetto, tempo: tempoLetto }
  ];

  /* nome -> {voce del registro, chiave locale}, oppure null */
  function risolvi(nome) {
    /* un nome che il Worker rifiuterebbe non e' sincronizzabile nemmeno qui */
    if (typeof nome !== 'string' || !RE_NOME.test(nome)) return null;
    for (var i = 0; i < REGISTRO.length; i++) {
      var r = REGISTRO[i];
      if (r.nome && r.nome === nome) return { reg: r, chiave: r.chiave };
      if (r.prefisso && nome.indexOf(r.prefisso) === 0 && nome.length > r.prefisso.length) {
        return { reg: r, chiave: r.chiave + nome.slice(r.prefisso.length) };
      }
    }
    return null;
  }
  function chiaveLocale(nome) { var r = risolvi(nome); return r ? r.chiave : null; }
  function sincronizzabile(nome) { return !!risolvi(nome); }
  /* chiave locale -> nome, oppure null (per ritrovare i `letto:` presenti) */
  function nomeDaChiave(chiave) {
    for (var i = 0; i < REGISTRO.length; i++) {
      var r = REGISTRO[i];
      if (r.nome && r.chiave === chiave) return r.nome;
      if (r.prefisso && chiave.indexOf(r.chiave) === 0 && chiave.length > r.chiave.length) {
        var nome = r.prefisso + chiave.slice(r.chiave.length);
        return RE_NOME.test(nome) ? nome : null;
      }
    }
    return null;
  }
  /* la forma canonica di un dato di `nome` (per un nome fuori registro: JSON) */
  function canonDi(nome, d) {
    var r = risolvi(nome);
    if (r && r.reg.forma === 'testo') return typeof d === 'string' ? d : undefined;
    return canon(d);
  }

  /* ------------------------------------------------------------------ *
   * leggere e scrivere un valore                                        *
   * ------------------------------------------------------------------ */
  /* un grezzo del browser -> {d, guasto}. Guasto = c'e' ma non si sa leggere. */
  function interpreta(reg, grezzo) {
    var d;
    if (reg.forma === 'testo') d = grezzo;
    else { try { d = JSON.parse(grezzo); } catch (e) { return { d: undefined, guasto: true }; } }
    return reg.legge(d) ? { d: d, guasto: false } : { d: undefined, guasto: true };
  }

  /* la busta del server -> {d, t, guasto} */
  function apriBusta(nome, v) {
    var r = risolvi(nome), b;
    if (!r || typeof v !== 'string') return { d: undefined, t: null, guasto: true };
    try { b = JSON.parse(v); } catch (e) { return { d: undefined, t: null, guasto: true }; }
    if (!eOggetto(b) || !proprio(b, 'd') || !eNumero(b.t) || b.t < 0) return { d: undefined, t: null, guasto: true };
    if (r.reg.forma === 'testo' && typeof b.d !== 'string') return { d: undefined, t: null, guasto: true };
    if (!r.reg.legge(b.d)) return { d: undefined, t: null, guasto: true };
    return { d: b.d, t: b.t, guasto: false };
  }
  function busta(d, t) { return JSON.stringify({ t: t, d: d }); }

  function prendi(storage, chiave) {
    try { return storage.getItem(chiave); } catch (e) { return null; }
  }
  function metti(storage, chiave, grezzo) {
    try { storage.setItem(chiave, grezzo); return true; } catch (e) { return false; }
  }
  function grezzoDi(reg, d) { return reg.forma === 'testo' ? String(d) : JSON.stringify(d); }
  function leggiJson(storage, chiave) {
    try { return JSON.parse(prendi(storage, chiave) || 'null'); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ *
   * lo stato di questo modulo in localStorage                           *
   * ------------------------------------------------------------------ */
  function metaVuota() {
    return { v: VERSIONE, utente: null, impronta: null, since: 0, scarto: 0, legato: null, voci: {} };
  }
  function leggiMeta(storage) {
    var m = leggiJson(storage, CHIAVE_META);
    if (!eOggetto(m) || m.v !== VERSIONE) {
      /* nessun meta, o di un'altra versione: si riparte dal cursore 0 e SENZA
         impronta (prima di spedire serve una lettura riuscita), ma si tengono
         utente e voci se si sanno leggere: le modifiche da spedire non si
         buttano per un cambio di formato */
      var n = metaVuota();
      if (eOggetto(m)) {
        if (typeof m.utente === 'string' && m.utente) n.utente = m.utente;
        if (eOggetto(m.voci)) n.voci = m.voci;
      }
      return n;
    }
    if (!(typeof m.utente === 'string' && m.utente)) m.utente = null;
    if (typeof m.impronta !== 'string') m.impronta = null;
    if (!eIntero(m.since)) m.since = 0;
    if (!eNumero(m.scarto)) m.scarto = 0;
    if (!eNumero(m.legato)) m.legato = null;
    if (!eOggetto(m.voci)) m.voci = {};
    return m;
  }
  function salvaMeta(storage, m) { return metti(storage, CHIAVE_META, JSON.stringify(m)); }
  function voceMeta(m, nome) {
    var v = m.voci[nome];
    return eOggetto(v) ? v : { base: null, t: null, sporca: false };
  }
  function basiVuote() { return { v: VERSIONE, voci: {} }; }
  function leggiBasi(storage) {
    var b = leggiJson(storage, CHIAVE_BASI);
    return eOggetto(b) && b.v === VERSIONE && eOggetto(b.voci) ? b : basiVuote();
  }
  function salvaBasi(storage, b) { return metti(storage, CHIAVE_BASI, JSON.stringify(b)); }
  function cacheVuota() { return { v: VERSIONE, items: {} }; }
  function leggiItems(storage) {
    var c = leggiJson(storage, CHIAVE_ITEMS);
    return eOggetto(c) && c.v === VERSIONE && eOggetto(c.items) ? c : cacheVuota();
  }
  /* l'ora del server, stimata da qui (lo scarto lo misura ogni lettura) */
  function oraServer(amb, meta) { return amb.adesso() + (eNumero(meta.scarto) ? meta.scarto : 0); }

  /* un valore di qui, com'e' ora: null se non c'e'.
       g      la sua forma canonica (null se illeggibile)
       gBase  la forma canonica della versione di base, se la si conosce
       sporca TOCCATO: diverso dalla base (se la base e' nota), mai arrivato al
              server (base null), oppure, se la base non si conosce, il segno
              lasciato da `spingi` */
  function leggiLocale(storage, meta, basi, nome) {
    var r = risolvi(nome);
    if (!r) return null;
    var grezzo = prendi(storage, r.chiave);
    if (grezzo === null || grezzo === undefined) return null;
    var x = interpreta(r.reg, grezzo);
    var vm = voceMeta(meta, nome);
    var base = eIntero(vm.base) ? vm.base : null;
    var bb = basi && eOggetto(basi.voci) && eOggetto(basi.voci[nome]) ? basi.voci[nome] : null;
    var gBase = bb && base !== null && bb.base === base && typeof bb.g === 'string' ? bb.g : null;
    var g = x.guasto ? null : canonDi(nome, x.d);
    var sporca;
    if (x.guasto) sporca = false;
    else if (base === null) sporca = true;
    else if (gBase !== null) sporca = g !== gBase;
    else sporca = vm.sporca === true;
    var dBase;
    if (gBase !== null) {
      if (r.reg.forma === 'testo') dBase = gBase;
      else { try { dBase = JSON.parse(gBase); } catch (e) { dBase = undefined; } }
    }
    var t = eNumero(vm.t) ? vm.t : (!x.guasto && r.reg.tempo ? r.reg.tempo(x.d) : null);
    return { d: x.d, guasto: x.guasto, grezzo: grezzo, g: g, gBase: gBase, dBase: dBase,
             t: eNumero(t) ? t : null, base: base, sporca: sporca };
  }

  /* i nomi dei salvataggi presenti in questo browser (fissi + `letto:<pagina>`) */
  function nomiLocali(storage) {
    var fuori = {}, i, nome;
    for (i = 0; i < REGISTRO.length; i++) {
      if (REGISTRO[i].nome && prendi(storage, REGISTRO[i].chiave) !== null) fuori[REGISTRO[i].nome] = true;
    }
    try {
      for (i = 0; i < storage.length; i++) {
        var k = storage.key(i);
        nome = k ? nomeDaChiave(k) : null;
        if (nome) fuori[nome] = true;
      }
    } catch (e) { /* storage che non si sa scorrere: restano i nomi fissi */ }
    return chiavi(fuori).sort();
  }

  /* MESSO DA PARTE, MAI BUTTATO. Una LISTA per chiave (la prima stesura ne teneva
     uno solo, e il secondo conflitto cancellava il primo); al massimo
     MAX_DA_PARTE voci per chiave e per account: esce la piu' vecchia di QUELLO
     stesso account, mai una di un altro. Rende false se non si e' potuto
     scrivere (memoria piena): chi chiama allora non tocca il valore. */
  function leggiPrecedente(storage) {
    var p = leggiJson(storage, CHIAVE_PRECEDENTE);
    if (!eOggetto(p) || !eOggetto(p.voci)) return { v: VERSIONE, voci: {} };
    var k = chiavi(p.voci), i;
    for (i = 0; i < k.length; i++) {
      var x = p.voci[k[i]];
      p.voci[k[i]] = eArray(x) ? x : (eOggetto(x) ? [x] : []);   /* la forma della prima stesura: una voce */
    }
    p.v = VERSIONE;
    return p;
  }
  function mettiDaParte(storage, chiave, voce) {
    var p = leggiPrecedente(storage);
    var lista = eArray(p.voci[chiave]) ? p.voci[chiave] : [];
    lista.push(voce);
    for (;;) {
      var suoi = [], i;
      for (i = 0; i < lista.length; i++) if (eOggetto(lista[i]) && lista[i].utente === voce.utente) suoi.push(i);
      if (suoi.length <= MAX_DA_PARTE) break;
      lista.splice(suoi[0], 1);
    }
    p.voci[chiave] = lista;
    return metti(storage, CHIAVE_PRECEDENTE, JSON.stringify(p));
  }

  /* ------------------------------------------------------------------ *
   * LA REGOLA: unisci                                                   *
   * ------------------------------------------------------------------ */
  /* PURA: non legge e non scrive niente.
       locale {nome: {d, t, base, sporca, guasto, g?, gBase?, dBase?, grezzo?}}
       remoto {nome: {d, t, agg, guasto}}        (agg = la versione, updated_at)
     Rende {voci: {nome: {d, t, base, g, sporca}}, scrivi, spingi, guasti, persi,
            uniti, daParte: [{nome, grezzo, motivo}]}:
       scrivi   il valore in voci va scritto qui;
       spingi   il valore di qui va spedito (con base = la versione del server);
       guasti   il valore di qui era ILLEGGIBILE e viene sostituito;
       persi    una modifica di qui battuta (del tutto o in parte);
       uniti    unito per record (regola 2);
       daParte  cosa mettere da parte, e perche' (regola 4);
       g        la forma canonica della versione di base che il nuovo valore ha.
     Le regole, una per riga (la n. 1-4 sono quelle dell'intestazione):
       a. un valore illeggibile non vince mai su uno leggibile, in nessun verso,
          e uno di qui illeggibile non si spedisce;
       b. se il server non e' cambiato dalla base di qui, resta quello di qui (e
          si spedisce se e' stato toccato);
       c. se il server e' cambiato: un valore di qui NON toccato cede sempre (1);
          uno toccato si unisce (2) o, dove non si sa unire, vince il
          salvataggio piu' recente e a pari ora la forma canonica maggiore (3);
          chi perde va messo da parte (4);
       d. un valore di qui che non e' mai arrivato al server si spedisce. */
  function unisci(locale, remoto) {
    locale = eOggetto(locale) ? locale : {};
    remoto = eOggetto(remoto) ? remoto : {};
    var out = { voci: {}, scrivi: [], spingi: [], guasti: [], persi: [], uniti: [], daParte: [] };
    var lista = unione(chiavi(locale), chiavi(remoto)).sort(), i;
    for (i = 0; i < lista.length; i++) {
      var nome = lista[i];
      var L = eOggetto(locale[nome]) ? locale[nome] : null;
      var R = eOggetto(remoto[nome]) ? remoto[nome] : null;
      if (!L && !R) continue;
      var r = risolvi(nome), reg = r ? r.reg : null;
      var baseL = L && eIntero(L.base) ? L.base : null;
      var gL = L && !L.guasto ? (typeof L.g === 'string' ? L.g : canonDi(nome, L.d)) : null;
      var gBaseL = L && typeof L.gBase === 'string' ? L.gBase : null;
      var sporcaL = !!L && !L.guasto && (L.sporca === true || baseL === null);
      var tL = L && eNumero(L.t) ? L.t : null;
      var grezzoL = L ? (typeof L.grezzo === 'string' ? L.grezzo : (reg && !L.guasto ? grezzoDi(reg, L.d) : undefined)) : undefined;
      if (!R) {
        out.voci[nome] = { d: L.d, t: tL, base: baseL, g: gBaseL, sporca: sporcaL };
        if (sporcaL) out.spingi.push(nome);
        continue;
      }
      var agg = eIntero(R.agg) ? R.agg : null;
      var gR = R.guasto ? null : canonDi(nome, R.d);
      var tR = eNumero(R.t) ? R.t : null;
      var dalServer = { d: R.d, t: tR, base: agg, g: gR, sporca: false };
      if (!L) {
        if (R.guasto) out.voci[nome] = { d: undefined, t: null, base: agg, g: null, sporca: false };
        else { out.voci[nome] = dalServer; out.scrivi.push(nome); }
        continue;
      }
      if (L.guasto && R.guasto) { out.voci[nome] = { d: undefined, t: null, base: agg, g: null, sporca: false }; continue; }
      if (L.guasto) {
        out.voci[nome] = dalServer; out.scrivi.push(nome); out.guasti.push(nome);
        if (grezzoL !== undefined) out.daParte.push({ nome: nome, grezzo: grezzoL, motivo: 'illeggibile' });
        continue;
      }
      if (R.guasto) {
        /* quello del server non si sa leggere: resta quello di qui, e lo ripara */
        out.voci[nome] = { d: L.d, t: tL, base: agg, g: null, sporca: true };
        out.spingi.push(nome);
        continue;
      }
      if (baseL !== null && baseL === agg) {
        out.voci[nome] = { d: L.d, t: tL, base: baseL, g: gBaseL, sporca: sporcaL };
        if (sporcaL) out.spingi.push(nome);
        continue;
      }
      /* (c) il server e' andato avanti. Lo stesso contenuto: si prende solo la
         versione, senza riscrivere niente */
      if (gL === gR) { out.voci[nome] = { d: R.d, t: tR, base: agg, g: gR, sporca: false }; continue; }
      if (!sporcaL) { out.voci[nome] = dalServer; out.scrivi.push(nome); continue; }        /* regola 1 */
      if (reg && typeof reg.unisci === 'function') {                                       /* regola 2 */
        var m = reg.unisci(L.dBase, L.d, R.d, { tQui: tL, tLa: tR });
        var gM = canonDi(nome, m.d);
        out.uniti.push(nome);
        if (m.persiQui) { out.persi.push(nome); out.daParte.push({ nome: nome, grezzo: grezzoL, motivo: 'sostituito' }); }
        if (gM === gR) { out.voci[nome] = dalServer; out.scrivi.push(nome); continue; }
        if (m.persiLa) out.daParte.push({ nome: nome, grezzo: grezzoDi(reg, R.d), motivo: 'sostituito-sul-server' });
        var tM = Math.max(eNumero(tL) ? tL : -Infinity, eNumero(tR) ? tR : -Infinity);
        out.voci[nome] = { d: m.d, t: eNumero(tM) ? tM : null, base: agg, g: gR, sporca: true };
        if (gM !== gL) out.scrivi.push(nome);
        out.spingi.push(nome);
        continue;
      }
      var tq = eNumero(tL) ? tL : -Infinity, tl = eNumero(tR) ? tR : -Infinity;          /* regola 3 */
      if (tq > tl || (tq === tl && String(gL) > String(gR))) {
        out.voci[nome] = { d: L.d, t: tL, base: agg, g: gR, sporca: true };
        out.spingi.push(nome);
        if (reg) out.daParte.push({ nome: nome, grezzo: grezzoDi(reg, R.d), motivo: 'sostituito-sul-server' });
      } else {
        out.voci[nome] = dalServer;
        out.scrivi.push(nome);
        out.persi.push(nome);
        out.daParte.push({ nome: nome, grezzo: grezzoL, motivo: 'sostituito' });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * gli ITEM del server che servono al piano                            *
   * ------------------------------------------------------------------ */
  /* Delle righe di `study_state` il browser tiene SOLO cio' che il piano legge:
     le tappe (tutte) e le domande dei quiz ancora da recuperare (ultimo esito
     ko o quasi: una giusta toglie la domanda). Il resto passa e non si tiene:
     chi ne avra' bisogno (il secondo tempo, per le flashcards) alza VERSIONE e
     il cursore riparte da 0. PURA: rende una cache nuova. */
  function fondiItems(cache, righe) {
    var c = eOggetto(cache) && eOggetto(cache.items) ? cache : cacheVuota();
    var items = {}, k;
    for (k in c.items) if (proprio(c.items, k)) items[k] = c.items[k];
    var lista = eArray(righe) ? righe : [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      if (!eOggetto(r) || typeof r.item !== 'string' || !r.item) continue;
      var voce = { k: r.kind, e: presente(r.ultimo_esito) ? r.ultimo_esito : null,
                   u: eGiorno(r.ultimo) ? r.ultimo : null, a: eIntero(r.updated_at) ? r.updated_at : null };
      if (r.kind === 'tappa') items[r.item] = voce;
      else if (r.kind === 'quiz') {
        if (voce.e === 'ko' || voce.e === 'quasi') items[r.item] = voce;
        else delete items[r.item];
      }
    }
    return { v: VERSIONE, items: items };
  }

  /* ------------------------------------------------------------------ *
   * nomi degli item                                                     *
   * ------------------------------------------------------------------ */
  function itemTappa(parte, tappa) {
    if (typeof parte !== 'string' || !/^s[12][fcb]\d{2}-[AB]$/.test(parte)) return null;
    for (var i = 0; i < TAPPE.length; i++) if (TAPPE[i] === tappa) return 'tappa:' + parte + ':' + tappa;
    return null;
  }
  function leggiItemTappa(item) {
    var m = typeof item === 'string' ? RE_TAPPA.exec(item) : null;
    if (!m) return null;
    for (var i = 0; i < TAPPE.length; i++) if (TAPPE[i] === m[2]) return { parte: m[1], tappa: m[2] };
    return null;
  }
  function parteDi(item) {
    var m = typeof item === 'string' ? RE_PARTE.exec(item) : null;
    return m ? m[1] + '-' + m[2] : null;
  }

  /* ------------------------------------------------------------------ *
   * L'ADATTATORE verso il piano di studio (motori_assets/masterplan.js) *
   * ------------------------------------------------------------------ */
  /* Lo `stato` che il piano si aspetta (intestazione di masterplan.js):
       {tappe:     {'<parte>': {capisci:T, fai:T, richiama:T, nonCascarci:T}},
        sbagliate: {'<parte>': {n, ultima, prima}},
        scatole:   {'<parte>': {box, ultimo}}}
       T = 'AAAA-MM-GG' oppure {fatto:'AAAA-MM-GG', esito:'so'|'incerto'|'no'}
     Da dove viene ognuno (PURA; `opz.giorno(ms)` -> giorno locale):
       tappe      il salvataggio `studio-tappe` (gia' nella forma del piano) e le
                  tappe del server (eventi `tappa`: ultimo giorno e ultimo esito,
                  ok = so, quasi = incerto, ko = no). Per ogni tappa vince il
                  giorno piu' recente; a pari giorno il salvataggio. Un valore
                  del salvataggio che non si sa leggere passa COSI' COM'E' se il
                  server non ha niente: e' il piano a dichiararlo in `scartati`.
       sbagliate  l'unione di due fonti, per domanda: le domande che il server
                  dice ancora sbagliate (ultimo esito ko o quasi, su qualunque
                  dispositivo) e il registro di quiz.js di questo browser
                  (`quiz.v1.sbagliate`, anche cio' che non e' ancora partito).
                  n = quante domande di quella parte, ultima = il giorno piu'
                  recente fra i loro, prima = il piu' VECCHIO (assente se il
                  giorno di una domanda non si sa). Nel dubbio una domanda resta sbagliata:
                  un ripasso in piu' costa meno di una lacuna. Del registro del
                  browser si leggono solo le domande sbagliate DOPO l'ingresso
                  dell'account di adesso (`stato.legato`): quelle di prima sono
                  di chi usava il browser prima.
       scatole    le scatole di ripasso (`scatole.v1.studio`): ogni argomento
                  legato a una LEZIONE (`u` = 's1f01.html') con un ultimo
                  ripasso vale per le sue DUE parti (A e B), con la sua scatola.
                  Due argomenti sulla stessa lezione: vince l'ultimo ripasso piu'
                  recente, poi la scatola piu' alta. Gli argomenti liberi (senza
                  lezione) restano al calendario delle scatole.
     `fonti` conta da dove e' venuto cosa, e cosa e' rimasto FUORI e perche'
     (`senzaParte`: un id di cui non si sa la parte; `altroAccount`: una domanda
     del registro di prima dell'account di adesso). E' un canale per chi integra
     (S4): un id che non si sa leggere si conta, non si salta in silenzio. */
  function perPiano(stato, opz) {
    var s = eOggetto(stato) ? stato : {};
    var giorno = opz && typeof opz.giorno === 'function' ? opz.giorno : giornoLocale;
    var kv = eOggetto(s.kv) ? s.kv : {};
    var items = eOggetto(s.items) ? s.items : {};
    var legato = eNumero(s.legato) ? s.legato : null;
    var fonti = { tappe: { salvataggio: 0, server: 0 },
                  sbagliate: { server: 0, browser: 0, senzaParte: 0, altroAccount: 0 },
                  scatole: { argomenti: 0, fuori: 0 } };
    var tappe = {}, i, p, k, x;

    /* --- tappe --- */
    var dalServer = {};
    for (k in items) {
      if (!proprio(items, k) || !eOggetto(items[k]) || items[k].k !== 'tappa') continue;
      var it = leggiItemTappa(k);
      if (!it || !proprio(ESITO_TAPPA, items[k].e) || !eGiorno(items[k].u)) continue;
      if (!dalServer[it.parte]) dalServer[it.parte] = {};
      dalServer[it.parte][it.tappa] = { fatto: items[k].u, esito: ESITO_TAPPA[items[k].e] };
    }
    var blob = kv['studio-tappe'] && eOggetto(kv['studio-tappe'].d) ? kv['studio-tappe'].d : {};
    var parti = {};
    for (p in blob) if (proprio(blob, p)) parti[p] = true;
    for (p in dalServer) if (proprio(dalServer, p)) parti[p] = true;
    for (p in parti) {
      if (!proprio(parti, p)) continue;
      var b = proprio(blob, p) ? blob[p] : undefined;
      if (presente(b) && !eOggetto(b)) {
        /* una parte del salvataggio che non si sa leggere: se il server sa
           qualcosa di quella parte vince lui (leggibile su illeggibile), se no
           passa cosi' com'e' e il piano la dichiara in `scartati` */
        if (!dalServer[p]) { tappe[p] = b; fonti.tappe.salvataggio++; continue; }
        b = undefined;
      }
      var t = {}, qualcuna = false;
      for (i = 0; i < TAPPE.length; i++) {
        var nomeT = TAPPE[i];
        var dalBlob = b && proprio(b, nomeT) && presente(b[nomeT]) ? b[nomeT] : undefined;
        var dalSrv = dalServer[p] && dalServer[p][nomeT] ? dalServer[p][nomeT] : undefined;
        var fattoBlob = typeof dalBlob === 'string' ? dalBlob : (eOggetto(dalBlob) ? dalBlob.fatto : null);
        if (dalBlob !== undefined && (!dalSrv || (eGiorno(fattoBlob) && fattoBlob >= dalSrv.fatto))) {
          t[nomeT] = dalBlob; fonti.tappe.salvataggio++; qualcuna = true;
        } else if (dalSrv) {
          t[nomeT] = { fatto: dalSrv.fatto, esito: dalSrv.esito }; fonti.tappe.server++; qualcuna = true;
        }
      }
      if (qualcuna) tappe[p] = t;
    }

    /* --- sbagliate --- */
    var sbagliateItem = {};   // item -> giorno (o null)
    for (k in items) {
      if (!proprio(items, k) || !eOggetto(items[k]) || items[k].k !== 'quiz') continue;
      if (items[k].e !== 'ko' && items[k].e !== 'quasi') continue;
      if (!parteDi(k)) { fonti.sbagliate.senzaParte++; continue; }
      sbagliateItem[k] = eGiorno(items[k].u) ? items[k].u : null;
      fonti.sbagliate.server++;
    }
    var reg = s.registroQuiz;
    if (eOggetto(reg) && eOggetto(reg.q)) {
      for (k in reg.q) {
        if (!proprio(reg.q, k) || !eOggetto(reg.q[k])) continue;
        if (!parteDi(k)) { fonti.sbagliate.senzaParte++; continue; }
        if (legato !== null && eNumero(reg.q[k].t) && reg.q[k].t < legato) { fonti.sbagliate.altroAccount++; continue; }
        var g = eNumero(reg.q[k].t) ? giorno(reg.q[k].t) : null;
        if (!proprio(sbagliateItem, k)) fonti.sbagliate.browser++;
        sbagliateItem[k] = maxGiorno(proprio(sbagliateItem, k) ? sbagliateItem[k] : null, eGiorno(g) ? g : null);
      }
    }
    var sbagliate = {}, prime = {}, ignote = {};
    for (k in sbagliateItem) {
      if (!proprio(sbagliateItem, k)) continue;
      p = parteDi(k);
      if (!sbagliate[p]) sbagliate[p] = { n: 0, ultima: null };
      sbagliate[p].n++;
      sbagliate[p].ultima = maxGiorno(sbagliate[p].ultima, sbagliateItem[k]);
      if (sbagliateItem[k] === null) ignote[p] = true;
      if (sbagliateItem[k] !== null && (!prime[p] || sbagliateItem[k] < prime[p])) prime[p] = sbagliateItem[k];
    }
    /* `prima` = il giorno della domanda sbagliata piu' VECCHIA ancora aperta (per
       ogni domanda conta il suo ultimo errore): il piano applica R5 all'errore e
       non alla parte. Se il giorno di una domanda non si sa, `prima` non c'e' e
       il piano usa `ultima`, come prima (revisione S3v2) */
    for (p in sbagliate) if (proprio(sbagliate, p) && !ignote[p] && prime[p]) sbagliate[p].prima = prime[p];

    /* --- scatole --- */
    var scatole = {};
    var sc = kv.scatole && leggeScatole(kv.scatole.d) ? kv.scatole.d : null;
    if (sc) {
      for (i = 0; i < sc.argomenti.length; i++) {
        x = sc.argomenti[i];
        if (!eOggetto(x)) continue;
        var m = typeof x.u === 'string' ? RE_PAGINA_LEZIONE.exec(x.u) : null;
        if (!m || !eGiorno(x.ultimo)) { fonti.scatole.fuori++; continue; }
        fonti.scatole.argomenti++;
        var box = eIntero(x.box) ? x.box : 0;
        var lati = ['A', 'B'];
        for (var j = 0; j < 2; j++) {
          var parte = m[1] + '-' + lati[j];
          var ora = scatole[parte];
          if (!ora || x.ultimo > ora.ultimo || (x.ultimo === ora.ultimo && box > ora.box)) {
            scatole[parte] = { box: box, ultimo: x.ultimo };
          }
        }
      }
    }
    return { tappe: tappe, sbagliate: sbagliate, scatole: scatole, fonti: fonti };
  }

  /* ------------------------------------------------------------------ *
   * lo stato di QUI, per perPiano                                       *
   * ------------------------------------------------------------------ */
  function leggi(storage) {
    var st = storage || global.localStorage;
    var meta = leggiMeta(st), basi = leggiBasi(st);
    var kv = {}, nomi = nomiLocali(st);
    for (var i = 0; i < nomi.length; i++) {
      var l = leggiLocale(st, meta, basi, nomi[i]);
      if (l && !l.guasto) kv[nomi[i]] = { d: l.d, t: l.t };
    }
    var reg = leggiJson(st, CHIAVE_REGISTRO_QUIZ);
    return { v: VERSIONE, utente: meta.utente, since: meta.since, legato: meta.legato, kv: kv,
             items: leggiItems(st).items, registroQuiz: eOggetto(reg) ? reg : null };
  }

  /* ------------------------------------------------------------------ *
   * l'ambiente: tutto si puo' passare da fuori                          *
   * ------------------------------------------------------------------ */
  /* Le opzioni della PAGINA (secondo tempo di S2): `avvia` le mette qui, e da
     allora `Sync.spingi('scatole')` di un motore sa dov'e' il Worker senza che il
     motore lo sappia. Quelle passate a mano vincono sempre (le prove le passano
     tutte). */
  var predefinite = {};
  function ambiente(opz) {
    var o = {}, k;
    for (k in predefinite) if (proprio(predefinite, k)) o[k] = predefinite[k];
    if (eOggetto(opz)) for (k in opz) if (proprio(opz, k)) o[k] = opz[k];
    var storage = o.storage || global.localStorage;
    return {
      api: typeof o.api === 'string' ? o.api.replace(/\/+$/, '') : '',
      storage: storage,
      fetch: o.fetch || (typeof global.fetch === 'function' ? function (u, i) { return global.fetch(u, i); } : null),
      adesso: typeof o.adesso === 'function' ? o.adesso : function () { return new Date().getTime(); },
      token: typeof o.token === 'function' ? o.token : function () { return prendi(storage, CHIAVE_TOKEN) || ''; },
      timer: eOggetto(o.timer) ? o.timer : null,
      subito: o.subito === true,
      avvisa: typeof o.avvisa === 'function' ? o.avvisa : avvisaPagina
    };
  }
  /* i motori rileggono i loro dati quando arriva questo segnale (secondo tempo) */
  function avvisaPagina(dettaglio) {
    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('studio:stato', { detail: dettaglio }));
      }
    } catch (e) { /* un avviso non deve mai fermare lo studio */ }
  }

  /* applica un'unione nel browser: mette da parte, scrive, aggiorna meta e basi.
     Un nome il cui «messo da parte» non si e' potuto scrivere (memoria piena)
     NON si tocca: e' fra le `nonScritte`, e `tira` non sposta il cursore. */
  function applica(amb, meta, basi, es, rapporto) {
    var i, nome, r, daScrivere = {}, fermi = {};
    var quando = oraServer(amb, meta);
    for (i = 0; i < es.daParte.length; i++) {
      var x = es.daParte[i];
      r = risolvi(x.nome);
      if (!r || typeof x.grezzo !== 'string') continue;
      if (!mettiDaParte(amb.storage, r.chiave, { grezzo: x.grezzo, motivo: x.motivo, quando: quando, utente: meta.utente })) {
        fermi[x.nome] = true;
      }
    }
    for (i = 0; i < es.guasti.length; i++) if (!fermi[es.guasti[i]]) rapporto.guasti.push(es.guasti[i]);
    for (i = 0; i < es.persi.length; i++) if (!fermi[es.persi[i]]) rapporto.persi.push(es.persi[i]);
    for (i = 0; i < es.uniti.length; i++) if (!fermi[es.uniti[i]]) rapporto.uniti.push(es.uniti[i]);
    for (i = 0; i < es.scrivi.length; i++) daScrivere[es.scrivi[i]] = true;
    for (nome in es.voci) {
      if (!proprio(es.voci, nome)) continue;
      var v = es.voci[nome];
      if (fermi[nome]) { rapporto.nonScritte.push(nome); continue; }
      if (daScrivere[nome]) {
        r = risolvi(nome);
        if (!r || !metti(amb.storage, r.chiave, grezzoDi(r.reg, v.d))) {
          /* non scritto (memoria piena): la versione del server NON diventa la
             base, il meta resta com'era, e il cursore non passa di qui */
          rapporto.nonScritte.push(nome);
          continue;
        }
        rapporto.scritte.push(nome);
      }
      meta.voci[nome] = { base: v.base, t: v.t, sporca: v.sporca === true };
      /* un valore da spedire uscito da una lettura (o da un conflitto) col token del
         legame e' dell'account del legame: lo si segna (`h`, vedi cambiaAccount) */
      if (v.sporca === true && v.d !== undefined) meta.voci[nome].h = impronta(canonDi(nome, v.d));
      if (typeof v.g === 'string' && eIntero(v.base)) basi.voci[nome] = { base: v.base, g: v.g };
      else delete basi.voci[nome];
    }
  }

  /* Un ALTRO account su questo browser. I salvataggi di prima si mettono da parte
     col nome del LORO account (e se non erano ancora arrivati al server, lo si
     annota), si tolgono, e NON si spediscono mai al nuovo account. Poi cio' che il
     NUOVO account aveva lasciato qui senza spedirlo, messo da parte l'ultima
     volta che un altro e' entrato, torna al suo posto e rientra nell'unione.
     Se non si riesce a mettere da parte non si tocca niente (rende null).
     DI CHI E' IL VALORE DI QUI (revisione della fetta S2b, 2026-09-29). Prima un
     valore diverso dalla base si metteva da parte come «dell'account di prima, da
     spedire», e al suo rientro tornava in gioco e andava sul SUO server. Ma sullo
     stesso browser, se il nuovo studente entra mentre il server non risponde, la
     pagina gli lasciava toccare i dati di prima (un «Azzera tutto» cancellava le
     scatole dell'altro anche sul server). Adesso «da spedire» vale solo se il
     contenuto e' quello che uno `spingi` ha segnato col token del legame (`h`):
     un valore cambiato quando il token non era quello del legame si mette da parte
     come «dubbio», e non torna in gioco da solo. La versione dell'account di prima
     resta la sua, sul server. */
  function cambiaAccount(amb, meta, basi, nuovo, tok) {
    var nomi = nomiLocali(amb.storage), quando = oraServer(amb, meta), i, r, g, l, vm, suo, toccato;
    for (i = 0; i < nomi.length; i++) {
      r = risolvi(nomi[i]);
      g = prendi(amb.storage, r.chiave);
      if (g === null) continue;
      l = leggiLocale(amb.storage, meta, basi, nomi[i]);
      vm = voceMeta(meta, nomi[i]);
      toccato = !!(l && !l.guasto && l.sporca);
      suo = toccato && typeof vm.h === 'string' && vm.h === impronta(l.g);
      var voce = { grezzo: g, motivo: toccato && !suo ? 'dubbio' : 'altro-account', quando: quando,
                   utente: meta.utente, sporca: suo, base: l ? l.base : null, t: l ? l.t : null,
                   gBase: l ? l.gBase : null };
      if (suo) voce.h = vm.h;
      if (!mettiDaParte(amb.storage, r.chiave, voce)) return null;
    }
    for (i = 0; i < nomi.length; i++) {
      try { amb.storage.removeItem(risolvi(nomi[i]).chiave); } catch (e) { return null; }
    }
    try { amb.storage.removeItem(CHIAVE_ITEMS); amb.storage.removeItem(CHIAVE_BASI); } catch (e2) { /* si riscrivono */ }
    var m = metaVuota(), b = basiVuote();
    m.utente = nuovo;
    m.impronta = impronta(tok);
    m.scarto = meta.scarto;
    m.legato = amb.adesso();
    riprendiDaParte(amb.storage, nuovo, m, b);
    salvaBasi(amb.storage, b);
    return salvaMeta(amb.storage, m) ? m : null;
  }
  /* cio' che `utente` aveva lasciato qui senza spedirlo torna al suo posto */
  function riprendiDaParte(storage, utente, m, b) {
    var p = leggiPrecedente(storage), k = chiavi(p.voci), i, j, cambiato = false;
    for (i = 0; i < k.length; i++) {
      var lista = p.voci[k[i]], nome = nomeDaChiave(k[i]);
      if (!nome || prendi(storage, k[i]) !== null) continue;
      for (j = lista.length - 1; j >= 0; j--) {
        var e = lista[j];
        if (!eOggetto(e) || e.motivo !== 'altro-account' || e.utente !== utente || e.sporca !== true) continue;
        if (typeof e.grezzo !== 'string' || !metti(storage, k[i], e.grezzo)) break;
        /* (`h` torna con lui: e' ancora il SUO contenuto, se un altro entra di nuovo) */
        m.voci[nome] = { base: eIntero(e.base) ? e.base : null, t: eNumero(e.t) ? e.t : null, sporca: true };
        if (typeof e.h === 'string') m.voci[nome].h = e.h;
        if (typeof e.gBase === 'string' && eIntero(e.base)) b.voci[nome] = { base: e.base, g: e.gBase };
        lista.splice(j, 1);
        cambiato = true;
        break;
      }
    }
    if (cambiato) metti(storage, CHIAVE_PRECEDENTE, JSON.stringify(p));
  }

  function rispostaStato(j) {
    return eOggetto(j) && typeof j.utente === 'string' && j.utente !== '' && eIntero(j.fino) &&
      eArray(j.items) && eArray(j.kv) && typeof j.altro === 'boolean';
  }

  /* ------------------------------------------------------------------ *
   * TIRA: dal server a qui                                              *
   * ------------------------------------------------------------------ */
  /* Legge cio' che e' cambiato dopo il cursore, pagina per pagina, e lo
     unisce. Poi spedisce cio' che resta da spedire (opz.spingi === false per
     non farlo). Non lancia mai: rende un rapporto con `esito`
     ok | senza-api | senza-account | non-autenticato | errore | rete |
     risposta-malformata | incompleto | altro-account-bloccato.
     «incompleto» = troppe pagine, oppure un valore che non si e' potuto
     scrivere qui (memoria piena): in quel caso il cursore resta dov'era, e la
     lettura dopo ripassa da quella pagina. */
  function tira(opz) {
    var amb = ambiente(opz);
    var rapporto = { esito: 'ok', pagine: 0, scritte: [], nonScritte: [], guasti: [], persi: [], uniti: [],
                     ignorati: [], cambioAccount: false, spinta: null };
    if (!amb.api || !amb.fetch) { rapporto.esito = 'senza-api'; return Promise.resolve(rapporto); }
    var tok = amb.token();
    if (!tok) { rapporto.esito = 'senza-account'; return Promise.resolve(rapporto); }
    var meta = leggiMeta(amb.storage);
    var basi = leggiBasi(amb.storage);
    var cache = leggiItems(amb.storage);

    function pagina(n) {
      if (n >= MAX_PAGINE) { rapporto.esito = 'incompleto'; return Promise.resolve(); }
      return amb.fetch(amb.api + '/studio/stato?since=' + encodeURIComponent(String(meta.since)),
                       { headers: { 'Authorization': 'Bearer ' + tok } })
        .then(function (r) {
          if (r.status === 401) { rapporto.esito = 'non-autenticato'; return null; }
          if (!r.ok) { rapporto.esito = 'errore'; rapporto.http = r.status; return null; }
          return r.json();
        })
        .then(function (j) {
          if (j === null || rapporto.esito !== 'ok') return undefined;
          if (!rispostaStato(j)) { rapporto.esito = 'risposta-malformata'; return undefined; }
          if (meta.utente !== null && meta.utente !== j.utente) {
            if (rapporto.cambioAccount) { rapporto.esito = 'errore'; return undefined; }
            var nuova = cambiaAccount(amb, meta, basi, j.utente, tok);
            if (!nuova) { rapporto.esito = 'altro-account-bloccato'; return undefined; }
            rapporto.cambioAccount = true;
            meta = nuova;
            basi = leggiBasi(amb.storage);
            cache = cacheVuota();
            return pagina(n + 1);   /* la pagina era del cursore di prima: si riparte da 0 */
          }
          rapporto.pagine++;
          meta.utente = j.utente;
          meta.impronta = impronta(tok);
          if (eIntero(j.adesso)) meta.scarto = j.adesso * 1000 - amb.adesso();
          var remoto = {}, locale = {}, i;
          for (i = 0; i < j.kv.length; i++) {
            var riga = j.kv[i];
            if (!eOggetto(riga) || !sincronizzabile(riga.k) || !eIntero(riga.updated_at)) {
              rapporto.ignorati.push(eOggetto(riga) ? String(riga.k) : '?');
              continue;
            }
            var b = apriBusta(riga.k, riga.v);
            remoto[riga.k] = { d: b.d, t: b.t, agg: riga.updated_at, guasto: b.guasto };
            var l = leggiLocale(amb.storage, meta, basi, riga.k);
            if (l) locale[riga.k] = l;
          }
          var prima = rapporto.nonScritte.length;
          applica(amb, meta, basi, unisci(locale, remoto), rapporto);
          cache = fondiItems(cache, j.items);
          metti(amb.storage, CHIAVE_ITEMS, JSON.stringify(cache));
          salvaBasi(amb.storage, basi);
          if (rapporto.nonScritte.length > prima) {
            /* un valore del server non e' entrato: il cursore NON passa oltre */
            salvaMeta(amb.storage, meta);
            rapporto.esito = 'incompleto';
            return undefined;
          }
          meta.since = j.fino;
          salvaMeta(amb.storage, meta);
          return j.altro ? pagina(n + 1) : undefined;
        });
    }

    return pagina(0).then(function () {
      if (rapporto.esito !== 'ok') return rapporto;
      /* cio' che c'e' qui ed e' stato toccato senza che nessuno lo segnasse (un
         motore che salva senza `spingi`), o non e' mai arrivato al server
         (regola d): lo si segna da spedire */
      var nomi = nomiLocali(amb.storage), i, cambiato = false;
      for (i = 0; i < nomi.length; i++) {
        var l = leggiLocale(amb.storage, meta, basi, nomi[i]);
        var vm = voceMeta(meta, nomi[i]);
        if (!l || l.guasto) continue;
        if (l.sporca && (vm.sporca !== true || typeof vm.h !== 'string')) {
          /* (letto con il token del legame appena confermato: e' suo, `h`) */
          meta.voci[nomi[i]] = { base: l.base, t: l.t, sporca: true, h: impronta(l.g) };
          cambiato = true;
        } else if (!l.sporca && vm.sporca === true && l.gBase !== null) {
          meta.voci[nomi[i]] = { base: l.base, t: vm.t, sporca: false };
          cambiato = true;
        }
      }
      if (cambiato) salvaMeta(amb.storage, meta);
      amb.avvisa({ scritte: rapporto.scritte.slice(), cambioAccount: rapporto.cambioAccount });
      if (eOggetto(opz) && opz.spingi === false) return rapporto;
      return svuota(opz).then(function (s) { rapporto.spinta = s; return rapporto; });
    }, function () {
      rapporto.esito = 'rete';
      return rapporto;
    });
  }

  /* ------------------------------------------------------------------ *
   * SPINGI e SVUOTA: da qui al server                                   *
   * ------------------------------------------------------------------ */
  var attesa = null;   /* il timer dell'ultima spinta programmata */

  /* legato e con il token di adesso? (se c'e' un token e il browser e' legato a
     un account, deve essere il token del legame: altrimenti serve prima `tira`) */
  function tokenDelLegame(meta, tok) { return meta.utente !== null && meta.impronta === impronta(tok); }

  /* Il motore ha appena salvato `nome` (nella SUA chiave). Se il valore e' davvero
     diverso dalla versione del server da cui parte, lo si segna da spedire con
     l'ORA DEL SERVER, e si spedisce dopo 2 s di quiete; se e' uguale (un motore
     che risalva all'apertura) non si timbra niente: un valore non toccato non
     diventa piu' recente di quello di un altro dispositivo. Rende false se non
     segna niente perche' il token non e' quello del legame (serve prima `tira`). */
  function spingi(nome, opz) {
    if (!sincronizzabile(nome)) return false;
    var amb = ambiente(opz);
    var meta = leggiMeta(amb.storage), basi = leggiBasi(amb.storage);
    var tok = amb.token();
    if (tok && meta.utente !== null && !tokenDelLegame(meta, tok)) {
      /* il token non e' quello del legame (un altro accesso, o un altro account):
         nella pagina si rilegge, e la lettura decide di chi sono i dati (debito
         (d) del primo tempo). Con un freno: una lettura al minuto al massimo. */
      if (avviata) rileggi(false);
      return false;
    }
    var l = leggiLocale(amb.storage, meta, basi, nome);
    var vm = voceMeta(meta, nome);
    /* DI CHI e' questo salvataggio (revisione S2b, vedi cambiaAccount): lo si sa se il
       token e' quello del legame, o se il browser non e' ancora legato a nessuno.
       Senza token, su un browser legato, si segna da spedire ma senza impronta: se
       poi entra un altro account, il valore resta «dubbio». */
    var certo = !!tok || meta.utente === null;
    if (l && !l.guasto && (l.sporca || l.gBase === null)) {
      var h = certo ? impronta(l.g) : null;
      if (!(vm.sporca === true && vm.h === h && eNumero(vm.t))) {
        meta.voci[nome] = { base: eIntero(vm.base) ? vm.base : null, t: oraServer(amb, meta), sporca: true, h: h };
      }
    } else if (l && l.guasto) {
      /* illeggibile: non parte, ma `svuota` lo dira' */
      meta.voci[nome] = { base: eIntero(vm.base) ? vm.base : null, t: vm.t, sporca: true };
    } else if (vm.sporca === true) {
      /* tornato uguale al server, o tolto: niente da spedire */
      meta.voci[nome] = { base: eIntero(vm.base) ? vm.base : null, t: vm.t, sporca: false };
    }
    if (!salvaMeta(amb.storage, meta)) return false;
    if (amb.subito) { svuota(opz); return true; }
    var set = amb.timer ? amb.timer.set : (typeof global.setTimeout === 'function' ? global.setTimeout : null);
    var clear = amb.timer ? amb.timer.clear : (typeof global.clearTimeout === 'function' ? global.clearTimeout : null);
    if (set) {
      if (attesa !== null && clear) clear(attesa);
      attesa = set(function () { attesa = null; svuota(opz); }, ATTESA_SPINTA_MS);
    }
    return true;
  }

  /* Spedisce tutto cio' che e' stato toccato. MAI prima di sapere di chi sono i
     dati di questo browser, e MAI con un token che non e' quello del legame
     (`non-legato`: serve prima una `tira`); il corpo dice al Worker di chi sono
     (`utente`), e il Worker rifiuta con 409 se non e' l'account del token. Esito:
     ok | senza-api | senza-account | non-legato | non-autenticato |
     senza-diritto | altro-account | troppe-richieste | errore | rete |
     troppo-grande (un valore oltre KV_VALORE_MAX: resta segnato e non parte). */
  function svuota(opz) {
    var amb = ambiente(opz);
    var rapporto = { esito: 'ok', salvate: [], conflitti: [], rifiutate: [], illeggibili: [], troppoGrandi: [],
                     scritte: [], nonScritte: [], guasti: [], persi: [], uniti: [], giri: 0 };
    if (!amb.api || !amb.fetch) { rapporto.esito = 'senza-api'; return Promise.resolve(rapporto); }
    var tok = amb.token();
    if (!tok) { rapporto.esito = 'senza-account'; return Promise.resolve(rapporto); }
    if (!tokenDelLegame(leggiMeta(amb.storage), tok)) { rapporto.esito = 'non-legato'; return Promise.resolve(rapporto); }
    var respinte = {};   /* rifiutate dal Worker in questa chiamata: non si rimandano nei giri dopo */

    function giro(n) {
      var meta = leggiMeta(amb.storage), basi = leggiBasi(amb.storage);
      var ora = oraServer(amb, meta);
      var voci = [], inviate = {}, nomi = unione(chiavi(meta.voci), nomiLocali(amb.storage)), i;
      for (i = 0; i < nomi.length; i++) {
        var nome = nomi[i];
        if (!sincronizzabile(nome) || respinte[nome]) continue;
        var vm = voceMeta(meta, nome);
        var l = leggiLocale(amb.storage, meta, basi, nome);
        if (!l) { if (vm.sporca === true) meta.voci[nome] = { base: vm.base, t: vm.t, sporca: false }; continue; }
        if (l.guasto) {
          if (vm.sporca === true) { meta.voci[nome] = { base: vm.base, t: vm.t, sporca: false }; rapporto.illeggibili.push(nome); }
          continue;
        }
        if (!l.sporca) {
          if (vm.sporca === true || vm.stato) meta.voci[nome] = { base: vm.base, t: vm.t, sporca: false };
          continue;
        }
        var t = eNumero(vm.t) ? vm.t : (eNumero(l.t) ? l.t : ora);
        if (t > ora) t = ora;                          /* mai piu' avanti del server */
        var v = busta(l.d, t);
        if (v.length > KV_VALORE_MAX) {
          meta.voci[nome] = { base: l.base, t: vm.t, sporca: true, stato: 'troppo-grande' };
          rapporto.troppoGrandi.push(nome);
          continue;
        }
        if (voci.length >= KV_MAX_VOCI) continue;      /* al giro dopo */
        meta.voci[nome] = { base: l.base, t: t, sporca: true, h: vm.h };
        voci.push({ k: nome, v: v, base_updated_at: l.base });
        inviate[nome] = { t: t, g: l.g };
      }
      salvaMeta(amb.storage, meta);
      if (!voci.length || n >= MAX_GIRI_SPINTA) return Promise.resolve();
      rapporto.giri++;
      return amb.fetch(amb.api + '/studio/kv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ utente: meta.utente, voci: voci })
      }).then(function (r) {
        if (r.status === 401) { rapporto.esito = 'non-autenticato'; return null; }
        if (r.status === 403) { rapporto.esito = 'senza-diritto'; return null; }
        if (r.status === 409) { rapporto.esito = 'altro-account'; return null; }
        if (r.status === 429) { rapporto.esito = 'troppe-richieste'; return null; }
        if (!r.ok) { rapporto.esito = 'errore'; rapporto.http = r.status; return null; }
        return r.json();
      }).then(function (j) {
        if (!j || rapporto.esito !== 'ok') return undefined;
        var m = leggiMeta(amb.storage), b = leggiBasi(amb.storage), x, k2;   /* riletti: uno `spingi` puo' essere arrivato intanto */
        var salvate = eArray(j.salvate) ? j.salvate : [];
        for (k2 = 0; k2 < salvate.length; k2++) {
          x = salvate[k2];
          if (!eOggetto(x) || !proprio(inviate, x.k) || !eIntero(x.updated_at)) continue;
          var mv = voceMeta(m, x.k), inv = inviate[x.k];
          /* la base nuova e' CIO' CHE E' PARTITO: un salvataggio arrivato durante
             il viaggio resta diverso dalla base, e parte al giro dopo */
          b.voci[x.k] = { base: x.updated_at, g: inv.g };
          var ancora = mv.sporca === true && eNumero(mv.t) && mv.t !== inv.t;
          m.voci[x.k] = { base: x.updated_at, t: ancora ? mv.t : inv.t, sporca: ancora, h: mv.h };
          rapporto.salvate.push(x.k);
        }
        var rifiutate = eArray(j.rifiutate) ? j.rifiutate : [];
        for (k2 = 0; k2 < rifiutate.length; k2++) {
          x = rifiutate[k2];
          if (!eOggetto(x) || !proprio(inviate, x.k)) continue;
          var rv = voceMeta(m, x.k);
          if (x.motivo === 'ora') {
            /* l'ora era troppo avanti per il server: si ritimbra e riparte */
            m.voci[x.k] = { base: rv.base, t: oraServer(amb, m), sporca: true, h: rv.h };
            continue;
          }
          respinte[x.k] = true;
          m.voci[x.k] = { base: rv.base, t: rv.t, sporca: true, stato: String(x.motivo || 'rifiutata') };
          rapporto.rifiutate.push({ k: x.k, motivo: x.motivo });
        }
        var conflitti = eArray(j.conflitti) ? j.conflitti : [];
        var remoto = {}, locale = {}, ce = false;
        for (k2 = 0; k2 < conflitti.length; k2++) {
          x = conflitti[k2];
          if (!eOggetto(x) || !proprio(inviate, x.k)) continue;
          rapporto.conflitti.push(x.k);
          if (x.v === null && x.updated_at === null) {
            /* il server il nome non ce l'ha: si rimanda con la base giusta (null) */
            m.voci[x.k] = { base: null, t: voceMeta(m, x.k).t, sporca: true };
            delete b.voci[x.k];
            continue;
          }
          if (!eIntero(x.updated_at)) continue;
          var bu = apriBusta(x.k, x.v);
          remoto[x.k] = { d: bu.d, t: bu.t, agg: x.updated_at, guasto: bu.guasto };
          var lc = leggiLocale(amb.storage, m, b, x.k);
          if (lc) locale[x.k] = lc;
          ce = true;
        }
        if (ce) applica(amb, m, b, unisci(locale, remoto), rapporto);
        salvaBasi(amb.storage, b);
        salvaMeta(amb.storage, m);
        return giro(n + 1);
      });
    }

    return giro(0).then(function () {
      if (rapporto.esito === 'ok' && rapporto.troppoGrandi.length) rapporto.esito = 'troppo-grande';
      return rapporto;
    }, function () {
      rapporto.esito = 'rete';
      return rapporto;
    });
  }

  /* ------------------------------------------------------------------ *
   * NELLA PAGINA (secondo tempo di S2): avvia, rileggi, legato           *
   * ------------------------------------------------------------------ */
  /* AVVIA: una volta per pagina. Lo chiama il modulo stesso quando la pagina gli
     ha detto dov'e' il Worker (`window.STUDIO_SYNC = {api}`, lo scrive site.js del
     completo, `_coda_studio_js`), oppure una prova. Tre cose:
       1. mette le opzioni della pagina fra le predefinite (i motori chiamano
          `Sync.spingi(nome)` senza sapere niente del Worker);
       2. legge dal server SUBITO (`tira`): i motori sono gia' montati e lavorano
          sulla memoria di questo browser; quando la lettura scrive qualcosa, il
          segnale `studio:stato` dice loro di rileggere. La pagina non aspetta la
          rete: senza server resta com'era prima di questa fetta;
       3. quando la pagina si NASCONDE spedisce cio' che resta (sul telefono e'
          l'unico «dopo» che esiste), quando torna in vista rilegge (un altro
          dispositivo puo' aver lavorato nel frattempo), al massimo una volta al
          minuto.
     Non lancia mai: rende la promessa del rapporto della prima lettura. */
  var avviata = null;
  var ultimaLettura = null;
  var letturaInVolo = null;
  var MIN_TRA_LETTURE_MS = 60000;
  function rileggi(forza) {
    if (letturaInVolo) return letturaInVolo;
    var ora;
    try { ora = ambiente().adesso(); } catch (e) { ora = 0; }
    if (!forza && ultimaLettura !== null && ora - ultimaLettura < MIN_TRA_LETTURE_MS) {
      return Promise.resolve(null);
    }
    ultimaLettura = ora;
    var p;
    try { p = tira(); } catch (e2) { p = Promise.resolve({ esito: 'errore' }); }
    letturaInVolo = p.then(function (r) { letturaInVolo = null; return r; },
                           function () { letturaInVolo = null; return { esito: 'errore' }; });
    return letturaInVolo;
  }
  function avvia(opz) {
    if (avviata) return avviata;
    var o = eOggetto(opz) ? opz : {}, k;
    predefinite = {};
    for (k in o) if (proprio(o, k)) predefinite[k] = o[k];
    avviata = rileggi(true);
    try {
      var doc = global.document;
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', function () {
          try {
            if (doc.visibilityState === 'hidden') svuota();
            else if (doc.visibilityState === 'visible') rileggi(false);
          } catch (e) { /* lo studio non si ferma per la sincronizzazione */ }
        });
      }
    } catch (e3) { /* idem */ }
    return avviata;
  }
  /* LEGATO: di chi sono i dati di questo browser, SE il token di adesso e' quello
     del legame (cioe' una lettura dal server con questo token e' riuscita), se no
     null. Una lettura riuscita e' anche la prova che il Worker ha la migrazione
     0011: la coda degli eventi (site.js) spedisce i tipi nuovi (guida, lettura,
     tappa) solo allora, perche' un database senza la 0011 li rifiuterebbe e con
     loro l'intero lotto. */
  function legato(opz) {
    try {
      var amb = ambiente(opz), tok = amb.token();
      var meta = leggiMeta(amb.storage);
      return tok && tokenDelLegame(meta, tok) ? meta.utente : null;
    } catch (e) { return null; }
  }
  /* IN ATTESA (revisione della fetta S2b, 2026-09-29): i dati di questo browser sono
     legati a un account, c'e' un token, e NON e' quello del legame. Finche' una
     lettura riuscita non dice di chi e' il token, quei dati possono essere di un
     ALTRO studente: sullo stesso browser B entra mentre il server non risponde, e la
     pagina delle scatole mostrava gli esami di A e ne accettava i gesti. Chi mostra
     dati sincronizzati (scatole.js) aspetta finche' e' vero. Vale solo nella pagina
     avviata (con l'indirizzo del Worker): senza sincronizzazione non c'e' niente da
     confermare, e i dati restano del browser come prima. */
  function inAttesa(opz) {
    try {
      if (!avviata && !(eOggetto(opz) && typeof opz.api === 'string' && opz.api)) return false;
      var amb = ambiente(opz), tok = amb.token();
      if (!tok || !amb.api) return false;
      var meta = leggiMeta(amb.storage);
      return meta.utente !== null && !tokenDelLegame(meta, tok);
    } catch (e) { return false; }
  }

  var Sync = {
    VERSIONE: VERSIONE,
    TAPPE: TAPPE.slice(),
    ESITO_TAPPA: ESITO_TAPPA,
    CHIAVI: { meta: CHIAVE_META, items: CHIAVE_ITEMS, precedente: CHIAVE_PRECEDENTE, basi: CHIAVE_BASI,
              token: CHIAVE_TOKEN },
    /* gli stessi del Worker: una prova li confronta (tests/test_studio_sync.mjs) */
    LIMITI: { KV_MAX_VOCI: KV_MAX_VOCI, KV_VALORE_MAX: KV_VALORE_MAX, RE_NOME: RE_NOME,
              MAX_PAGINE: MAX_PAGINE, MAX_DA_PARTE: MAX_DA_PARTE },
    NOMI: (function () {
      var n = [];
      for (var i = 0; i < REGISTRO.length; i++) n.push(REGISTRO[i].nome || REGISTRO[i].prefisso + '<pagina>');
      return n;
    })(),
    unisci: unisci,
    unisciTappe: unisciTappe,
    unisciScatole: unisciScatole,
    fondiItems: fondiItems,
    perPiano: perPiano,
    itemTappa: itemTappa,
    leggiItemTappa: leggiItemTappa,
    parteDi: parteDi,
    canon: canon,
    impronta: impronta,
    chiaveLocale: chiaveLocale,
    sincronizzabile: sincronizzabile,
    leggi: leggi,
    tira: tira,
    spingi: spingi,
    svuota: svuota,
    avvia: avvia,
    rileggi: rileggi,
    legato: legato,
    inAttesa: inAttesa,
    _interni: { apriBusta: apriBusta, busta: busta, nomeDaChiave: nomeDaChiave, giornoLocale: giornoLocale,
                /* per le prove: la pagina come appena aperta */
                azzeraPagina: function () { avviata = null; predefinite = {}; ultimaLettura = null; letturaInVolo = null; } }
  };

  global.Sync = Sync;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sync;

  /* LA PAGINA DEL COMPLETO lo avvia da sola: site.js (caricato PRIMA di questo
     file, `_coda_studio_js` in site_build.py) scrive dov'e' il Worker in
     `window.STUDIO_SYNC`. Senza quell'indirizzo (una copia costruita senza
     l'area account, o node) non parte niente.
     L'ORDINE NON E' UN MURO (revisione della fetta S2b): se site.js arriva DOPO,
     mentre il documento si carica si riprova a DOMContentLoaded (gli script
     `defer` sono tutti eseguiti prima), e la coda di site.js, se trova questo
     modulo gia' eseguito, lo avvia lei. Il presidio `controlla_sync` di check()
     pretende comunque l'ordine di page(). */
  function parteSeConfigurata() {
    var cfg = global.STUDIO_SYNC;
    if (global.document && eOggetto(cfg) && typeof cfg.api === 'string' && cfg.api) { avvia({ api: cfg.api }); return true; }
    return false;
  }
  try {
    var doc0 = global.document;
    if (!parteSeConfigurata() && doc0 && doc0.readyState === 'loading' && typeof doc0.addEventListener === 'function') {
      doc0.addEventListener('DOMContentLoaded', function () {
        try { parteSeConfigurata(); } catch (e1) { /* idem */ }
      });
    }
  } catch (e) { /* senza sincronizzazione lo studio resta su questo browser, come prima */ }

/* In pagina e' `window`. In node (require) `this` di un modulo CommonJS e'
   module.exports: si passa globalThis, come fa masterplan.js. */
})(typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global : this);
