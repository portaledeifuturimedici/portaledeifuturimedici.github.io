/* =====================================================================
   studio_hub.js — gli HUB trasversali di /studio: flashcards e quiz.

   IL BUCO CHE CHIUDE (parole del proprietario, 2026-07-30)
   «non ci sono delle schede per consultare in maniera agevole flashcards,
   mappe, eccetera». Prima di questo file, per ripassare le carte sulla
   cellula bisognava GIÀ SAPERE in quale episodio stavano, aprire una pagina
   da 106 KB e allargare il sesto accordion di otto — e poi rifarlo per la
   parte B. I motori sapevano comporre mazzi e serie da più lezioni; mancava
   il posto dove chiederglielo.

   COSA FA QUESTO FILE, E COSA NON FA
   È SOLO il banco della SELEZIONE: legge il catalogo, applica i filtri,
   scarica il minimo indispensabile e passa il risultato al motore giusto.
   Non ripassa, non corregge, non tiene punteggi: quelli sono flashcards.js
   e quiz.js, che restano gli unici a sapere come si studia.

   MONTAGGIO (le pagine le genera site_build.py)
     <div data-hub="flashcards" data-base="../data/"
          data-catalogo="hub-catalogo"></div>
     <script type="application/json" id="hub-catalogo">{...}</script>

   IL CATALOGO È LA FONTE, I DATI NO — regola «niente buchi»
   L'elenco degli episodi arriva dal catalogo del sito (60 su 60, sempre),
   non da «chi ha un JSON». Una parte senza materiale NON sparisce: resta in
   elenco, spenta, col MOTIVO scritto accanto. Un elenco che si accorcia da
   solo è il modo più silenzioso di perdere un episodio.

   PERCHÉ NON SCARICA 60 FILE (misurato)
   «tutta la biologia» sono 30 lezioni x 2 parti = 60 file cifrati.
     · FLASHCARDS: study_data.py emette `_mazzo-<materia>.json`, l'intera
       materia in UN file (biologia 318 KB in chiaro). Uno scaricamento e una
       decifratura invece di sessanta.
     · QUIZ: le domande intere sono 8,6 MB, aggregarle sarebbe assurdo.
       Si scaricano le facce (`_facce-<materia>.json`: quante domande per
       difficoltà, tipo e argomento, 36-73 KB) per filtrare e contare SENZA
       le domande, e poi si prendono solo i file delle lezioni che serviranno
       davvero — al più `MAX_LEZIONI`, presi a giro fra quelle ammesse.
   Tutto quello che scende resta in memoria per la durata della pagina:
   cambiare filtro non ri-scarica niente.

   SI ROMPE RUMOROSAMENTE
   Ogni lettura passa da `StudioFetch` (assets/studio_fetch.js) e ogni
   fallimento arriva a schermo col suo motivo. Un mazzo vuoto per guasto
   NON deve poter somigliare a un mazzo vuoto per filtro: sono due pannelli
   diversi, con due testi diversi e due gesti diversi da suggerire.

   Vanilla JS, ES5, zero dipendenze — come gli altri due motori.
   ===================================================================== */
(function (global) {
  'use strict';

  /* Quante lezioni al massimo compongono UNA serie di quiz. Non è un numero di
     comodo, è il tetto al costo di rete della singola serie — ed è stato
     MISURATO sul sito cifrato servito in locale: con 6 lezioni una serie di
     biologia scaricava 528.698 byte (720 domande, di cui 20 usate). Con 4
     scende a ~350 KB e l'interlacciamento resta pieno: una serie da 20
     domande pesca comunque da 4 lezioni diverse, cioè ~5 per lezione.
     Sotto i 4 si guadagnerebbero 90 KB e si perderebbe la cosa per cui l'hub
     esiste: mescolare argomenti che nel programma stanno lontani.
     Una sola lezione basterebbe a riempire la serie (120 domande a file): le
     altre tre si pagano APPOSTA, per il mescolamento.
     Le lezioni non pescate oggi tornano nei giri successivi (`recenti`). */
  var MAX_LEZIONI = 4;
  var RECENTI_MAX = 24;
  var CHIAVE_RECENTI = 'hub.v1.recenti';
  /* Il cassetto UNICO dei progressi delle flashcard: vedi `data-chiave` in
     flashcards.js. Vale per l'hub E per le pagine-episodio, così una carta
     ripassata di là è ripassata anche di qua. */
  var CHIAVE_CARTE = 'studio';
  var ATTESA_SPORTELLO = 5000, PASSO_SPORTELLO = 25;

  var ORDINE_DIFF = ['base', 'medio', 'sfida'];
  var ETICHETTA_DIFF = { base: 'base', medio: 'medio', sfida: 'sfida' };

  /* ------------------------------------------------------------------ *
   * utilità                                                             *
   * ------------------------------------------------------------------ */

  function el(doc, tag, attr, testo) {
    var n = doc.createElement(tag), k;
    if (attr) for (k in attr) if (attr.hasOwnProperty(k) && attr[k] != null) n.setAttribute(k, attr[k]);
    if (testo != null) n.appendChild(doc.createTextNode(testo));
    return n;
  }

  function svuota(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function esisteArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  function indiceIn(arr, v) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
    return -1;
  }

  function mescolaIn(arr, rnd) {
    var r = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* «1.083» e non «1083»: sono numeri che si leggono, non identificatori. */
  function numero(n) {
    var s = String(n), fuori = '', i, c = 0;
    for (i = s.length - 1; i >= 0; i--) {
      fuori = s.charAt(i) + fuori;
      if (++c % 3 === 0 && i > 0) fuori = '.' + fuori;
    }
    return fuori;
  }

  function plurale(n, uno, molti) { return numero(n) + ' ' + (n === 1 ? uno : molti); }

  function leggiLS(chiave) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(chiave);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return null;
  }

  function scriviLS(chiave, valore) {
    try { if (global.localStorage) global.localStorage.setItem(chiave, JSON.stringify(valore)); }
    catch (e) { }
  }

  /* Lo sportello dei dati cifrati. Identico ai due motori, e per la stessa
     ragione: nella pagina-cancello di site_lock.py gli script vengono
     ricreati a mano e l'ordine d'esecuzione dipende dal browser. Scaduta
     l'attesa NON si ripiega su `fetch().json()`: si dice che manca. */
  function conSportello(cb) {
    function sf() {
      var s = global.StudioFetch;
      return (s && typeof s.leggi === 'function') ? s : null;
    }
    var s = sf();
    if (s) { cb(s); return; }
    if (!global.setTimeout) { cb(null); return; }
    var atteso = 0;
    (function riprova() {
      var t = sf();
      if (t) { cb(t); return; }
      atteso += PASSO_SPORTELLO;
      if (atteso >= ATTESA_SPORTELLO) { cb(null); return; }
      global.setTimeout(riprova, PASSO_SPORTELLO);
    })();
  }

  /* Un file, una volta sola per pagina. La cache è per URL: cambiare filtro
     avanti e indietro non deve ri-scaricare né ri-decifrare niente. */
  var cache = {};

  function scarica(url) {
    if (cache[url]) return cache[url];
    var p = new global.Promise(function (risolvi, rifiuta) {
      conSportello(function (sportello) {
        if (!sportello) {
          rifiuta({
            motivo: 'sportello',
            messaggio: 'Il modulo che apre i materiali (studio_fetch.js) non è ' +
              'stato caricato: ricarica la pagina.'
          });
          return;
        }
        sportello.leggi(url, { credentials: 'same-origin' }).then(risolvi, function (err) {
          rifiuta({
            motivo: (err && err.motivo) || 'rete',
            messaggio: (err && err.messaggio) ||
              'Non sono riuscito a scaricare i materiali. Controlla la connessione.'
          });
        });
      });
    });
    /* Un fallimento NON resta in cache: la causa più comune è una sessione da
       ri-sbloccare, e dopo il rimedio il secondo tentativo deve poter riuscire. */
    p['catch'](function () { delete cache[url]; });
    cache[url] = p;
    return p;
  }

  /* ------------------------------------------------------------------ *
   * l'hub                                                               *
   * ------------------------------------------------------------------ */

  function Hub(radice, opzioni) {
    var doc = radice.ownerDocument || global.document;
    opzioni = opzioni || {};
    this.doc = doc;
    this.radice = radice;
    this.tipo = String(opzioni.tipo || radice.getAttribute('data-hub') || 'flashcards');
    if (this.tipo !== 'quiz') this.tipo = 'flashcards';
    this.base = String(opzioni.base || radice.getAttribute('data-base') || '../data/');
    this.catalogo = opzioni.catalogo || this.leggiCatalogo();
    this.motoreVivo = null;
    this.facce = {};          /* materia -> facce dei quiz (lazy) */
    this.mazzi = {};          /* materia -> mazzo aggregato gia' aperto */
    this.filtri = {
      materia: '', ud: '', ep: '', parte: '',
      diff: {}, tag: '', modo: 'tutto'
    };
    this.applicaUrl();
    this.costruisci();
    this.aggiornaSelettori();
    this.aggiornaConteggio();
    this.disegnaCatalogo();
  }

  Hub.prototype.leggiCatalogo = function () {
    var id = this.radice.getAttribute('data-catalogo');
    var nodo = id ? this.doc.getElementById(id) : null;
    if (!nodo) return { episodi: [], materie: [] };
    try { return JSON.parse(nodo.textContent || nodo.innerText || '{}'); }
    catch (e) { return { episodi: [], materie: [] }; }
  };

  /* ---- lettura dell'indirizzo (i link dalle pagine-episodio) ---------- */

  Hub.prototype.applicaUrl = function () {
    var q = String(global.location && global.location.search || '');
    if (!q || q.charAt(0) !== '?') return;
    var pezzi = q.slice(1).split('&'), i, kv, k, v;
    for (i = 0; i < pezzi.length; i++) {
      kv = pezzi[i].split('=');
      k = decodeURIComponent(kv[0] || '');
      v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      if (k === 'm') this.filtri.materia = v.toLowerCase();
      else if (k === 'ud') this.filtri.ud = v;
      else if (k === 'ep') this.filtri.ep = v;
      else if (k === 'parte') this.filtri.parte = v.toUpperCase();
      else if (k === 'tag') this.filtri.tag = v;
      else if (k === 'modo' && (v === 'bestie' || v === 'sbagliate')) this.filtri.modo = v;
      else if (k === 'diff' && indiceIn(ORDINE_DIFF, v) >= 0) this.filtri.diff[v] = true;
    }
    /* Un episodio scelto senza materia: la materia la sa il catalogo, e
       tenerla vuota lascerebbe i selettori a raccontare un'altra storia. */
    if (this.filtri.ep && !this.filtri.materia) {
      var e = this.episodio(this.filtri.ep);
      if (e) this.filtri.materia = e.materia;
    }
  };

  Hub.prototype.episodio = function (slug) {
    var eps = this.catalogo.episodi || [], i;
    for (i = 0; i < eps.length; i++) if (eps[i].slug === slug) return eps[i];
    return null;
  };

  /* ---- il vocabolario: tutte le lezioni del catalogo, in fila -------- */

  /* Ogni PARTE di ogni episodio, con lo stato del materiale di QUESTO hub.
     È la lista su cui lavora tutto il resto — filtri, conteggi, catalogo —
     e contiene sempre 2 voci per episodio, anche quando non c'è materiale. */
  Hub.prototype.lezioni = function () {
    if (this._lezioni) return this._lezioni;
    var eps = this.catalogo.episodi || [], fuori = [], i, j;
    for (i = 0; i < eps.length; i++) {
      var e = eps[i];
      for (j = 0; j < (e.parti || []).length; j++) {
        var p = e.parti[j];
        var quanti = this.tipo === 'quiz' ? (p.quiz || 0) : (p.carte || 0);
        var motivo = this.tipo === 'quiz' ? p.motivoQuiz : p.motivoCarte;
        fuori.push({
          k: e.slug + '-' + p.parte,
          slug: e.slug, parte: p.parte, ep: e.ep, epId: e.epId,
          materia: e.materia, titolo: e.titolo, page: e.page,
          ud: p.ud || '', lezione: p.lezione || e.titolo,
          n: quanti, motivo: motivo || '', pronto: quanti > 0
        });
      }
    }
    this._lezioni = fuori;
    return fuori;
  };

  /* Le lezioni che passano i filtri STRUTTURALI (materia/UD/episodio/parte).
     Difficoltà e argomento NON stanno qui: sono filtri sulle singole carte o
     domande, e si applicano dopo (per i quiz con l'aiuto delle facce). */
  Hub.prototype.ammesse = function () {
    var f = this.filtri, tutte = this.lezioni(), fuori = [], i;
    for (i = 0; i < tutte.length; i++) {
      var l = tutte[i];
      if (!l.pronto) continue;
      if (f.materia && l.materia !== f.materia) continue;
      if (f.ud && l.ud !== f.ud) continue;
      if (f.ep && l.slug !== f.ep) continue;
      if (f.parte && l.parte !== f.parte) continue;
      fuori.push(l);
    }
    return fuori;
  };

  /* ---- impalcatura --------------------------------------------------- */

  Hub.prototype.costruisci = function () {
    var doc = this.doc, self = this, n = {};
    svuota(this.radice);
    this.nodi = n;

    var form = el(doc, 'div', { 'class': 'hub-filtri', role: 'group',
      'aria-label': 'Filtri della selezione' });

    n.materia = this.campoSelect(form, 'Materia', 'materia');
    /* «Unità didattica» per esteso, non «UD»: l'etichetta di un campo è il
       posto dove il lettore incontra la parola per la prima volta, e chi si
       affaccia ora alla materia non ha ancora letto nessuna legenda. */
    n.ud = this.campoSelect(form, 'Unità didattica', 'ud');
    n.ep = this.campoSelect(form, 'Episodio', 'ep');
    n.parte = this.campoSelect(form, 'Parte', 'parte');

    /* difficoltà: chip a interruttore, come nei due motori — stessa lingua
       visiva, stesso gesto, e `aria-pressed` porta lo stato senza colore. */
    var rDiff = el(doc, 'div', { 'class': 'hub-riga' });
    rDiff.appendChild(el(doc, 'span', { 'class': 'hub-et' }, 'Difficoltà'));
    n.chips = [];
    for (var i = 0; i < ORDINE_DIFF.length; i++) {
      (function (d) {
        var b = el(doc, 'button', {
          type: 'button', 'class': 'hub-chip', 'aria-pressed': 'false'
        }, ETICHETTA_DIFF[d]);
        b.addEventListener('click', function () {
          self.filtri.diff[d] = !self.filtri.diff[d];
          b.setAttribute('aria-pressed', self.filtri.diff[d] ? 'true' : 'false');
          self.cambiato();
        }, false);
        n.chips.push({ b: b, d: d });
        rDiff.appendChild(b);
      })(ORDINE_DIFF[i]);
    }
    form.appendChild(rDiff);

    /* argomento: 6.315 etichette sui quiz e 2.056 sulle carte. Un menù a
       tendina con seimila voci non è un filtro, è un elenco telefonico:
       campo di testo con suggerimenti, che si scrive e si cerca. */
    var rTag = el(doc, 'div', { 'class': 'hub-riga hub-riga-larga' });
    var lblTag = el(doc, 'label', { 'class': 'hub-campo' }, 'Argomento');
    n.tag = el(doc, 'input', {
      type: 'text', 'class': 'hub-input', list: 'hub-tag-lista',
      placeholder: 'scrivi un argomento…', autocomplete: 'off', spellcheck: 'false'
    });
    n.tag.value = this.filtri.tag;
    n.tagLista = el(doc, 'datalist', { id: 'hub-tag-lista' });
    var t = null;
    n.tag.addEventListener('input', function () {
      if (t) global.clearTimeout(t);
      t = global.setTimeout(function () {
        self.filtri.tag = n.tag.value;
        self.cambiato();
      }, 250);
    }, false);
    n.tag.addEventListener('focus', function () { self.preparaTag(); }, false);
    lblTag.appendChild(n.tag);
    lblTag.appendChild(n.tagLista);
    n.tagNota = el(doc, 'span', { 'class': 'hub-nota' }, '');
    rTag.appendChild(lblTag);
    rTag.appendChild(n.tagNota);
    form.appendChild(rTag);

    n.modo = this.campoSelect(form, 'Cosa studiare', 'modo');
    this.radice.appendChild(form);

    /* Il conteggio è un `aria-live`: cambia a ogni filtro e chi non vede lo
       schermo deve saperlo senza andarlo a cercare. */
    var barra = el(doc, 'div', { 'class': 'hub-barra' });
    n.conteggio = el(doc, 'p', { 'class': 'hub-conteggio', 'aria-live': 'polite' }, '');
    barra.appendChild(n.conteggio);
    n.avvia = el(doc, 'button', { type: 'button', 'class': 'btn btn-primary hub-avvia' },
      this.tipo === 'quiz' ? 'Comincia la serie' : 'Comincia il ripasso');
    n.avvia.addEventListener('click', function () { self.comincia(); }, false);
    barra.appendChild(n.avvia);
    n.pulisci = el(doc, 'button', { type: 'button', 'class': 'btn hub-pulisci' },
      'Azzera i filtri');
    n.pulisci.addEventListener('click', function () { self.azzeraFiltri(); }, false);
    barra.appendChild(n.pulisci);
    this.radice.appendChild(barra);

    n.avviso = el(doc, 'div', { 'class': 'hub-avviso', role: 'alert', hidden: 'hidden' });
    this.radice.appendChild(n.avviso);

    n.motore = el(doc, 'div', { 'class': 'hub-motore' });
    this.radice.appendChild(n.motore);

    n.catalogo = el(doc, 'div', { 'class': 'hub-catalogo' });
    this.radice.appendChild(n.catalogo);
  };

  Hub.prototype.campoSelect = function (dove, etichetta, quale) {
    var doc = this.doc, self = this;
    var riga = el(doc, 'div', { 'class': 'hub-riga' });
    var lbl = el(doc, 'label', { 'class': 'hub-campo' }, etichetta);
    var sel = el(doc, 'select', { 'class': 'hub-select' });
    sel.addEventListener('change', function () {
      self.filtri[quale] = sel.value;
      /* Cambiare materia svuota unità ed episodio: tenerli vorrebbe dire
         mostrare una selezione impossibile («biologia + FIS-UD1») che dà
         sempre zero, e sembrerebbe un guasto invece di una contraddizione. */
      if (quale === 'materia') { self.filtri.ud = ''; self.filtri.ep = ''; }
      if (quale === 'ud') self.filtri.ep = '';
      self.cambiato();
      self.aggiornaSelettori();
    }, false);
    lbl.appendChild(sel);
    riga.appendChild(lbl);
    dove.appendChild(riga);
    return sel;
  };

  Hub.prototype.opzioniIn = function (sel, voci, valore) {
    var doc = this.doc, i;
    svuota(sel);
    for (i = 0; i < voci.length; i++) {
      var o = el(doc, 'option', { value: voci[i].v }, voci[i].t);
      sel.appendChild(o);
    }
    sel.value = valore;
    if (sel.value !== valore) sel.value = '';       /* valore sparito: si torna a «tutte» */
  };

  Hub.prototype.aggiornaSelettori = function () {
    var n = this.nodi, f = this.filtri, tutte = this.lezioni(), i;

    var materie = this.catalogo.materie || [];
    var vm = [{ v: '', t: 'Tutte e tre' }];
    for (i = 0; i < materie.length; i++) {
      /* ICONA + NOME, mai il solo colore: è la regola del progetto sulla
         ridondanza non cromatica, e in un menù a tendina il colore non
         c'è nemmeno. */
      vm.push({ v: materie[i].id, t: materie[i].icona + ' ' + materie[i].nome });
    }
    this.opzioniIn(n.materia, vm, f.materia);

    var viste = {}, vu = [{ v: '', t: 'Tutte le unità' }];
    for (i = 0; i < tutte.length; i++) {
      var l = tutte[i];
      if (!l.pronto || !l.ud) continue;
      if (f.materia && l.materia !== f.materia) continue;
      if (viste[l.ud]) continue;
      viste[l.ud] = 1;
      vu.push({ v: l.ud, t: l.ud });
    }
    this.opzioniIn(n.ud, vu, f.ud);

    var visti = {}, ve = [{ v: '', t: 'Tutti gli episodi' }];
    for (i = 0; i < tutte.length; i++) {
      var e = tutte[i];
      if (!e.pronto) continue;
      if (f.materia && e.materia !== f.materia) continue;
      if (f.ud && e.ud !== f.ud) continue;
      if (visti[e.slug]) continue;
      visti[e.slug] = 1;
      ve.push({ v: e.slug, t: e.epId + ' — ' + e.titolo });
    }
    this.opzioniIn(n.ep, ve, f.ep);

    this.opzioniIn(n.parte, [
      { v: '', t: 'Tutte e due' }, { v: 'A', t: 'Parte A' }, { v: 'B', t: 'Parte B' }
    ], f.parte);

    var vmodo = this.tipo === 'quiz'
      ? [{ v: 'tutto', t: 'Tutte le domande' },
         { v: 'sbagliate', t: 'Solo quelle che ho sbagliato' }]
      : [{ v: 'tutto', t: 'Tutte le carte' },
         { v: 'bestie', t: 'Le mie bestie nere' }];
    this.opzioniIn(n.modo, vmodo, f.modo);
  };

  Hub.prototype.azzeraFiltri = function () {
    this.filtri = { materia: '', ud: '', ep: '', parte: '', diff: {}, tag: '', modo: 'tutto' };
    for (var i = 0; i < this.nodi.chips.length; i++) {
      this.nodi.chips[i].b.setAttribute('aria-pressed', 'false');
    }
    this.nodi.tag.value = '';
    this.aggiornaSelettori();
    this.cambiato();
  };

  Hub.prototype.cambiato = function () {
    this.filtri.modo = this.nodi.modo.value || 'tutto';
    this.aggiornaConteggio();
    this.disegnaCatalogo();
  };

  /* ---- conteggio ------------------------------------------------------ */

  /* Quanto materiale c'è, con i filtri di adesso. Per le carte è esatto solo
     quando il mazzo è già sceso (prima si dice il numero di lezioni); per i
     quiz le facce lo sanno sempre, ed è per questo che esistono. */
  Hub.prototype.aggiornaConteggio = function () {
    var n = this.nodi, amm = this.ammesse(), i;
    var lez = amm.length;
    if (!lez) {
      this.testo(n.conteggio, 'Nessuna lezione con questi filtri: allarga la ' +
        'selezione (o azzera i filtri).');
      n.avvia.disabled = true;
      return;
    }
    n.avvia.disabled = false;

    var quanti = 0;
    var esatto = true;
    if (this.tipo === 'quiz') {
      /* «fino a» invece di un numero secco quando il conto non si SA ancora:
         una cifra precisa e sbagliata è peggio di una dichiaratamente
         approssimata, perché non si presenta come approssimata. */
      esatto = !this.servonoFacce() || this.faccePronte();
      if (esatto) {
        /* Anche le LEZIONI si ricontano: con un argomento scelto, «3 domande ·
           60 lezioni» è falso due volte — le lezioni che quell'argomento ce
           l'hanno sono due o tre, e il 60 farebbe credere che la serie
           spazierà su tutta la materia. */
        lez = 0;
        for (i = 0; i < amm.length; i++) {
          var q = this.domandeAmmesse(amm[i]);
          if (q > 0) { quanti += q; lez++; }
        }
        if (!lez) {
          this.testo(n.conteggio, 'Nessuna domanda con questi filtri: ' +
            'l\'argomento e la difficoltà che hai scelto non stanno insieme in ' +
            'nessuna lezione della selezione.');
          n.avvia.disabled = true;
          return;
        }
      } else {
        for (i = 0; i < amm.length; i++) quanti += amm[i].n;
      }
    } else if (this.servonoFacce() && this.mazziPronti()) {
      var ammK = {};
      for (i = 0; i < amm.length; i++) ammK[amm[i].k] = 1;
      var conto = this.carteAmmesse(ammK);
      quanti = conto.carte;
      lez = conto.lezioni;
      if (!quanti) {
        this.testo(n.conteggio, 'Nessuna carta con questi filtri: l\'argomento ' +
          'e la difficoltà che hai scelto non stanno insieme in nessuna carta ' +
          'della selezione.');
        n.avvia.disabled = true;
        return;
      }
    } else {
      for (i = 0; i < amm.length; i++) quanti += amm[i].n;
      if (this.servonoFacce()) esatto = false;
    }

    var unita = this.tipo === 'quiz' ? ['domanda', 'domande'] : ['carta', 'carte'];
    var testo = (esatto ? '' : 'fino a ') + plurale(quanti, unita[0], unita[1]) +
      ' · ' + plurale(lez, 'lezione', 'lezioni');
    if (!esatto) testo += ' — il conto esatto per argomento e difficoltà si vede al via';
    if (this.filtri.modo === 'bestie') {
      testo += ' · le bestie nere si contano quando il mazzo è aperto';
    } else if (this.filtri.modo === 'sbagliate') {
      testo += ' · ' + plurale(this.quanteSbagliate(), 'sbagliata in registro',
        'sbagliate in registro');
    }
    this.testo(n.conteggio, testo);
  };

  Hub.prototype.testo = function (nodo, s) {
    svuota(nodo);
    nodo.appendChild(this.doc.createTextNode(s));
  };

  Hub.prototype.quanteDiff = function () {
    var q = 0, k;
    for (k in this.filtri.diff) if (this.filtri.diff[k]) q++;
    return q;
  };

  Hub.prototype.quanteSbagliate = function () {
    var reg = (global.Quiz && global.Quiz.sbagliate) ? global.Quiz.sbagliate() : {};
    var q = 0, k;
    for (k in reg) if (reg.hasOwnProperty(k)) q++;
    return q;
  };

  /* ---- facce dei quiz (conteggi senza scaricare le domande) ----------- */

  Hub.prototype.materieAttive = function () {
    if (this.filtri.materia) return [this.filtri.materia];
    var m = this.catalogo.materie || [], fuori = [], i;
    for (i = 0; i < m.length; i++) fuori.push(m[i].id);
    return fuori;
  };

  Hub.prototype.faccePronte = function () {
    var m = this.materieAttive(), i;
    for (i = 0; i < m.length; i++) if (!this.facce[m[i]]) return false;
    return true;
  };

  Hub.prototype.caricaFacce = function () {
    var self = this, m = this.materieAttive(), attese = [], i;
    for (i = 0; i < m.length; i++) {
      (function (mat) {
        if (self.facce[mat]) return;
        attese.push(scarica(self.base + 'quiz/_facce-' + mat + '.json')
          .then(function (d) { self.facce[mat] = (d && d.lezioni) || {}; }));
      })(m[i]);
    }
    return global.Promise.all(attese);
  };

  /* Servono le facce, con i filtri di adesso? Solo difficoltà e argomento le
     chiedono: materia, unità, episodio e parte stanno già nel catalogo in
     pagina. Distinguere i due casi vale 97 KB scaricati in meno su OGNI serie
     che non filtra per argomento — cioè quasi tutte. */
  Hub.prototype.servonoFacce = function () {
    return !!(this.filtri.tag || this.quanteDiff());
  };

  /* Quante domande di QUESTA lezione passano difficoltà+argomento, secondo le
     facce. Senza facce non si indovina: lo dice `faccePronte`. */
  Hub.prototype.domandeAmmesse = function (l) {
    if (!this.servonoFacce()) return l.n;
    var f = this.facce[l.materia];
    var v = f && f[l.k];
    if (!v) return 0;
    var nDiff = this.quanteDiff(), k, tot = 0;
    if (this.filtri.tag) {
      tot = (v.t && v.t[this.filtri.tag]) || 0;
      /* Con difficoltà E argomento insieme le facce non bastano: sanno
         quante per difficoltà e quante per argomento, non l'incrocio. Si dà
         il tetto (il minore dei due) e lo si dichiara come tetto. */
      if (nDiff) {
        var perDiff = 0;
        for (k in v.d) if (v.d.hasOwnProperty(k) && this.filtri.diff[k]) perDiff += v.d[k];
        tot = Math.min(tot, perDiff);
      }
      return tot;
    }
    if (nDiff) {
      for (k in v.d) if (v.d.hasOwnProperty(k) && this.filtri.diff[k]) tot += v.d[k];
      return tot;
    }
    return l.n;
  };

  /* Il vocabolario degli argomenti, per i suggerimenti del campo. Si scarica
     solo quando qualcuno lo chiede: sono 36-73 KB per materia sui quiz, e
     chi non usa il filtro non deve pagarli. */
  Hub.prototype.preparaTag = function () {
    var self = this, n = this.nodi;
    if (this._tagInCorso) return;
    this._tagInCorso = true;
    this.testo(n.tagNota, 'cerco gli argomenti…');
    var attesa = this.tipo === 'quiz'
      ? this.caricaFacce().then(function () { return self.tagDaFacce(); })
      : this.caricaMazzi().then(function (mazzi) { return self.tagDaMazzi(mazzi); });
    attesa.then(function (voci) {
      self._tagInCorso = false;
      svuota(n.tagLista);
      for (var i = 0; i < voci.length && i < 1200; i++) {
        n.tagLista.appendChild(el(self.doc, 'option', { value: voci[i] }));
      }
      self.testo(n.tagNota, voci.length
        ? plurale(voci.length, 'argomento in elenco', 'argomenti in elenco')
        : 'nessun argomento per questa selezione');
      self.aggiornaConteggio();
    })['catch'](function (err) {
      self._tagInCorso = false;
      self.testo(n.tagNota, 'argomenti non disponibili');
      self.avviso(err);
    });
  };

  Hub.prototype.tagDaFacce = function () {
    var amm = this.ammesse(), visti = {}, fuori = [], i, k;
    for (i = 0; i < amm.length; i++) {
      var f = this.facce[amm[i].materia];
      var v = f && f[amm[i].k];
      if (!v || !v.t) continue;
      for (k in v.t) if (v.t.hasOwnProperty(k) && !visti[k]) { visti[k] = 1; fuori.push(k); }
    }
    fuori.sort();
    return fuori;
  };

  Hub.prototype.tagDaMazzi = function (mazzi) {
    var amm = {}, lista = this.ammesse(), visti = {}, fuori = [], i, j;
    for (i = 0; i < lista.length; i++) amm[lista[i].k] = 1;
    for (i = 0; i < mazzi.length; i++) {
      var carte = mazzi[i].carte || [];
      for (j = 0; j < carte.length; j++) {
        if (!amm[carte[j].k]) continue;
        var tg = carte[j].tag || [];
        for (var z = 0; z < tg.length; z++) {
          if (!visti[tg[z]]) { visti[tg[z]] = 1; fuori.push(tg[z]); }
        }
      }
    }
    fuori.sort();
    return fuori;
  };

  /* ---- avvisi --------------------------------------------------------- */

  /* UN GUASTO NON È UN MAZZO VUOTO. È la regola di condotta di studio_fetch.js
     portata fin qui: se la decifratura fallisce lo si SCRIVE, col motivo, e
     il posto del motore resta vuoto — mai riempito di zero carte, che si
     leggerebbero come «nessun risultato per questo filtro». */
  Hub.prototype.avviso = function (err) {
    var doc = this.doc, n = this.nodi;
    svuota(n.avviso);
    n.avviso.removeAttribute('hidden');
    n.avviso.appendChild(el(doc, 'h3', {}, 'I materiali non si sono aperti'));
    n.avviso.appendChild(el(doc, 'p', {},
      (err && err.messaggio) || 'Non sono riuscito a leggere i materiali.'));
    if (err && err.motivo) {
      n.avviso.appendChild(el(doc, 'p', { 'class': 'hub-motivo' },
        'Motivo tecnico: ' + err.motivo + '.'));
    }
    var self = this;
    var b = el(doc, 'button', { type: 'button', 'class': 'btn btn-primary' }, 'Riprova');
    b.addEventListener('click', function () { self.nascondiAvviso(); self.comincia(); }, false);
    n.avviso.appendChild(b);
    n.avvia.disabled = false;
    this.testo(n.avvia, this.tipo === 'quiz' ? 'Comincia la serie' : 'Comincia il ripasso');
  };

  Hub.prototype.nascondiAvviso = function () {
    svuota(this.nodi.avviso);
    this.nodi.avviso.setAttribute('hidden', 'hidden');
  };

  /* Il vuoto SPIEGATO: nessun risultato, ma per una ragione che si legge. */
  Hub.prototype.vuoto = function (titolo, spiega) {
    var doc = this.doc, self = this, n = this.nodi;
    svuota(n.motore);
    var p = el(doc, 'div', { 'class': 'hub-vuoto', role: 'status', tabindex: '-1' });
    p.appendChild(el(doc, 'h3', {}, titolo));
    p.appendChild(el(doc, 'p', {}, spiega));
    var b = el(doc, 'button', { type: 'button', 'class': 'btn' }, 'Azzera i filtri');
    b.addEventListener('click', function () { self.azzeraFiltri(); }, false);
    p.appendChild(b);
    n.motore.appendChild(p);
    try { p.focus(); } catch (e) { }
  };

  Hub.prototype.attesa = function (testo) {
    var doc = this.doc, n = this.nodi;
    svuota(n.motore);
    var p = el(doc, 'div', { 'class': 'hub-attesa', role: 'status' }, testo);
    n.motore.appendChild(p);
    return p;
  };

  /* ---- il via --------------------------------------------------------- */

  Hub.prototype.comincia = function () {
    this.nascondiAvviso();
    this.nodi.avvia.disabled = true;
    if (this.tipo === 'quiz') this.cominciaQuiz();
    else this.cominciaCarte();
  };

  Hub.prototype.fine = function () {
    this.nodi.avvia.disabled = false;
  };

  /* ---- flashcards ----------------------------------------------------- */

  Hub.prototype.caricaMazzi = function () {
    var self = this, m = this.materieAttive(), attese = [], i;
    for (i = 0; i < m.length; i++) {
      (function (mat) {
        attese.push(scarica(self.base + 'flashcards/_mazzo-' + mat + '.json')
          .then(function (d) { self.mazzi[mat] = d; return d; }));
      })(m[i]);
    }
    return global.Promise.all(attese);
  };

  /* I mazzi delle materie attive sono GIÀ in memoria? Se sì il conteggio per
     argomento e difficoltà si fa esatto senza scaricare niente. */
  Hub.prototype.mazziPronti = function () {
    var m = this.materieAttive(), i;
    for (i = 0; i < m.length; i++) if (!this.mazzi[m[i]]) return false;
    return true;
  };

  /* Quante carte passano TUTTI i filtri, con i mazzi che ci sono in memoria. */
  Hub.prototype.carteAmmesse = function (ammK) {
    var m = this.materieAttive(), tot = 0, lez = {}, i, j;
    for (i = 0; i < m.length; i++) {
      var lista = (this.mazzi[m[i]] && this.mazzi[m[i]].carte) || [];
      for (j = 0; j < lista.length; j++) {
        var c = lista[j];
        if (!ammK[c.k]) continue;
        if (this.quanteDiff() && !this.filtri.diff[c.diff]) continue;
        if (this.filtri.tag && indiceIn(c.tag || [], this.filtri.tag) < 0) continue;
        tot++;
        lez[c.k] = 1;
      }
    }
    var n = 0, k;
    for (k in lez) if (lez.hasOwnProperty(k)) n++;
    return { carte: tot, lezioni: n };
  };

  Hub.prototype.cominciaCarte = function () {
    var self = this;
    var amm = this.ammesse(), ammK = {}, i;
    for (i = 0; i < amm.length; i++) ammK[amm[i].k] = amm[i];
    this.attesa('Apro le carte…');
    var t0 = (new Date()).getTime();
    this.caricaMazzi().then(function (mazzi) {
      var carte = [], j, z;
      for (j = 0; j < mazzi.length; j++) {
        var lista = (mazzi[j] && mazzi[j].carte) || [];
        for (z = 0; z < lista.length; z++) {
          var c = lista[z];
          if (!ammK[c.k]) continue;
          if (self.quanteDiff() && !self.filtri.diff[c.diff]) continue;
          if (self.filtri.tag && indiceIn(c.tag || [], self.filtri.tag) < 0) continue;
          carte.push(c);
        }
      }
      self.fine();
      /* i mazzi ora sono in memoria: il conteggio in cima puo' smettere di
         dire «fino a» e diventare esatto */
      self.aggiornaConteggio();
      if (!carte.length) {
        self.vuoto('Nessuna carta con questi filtri',
          'Le lezioni scelte ci sono, ma nessuna carta ha insieme la difficoltà ' +
          'e l\'argomento che hai chiesto. Togli uno dei due e riprova.');
        return;
      }
      var materie = {};
      for (j = 0; j < carte.length; j++) materie[ammK[carte[j].k].materia] = 1;
      var quante = 0, unica = '';
      for (var mm in materie) if (materie.hasOwnProperty(mm)) { quante++; unica = mm; }

      svuota(self.nodi.motore);
      var punto = el(self.doc, 'div', {});
      self.nodi.motore.appendChild(punto);
      self.motoreVivo = global.Flashcards.monta(punto, {
        /* niente `slug`: il mazzo NON è di una lezione. La chiave esplicita
           è quella che tiene insieme i progressi fra un filtro e l'altro. */
        materia: quante === 1 ? unica : '',
        lezione: self.titoloSelezione(),
        carte: carte
      }, {
        chiave: CHIAVE_CARTE,
        titolo: self.titoloSelezione(),
        avvio: self.filtri.modo === 'bestie' ? 'bestie' : ''
      });
      self.misura(t0, carte.length, 'carte');
    })['catch'](function (err) {
      self.fine();
      svuota(self.nodi.motore);
      self.avviso(err);
    });
  };

  /* ---- quiz ------------------------------------------------------------ */

  Hub.prototype.recenti = function () {
    var v = leggiLS(CHIAVE_RECENTI);
    return esisteArray(v) ? v : [];
  };

  /* Quali lezioni comporranno questa serie. Al più MAX_LEZIONI, mescolate, con
     quelle già usate di recente in coda: due serie di fila non insistono sugli
     stessi episodi, e nel giro di qualche serie il filtro viene coperto tutto. */
  Hub.prototype.scegliLezioni = function (amm) {
    var recenti = this.recenti(), fresche = [], usate = [], i;
    for (i = 0; i < amm.length; i++) {
      (indiceIn(recenti, amm[i].k) >= 0 ? usate : fresche).push(amm[i]);
    }
    mescolaIn(fresche);
    mescolaIn(usate);
    var fila = fresche.concat(usate);
    return fila.slice(0, MAX_LEZIONI);
  };

  Hub.prototype.cominciaQuiz = function () {
    var self = this;
    var t0 = (new Date()).getTime();
    this.attesa('Scelgo le lezioni…');
    /* Le facce servono prima di scegliere SOLO se c'è un filtro per argomento
       o difficoltà: senza di loro si scaricherebbero lezioni che quel filtro
       non lo soddisfano, e la serie uscirebbe corta senza sapere perché.
       Quando il filtro non c'è, non si scaricano affatto (vedi `servonoFacce`). */
    (this.servonoFacce() ? this.caricaFacce() : global.Promise.resolve()).then(function () {
      var amm = self.ammesse(), buone = [], i;
      for (i = 0; i < amm.length; i++) {
        if (self.domandeAmmesse(amm[i]) > 0) buone.push(amm[i]);
      }
      if (!buone.length) {
        self.fine();
        self.vuoto('Nessuna domanda con questi filtri',
          'Le lezioni scelte non hanno domande con la difficoltà e l\'argomento ' +
          'che hai chiesto. Togli uno dei due filtri e riprova.');
        return null;
      }
      var scelte = self.scegliLezioni(buone);
      var p = self.attesa('Scarico ' + plurale(scelte.length, 'lezione', 'lezioni') + '…');
      var fatte = 0;
      var attese = [], j;
      for (j = 0; j < scelte.length; j++) {
        (function (l) {
          attese.push(scarica(self.base + 'quiz/' + l.k + '.json').then(function (d) {
            fatte++;
            self.testo(p, 'Scarico le lezioni… ' + fatte + ' di ' + scelte.length);
            return { l: l, d: d };
          }));
        })(scelte[j]);
      }
      return global.Promise.all(attese).then(function (blocchi) {
        return { scelte: scelte, blocchi: blocchi };
      });
    }).then(function (esito) {
      if (!esito) return;
      var domande = [], i, j;
      for (i = 0; i < esito.blocchi.length; i++) {
        var l = esito.blocchi[i].l;
        var lista = (esito.blocchi[i].d && esito.blocchi[i].d.domande) || [];
        for (j = 0; j < lista.length; j++) {
          var q = lista[j];
          if (self.quanteDiff() && !self.filtri.diff[q.diff]) continue;
          if (self.filtri.tag && indiceIn(q.tag || [], self.filtri.tag) < 0) continue;
          /* la provenienza viaggia con la domanda: il banco è misto e il
             riepilogo delle sbagliate la stampa riga per riga */
          domande.push({
            id: q.id, tipo: q.tipo, tag: q.tag, diff: q.diff, stem: q.stem,
            opzioni: q.opzioni, corretta: q.corretta, perche: q.perche,
            risposta: q.risposta, varianti: q.varianti, errore: q.errore,
            slug: l.slug, parte: l.parte, materia: l.materia,
            lezione: l.epId + ' ' + l.titolo + ' · parte ' + l.parte
          });
        }
      }
      if (self.filtri.modo === 'sbagliate') {
        var reg = self.quanteSbagliate() ? global.Quiz.sbagliate() : {};
        var soloQueste = [];
        for (i = 0; i < domande.length; i++) if (reg[domande[i].id]) soloQueste.push(domande[i]);
        if (!soloQueste.length) {
          self.fine();
          self.vuoto('Nessuna domanda sbagliata, qui',
            'Il registro delle domande da recuperare è vuoto per questa ' +
            'selezione: o non hai ancora sbagliato niente qui, oppure le hai ' +
            'già recuperate tutte. Passa a «tutte le domande» per allenarti lo stesso.');
          return;
        }
        domande = soloQueste;
      }
      self.fine();
      if (!domande.length) {
        self.vuoto('Nessuna domanda con questi filtri',
          'Le lezioni sono arrivate, ma nessuna domanda ha insieme la ' +
          'difficoltà e l\'argomento che hai chiesto.');
        return;
      }
      /* le lezioni di questo giro vanno in coda al prossimo */
      var chiavi = [], k;
      for (k = 0; k < esito.scelte.length; k++) chiavi.push(esito.scelte[k].k);
      var anello = self.recenti().concat(chiavi);
      if (anello.length > RECENTI_MAX) anello = anello.slice(anello.length - RECENTI_MAX);
      scriviLS(CHIAVE_RECENTI, anello);

      var materie = {}, quante = 0, unica = '';
      for (i = 0; i < domande.length; i++) materie[domande[i].materia] = 1;
      for (k in materie) if (materie.hasOwnProperty(k)) { quante++; unica = k; }

      svuota(self.nodi.motore);
      var punto = el(self.doc, 'div', {});
      self.nodi.motore.appendChild(punto);
      self.motoreVivo = global.Quiz.monta(punto, {
        materia: quante === 1 ? unica : '',
        lezione: self.titoloSelezione(),
        domande: domande
      }, { modo: 'lezione', titolo: self.titoloSelezione() });
      self.misura(t0, domande.length, 'domande');
    })['catch'](function (err) {
      self.fine();
      svuota(self.nodi.motore);
      self.avviso(err);
    });
  };

  /* ---- misura del costo (§ prestazioni) ------------------------------- */

  /* Il tempo dal click alla prima carta finisce in console, non a schermo:
     serve a chi misura, non a chi studia. È l'unico modo onesto di dire
     «quanto ci mette» — un numero preso dal vero, non una speranza. */
  Hub.prototype.misura = function (t0, quanti, cosa) {
    var ms = (new Date()).getTime() - t0;
    this.ultimaMisura = { ms: ms, quanti: quanti, cosa: cosa };
    try {
      if (global.console && global.console.info) {
        global.console.info('[hub] ' + this.tipo + ': ' + quanti + ' ' + cosa +
          ' pronte in ' + ms + ' ms');
      }
    } catch (e) { }
  };

  /* ---- titolo leggibile della selezione ------------------------------- */

  Hub.prototype.titoloSelezione = function () {
    var f = this.filtri, pezzi = [];
    if (f.ep) {
      var e = this.episodio(f.ep);
      pezzi.push(e ? (e.epId + ' ' + e.titolo) : f.ep);
    } else if (f.ud) {
      pezzi.push('Unità ' + f.ud);
    } else if (f.materia) {
      pezzi.push(f.materia.charAt(0).toUpperCase() + f.materia.slice(1));
    } else {
      pezzi.push('Tutto il programma');
    }
    if (f.parte) pezzi.push('parte ' + f.parte);
    if (f.tag) pezzi.push('«' + f.tag + '»');
    var d = [], k;
    for (k in f.diff) if (f.diff[k]) d.push(ETICHETTA_DIFF[k] || k);
    if (d.length) pezzi.push(d.join(' + '));
    if (f.modo === 'bestie') pezzi.push('bestie nere');
    if (f.modo === 'sbagliate') pezzi.push('solo le sbagliate');
    return pezzi.join(' · ');
  };

  /* ---- il catalogo: 60 su 60, sempre ---------------------------------- */

  Hub.prototype.disegnaCatalogo = function () {
    var doc = this.doc, self = this, n = this.nodi;
    var eps = this.catalogo.episodi || [];
    svuota(n.catalogo);

    var det = el(doc, 'details', { 'class': 'hub-tutti' });
    var somm = el(doc, 'summary', {});
    var nomeM = {}, i;
    var mats = this.catalogo.materie || [];
    for (i = 0; i < mats.length; i++) nomeM[mats[i].id] = mats[i];

    var conta = { pronte: 0, spente: 0, episodi: eps.length };
    var ul = el(doc, 'ul', { 'class': 'hub-elenco' });
    for (i = 0; i < eps.length; i++) {
      var e = eps[i];
      var li = el(doc, 'li', { 'class': 'hub-ep' });
      var m = nomeM[e.materia] || { icona: '', nome: e.materia };
      var testa = el(doc, 'div', { 'class': 'hub-ep-t' });
      testa.appendChild(el(doc, 'span', { 'class': 'hub-ep-m' },
        m.icona + ' ' + m.nome));
      testa.appendChild(el(doc, 'span', { 'class': 'hub-ep-id' }, e.epId));
      testa.appendChild(el(doc, 'span', { 'class': 'hub-ep-tit' }, e.titolo));
      li.appendChild(testa);

      var parti = el(doc, 'div', { 'class': 'hub-parti' });
      for (var j = 0; j < (e.parti || []).length; j++) {
        var p = e.parti[j];
        var quanti = this.tipo === 'quiz' ? (p.quiz || 0) : (p.carte || 0);
        var motivo = (this.tipo === 'quiz' ? p.motivoQuiz : p.motivoCarte) || '';
        if (quanti > 0) {
          conta.pronte++;
          (function (slug, parte) {
            var b = el(doc, 'button', { type: 'button', 'class': 'hub-parte' },
              'Parte ' + parte + ' · ' + numero(quanti));
            b.addEventListener('click', function () {
              self.filtri.materia = self.episodio(slug).materia;
              self.filtri.ud = '';
              self.filtri.ep = slug;
              self.filtri.parte = parte;
              self.aggiornaSelettori();
              self.cambiato();
              self.comincia();
            }, false);
            parti.appendChild(b);
          })(e.slug, p.parte);
        } else {
          conta.spente++;
          /* SPENTA, NON TOLTA. Il motivo è scritto accanto: un episodio che
             sparisce dall'elenco è un buco, e i buchi qui non si aprono. */
          var sp = el(doc, 'span', {
            'class': 'hub-parte hub-parte-spenta', 'aria-disabled': 'true'
          }, 'Parte ' + p.parte + ' · non disponibile');
          sp.setAttribute('title', motivo || 'materiale non generato');
          parti.appendChild(sp);
          parti.appendChild(el(doc, 'span', { 'class': 'hub-motivo' },
            motivo || 'materiale non generato'));
        }
      }
      li.appendChild(parti);
      ul.appendChild(li);
    }

    var cosa = this.tipo === 'quiz' ? 'con le domande' : 'con le carte';
    somm.appendChild(doc.createTextNode(
      'Tutti gli episodi: ' + conta.episodi + ' su ' + conta.episodi + ' in elenco · ' +
      conta.pronte + ' parti ' + cosa +
      (conta.spente ? ' · ' + conta.spente + ' parti spente, col motivo' : '')));
    det.appendChild(somm);
    var intro = el(doc, 'p', { 'class': 'hub-intro' },
      'L\'elenco è quello del corso, non quello dei file: se una parte non ha ' +
      'ancora il materiale resta qui, spenta, con scritto perché. Così un ' +
      'episodio non può sparire in silenzio.');
    det.appendChild(intro);
    det.appendChild(ul);
    n.catalogo.appendChild(det);
    /* Il conto lo pubblica anche il DOM, così un guard può leggerlo dal
       risultato invece che fidarsi del generatore. */
    n.catalogo.setAttribute('data-episodi', String(conta.episodi));
    n.catalogo.setAttribute('data-parti-pronte', String(conta.pronte));
    n.catalogo.setAttribute('data-parti-spente', String(conta.spente));
  };

  /* ------------------------------------------------------------------ *
   * API pubblica + avvio automatico                                     *
   * ------------------------------------------------------------------ */

  function monta(radice, opzioni) {
    if (typeof radice === 'string') radice = global.document.getElementById(radice);
    if (!radice) return null;
    if (!global.Promise || !global.fetch) {
      svuota(radice);
      radice.appendChild(el(radice.ownerDocument || global.document, 'p', {},
        'Questo browser non sa caricare i materiali: serve un browser recente.'));
      return null;
    }
    return new Hub(radice, opzioni);
  }

  function avvia() {
    var doc = global.document;
    if (!doc) return;
    var nodi = doc.querySelectorAll('[data-hub]'), i;
    for (i = 0; i < nodi.length; i++) {
      if (!nodi[i].getAttribute('data-hub-montato')) {
        nodi[i].setAttribute('data-hub-montato', '1');
        monta(nodi[i]);
      }
    }
  }

  var StudioHub = {
    monta: monta,
    avvia: avvia,
    MAX_LEZIONI: MAX_LEZIONI,
    CHIAVE_CARTE: CHIAVE_CARTE,
    _logica: { numero: numero, plurale: plurale, mescolaIn: mescolaIn }
  };

  global.StudioHub = StudioHub;
  if (typeof module !== 'undefined' && module.exports) module.exports = StudioHub;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', avvia, false);
    } else {
      avvia();
    }
  }

})(typeof window !== 'undefined' ? window : this);
