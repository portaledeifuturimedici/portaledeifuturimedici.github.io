/* =====================================================================
   scatole.js — le SCATOLE DI RIPASSO nella copia FULL (/studio/scatole/)
   Vanilla JS, ZERO dipendenze, niente CDN, niente document.write.
   Compatibile ES5 (var/function, nessuna arrow, nessun template literal,
   niente padStart, niente async): gira sui browser mobili anche vecchiotti.

   DA DOVE VIENE. Il sistema l'ha progettato Luca Pelliccia (repo privato
   Zaahaard/scatole-ripasso-pfm, ripasso.html, 2026-09-14): esami, un
   calendario che fa uscire UN argomento al giorno per esame, scatole Leitner
   su due percorsi. L'utente l'ha voluto dentro lo study pack il 2026-09-15.
   La LOGICA e' la sua; cambiano cinque cose, tutte misurate sull'originale:
     1. le DATE sono giorni di calendario in UTC, non istanti locali: con
        `mezzanotte locale + n*86400000` l'originale saltava il 26 ottobre
        (fine dell'ora legale) e anticipava di un giorno le scadenze che lo
        attraversavano;
     2. i colori vengono dalla palette del sito (site.css), i font sono quelli
        del sito: nessuna richiesta a Google Fonts;
     3. gli intervalli dei due percorsi NON sono scritti qui: arrivano dal
        generatore (`SCATOLE_PERCORSI` in site_build.py) nell'isola JSON
        `#scatole-catalogo`, insieme agli episodi del corso da cui partire;
     4. un valore illeggibile in memoria non viene piu' sovrascritto: si mette
        da parte in `scatole.v1.studio.guasto` prima di ripartire;
     5. niente esami di esempio (erano di Gastroenterologia): si parte vuoti,
        o da una materia del semestre filtro con i suoi episodi.

   MONTAGGIO
     <div data-scatole></div>
     <script type="application/json" id="scatole-catalogo">{...}</script>
     <script src="../assets/scatole.js" defer></script>

   CATALOGO (lo scrive site_build.pagina_scatole)
     {"percorsi":[{"id":"rapido","titolo":"...","breve":"...","iv":[1,3,7]}, ...],
      "materie":[{"m":"fisica","nome":"Fisica","episodi":[{"t":"...","u":"s1f01.html"}]}],
      "base":"../appunti/"}

   STATO in localStorage, chiave `scatole.v1.studio` (la dichiara l'informativa)
     {v:1, esami:[{id,nome,materia,inizio,dataEsame,giorni:{"AAAA-MM-GG":{t,esito}},ultimoGiorno,
                   pref:{giorni:[lun..dom bool],ripasso}}],
      argomenti:[{id,nome,esame,track,box,ultimo,creato,ripassi,pendente,u,piano}]}
   E' la stessa forma dell'originale (v:2 di Luca): un suo backup si importa.
   `pref` e `piano` sono campi in piu' e facoltativi: un backup che non li ha
   riceve le preferenze di base e il programma si ricalcola all'apertura.

   PROGRAMMA DI STUDIO (utente 2026-09-25). Con la data d'esame, gli argomenti
   MAI studiati (senza `ultimo` e non in coda) si distribuiscono da soli, in
   modo uniforme e nell'ordine del corso, sui giorni in cui lo studente vuole
   studiare cose nuove (`pref.giorni`, di base lun-ven), fermandosi
   `pref.ripasso` giorni prima dell'esame (di base 7). `piano` e' il giorno
   previsto per il primo studio: prima di quel giorno l'argomento non esce
   come uscita di ripasso, e segnarlo «studiato» lo mette in scatola 1. Il
   programma si rifa' a ogni cambio di data, preferenze o argomenti; chi
   resta indietro non viene spostato in silenzio: si vede, e si ridistribuisce
   con un gesto.

   DI CHI SONO LE SCATOLE IN PAGINA (revisione della fetta S2b, 2026-09-29).
   Con l'account le scatole si sincronizzano (studio_sync.js), e sullo stesso
   browser possono passare due studenti. Tre regole:
     1. finche' i dati del browser sono legati a un account e il token di adesso
        non e' confermato come suo (`Sync.inAttesa`), la pagina non mostra ne'
        modifica niente: aspetta la lettura, e se la rete non c'e' lo dice;
     2. prima di scrivere si guarda che la copia in memoria sia ancora di chi c'e'
        adesso (account del legame + token, `diChiOra`): se in un'altra scheda e'
        entrato un altro account non si scrive, si rilegge (`cambioDiMano`);
     3. le altre schede si ascoltano (evento `storage`): un cambio d'account si
        vede subito, e una scrittura dello stesso account ridisegna.
   Per questo la pagina carica questo file DOPO studio_sync.js (page(), `scatole`).
   ===================================================================== */

(function (global) {
  'use strict';

  var CHIAVE = 'scatole.v1.studio';
  var GIORNO = 86400000;
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
              'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var DOW = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

  /* ---------------------------------------------------------------- *
   * date: giorni di calendario, aritmetica in UTC                     *
   * ---------------------------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function chiaveUTC(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function msDi(s) {
    var p = String(s).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function OGGI() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function piu(s, n) { return chiaveUTC(new Date(msDi(s) + n * GIORNO)); }
  function diffGiorni(a, b) { return Math.round((msDi(a) - msDi(b)) / GIORNO); }
  function locale(s) {
    var p = String(s).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function dataLunga(s) {
    return locale(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function dataBreve(s) { return locale(s).toLocaleDateString('it-IT'); }
  function eChiave(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  /* Una data d'esame plausibile. Il campo data del browser emette `change` a
     ogni cifra dell'anno (0002, 0020, 0202, 2026): senza questo filtro si
     salvava «0002» e il ridisegno del pannello toglieva il focus a meta'. */
  function eDataEsame(s) {
    if (!eChiave(s)) return false;
    var a = Number(s.slice(0, 4));
    return a >= 2000 && a <= 2100;
  }
  function giornoSett(s) { return (new Date(msDi(s)).getUTCDay() + 6) % 7; }
  function prefBase() { return { giorni: [true, true, true, true, true, false, false], ripasso: 7 }; }
  function normPref(p) {
    if (!p || Object.prototype.toString.call(p.giorni) !== '[object Array]' || p.giorni.length !== 7) return null;
    var g = [], almeno = false;
    for (var i = 0; i < 7; i++) { g.push(p.giorni[i] === true); if (g[i]) almeno = true; }
    if (!almeno) return null;
    var r = Math.floor(Number(p.ripasso));
    if (!(r >= 0)) r = 7;
    return { giorni: g, ripasso: Math.min(r, 60) };
  }
  function plur(n, s, p) { return n === 1 ? s : p; }
  function nid() { return Math.random().toString(36).slice(2, 10); }

  /* ---------------------------------------------------------------- *
   * DOM                                                               *
   * ---------------------------------------------------------------- */
  function el(tag, cls, testo) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (testo !== undefined && testo !== null) n.textContent = testo;
    return n;
  }
  function bottone(cls, testo, azione) {
    var b = el('button', cls, testo);
    b.type = 'button';
    if (azione) b.onclick = azione;
    return b;
  }

  function Scatole(radice, catalogo) {
    this.radice = radice;
    this.cat = catalogo;
    this.percorsi = {};
    this.ordine = [];
    var i;
    for (i = 0; i < catalogo.percorsi.length; i++) {
      this.percorsi[catalogo.percorsi[i].id] = catalogo.percorsi[i];
      this.ordine.push(catalogo.percorsi[i].id);
    }
    this.materie = {};
    for (i = 0; i < (catalogo.materie || []).length; i++) {
      this.materie[catalogo.materie[i].m] = catalogo.materie[i];
    }
    this.attivo = null;
    this.vista = this.ordine[0];
    this.mese = null;
    this.S = this.carica();
    this.migra();
    this.costruisci();
    if (!this.attivo && this.S.esami.length) this.attivo = this.S.esami[0].id;
    this.render();
    /* la sincronizzazione ha scritto qualcosa (fetta S2, secondo tempo): `suStato`;
       un'ALTRA SCHEDA ha scritto (o e' entrato un altro account): `suMemoria` */
    var self = this;
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('studio:stato', function (ev) {
        try { self.suStato(ev && ev.detail); } catch (e) { /* il ripasso non si ferma */ }
      });
      global.addEventListener('storage', function (ev) {
        try { self.suMemoria(ev); } catch (e2) { /* idem */ }
      });
    }
    /* (se i dati del browser sono di un account e il token non e' ancora confermato,
       il `render` qui sopra ha gia' messo la pagina in attesa e chiesto la lettura:
       vedi `inAttesa`) */
  }

  var P = Scatole.prototype;

  /* ---------------------------------------------------------------- *
   * stato                                                             *
   * ---------------------------------------------------------------- */
  P.vuoto = function () { return { v: 1, esami: [], argomenti: [] }; };

  /* Rende utilizzabile uno stato letto da fuori (memoria o backup): scarta cio'
     che non ha la forma giusta invece di rompere il disegno a meta'. Restituisce
     null se non c'e' niente di riconoscibile. */
  P.normalizza = function (d) {
    if (!d || Object.prototype.toString.call(d.esami) !== '[object Array]' ||
        Object.prototype.toString.call(d.argomenti) !== '[object Array]') return null;
    var self = this, oggi = OGGI(), ids = {};
    var esami = [], argomenti = [];
    d.esami.forEach(function (e) {
      if (!e || typeof e.id !== 'string' || typeof e.nome !== 'string') return;
      var giorni = {};
      if (e.giorni && typeof e.giorni === 'object') {
        Object.keys(e.giorni).forEach(function (k) {
          var g = e.giorni[k];
          if (eChiave(k) && g && typeof g.t === 'string') giorni[k] = { t: g.t, esito: g.esito || undefined };
        });
      }
      ids[e.id] = true;
      esami.push({ id: e.id, nome: e.nome.slice(0, 60),
                   materia: self.materie[e.materia] ? e.materia : null,
                   inizio: eChiave(e.inizio) ? e.inizio : oggi,
                   dataEsame: eDataEsame(e.dataEsame) ? e.dataEsame : null,
                   giorni: giorni,
                   ultimoGiorno: eChiave(e.ultimoGiorno) ? e.ultimoGiorno : null,
                   pref: normPref(e.pref) });
    });
    d.argomenti.forEach(function (t) {
      if (!t || typeof t.id !== 'string' || typeof t.nome !== 'string' || !ids[t.esame]) return;
      var track = self.percorsi[t.track] ? t.track : self.ordine[0];
      var n = self.percorsi[track].iv.length;
      var box = Math.floor(Number(t.box));
      if (!(box >= 0)) box = 0;
      if (box > n - 1) box = n - 1;
      argomenti.push({ id: t.id, nome: t.nome.slice(0, 90), esame: t.esame, track: track, box: box,
                       ultimo: eChiave(t.ultimo) ? t.ultimo : null,
                       creato: eChiave(t.creato) ? t.creato : (eChiave(t.ultimo) ? t.ultimo : oggi),
                       ripassi: Math.max(0, Math.floor(Number(t.ripassi)) || 0),
                       pendente: eChiave(t.pendente) ? t.pendente : null,
                       u: typeof t.u === 'string' ? t.u : '',
                       piano: eChiave(t.piano) ? t.piano : null });
    });
    return { v: 1, esami: esami, argomenti: argomenti };
  };

  P.carica = function () {
    var raw = null;
    /* di chi e' la copia che si legge adesso (vedi `diChiOra` e `salva`) */
    this.chi = this.diChiOra();
    try { raw = global.localStorage && global.localStorage.getItem(CHIAVE); } catch (e) { raw = null; }
    /* cio' che c'era quando l'abbiamo letto: la base per unire cio' che un altro
       (la sincronizzazione, un'altra scheda) scrive DOPO (vedi `salva`) */
    this.letto = typeof raw === 'string' ? raw : null;
    if (!raw) return this.vuoto();
    var d = null;
    try { d = this.normalizza(JSON.parse(raw)); } catch (e2) { d = null; }
    if (d) return d;
    /* illeggibile: prima si mette da parte, poi si riparte. L'originale lo
       sovrascriveva con gli esempi al primo disegno. */
    try { global.localStorage.setItem(CHIAVE + '.guasto', raw); } catch (e3) {}
    this.avvisoIniziale = 'I dati salvati non erano leggibili: li abbiamo messi da parte e si riparte da zero.';
    return this.vuoto();
  };

  /* esami senza preferenze (dati di prima del programma, backup vecchi):
     ricevono quelle di base e il loro programma */
  P.migra = function () {
    var self = this;
    this.S.esami.forEach(function (e) {
      if (e.pref) return;
      e.pref = prefBase();
      self.ripianifica(e);
    });
  };

  /* IL SALVATAGGIO NON COPRE CIO' CHE E' ARRIVATO NEL FRATTEMPO (fetta S2,
     secondo tempo, 2026-09-29). Con l'account le scatole si sincronizzano
     (motori_assets/studio_sync.js, nome `scatole`): una lettura dal server puo'
     scrivere in memoria del browser una versione UNITA con quella di un altro
     dispositivo, mentre questa pagina tiene in `this.S` la copia di prima.
     Riscriverla com'e' cancellerebbe l'unione qui, e la spinta successiva
     porterebbe al server la copia vecchia come la piu' nuova: i ripassi fatti
     sull'altro dispositivo sparirebbero. Quindi, se la memoria e' cambiata da
     quando l'abbiamo letta o scritta noi, prima di scrivere si UNISCE a tre vie
     (base = cio' che avevamo letto, qui = `this.S`, la' = cio' che c'e' adesso)
     con la regola del modulo (`Sync.unisciScatole`): valgono le modifiche di
     tutte e due. Se la memoria e' stata SVUOTATA da fuori (la sincronizzazione
     toglie le scatole di un account quando ne entra un altro) la copia in memoria
     era di quell'account e non si scrive: si riparte da cio' che c'e'. Poi, se
     c'e' la sincronizzazione, `Sync.spingi('scatole')`: parte solo se il
     contenuto e' davvero cambiato, e senza account o senza server non succede
     niente. */
  P.salva = function () {
    var ls = global.localStorage, fuori = null;
    /* (revisione della fetta S2b) finche' il token non e' confermato non si scrive
       niente: i dati in memoria possono essere di un altro studente (`inAttesa`) */
    if (this.inAttesa()) return;
    /* LA COPIA IN MEMORIA E' ANCORA DI CHI C'E' ADESSO? Con due schede sullo stesso
       browser, nell'altra puo' essere entrato un altro account (la sincronizzazione ha
       gia' messo in memoria le SUE scatole): unire la copia di prima a quelle
       porterebbe gli esami di X nell'account di Y, e la spinta li manderebbe al server
       di Y. Se l'account del legame o il token sono cambiati da quando si e' letto, non
       si scrive niente: `render` ricarica da cio' che c'e' (`cambioDiMano`). */
    if (!this.stessaMano()) { this.cambioMano = true; return; }
    try { fuori = ls ? ls.getItem(CHIAVE) : null; } catch (e0) { fuori = null; }
    if (fuori !== this.letto && this.letto !== undefined) {
      if (fuori === null) {
        this.S = this.carica();
        this.migra();
        this.daRidisegnare = true;
      } else if (global.Sync && typeof global.Sync.unisciScatole === 'function') {
        var la = null, base = null, m = null;
        try { la = this.normalizza(JSON.parse(fuori)); } catch (e1) { la = null; }
        try { base = this.letto ? this.normalizza(JSON.parse(this.letto)) : null; } catch (e2) { base = null; }
        if (la) {
          try { m = this.normalizza(global.Sync.unisciScatole(base, this.S, la, {}).d); } catch (e3) { m = null; }
        }
        if (m) { this.S = m; this.migra(); this.daRidisegnare = true; }
      }
    }
    var testo = JSON.stringify(this.S);
    /* niente di cambiato: non si riscrive (ogni disegno passa di qui, e una scrittura
       uguale sveglierebbe le altre schede per niente) */
    if (testo === fuori) { this.letto = testo; return; }
    try { ls.setItem(CHIAVE, testo); this.letto = testo; }
    catch (e) { this.avviso('La memoria del browser non è disponibile: i dati non vengono salvati.'); return; }
    if (global.Sync && typeof global.Sync.spingi === 'function') {
      try { global.Sync.spingi('scatole'); } catch (e4) { /* la sincronizzazione non ferma il ripasso */ }
    }
  };

  /* ---- DI CHI SONO I DATI IN PAGINA (revisione della fetta S2b, 2026-09-29) ----
     L'account del legame, se il token di adesso e' quello del legame (Sync.legato), e
     il token: se uno dei due cambia fra la lettura e il salvataggio, la copia in
     memoria e' di qualcun altro. */
  P.diChiOra = function () {
    var u = null, t = '';
    try { u = global.Sync && typeof global.Sync.legato === 'function' ? global.Sync.legato() : null; } catch (e) { u = null; }
    try { t = global.localStorage ? (global.localStorage.getItem('appunti-tok') || '') : ''; } catch (e2) { t = ''; }
    return { u: u || null, t: t };
  };
  /* la copia letta (`this.chi`) e' ancora in mano a chi c'e' adesso? Lo stesso token, e
     lo stesso account del legame; un browser che si lega per la prima volta (nessun
     account -> quello del token di adesso) non cambia di mano */
  P.stessaMano = function () {
    var prima = this.chi, ora = this.diChiOra();
    if (!prima) return true;
    var stessa = prima.t === ora.t && (prima.u === null || prima.u === ora.u);
    if (stessa && prima.u === null && ora.u) this.chi = ora;   /* legato adesso: lo si ricorda */
    return stessa;
  };
  /* I dati di questo browser sono legati a un account e il token di adesso non e'
     (ancora) confermato come suo (studio_sync.js, `Sync.inAttesa`): possono essere di
     un ALTRO studente. Il caso della revisione: A esce, B entra mentre il server non
     risponde; la pagina mostrava gli esami di A e ne accettava i gesti, e un «Azzera
     tutto» di B cancellava le scatole di A anche sul server. Adesso finche' dura non
     si mostrano i dati, non si accettano gesti e non si scrive niente. */
  P.inAttesa = function () {
    try { return !!(global.Sync && typeof global.Sync.inAttesa === 'function' && global.Sync.inAttesa()); }
    catch (e) { return false; }
  };
  /* si chiede la lettura (una, col freno del modulo; `forza` per «Riprova») e se ne
     aspetta la risposta: riuscita, `studio:stato` ridisegna; fallita, lo si dice.
     La chiede `render` la prima volta che entra nell'attesa, da qualunque strada ci
     arrivi (il montaggio, un token cambiato in un'altra scheda). */
  P.chiediConferma = function () {
    var self = this, p = null;
    /* forzata: il freno di un minuto del modulo vale per le riletture in vista, non per
       un token che nessuno ha ancora confermato (una lettura gia' in volo si riusa) */
    try { p = global.Sync && typeof global.Sync.rileggi === 'function' ? global.Sync.rileggi(true) : null; } catch (e) { p = null; }
    var dopo = function (r) {
      self.erroreAttesa = self.inAttesa() ? ((r && r.esito) || 'errore') : false;
      self.render();
    };
    if (p && typeof p.then === 'function') p.then(dopo, function () { dopo(null); }); else dopo(null);
  };
  /* «Riprova» */
  P.aspettaConferma = function () {
    this.erroreAttesa = false;
    this.disegnaAttesa();
    this.chiediConferma();
  };
  P.disegnaAttesa = function () {
    var i, self = this;
    this.chiudi(this.dlg);
    this.chiudi(this.dlg2);
    this.dlg.corpo.textContent = '';
    this.dlg2.corpo.textContent = '';
    for (i = 0; i < this.corpo.length; i++) this.corpo[i].hidden = true;
    /* e cio' che era disegnato (di chi c'era prima) non resta nel documento */
    this.tally.textContent = '';
    this.railEsami.textContent = '';
    this.vuotoEl.textContent = '';
    this.vistaEl.textContent = '';
    this.attesaEl.hidden = false;
    this.attesaEl.textContent = '';
    this.inAttesaMostrata = true;
    if (this.erroreAttesa === 'non-autenticato') {
      this.attesaEl.appendChild(el('p', 'sc-nota', 'La tua sessione non vale più: rientra nel tuo account ' +
        'per aprire le tue scatole. Fino ad allora non le mostriamo e non le modifichiamo.'));
      this.attesaEl.appendChild(bottone('btn', 'Riprova', function () { self.aspettaConferma(); }));
    } else if (this.erroreAttesa) {
      this.attesaEl.appendChild(el('p', 'sc-nota', 'Per aprire le tue scatole serve la connessione: dobbiamo ' +
        'controllare che siano del tuo account. Senza, non le mostriamo e non le modifichiamo.'));
      this.attesaEl.appendChild(bottone('btn', 'Riprova', function () { self.aspettaConferma(); }));
    } else {
      this.attesaEl.appendChild(el('p', 'sc-nota', 'Un momento: stiamo controllando che queste scatole siano del tuo account.'));
    }
  };
  /* la copia in memoria non e' piu' di chi c'e' adesso: si chiude tutto e si rilegge
     (`gestoPerso`: l'ultimo gesto non si e' salvato, e lo si dice) */
  P.cambioDiMano = function (gestoPerso) {
    this.chiudi(this.dlg);
    this.chiudi(this.dlg2);
    /* (le finestre chiuse tengono ancora nel documento i nomi di chi c'era prima) */
    this.dlg.corpo.textContent = '';
    this.dlg2.corpo.textContent = '';
    this.S = this.carica();
    this.migra();
    this.attivo = this.S.esami.length ? this.S.esami[0].id : null;
    this.mese = null;
    this.render();
    if (gestoPerso) {
      this.avviso('L’accesso è cambiato in un’altra scheda: la pagina si è aggiornata e l’ultima modifica non è stata salvata.', true);
    }
  };
  /* UN'ALTRA SCHEDA ha scritto nella memoria del browser (l'evento `storage` arriva
     solo alle ALTRE schede): se e' cambiato l'account, o il token, si rilegge da capo;
     se sono le scatole dello stesso account, si ridisegna (a finestra aperta, dopo). */
  P.suMemoria = function (ev) {
    var k = ev ? ev.key : null;
    if (ev && ev.storageArea && global.localStorage && ev.storageArea !== global.localStorage) return;
    if (k !== null && k !== CHIAVE && k !== 'studio-sync' && k !== 'appunti-tok') return;
    if (this.inAttesa() || this.inAttesaMostrata) { this.render(); return; }
    if (!this.stessaMano()) { this.cambioDiMano(false); return; }
    if (k !== CHIAVE && k !== null) return;
    if ((this.dlg && this.dlg.open) || (this.dlg2 && this.dlg2.open)) this.rileggiDopo = true;
    else {
      this.S = this.carica();
      this.migra();
      this.render();
    }
  };

  /* La lettura dal server ha scritto qualcosa (`studio:stato`, studio_sync.js).
     Le SCATOLE: si ridisegna, e il ridisegno passa da `salva`, che unisce. Mai
     sotto le mani dello studente: con una finestra aperta (un argomento, un
     esame, una conferma) si aspetta che la chiuda. Un ALTRO ACCOUNT invece non
     aspetta: cio' che e' in pagina e' dell'account di prima, e va via subito. */
  P.suStato = function (dettaglio) {
    var d = dettaglio || {};
    var scritte = Object.prototype.toString.call(d.scritte) === '[object Array]' ? d.scritte : [];
    /* si aspettava la conferma dell'account: `render` esce dall'attesa e rilegge */
    if (this.inAttesaMostrata && !d.cambioAccount) { this.render(); return; }
    if (d.cambioAccount) {
      this.chiudi(this.dlg);
      this.chiudi(this.dlg2);
      this.dlg.corpo.textContent = '';
      this.dlg2.corpo.textContent = '';
      this.S = this.carica();
      this.migra();
      this.attivo = this.S.esami.length ? this.S.esami[0].id : null;
      this.mese = null;
      this.render();
      return;
    }
    if (scritte.indexOf('scatole') < 0) return;
    if ((this.dlg && this.dlg.open) || (this.dlg2 && this.dlg2.open)) { this.rileggiDopo = true; return; }
    this.render();
  };

  /* ---------------------------------------------------------------- *
   * ricerche                                                          *
   * ---------------------------------------------------------------- */
  P.esame = function (id) {
    for (var i = 0; i < this.S.esami.length; i++) if (this.S.esami[i].id === id) return this.S.esami[i];
    return null;
  };
  P.arg = function (id) {
    for (var i = 0; i < this.S.argomenti.length; i++) if (this.S.argomenti[i].id === id) return this.S.argomenti[i];
    return null;
  };
  P.argDi = function (eid) {
    return this.S.argomenti.filter(function (t) { return t.esame === eid; });
  };
  P.iv = function (t) { return this.percorsi[t.track].iv; };
  P.scadenza = function (t) {
    return t.ultimo ? piu(t.ultimo, this.iv(t)[t.box] || 1) : (t.piano || t.creato || OGGI());
  };
  P.giorniA = function (t) { return diffGiorni(this.scadenza(t), OGGI()); };
  P.maturo = function (t) { return this.giorniA(t) <= 0; };
  P.arretrati = function (eid) {
    var oggi = OGGI();
    return this.argDi(eid).filter(function (t) { return t.pendente && t.pendente < oggi; })
      .sort(function (a, b) { return a.pendente < b.pendente ? -1 : (a.pendente > b.pendente ? 1 : 0); });
  };
  P.diOggi = function (eid) {
    var oggi = OGGI();
    var l = this.argDi(eid).filter(function (t) { return t.pendente === oggi; });
    return l.length ? l[0] : null;
  };

  /* ---------------------------------------------------------------- *
   * programma di studio: gli argomenti nuovi, distribuiti fino all'esame *
   * ---------------------------------------------------------------- */
  P.inProgramma = function (t) { return !!t.piano && !t.ultimo && !t.pendente; };
  /* i giorni in cui si studia qualcosa di nuovo: da oggi al giorno prima del
     ripasso finale, solo quelli scelti */
  P.giorniUtili = function (e) {
    if (!e.dataEsame) return [];
    var p = e.pref || prefBase();
    var fine = piu(e.dataEsame, -(p.ripasso + 1)), g = OGGI(), out = [], guardia = 0;
    while (diffGiorni(g, fine) <= 0 && guardia++ < 800) {
      if (p.giorni[giornoSett(g)]) out.push(g);
      g = piu(g, 1);
    }
    return out;
  };
  P.ripianifica = function (e) {
    var lista = this.argDi(e.id).filter(function (t) { return !t.ultimo && !t.pendente; });
    lista.forEach(function (t) { t.piano = null; });
    var giorni = this.giorniUtili(e), n = lista.length, d = giorni.length;
    if (!n || !d) return;
    /* uniforme: con 20 argomenti su 15 giorni, cinque giorni ne hanno due */
    lista.forEach(function (t, i) { t.piano = giorni[Math.floor(i * d / n)]; });
  };
  P.nuoviDa = function (eid) {
    var self = this, oggi = OGGI();
    return this.argDi(eid).filter(function (t) { return self.inProgramma(t) && t.piano <= oggi; })
      .sort(function (a, b) { return a.piano < b.piano ? -1 : (a.piano > b.piano ? 1 : 0); });
  };
  P.studia = function (t) {
    this.chiudiUscita(t, 'fatto');
    t.ultimo = OGGI();
    t.box = 0;
  };
  P.riepilogo = function (e) {
    if (!e.dataEsame) return 'Fissa la data d’esame e il programma si fa da solo.';
    if (diffGiorni(e.dataEsame, OGGI()) < 0) return 'La data d’esame è passata: niente programma.';
    var suoi = this.argDi(e.id);
    if (!suoi.length) return 'Aggiungi gli argomenti: si distribuiscono da soli fino all’esame.';
    var self = this;
    var piano = suoi.filter(function (t) { return self.inProgramma(t); });
    if (!suoi.filter(function (t) { return !t.ultimo && !t.pendente; }).length) {
      return 'Hai già studiato tutti gli argomenti almeno una volta: da qui all’esame lavorano le scatole.';
    }
    if (!piano.length) return 'Nessun giorno utile prima del ripasso finale: scegli più giorni o accorcia il ripasso finale.';
    var perGiorno = {}, max = 0, primo = null, ultimo = null;
    piano.forEach(function (t) {
      perGiorno[t.piano] = (perGiorno[t.piano] || 0) + 1;
      if (perGiorno[t.piano] > max) max = perGiorno[t.piano];
      if (!primo || t.piano < primo) primo = t.piano;
      if (!ultimo || t.piano > ultimo) ultimo = t.piano;
    });
    var k = Object.keys(perGiorno).length, resto = diffGiorni(e.dataEsame, ultimo) - 1;
    return piano.length + ' ' + plur(piano.length, 'argomento nuovo', 'argomenti nuovi') + ' in ' + k + ' ' +
      plur(k, 'giorno', 'giorni') + ' di studio' + (max > 1 ? ' (fino a ' + max + ' al giorno)' : '') +
      (k > 1 ? ', dal ' + dataBreve(primo) + ' al ' + dataBreve(ultimo) : ', il ' + dataBreve(primo)) +
      '. Poi ' + resto + ' ' + plur(resto, 'giorno', 'giorni') + ' di solo ripasso prima dell’esame.';
  };

  /* ---------------------------------------------------------------- *
   * calendario: una uscita al giorno per esame                        *
   * ---------------------------------------------------------------- */
  P.scegli = function (e, giorno) {
    var self = this;
    var cand = this.argDi(e.id).filter(function (t) {
      return !t.pendente && !self.inProgramma(t) && self.scadenza(t) <= giorno;
    });
    if (!cand.length) return null;
    cand.sort(function (a, b) {
      var sa = self.scadenza(a), sb = self.scadenza(b);
      if (sa !== sb) return sa < sb ? -1 : 1;
      if (a.box !== b.box) return a.box - b.box;
      return a.nome.localeCompare(b.nome, 'it', { numeric: true });
    });
    return cand[0];
  };
  P.aggiornaCalendario = function (e) {
    var fine = OGGI();
    var g = e.ultimoGiorno ? piu(e.ultimoGiorno, 1) : e.inizio;
    /* la casella di oggi resta aperta: un argomento aggiunto adesso esce subito */
    if (diffGiorni(g, fine) > 0) g = fine;
    var guardia = 0;
    while (diffGiorni(g, fine) <= 0 && guardia++ < 400) {
      if (!e.giorni[g]) {
        var t = this.scegli(e, g);
        if (t) { e.giorni[g] = { t: t.id }; t.pendente = g; }
      }
      g = piu(g, 1);
    }
    e.ultimoGiorno = fine;
  };

  P.chiudiUscita = function (t, esito) {
    if (!t.pendente) return;
    var e = this.esame(t.esame);
    if (e && e.giorni[t.pendente]) e.giorni[t.pendente].esito = esito || 'fatto';
    t.pendente = null;
  };
  /* `esito` (fetta S2, secondo tempo): 'ok' = ricordato, 'ko' = non ricordato.
     Chi sposta a mano un argomento in uscita (tabellone, scheda) non lo dice:
     lo si legge dalla scatola (piu' su o promosso = ok, la prima = ko, altrimenti
     quasi). */
  P.segna = function (t, box, track, esito) {
    var prima = { box: t.box, track: t.track };
    this.chiudiUscita(t, 'fatto');
    t.ultimo = OGGI();
    t.ripassi = (t.ripassi || 0) + 1;
    if (track) t.track = track;
    t.box = box;
    if (!esito) {
      esito = (track && track !== prima.track) || box > prima.box ? 'ok' : (box === 0 ? 'ko' : 'quasi');
    }
    this.evento(t, esito);
  };

  /* ---- IL FATTO ESCE DAL DISPOSITIVO (fetta S2, secondo tempo, 2026-09-29) ----
     Ogni ripasso giudicato diventa un evento `scatola` per il server, come le
     carte di flashcards.js: `studioEvento` lo mette in coda (la definisce il sito
     nella copia privata, `_coda_studio_js`); senza, non succede niente. Porta lo
     STATO che il motore ha calcolato (percorso, scatola, prossimo ripasso) e il
     giorno LOCALE. Il nome dell'argomento NO: e' testo scritto dallo studente, e
     all'evento non serve (l'item e' l'id dell'argomento; la lezione, se c'e',
     dice di che cosa si tratta). */
  P.evento = function (t, esito) {
    if (!global.studioEvento || !t || !t.id) return;
    var e = this.esame(t.esame);
    var m = typeof t.u === 'string' ? /(s[12][fcb]\d{2})\.html$/.exec(t.u) : null;
    try {
      global.studioEvento({
        kind: 'scatola',
        item: 'scatola:' + t.id,
        lezione: m ? m[1] : null,
        materia: e && e.materia ? e.materia : null,
        esito: esito,
        track: t.track,
        box: t.box,
        scade: this.scadenza(t),
        ultimo: t.ultimo
      });
    } catch (x) { /* una statistica non deve mai fermare il ripasso */ }
  };

  /* Quale scatola del percorso successivo accoglie chi finisce il primo: la
     prima con un intervallo PIU' LUNGO dell'ultima scatola di partenza. Con i
     percorsi di oggi (1·3·7 e 1·3·7·15·30·60) e' la quarta, 15 giorni, come
     nell'originale; ma lo si ricava dai numeri, non da un indice scritto a mano. */
  P.ingresso = function (daTrack, aTrack) {
    var ultimo = this.percorsi[daTrack].iv[this.percorsi[daTrack].iv.length - 1];
    var iv = this.percorsi[aTrack].iv;
    for (var i = 0; i < iv.length; i++) if (iv[i] > ultimo) return i;
    return iv.length - 1;
  };
  P.successivo = function (track) {
    var i = this.ordine.indexOf(track);
    return i >= 0 && i < this.ordine.length - 1 ? this.ordine[i + 1] : null;
  };

  /* ---------------------------------------------------------------- *
   * creazione                                                         *
   * ---------------------------------------------------------------- */
  P.creaEsame = function (nome, materia, dataEsame, conEpisodi) {
    var e = { id: nid(), nome: nome, materia: this.materie[materia] ? materia : null,
              inizio: OGGI(), dataEsame: eDataEsame(dataEsame) ? dataEsame : null, giorni: {},
              ultimoGiorno: null, pref: prefBase() };
    this.S.esami.push(e);
    var aggiunti = 0;
    if (e.materia && conEpisodi) {
      var oggi = OGGI(), self = this;
      this.materie[e.materia].episodi.forEach(function (ep) {
        self.S.argomenti.push({ id: nid(), nome: ep.t, esame: e.id, track: self.ordine[0], box: 0,
                                ultimo: null, creato: oggi, ripassi: 0, pendente: null, u: ep.u || '', piano: null });
        aggiunti++;
      });
    }
    this.ripianifica(e);
    this.attivo = e.id;
    this.mese = null;
    return aggiunti;
  };

  /* `fisso`: un avviso che l'avviso di un gesto non deve coprire (il cambio d'account
     in un'altra scheda: il gesto dopo direbbe «salvato», e non lo e') */
  P.avviso = function (msg, fisso) {
    var t = this.toast, self = this;
    if (!t) return;
    if (this.toastFisso && !fisso) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastT);
    this.toastFisso = !!fisso;
    this.toastT = setTimeout(function () { t.classList.remove('on'); self.toastFisso = false; }, fisso ? 6000 : 3200);
  };

  /* ---------------------------------------------------------------- *
   * scheletro della pagina                                            *
   * ---------------------------------------------------------------- */
  P.costruisci = function () {
    var self = this, r = this.radice;
    r.textContent = '';
    r.classList.add('sc');

    /* l'attesa della conferma dell'account (revisione S2b): al posto di tutto il resto */
    this.attesaEl = el('div', 'sc-attesa');
    this.attesaEl.setAttribute('role', 'status');
    this.attesaEl.hidden = true;
    r.appendChild(this.attesaEl);

    this.tally = el('div', 'sc-tally');
    r.appendChild(this.tally);

    var sezEsami = el('section', 'sc-sez');
    var h = el('div', 'sc-sez-h');
    h.appendChild(el('h2', null, 'I tuoi esami'));
    h.appendChild(el('p', 'sc-nota', 'Ogni esame ha il suo calendario e le sue scatole. Scegline uno per lavorarci.'));
    sezEsami.appendChild(h);
    this.railEsami = el('div', 'sc-esami');
    sezEsami.appendChild(this.railEsami);
    r.appendChild(sezEsami);

    this.vuotoEl = el('div', 'sc-vuoto');
    r.appendChild(this.vuotoEl);

    this.vistaEl = el('div', 'sc-vista');
    r.appendChild(this.vistaEl);

    var piede = el('div', 'sc-piede');
    piede.appendChild(el('p', 'sc-nota', 'I dati restano su questo dispositivo, nella memoria del browser: non arrivano a noi e non passano da un altro dispositivo. Per portarli altrove c’è il backup.'));
    var az = el('div', 'sc-azioni');
    az.appendChild(bottone('btn btn-ghost', 'Esporta backup', function () { self.esporta(); }));
    var file = el('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    file.onchange = function (ev) { self.importa(ev); };
    az.appendChild(bottone('btn btn-ghost', 'Importa backup', function () { file.click(); }));
    az.appendChild(file);
    az.appendChild(bottone('btn btn-ghost sc-pericolo', 'Azzera tutto', function () {
      self.conferma('Azzerare tutto?', 'Esami, argomenti, calendari e scadenze spariscono da questo dispositivo. Non si annulla.',
        'Azzera tutto', function () {
          self.S = self.vuoto(); self.attivo = null; self.mese = null;
          self.render(); self.avviso('Dati azzerati.');
        });
    }));
    piede.appendChild(az);
    r.appendChild(piede);
    /* cio' che l'attesa nasconde: i dati E i bottoni che li toccano (azzera, importa) */
    this.corpo = [this.tally, sezEsami, this.vuotoEl, this.vistaEl, piede];

    this.dlg = this.dialogo('sc-dlg');
    this.dlg2 = this.dialogo('sc-dlg sc-dlg-conferma');
    this.toast = el('div', 'sc-toast');
    this.toast.setAttribute('role', 'status');
    this.toast.setAttribute('aria-live', 'polite');
    r.appendChild(this.toast);
    if (this.avvisoIniziale) this.avviso(this.avvisoIniziale);
  };

  P.dialogo = function (cls) {
    var self = this;
    var d = el('dialog', cls);
    var corpo = el('div', 'sc-pannello');
    d.appendChild(corpo);
    d.corpo = corpo;
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    /* una lettura dal server arrivata a finestra aperta (`suStato`): si
       ridisegna appena la finestra si chiude */
    d.addEventListener('close', function () {
      if (self.rileggiDopo) { self.rileggiDopo = false; self.render(); }
    });
    this.radice.appendChild(d);
    return d;
  };
  P.apri = function (d) {
    /* in attesa della conferma dell'account nessuna finestra si apre sui dati */
    if (d.open || this.inAttesa()) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  };
  P.chiudi = function (d) {
    if (!d.open) return;
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  };

  /* ---------------------------------------------------------------- *
   * disegno                                                           *
   * ---------------------------------------------------------------- */
  P.render = function () {
    var self = this, i;
    /* (revisione S2b) in attesa della conferma dell'account: niente dati, niente gesti;
       la prima volta si chiede la lettura che conferma */
    if (this.inAttesa()) {
      var primaVolta = !this.inAttesaMostrata;
      this.disegnaAttesa();
      if (primaVolta) this.chiediConferma();
      return;
    }
    if (this.inAttesaMostrata) {
      /* la conferma e' arrivata: si rilegge (la copia in memoria e' di prima della
         conferma, e puo' essere di chi c'era prima) e si torna al disegno di sempre */
      this.inAttesaMostrata = false;
      this.erroreAttesa = false;
      this.attesaEl.hidden = true;
      this.attesaEl.textContent = '';
      for (i = 0; i < this.corpo.length; i++) this.corpo[i].hidden = false;
      this.S = this.carica();
      this.migra();
      this.attivo = this.S.esami.length ? this.S.esami[0].id : null;
      this.mese = null;
    }
    this.S.esami.forEach(function (e) { self.aggiornaCalendario(e); });
    if (this.attivo && !this.esame(this.attivo)) this.attivo = null;

    var oggiN = 0, arrN = 0;
    this.S.esami.forEach(function (e) {
      if (self.diOggi(e.id)) oggiN++;
      arrN += self.arretrati(e.id).length;
    });
    this.tally.textContent = '';
    [[oggiN, plur(oggiN, 'uscita oggi', 'uscite oggi'), 'oggi'],
     [arrN, 'in coda', arrN ? 'tardi' : ''],
     [this.S.argomenti.length, plur(this.S.argomenti.length, 'argomento', 'argomenti'), ''],
     [this.S.esami.length, plur(this.S.esami.length, 'esame', 'esami'), '']].forEach(function (v) {
      var c = el('div', 'sc-conta' + (v[2] ? ' sc-' + v[2] : ''));
      c.appendChild(el('b', null, String(v[0])));
      c.appendChild(el('span', null, v[1]));
      self.tally.appendChild(c);
    });

    this.renderEsami();
    this.renderVuoto();
    var e = this.attivo ? this.esame(this.attivo) : null;
    this.vistaEl.hidden = !e;
    this.vistaEl.textContent = '';
    if (e) this.renderVista(e);
    this.salva();
    /* `salva` ha visto che la copia in memoria non e' piu' di chi c'e' adesso: non ha
       scritto niente, e si rilegge da capo (una volta: la rilettura aggiorna `chi`) */
    if (this.cambioMano) {
      this.cambioMano = false;
      this.cambioDiMano(true);
      return;
    }
    /* `salva` ha unito cio' che era arrivato da fuori: si ridisegna UNA volta
       sola (il secondo `salva` trova la memoria com'e' stata appena scritta; e
       se non ha potuto scriverla, memoria piena, non si gira all'infinito) */
    if (this.daRidisegnare) {
      this.daRidisegnare = false;
      /* la copia in memoria e' cambiata sotto una finestra aperta: i suoi campi e
         bottoni tengono gli oggetti di PRIMA, e un secondo gesto lo scriverebbe su
         una copia che nessuno salva piu'. Il gesto appena fatto e' salvato (unito);
         la finestra si chiude, e se chi l'ha aperta la riapre, la riapre sui dati
         nuovi (i gesti della scheda di un argomento fanno proprio cosi'). */
      this.rileggiDopo = false;
      if (this.dlg && this.dlg.open) this.chiudi(this.dlg);
      if (this.dlg2 && this.dlg2.open) this.chiudi(this.dlg2);
      if (!this.ridisegnando) {
        this.ridisegnando = true;
        try { this.render(); } finally { this.ridisegnando = false; }
      }
    }
  };

  P.accento = function (nodo, e) {
    if (e && e.materia) nodo.style.setProperty('--sc-acc', 'var(--' + e.materia + ')');
    else nodo.style.removeProperty('--sc-acc');
  };

  /* il livello di tinta di una scatola: un ordinale, quindi una scala di UN
     colore (il CSS la ricava da `data-lv`, 1..6), mai sei colori diversi */
  P.livello = function (track, box) {
    var n = this.percorsi[track].iv.length;
    return Math.max(1, Math.min(6, Math.round((box + 1) / n * 6)));
  };

  P.renderEsami = function () {
    var self = this, rail = this.railEsami;
    rail.textContent = '';
    this.S.esami.forEach(function (e) {
      var suoi = self.argDi(e.id), arr = self.arretrati(e.id).length, oggiT = self.diOggi(e.id);
      var card = el('div', 'sc-esame');
      self.accento(card, e);
      if (self.attivo === e.id) card.classList.add('sc-scelto');

      var apri = bottone('sc-esame-apri', null, function () {
        self.attivo = (self.attivo === e.id) ? null : e.id;
        self.mese = null;
        self.render();
        if (self.attivo && self.vistaEl.scrollIntoView) self.vistaEl.scrollIntoView({ block: 'start' });
      });
      apri.setAttribute('aria-pressed', self.attivo === e.id ? 'true' : 'false');
      apri.appendChild(el('span', 'sc-esame-nome', e.nome));
      var riga = suoi.length + ' ' + plur(suoi.length, 'argomento', 'argomenti');
      if (e.dataEsame) {
        var gg = diffGiorni(e.dataEsame, OGGI());
        riga += gg > 0 ? ' · esame tra ' + gg + ' ' + plur(gg, 'giorno', 'giorni') : (gg === 0 ? ' · esame oggi' : ' · esame passato');
      }
      apri.appendChild(el('span', 'sc-esame-riga', riga));
      var riga2 = el('span', 'sc-esame-riga');
      riga2.appendChild(el(oggiT ? 'b' : 'span', null, oggiT ? '1 uscita oggi' : 'nessuna uscita oggi'));
      if (arr) riga2.appendChild(el('em', null, ' · ' + arr + ' in coda'));
      var nuovi = self.nuoviDa(e.id).length;
      if (nuovi) riga2.appendChild(el('span', null, ' · ' + nuovi + ' ' + plur(nuovi, 'nuovo', 'nuovi') + ' da studiare'));
      apri.appendChild(riga2);
      var barra = el('span', 'sc-esame-barra');
      barra.setAttribute('aria-hidden', 'true');
      self.ordine.forEach(function (tr) {
        self.percorsi[tr].iv.forEach(function (_, i) {
          var n = suoi.filter(function (t) { return t.track === tr && t.box === i; }).length;
          var tacca = el('i');
          if (n) tacca.setAttribute('data-lv', String(self.livello(tr, i)));
          barra.appendChild(tacca);
        });
      });
      apri.appendChild(barra);
      card.appendChild(apri);

      var gest = bottone('sc-gest', '✎', function () {
        self.attivo = e.id; self.mese = null; self.render(); self.pannelloEsame(e.id);
      });
      gest.setAttribute('aria-label', 'Gestisci ' + e.nome);
      gest.title = 'Gestisci ' + e.nome;
      card.appendChild(gest);
      rail.appendChild(card);
    });

    /* nuovo esame: nome, materia (facoltativa), data, episodi */
    var form = el('form', 'sc-nuovo');
    form.appendChild(el('span', 'eyebrow', 'Nuovo esame'));
    var nome = el('input');
    nome.type = 'text'; nome.maxLength = 60; nome.required = true;
    nome.placeholder = 'Es. Fisica, primo appello';
    nome.setAttribute('aria-label', 'Nome dell’esame');
    form.appendChild(nome);
    var materia = el('select');
    materia.setAttribute('aria-label', 'Materia');
    var o0 = el('option', null, 'Materia: nessuna');
    o0.value = '';
    materia.appendChild(o0);
    (this.cat.materie || []).forEach(function (m) {
      var o = el('option', null, m.nome);
      o.value = m.m;
      materia.appendChild(o);
    });
    form.appendChild(materia);
    var lab = el('label', 'sc-check');
    var conEp = el('input');
    conEp.type = 'checkbox'; conEp.checked = true;
    lab.appendChild(conEp);
    var labT = el('span', null, 'con le sue lezioni come argomenti');
    lab.appendChild(labT);
    lab.hidden = true;
    form.appendChild(lab);
    materia.onchange = function () {
      var m = self.materie[materia.value];
      lab.hidden = !m;
      if (m) {
        labT.textContent = 'con le sue ' + m.episodi.length + ' lezioni come argomenti';
        if (!nome.value.trim()) nome.value = m.nome;
      }
    };
    var riga = el('div', 'sc-riga');
    var data = el('input');
    data.type = 'date'; data.min = '2000-01-01'; data.max = '2100-12-31';
    data.setAttribute('aria-label', 'Data dell’esame, facoltativa');
    riga.appendChild(data);
    var crea = el('button', 'btn btn-primary', 'Crea');
    crea.type = 'submit';
    riga.appendChild(crea);
    form.appendChild(riga);
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var n = nome.value.trim();
      if (!n) { nome.focus(); return; }
      if (data.value && !eDataEsame(data.value)) { self.avviso('Data d’esame non valida: controlla l’anno.'); data.focus(); return; }
      var quanti = self.creaEsame(n, materia.value, data.value, !lab.hidden && conEp.checked);
      self.render();
      self.avviso(quanti && data.value ? '« ' + n + ' » creato con ' + quanti + ' argomenti, distribuiti fino all’esame: i giorni si cambiano da ✎.'
                : quanti ? '« ' + n + ' » creato con ' + quanti + ' argomenti: il calendario ne fa uscire uno al giorno da oggi.'
                : '« ' + n + ' » creato: aggiungi gli argomenti e il calendario parte da oggi.');
    };
    rail.appendChild(form);
  };

  P.renderVuoto = function () {
    var self = this, v = this.vuotoEl;
    v.textContent = '';
    v.hidden = this.S.esami.length > 0;
    if (v.hidden) return;
    v.appendChild(el('h2', null, 'Nessun esame, per ora'));
    v.appendChild(el('p', null, 'Parti da una materia del semestre filtro: le sue lezioni diventano gli argomenti, e da oggi il calendario ne fa uscire uno al giorno. Oppure crea un esame tuo qui sopra e scrivi gli argomenti a mano.'));
    var az = el('div', 'sc-azioni sc-azioni-centro');
    (this.cat.materie || []).forEach(function (m) {
      var b = bottone('btn btn-primary', m.nome + ' · ' + m.episodi.length + ' lezioni', function () {
        var quanti = self.creaEsame(m.nome, m.m, null, true);
        self.render();
        self.avviso('« ' + m.nome + ' » creato con ' + quanti + ' argomenti.');
      });
      b.style.setProperty('--sc-acc', 'var(--' + m.m + ')');
      b.classList.add('sc-materia');
      az.appendChild(b);
    });
    v.appendChild(az);
  };

  P.renderVista = function (e) {
    var self = this, v = this.vistaEl;
    this.accento(v, e);

    /* l'uscita di oggi e la coda */
    var s1 = el('section', 'sc-sez');
    var h1 = el('div', 'sc-sez-h');
    h1.appendChild(el('h2', null, 'Uscita di oggi · ' + e.nome));
    h1.appendChild(el('p', 'sc-nota', 'Ogni giorno esce un argomento di questo esame. Se non lo sposti resta in coda, e il giorno dopo ne esce un altro.'));
    s1.appendChild(h1);
    var griglia = el('div', 'sc-oggi');
    griglia.appendChild(this.cartaOggi(e));
    var destra = el('div', 'sc-colonna');
    var cn = this.cartaNuovi(e);
    if (cn) destra.appendChild(cn);
    destra.appendChild(this.cartaCoda(e));
    griglia.appendChild(destra);
    s1.appendChild(griglia);
    v.appendChild(s1);

    /* calendario */
    var s2 = el('section', 'sc-sez');
    var h2 = el('div', 'sc-sez-h');
    h2.appendChild(el('h2', null, 'Calendario'));
    h2.appendChild(el('p', 'sc-nota', 'Le uscite passate restano segnate: spuntate se le hai spostate, in rosso se sono ancora in coda. «+2 nuovi» sono gli argomenti in programma quel giorno.'));
    s2.appendChild(h2);
    s2.appendChild(this.calendario(e));
    v.appendChild(s2);

    /* scatole */
    var s3 = el('section', 'sc-sez');
    var h3 = el('div', 'sc-sez-h');
    h3.appendChild(el('h2', null, 'Le scatole di questo esame'));
    h3.appendChild(el('p', 'sc-nota', 'Spostato a mano, un argomento cambia solo scatola; se è in coda, spostarlo vale come ripasso fatto.'));
    s3.appendChild(h3);

    var tracce = el('div', 'sc-percorsi');
    this.ordine.forEach(function (tr) {
      var p = self.percorsi[tr];
      var b = bottone('sc-percorso', null, function () { self.vista = tr; self.render(); });
      b.setAttribute('aria-pressed', self.vista === tr ? 'true' : 'false');
      var testo = el('span', 'sc-percorso-t');
      testo.appendChild(el('b', null, p.titolo));
      testo.appendChild(el('span', null, p.iv.length + ' scatole · ' + p.iv.join(' → ') + ' giorni'));
      b.appendChild(testo);
      var tacche = el('span', 'sc-tacche');
      tacche.setAttribute('aria-hidden', 'true');
      p.iv.forEach(function (_, i) {
        var t = el('i');
        t.setAttribute('data-lv', String(self.livello(tr, i)));
        tacche.appendChild(t);
      });
      b.appendChild(tacche);
      tracce.appendChild(b);
    });
    s3.appendChild(tracce);

    var barra = el('div', 'sc-barra');
    var nuovo = el('input', 'sc-cresce');
    nuovo.type = 'text'; nuovo.maxLength = 90;
    nuovo.placeholder = 'Nuovo argomento in questo percorso';
    nuovo.setAttribute('aria-label', 'Nuovo argomento');
    var aggiungi = function () {
      var n = nuovo.value.trim();
      if (!n) { nuovo.focus(); return; }
      self.S.argomenti.push({ id: nid(), nome: n, esame: e.id, track: self.vista, box: 0,
                              ultimo: null, creato: OGGI(), ripassi: 0, pendente: null, u: '', piano: null });
      self.ripianifica(e);
      self.render();
      var tn = self.S.argomenti[self.S.argomenti.length - 1];
      self.avviso(tn.piano ? '« ' + n + ' » è in programma il ' + dataBreve(tn.piano) + '.' : '« ' + n + ' » è nella scatola 1.');
    };
    nuovo.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); aggiungi(); } };
    barra.appendChild(nuovo);
    barra.appendChild(bottone('btn btn-ghost', 'Aggiungi', aggiungi));
    var ambito = el('select');
    ambito.setAttribute('aria-label', 'Da dove estrarre');
    [['maturi', 'Da ripassare oggi'], ['tutti', 'Tutto il percorso']].forEach(function (x) {
      var o = el('option', null, x[1]); o.value = x[0]; ambito.appendChild(o);
    });
    this.percorsi[this.vista].iv.forEach(function (g, i) {
      var o = el('option', null, 'Scatola ' + (i + 1) + ' · ' + g + ' ' + plur(g, 'giorno', 'giorni'));
      o.value = 'box' + i;
      ambito.appendChild(o);
    });
    if (this.ambito) ambito.value = this.ambito;
    if (ambito.value !== this.ambito) { ambito.value = 'maturi'; }
    ambito.onchange = function () { self.ambito = ambito.value; };
    barra.appendChild(ambito);
    barra.appendChild(bottone('btn btn-primary', 'Estrai a caso', function () { self.estrai(e, ambito.value); }));
    barra.appendChild(bottone('btn btn-ghost', 'Gestisci esame', function () { self.pannelloEsame(e.id); }));
    s3.appendChild(barra);

    s3.appendChild(this.tabellone(e));
    v.appendChild(s3);
  };

  P.cartaOggi = function (e) {
    var c = el('div', 'card sc-carta-oggi');
    var testa = el('div', 'sc-giorno');
    testa.appendChild(el('span', 'sc-punto'));
    testa.appendChild(el('span', 'eyebrow', dataLunga(OGGI())));
    c.appendChild(testa);
    var t = this.diOggi(e.id);
    if (!t) {
      var vuoto = this.argDi(e.id).length === 0;
      c.appendChild(el('h3', null, vuoto ? 'Questo esame è ancora vuoto' : 'Per oggi sei in pari'));
      c.appendChild(el('p', 'sc-nota', vuoto
        ? 'Aggiungi gli argomenti qui sotto: il calendario ne farà uscire uno al giorno, dal primo arrivato a scadenza.'
        : 'Nessun argomento di ' + e.nome + ' è arrivato a scadenza. Il prossimo esce appena una scatola matura, oppure estrai a caso per un ripasso in più.'));
      return c;
    }
    c.appendChild(el('h3', 'sc-oggi-t', t.nome));
    c.appendChild(this.etichette(t));
    c.appendChild(this.azioniRipasso(t, null));
    return c;
  };

  P.etichette = function (t) {
    var iv = this.iv(t), m = el('div', 'sc-etichette');
    var e1 = el('span', 'sc-tag');
    var pip = el('i');
    pip.setAttribute('data-lv', String(this.livello(t.track, t.box)));
    e1.appendChild(pip);
    e1.appendChild(document.createTextNode('Scatola ' + (t.box + 1) + ' · ' + iv[t.box] + ' ' + plur(iv[t.box], 'giorno', 'giorni')));
    m.appendChild(e1);
    m.appendChild(el('span', 'sc-tag', this.percorsi[t.track].breve));
    m.appendChild(el('span', 'sc-tag', t.ultimo
      ? 'ultimo ripasso ' + (-diffGiorni(t.ultimo, OGGI())) + ' g fa'
      : 'mai ripassato'));
    if (t.u) {
      var a = el('a', 'sc-tag sc-link', 'Apri gli appunti →');
      a.href = (this.cat.base || '') + t.u;
      m.appendChild(a);
    }
    return m;
  };

  P.azioniRipasso = function (t, dopo) {
    var self = this, iv = this.iv(t), ultima = iv.length - 1;
    var az = el('div', 'sc-azioni');
    var succ = this.successivo(t.track);
    var fatto = function (msg) { self.render(); if (dopo) dopo(); self.avviso(msg); };
    if (this.inProgramma(t)) {
      az.appendChild(bottone('btn btn-primary', 'Studiato → scatola 1 (primo ripasso domani)', function () {
        self.studia(t);
        fatto('In scatola 1: primo ripasso domani.');
      }));
      return az;
    }
    var ok;
    if (t.box < ultima) {
      ok = bottone('btn btn-primary', 'Ricordato → scatola ' + (t.box + 2) + ' (' + iv[t.box + 1] + ' g)', function () {
        self.segna(t, t.box + 1, null, 'ok');
        fatto('Spostato: torna tra ' + iv[t.box] + ' ' + plur(iv[t.box], 'giorno', 'giorni') + '.');
      });
    } else if (succ) {
      var ing = this.ingresso(t.track, succ), giorni = this.percorsi[succ].iv[ing];
      ok = bottone('btn btn-primary', 'Ricordato → ' + this.percorsi[succ].breve.toLowerCase() + ' (' + giorni + ' g)', function () {
        self.segna(t, ing, succ, 'ok');
        fatto('Promosso: ' + self.percorsi[succ].breve.toLowerCase() + ', torna tra ' + giorni + ' giorni.');
      });
    } else {
      ok = bottone('btn btn-primary', 'Ricordato → consolidato (altri ' + iv[ultima] + ' g)', function () {
        self.segna(t, ultima, null, 'ok');
        fatto('Consolidato: torna tra ' + iv[ultima] + ' giorni.');
      });
    }
    az.appendChild(ok);
    az.appendChild(bottone('btn btn-ghost', 'Non ricordato → scatola 1', function () {
      self.segna(t, 0, null, 'ko');
      fatto('Riparte dalla scatola 1.');
    }));
    if (t.pendente) {
      az.appendChild(bottone('btn btn-ghost', 'Lascio in coda', function () {
        fatto('Resta in coda: lo ritrovi domani fra gli arretrati.');
      }));
    }
    return az;
  };

  P.cartaNuovi = function (e) {
    var self = this, oggi = OGGI();
    if (!e.dataEsame) return null;
    var lista = this.nuoviDa(e.id);
    var c = el('div', 'card sc-carta-nuovi');
    var diOggi = lista.filter(function (t) { return t.piano === oggi; }).length;
    c.appendChild(el('h3', null, lista.length ? 'Da studiare oggi' : 'Niente di nuovo oggi'));
    c.appendChild(el('p', 'sc-nota', this.riepilogo(e)));
    if (lista.length) {
      var ul = el('ul', 'sc-coda');
      lista.forEach(function (t) {
        var gg = -diffGiorni(t.piano, oggi);
        var li = el('li', 'sc-nuovo-voce');
        var b = bottone('sc-voce' + (gg > 0 ? '' : ' sc-voce-ora'), null, function () { self.pannelloArgomento(t.id); });
        b.appendChild(el('span', 'sc-voce-t', t.nome));
        b.appendChild(el('span', 'sc-voce-d', gg > 0 ? 'in programma ' + gg + ' ' + plur(gg, 'giorno', 'giorni') + ' fa' : 'in programma oggi'));
        li.appendChild(b);
        var ok = bottone('btn btn-ghost sc-studiato', 'Studiato', function () {
          self.studia(t); self.render();
          self.avviso('« ' + t.nome + ' » in scatola 1: primo ripasso domani.');
        });
        ok.setAttribute('aria-label', 'Segna come studiato: ' + t.nome);
        li.appendChild(ok);
        ul.appendChild(li);
      });
      c.appendChild(ul);
      if (lista.length > diOggi) {
        c.appendChild(bottone('btn btn-ghost sc-largo', 'Ridistribuisci i rimasti indietro sui prossimi giorni', function () {
          self.ripianifica(e); self.render();
          self.avviso('Programma rifatto da oggi: ' + self.riepilogo(e));
        }));
      }
    } else {
      var prossimi = this.argDi(e.id).filter(function (t) { return self.inProgramma(t) && t.piano > oggi; })
        .map(function (t) { return t.piano; }).sort();
      if (prossimi.length) {
        var q = prossimi.filter(function (g) { return g === prossimi[0]; }).length;
        c.appendChild(el('p', 'sc-nota', 'Prossimi: ' + dataLunga(prossimi[0]) + ', ' + q + ' ' + plur(q, 'argomento', 'argomenti') + '.'));
      }
    }
    return c;
  };

  P.cartaCoda = function (e) {
    var self = this, arr = this.arretrati(e.id);
    var c = el('div', 'card sc-carta-coda');
    c.appendChild(el('h3', null, arr.length ? 'In coda da prima' : 'Coda pulita'));
    c.appendChild(el('p', 'sc-nota', arr.length
      ? arr.length + ' ' + plur(arr.length, 'argomento uscito', 'argomenti usciti') + ' nei giorni scorsi e mai ' + plur(arr.length, 'spostato', 'spostati') + '.'
      : 'Hai spostato tutte le uscite dei giorni scorsi.'));
    if (!arr.length) return c;
    var ul = el('ul', 'sc-coda');
    arr.forEach(function (t) {
      var gg = -diffGiorni(t.pendente, OGGI());
      var li = el('li');
      var b = bottone('sc-voce', null, function () { self.pannelloArgomento(t.id); });
      b.appendChild(el('span', 'sc-voce-t', t.nome));
      b.appendChild(el('span', 'sc-voce-d', 'uscito ' + gg + ' ' + plur(gg, 'giorno', 'giorni') + ' fa · scatola ' + (t.box + 1)));
      li.appendChild(b);
      ul.appendChild(li);
    });
    c.appendChild(ul);
    return c;
  };

  P.calendario = function (e) {
    var self = this, box = el('div', 'sc-cal-box');
    if (!this.mese) { var o = new Date(); this.mese = { a: o.getFullYear(), m: o.getMonth() }; }
    var testa = el('div', 'sc-cal-testa');
    var prec = bottone('sc-freccia', '‹', function () {
      self.mese.m--; if (self.mese.m < 0) { self.mese.m = 11; self.mese.a--; } self.render();
    });
    prec.setAttribute('aria-label', 'Mese precedente');
    var succ = bottone('sc-freccia', '›', function () {
      self.mese.m++; if (self.mese.m > 11) { self.mese.m = 0; self.mese.a++; } self.render();
    });
    succ.setAttribute('aria-label', 'Mese successivo');
    testa.appendChild(prec);
    testa.appendChild(succ);
    testa.appendChild(el('span', 'sc-mese', MESI[this.mese.m] + ' ' + this.mese.a));
    testa.appendChild(bottone('btn btn-ghost', 'Torna a oggi', function () { self.mese = null; self.render(); }));
    box.appendChild(testa);

    var cal = el('div', 'sc-cal');
    DOW.forEach(function (d) { cal.appendChild(el('div', 'sc-dow', d)); });
    var primo = new Date(this.mese.a, this.mese.m, 1);
    var spazio = (primo.getDay() + 6) % 7;
    var nGiorni = new Date(this.mese.a, this.mese.m + 1, 0).getDate();
    var oggi = OGGI(), piani = {};
    this.argDi(e.id).forEach(function (t) {
      if (t.piano) (piani[t.piano] = piani[t.piano] || []).push(t);
    });
    var inizioFinale = e.dataEsame ? piu(e.dataEsame, -((e.pref || prefBase()).ripasso)) : null;
    for (var i = 0; i < spazio; i++) cal.appendChild(el('div', 'sc-cella sc-nulla'));
    for (var g = 1; g <= nGiorni; g++) {
      var k = this.mese.a + '-' + pad(this.mese.m + 1) + '-' + pad(g);
      var voce = e.giorni[k];
      var t = voce ? this.arg(voce.t) : null;
      var cella = el(t ? 'button' : 'div', 'sc-cella');
      if (t) cella.type = 'button';
      if (k === oggi) cella.classList.add('sc-oggi-c');
      if (diffGiorni(k, oggi) > 0) cella.classList.add('sc-futuro');
      if (e.dataEsame === k) cella.classList.add('sc-esame-c');
      else if (inizioFinale && k >= inizioFinale && k < e.dataEsame) cella.classList.add('sc-finale');
      cella.appendChild(el('span', 'sc-num', String(g)));
      if (e.dataEsame === k) cella.appendChild(el('span', 'sc-cella-n', 'esame'));
      var pk = piani[k];
      if (pk) {
        var fatti = pk.filter(function (x) { return !!x.ultimo; }).length;
        cella.appendChild(el('span', 'sc-cella-n' + (fatti === pk.length ? ' sc-cella-n-ok' : ''),
          '+' + pk.length + ' ' + plur(pk.length, 'nuovo', 'nuovi')));
        cella.title = pk.map(function (x) { return x.nome; }).join(' · ');
      }
      if (t) {
        var chiusa = !!voce.esito || t.pendente !== k;
        cella.classList.add(chiusa ? 'sc-fatto' : 'sc-pend');
        cella.appendChild(el('span', 'sc-cella-t', t.nome));
        var st = el('span', 'sc-striscia');
        st.setAttribute('data-lv', String(this.livello(t.track, t.box)));
        cella.appendChild(st);
        cella.setAttribute('aria-label', g + ' ' + MESI[this.mese.m] + ': ' + t.nome + (chiusa ? ', spostato' : ', ancora in coda') +
          (pk ? '; ' + pk.length + ' ' + plur(pk.length, 'argomento nuovo', 'argomenti nuovi') + ' in programma' : ''));
        (function (id) { cella.onclick = function () { self.pannelloArgomento(id); }; })(t.id);
      }
      cal.appendChild(cella);
    }
    box.appendChild(cal);
    return box;
  };

  P.tabellone = function (e) {
    var self = this, tr = this.vista, p = this.percorsi[tr];
    var tab = el('div', 'sc-scatole');
    tab.setAttribute('data-n', String(p.iv.length));
    var lista = this.argDi(e.id).filter(function (t) { return t.track === tr; });
    var oggi = OGGI();
    p.iv.forEach(function (giorni, i) {
      var dentro = lista.filter(function (t) { return t.box === i; })
        .sort(function (a, b) { return self.giorniA(a) - self.giorniA(b); });
      var maturi = dentro.filter(function (t) { return self.maturo(t); }).length;
      var col = el('div', 'sc-scatola');
      col.setAttribute('data-lv', String(self.livello(tr, i)));
      var testa = el('div', 'sc-scatola-h');
      testa.appendChild(el('span', 'eyebrow', 'Scatola ' + (i + 1)));
      var r = el('div', 'sc-riga');
      r.appendChild(el('b', 'sc-iv', giorni + ' ' + plur(giorni, 'giorno', 'giorni')));
      r.appendChild(el('span', 'sc-cnt', String(dentro.length)));
      testa.appendChild(r);
      testa.appendChild(el('span', 'sc-scad' + (maturi ? ' sc-tardi' : ''),
        maturi ? maturi + ' ' + plur(maturi, 'maturo', 'maturi') : 'niente in scadenza'));
      col.appendChild(testa);

      if (dentro.length) {
        var ul = el('ul', 'sc-chips');
        dentro.forEach(function (t) {
          var gg = self.giorniA(t), testo, stato;
          if (t.pendente) { testo = t.pendente === oggi ? 'uscito oggi' : 'in coda'; stato = t.pendente === oggi ? 'ora' : 'tardi'; }
          else if (!t.ultimo && t.piano) {
            testo = gg > 0 ? 'in programma il ' + dataBreve(t.piano) : (gg === 0 ? 'da studiare oggi' : 'da studiare, indietro');
            stato = gg > 0 ? '' : (gg === 0 ? 'ora' : 'tardi');
          }
          else if (!t.ultimo) { testo = 'mai visto'; stato = 'ora'; }
          else if (gg < 0) { testo = (-gg) + ' g di ritardo'; stato = 'tardi'; }
          else if (gg === 0) { testo = 'matura oggi'; stato = 'ora'; }
          else if (gg === 1) { testo = 'domani'; stato = ''; }
          else { testo = 'tra ' + gg + ' g'; stato = ''; }
          var li = el('li');
          var b = bottone('sc-chip' + (stato ? ' sc-' + stato : ''), null, function () { self.pannelloArgomento(t.id); });
          b.draggable = true;
          b.appendChild(el('span', 'sc-chip-t', t.nome));
          var m = el('span', 'sc-chip-m');
          m.appendChild(el('span', null, (t.ripassi || 0) + ' ' + plur(t.ripassi || 0, 'ripasso', 'ripassi')));
          m.appendChild(el('span', 'sc-quando', testo));
          b.appendChild(m);
          b.ondragstart = function (ev) {
            ev.dataTransfer.setData('text/plain', t.id);
            ev.dataTransfer.effectAllowed = 'move';
          };
          li.appendChild(b);
          ul.appendChild(li);
        });
        col.appendChild(ul);
      } else {
        col.appendChild(el('p', 'sc-vuota', 'Vuota. Trascina qui un argomento, o spostalo dalla sua scheda.'));
      }
      col.ondragover = function (ev) { ev.preventDefault(); col.classList.add('sc-drop'); };
      col.ondragleave = function () { col.classList.remove('sc-drop'); };
      col.ondrop = function (ev) {
        ev.preventDefault();
        col.classList.remove('sc-drop');
        var t = self.arg(ev.dataTransfer.getData('text/plain'));
        if (!t || t.box === i || t.track !== tr) return;
        if (t.pendente) self.segna(t, i); else t.box = i;
        self.render();
        self.avviso('« ' + t.nome + ' » nella scatola ' + (i + 1) + '.');
      };
      tab.appendChild(col);
    });
    return tab;
  };

  /* ---------------------------------------------------------------- *
   * pannelli                                                          *
   * ---------------------------------------------------------------- */
  P.conferma = function (titolo, testo, etichetta, azione) {
    var self = this, c = this.dlg2.corpo;
    if (this.inAttesa()) return;             /* niente conferme sui dati di un altro (revisione S2b) */
    c.textContent = '';
    c.appendChild(el('h3', null, titolo));
    c.appendChild(el('p', 'sc-nota', testo));
    var az = el('div', 'sc-azioni');
    az.appendChild(bottone('btn btn-ghost', 'Annulla', function () { self.chiudi(self.dlg2); }));
    var si = bottone('btn btn-primary sc-pericolo-pieno', etichetta, function () { self.chiudi(self.dlg2); azione(); });
    az.appendChild(si);
    c.appendChild(az);
    this.apri(this.dlg2);
    si.focus();
  };

  P.testata = function (valore, sotto, etichetta, salva) {
    var self = this, h = el('div', 'sc-pannello-h');
    var box = el('div', 'sc-pannello-tit');
    var inp = el('input', 'sc-titolo');
    inp.type = 'text'; inp.value = valore; inp.maxLength = 90;
    inp.setAttribute('aria-label', etichetta);
    inp.title = 'Scrivi qui per rinominare';
    inp.onchange = function () {
      var n = inp.value.trim();
      if (n && n !== valore) salva(n); else inp.value = valore;
    };
    inp.onkeydown = function (ev) { if (ev.key === 'Enter') inp.blur(); };
    box.appendChild(inp);
    if (sotto) box.appendChild(el('p', 'sc-nota', sotto));
    h.appendChild(box);
    var x = bottone('sc-icona', '✕', function () { self.chiudi(self.dlg); });
    x.setAttribute('aria-label', 'Chiudi');
    h.appendChild(x);
    return h;
  };

  P.pannelloArgomento = function (tid) {
    var self = this, t = this.inAttesa() ? null : this.arg(tid);
    if (!t) return;
    var e = this.esame(t.esame), iv = this.iv(t), c = this.dlg.corpo;
    this.accento(this.dlg, e);
    c.textContent = '';
    c.appendChild(this.testata(t.nome,
      (e ? e.nome + ' · ' : '') + this.percorsi[t.track].breve + ' · scatola ' + (t.box + 1) + ' di ' + iv.length +
      ' · ' + (t.ripassi || 0) + ' ' + plur(t.ripassi || 0, 'ripasso', 'ripassi'),
      'Nome dell’argomento',
      function (n) { t.nome = n; self.render(); self.avviso('Argomento rinominato.'); }));

    var gg = this.giorniA(t), st = el('div', 'sc-stato');
    if (t.pendente) {
      var q = -diffGiorni(t.pendente, OGGI());
      st.classList.add(q > 0 ? 'sc-tardi' : 'sc-ora');
      st.textContent = q > 0 ? 'Uscito ' + q + ' ' + plur(q, 'giorno', 'giorni') + ' fa e ancora in coda.' : 'È l’uscita di oggi.';
    } else {
      if (gg < 0) st.classList.add('sc-tardi'); else if (gg === 0) st.classList.add('sc-ora');
      st.textContent = t.ultimo
        ? 'Ultimo ripasso il ' + dataBreve(t.ultimo) + (gg < 0 ? ', in ritardo di ' + (-gg) + ' g' : (gg === 0 ? ', matura oggi' : ', torna tra ' + gg + ' g'))
        : t.piano
          ? (gg > 0 ? 'In programma ' + dataLunga(t.piano) + ': è il giorno in cui studiarlo la prima volta.'
                    : (gg === 0 ? 'In programma oggi: studialo, poi segnalo.' : 'In programma da ' + (-gg) + ' ' + plur(-gg, 'giorno', 'giorni') + ': sei indietro.'))
          : 'Mai ripassato: esce al primo giro utile.';
    }
    c.appendChild(st);
    if (t.u) {
      var a = el('a', 'sc-link-appunti', 'Apri gli appunti di questa lezione →');
      a.href = (this.cat.base || '') + t.u;
      c.appendChild(a);
    }
    c.appendChild(this.azioniRipasso(t, function () { self.chiudi(self.dlg); }));

    c.appendChild(el('span', 'eyebrow sc-sotto', 'Sposta di scatola'));
    var mv = el('div', 'sc-sposta');
    iv.forEach(function (g, i) {
      var b = bottone('sc-mover', (i + 1) + ' · ' + g + ' g', function () {
        if (t.pendente) self.segna(t, i); else t.box = i;
        self.render(); self.pannelloArgomento(tid);
      });
      b.setAttribute('data-lv', String(self.livello(t.track, i)));
      b.setAttribute('aria-pressed', i === t.box ? 'true' : 'false');
      mv.appendChild(b);
    });
    c.appendChild(mv);

    c.appendChild(el('span', 'eyebrow sc-sotto', 'Percorso, esame, nome'));
    var riga = el('div', 'sc-azioni');
    this.ordine.forEach(function (alt) {
      if (alt === t.track) return;
      riga.appendChild(bottone('btn btn-ghost', 'Sposta in ' + self.percorsi[alt].breve.toLowerCase(), function () {
        t.track = alt;
        t.box = Math.min(t.box, self.percorsi[alt].iv.length - 1);
        self.vista = alt; self.render(); self.pannelloArgomento(tid);
      }));
    });
    if (this.S.esami.length > 1) {
      var sel = el('select');
      sel.setAttribute('aria-label', 'Esame dell’argomento');
      this.S.esami.forEach(function (x) { var o = el('option', null, x.nome); o.value = x.id; sel.appendChild(o); });
      sel.value = t.esame;
      sel.onchange = function () {
        self.chiudiUscita(t, 'spostato');
        var da = self.esame(t.esame);
        t.esame = sel.value; self.attivo = t.esame;
        if (da) self.ripianifica(da);
        self.ripianifica(self.esame(t.esame));
        self.render(); self.pannelloArgomento(tid);
      };
      riga.appendChild(sel);
    }
    riga.appendChild(bottone('btn btn-ghost sc-pericolo', 'Elimina argomento', function () {
      self.conferma('Eliminare « ' + t.nome + ' »?',
        'Sparisce dalle scatole di ' + (e ? e.nome : 'questo esame') + ' e dalle uscite già segnate sul calendario.',
        'Elimina', function () { self.elimina(t.id); self.render(); self.chiudi(self.dlg); self.avviso('Argomento eliminato.'); });
    }));
    c.appendChild(riga);
    this.apri(this.dlg);
  };

  P.elimina = function (tid) {
    var t = this.arg(tid), e = t ? this.esame(t.esame) : null;
    this.S.argomenti = this.S.argomenti.filter(function (a) { return a.id !== tid; });
    this.S.esami.forEach(function (x) {
      Object.keys(x.giorni).forEach(function (k) { if (x.giorni[k] && x.giorni[k].t === tid) delete x.giorni[k]; });
    });
    if (e) this.ripianifica(e);
  };

  P.pannelloEsame = function (eid) {
    var self = this, e = this.inAttesa() ? null : this.esame(eid), c = this.dlg.corpo;
    if (!e) { this.chiudi(this.dlg); return; }
    this.accento(this.dlg, e);
    var suoi = this.argDi(e.id);
    c.textContent = '';
    c.appendChild(this.testata(e.nome,
      suoi.length + ' ' + plur(suoi.length, 'argomento', 'argomenti') + ' · calendario dal ' + dataBreve(e.inizio),
      'Nome dell’esame',
      function (n) { e.nome = n.slice(0, 60); self.render(); self.avviso('Esame rinominato.'); }));

    var campo = el('div', 'sc-campo');
    var lab = el('label', 'eyebrow', 'Data d’esame');
    var id = 'sc-data-' + e.id;
    lab.setAttribute('for', id);
    var data = el('input');
    data.type = 'date'; data.id = id; data.value = e.dataEsame || '';
    data.min = '2000-01-01'; data.max = '2100-12-31';
    var riep = el('div', 'sc-stato');
    var aggiornaPiano = function () { self.ripianifica(e); self.render(); riep.textContent = self.riepilogo(e); };
    /* Niente ridisegno del pannello mentre si scrive: il campo data emette
       `change` a ogni cifra dell'anno, e ridisegnarlo toglieva il focus
       lasciando l'anno a «0002». Si salva solo una data plausibile; l'avviso
       arriva quando si esce dal campo. */
    var dataPrima = e.dataEsame;
    data.onchange = function () {
      if (data.value && !eDataEsame(data.value)) return;
      e.dataEsame = data.value || null;
      aggiornaPiano();
    };
    data.onblur = function () {
      if (data.value && !eDataEsame(data.value)) data.value = e.dataEsame || '';
      if (e.dataEsame === dataPrima) return;
      dataPrima = e.dataEsame;
      self.avviso(e.dataEsame ? 'Esame fissato al ' + dataBreve(e.dataEsame) + ': programma aggiornato.' : 'Data rimossa: niente programma.');
    };
    data.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); data.blur(); } };
    campo.appendChild(lab);
    campo.appendChild(data);
    c.appendChild(campo);

    /* il programma: in che giorni studiare cose nuove, quanto ripasso finale */
    if (!e.pref) e.pref = prefBase();
    c.appendChild(el('span', 'eyebrow sc-sotto', 'Programma di studio'));
    c.appendChild(el('p', 'sc-nota', 'Gli argomenti che non hai ancora studiato si distribuiscono da soli fino all’esame, nei giorni che scegli qui. Ai ripassi pensano le scatole, tutti i giorni.'));
    var gruppo = el('div', 'sc-sposta sc-giorni');
    gruppo.setAttribute('role', 'group');
    gruppo.setAttribute('aria-label', 'Giorni in cui studiare argomenti nuovi');
    DOW.forEach(function (d, i) {
      var b = bottone('sc-mover', d, function () {
        var accesi = e.pref.giorni.filter(function (x) { return x; }).length;
        if (e.pref.giorni[i] && accesi === 1) { self.avviso('Serve almeno un giorno per gli argomenti nuovi.'); return; }
        e.pref.giorni[i] = !e.pref.giorni[i];
        b.setAttribute('aria-pressed', e.pref.giorni[i] ? 'true' : 'false');
        aggiornaPiano();
      });
      b.setAttribute('aria-pressed', e.pref.giorni[i] ? 'true' : 'false');
      gruppo.appendChild(b);
    });
    c.appendChild(gruppo);
    var campo2 = el('div', 'sc-campo');
    var lab2 = el('label', 'eyebrow', 'Ripasso finale');
    var id2 = 'sc-rip-' + e.id;
    lab2.setAttribute('for', id2);
    var rip = el('input', 'sc-numero');
    rip.type = 'number'; rip.id = id2; rip.min = '0'; rip.max = '60'; rip.step = '1';
    rip.value = String(e.pref.ripasso);
    rip.onchange = function () {
      var r = Math.floor(Number(rip.value));
      if (!(r >= 0)) r = 0;
      if (r > 60) r = 60;
      rip.value = String(r);
      e.pref.ripasso = r;
      aggiornaPiano();
    };
    campo2.appendChild(lab2);
    campo2.appendChild(rip);
    campo2.appendChild(el('span', 'sc-nota', 'giorni prima dell’esame senza argomenti nuovi'));
    c.appendChild(campo2);
    riep.textContent = this.riepilogo(e);
    c.appendChild(riep);

    var sotto = el('div', 'sc-sotto-riga');
    sotto.appendChild(el('span', 'eyebrow', 'Argomenti dell’esame'));
    sotto.appendChild(el('span', 'sc-nota', suoi.length + ' in totale'));
    c.appendChild(sotto);

    if (suoi.length) {
      var ul = el('ul', 'sc-righe');
      suoi.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it', { numeric: true }); }).forEach(function (t) {
        var li = el('li');
        li.appendChild(el('span', 'sc-righe-t', t.nome));
        li.appendChild(el('span', 'sc-righe-p', self.percorsi[t.track].breve + ' · sc. ' + (t.box + 1)));
        var apri = bottone('sc-icona', '→', function () { self.vista = t.track; self.render(); self.pannelloArgomento(t.id); });
        apri.setAttribute('aria-label', 'Apri ' + t.nome);
        li.appendChild(apri);
        var via = bottone('sc-icona sc-pericolo', '✕', function () {
          self.conferma('Eliminare « ' + t.nome + ' »?',
            'Esce dalle scatole di ' + e.nome + ' e dalle uscite già segnate sul calendario.',
            'Elimina', function () { self.elimina(t.id); self.render(); self.pannelloEsame(e.id); self.avviso('Argomento eliminato.'); });
        });
        via.setAttribute('aria-label', 'Elimina ' + t.nome);
        li.appendChild(via);
        ul.appendChild(li);
      });
      c.appendChild(ul);
    } else {
      c.appendChild(el('p', 'sc-nota', 'Nessun argomento: aggiungine uno qui sotto e il calendario avrà qualcosa da far uscire.'));
    }

    var add = el('form', 'sc-riga sc-aggiungi');
    var inp = el('input');
    inp.type = 'text'; inp.maxLength = 90; inp.required = true;
    inp.placeholder = 'Nuovo argomento di ' + e.nome;
    inp.setAttribute('aria-label', 'Nuovo argomento');
    var sel = el('select');
    sel.setAttribute('aria-label', 'Percorso');
    this.ordine.forEach(function (tr) { var o = el('option', null, self.percorsi[tr].breve); o.value = tr; sel.appendChild(o); });
    sel.value = this.vista;
    var bt = el('button', 'btn btn-primary', 'Aggiungi');
    bt.type = 'submit';
    add.onsubmit = function (ev) {
      ev.preventDefault();
      var n = inp.value.trim();
      if (!n) return;
      self.S.argomenti.push({ id: nid(), nome: n, esame: e.id, track: sel.value, box: 0,
                              ultimo: null, creato: OGGI(), ripassi: 0, pendente: null, u: '', piano: null });
      self.ripianifica(e);
      self.render(); self.pannelloEsame(e.id);
    };
    add.appendChild(inp); add.appendChild(sel); add.appendChild(bt);
    c.appendChild(add);

    if (e.materia && this.materie[e.materia]) {
      var m = this.materie[e.materia];
      var mancanti = lezioniMancanti(suoi, m.episodi);
      if (mancanti.length) {
        c.appendChild(bottone('btn btn-ghost sc-largo', 'Aggiungi le lezioni di ' + m.nome + ' che mancano (' + mancanti.length + ')', function () {
          var oggi = OGGI();
          mancanti.forEach(function (ep) {
            self.S.argomenti.push({ id: nid(), nome: ep.t, esame: e.id, track: self.ordine[0], box: 0,
                                    ultimo: null, creato: oggi, ripassi: 0, pendente: null, u: ep.u || '', piano: null });
          });
          self.ripianifica(e);
          self.render(); self.pannelloEsame(e.id);
          self.avviso(mancanti.length + ' ' + plur(mancanti.length, 'lezione aggiunta', 'lezioni aggiunte') + '.');
        }));
      }
    }

    c.appendChild(el('span', 'eyebrow sc-sotto', 'Zona pericolosa'));
    c.appendChild(bottone('btn btn-ghost sc-pericolo sc-largo', 'Elimina « ' + e.nome + ' »', function () {
      self.conferma('Eliminare l’esame « ' + e.nome + ' »?',
        suoi.length ? 'Spariscono anche i suoi ' + suoi.length + ' ' + plur(suoi.length, 'argomento', 'argomenti') + ' e tutto il calendario. Non si annulla.'
                    : 'L’esame e il suo calendario spariscono. Non si annulla.',
        'Elimina l’esame', function () {
          self.S.argomenti = self.S.argomenti.filter(function (t) { return t.esame !== e.id; });
          self.S.esami = self.S.esami.filter(function (x) { return x.id !== e.id; });
          if (self.attivo === e.id) self.attivo = self.S.esami.length ? self.S.esami[0].id : null;
          self.render(); self.chiudi(self.dlg); self.avviso('Esame eliminato.');
        });
    }));
    this.apri(this.dlg);
  };

  P.estrai = function (e, ambito) {
    var self = this, tr = this.vista;
    var pool = this.argDi(e.id).filter(function (t) { return t.track === tr; });
    if (ambito === 'maturi') pool = pool.filter(function (t) { return self.maturo(t) || t.pendente; });
    else if (ambito && ambito.indexOf('box') === 0) {
      var n = Number(ambito.slice(3));
      pool = pool.filter(function (t) { return t.box === n; });
    }
    if (!pool.length) {
      this.avviso(ambito === 'maturi' ? 'Niente di maturo in questo percorso: prova con « Tutto il percorso ».'
                                      : 'Nessun argomento in questa selezione.');
      return;
    }
    this.pannelloArgomento(pool[Math.floor(Math.random() * pool.length)].id);
  };

  /* ---------------------------------------------------------------- *
   * backup                                                            *
   * ---------------------------------------------------------------- */
  P.esporta = function () {
    var testo = JSON.stringify(this.S, null, 2);
    var nome = 'scatole-di-ripasso-' + OGGI() + '.json';
    try {
      var blob = new Blob([testo], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      this.avviso('Backup scaricato: ' + nome + '.');
      return;
    } catch (e) {}
    var self = this;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(testo).then(function () {
        self.avviso('Backup copiato negli appunti: incollalo in un file .json.');
      }, function () { self.avviso('Esportazione non riuscita: riprova da un altro browser.'); });
    } else {
      this.avviso('Esportazione non riuscita: riprova da un altro browser.');
    }
  };

  P.importa = function (ev) {
    var self = this, f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var d = null;
      try { d = self.normalizza(JSON.parse(r.result)); } catch (e) { d = null; }
      ev.target.value = '';
      if (!d) { self.avviso('File non valido: serve un backup esportato dalle scatole.'); return; }
      self.conferma('Sostituire i dati con il backup?',
        'Il backup contiene ' + d.esami.length + ' ' + plur(d.esami.length, 'esame', 'esami') + ' e ' + d.argomenti.length + ' ' +
        plur(d.argomenti.length, 'argomento', 'argomenti') + '. I dati attuali su questo dispositivo vengono sostituiti.',
        'Sostituisci', function () {
          self.S = d;
          self.migra();
          self.attivo = d.esami.length ? d.esami[0].id : null;
          self.mese = null;
          self.render();
          self.avviso('Backup importato: ' + d.argomenti.length + ' ' + plur(d.argomenti.length, 'argomento', 'argomenti') + '.');
        });
    };
    r.readAsText(f);
  };

  /* LE LEZIONI DEL CORSO CHE UN ESAME NON HA ANCORA (07/10): `suoi` = gli argomenti
     dell'esame, `episodi` = le lezioni della materia dal catalogo ({t, u}). Una lezione gia'
     presa si riconosce dal nome O DALLA SUA PAGINA (`u`): il nome di un argomento del corso e'
     cambiato («S1E01 · ...» -> «Lezione 1 di 10 · ...», il lessico deciso), e chi l'aveva
     aggiunta col nome vecchio, o l'ha rinominata, non deve trovarsela doppia dopo «Aggiungi
     le lezioni che mancano». */
  function lezioniMancanti(suoi, episodi) {
    var gia = {}, giaU = {};
    (suoi || []).forEach(function (t) { gia[t.nome] = true; if (t.u) giaU[t.u] = true; });
    return (episodi || []).filter(function (ep) { return !gia[ep.t] && !(ep.u && giaU[ep.u]); });
  }

  /* ---------------------------------------------------------------- *
   * avvio                                                             *
   * ---------------------------------------------------------------- */
  function avvia() {
    var nodi = document.querySelectorAll('[data-scatole]');
    if (!nodi.length) return;
    var isola = document.getElementById('scatole-catalogo');
    var cat = null;
    try { cat = isola ? JSON.parse(isola.textContent) : null; } catch (e) { cat = null; }
    for (var i = 0; i < nodi.length; i++) {
      if (nodi[i].getAttribute('data-montato')) continue;
      if (!cat || !cat.percorsi || !cat.percorsi.length) {
        nodi[i].textContent = 'Le scatole non si sono aperte: manca il loro catalogo. Ricarica la pagina; se resta così, scrivici dall’assistenza.';
        continue;
      }
      nodi[i].setAttribute('data-montato', '1');
      new Scatole(nodi[i], cat);
    }
  }

  global.Scatole = { avvia: avvia, _date: { piu: piu, diffGiorni: diffGiorni, chiaveUTC: chiaveUTC },
                     _argomenti: { lezioniMancanti: lezioniMancanti } };
  /* Nella copia cifrata la pagina-cancello ricrea gli script DOPO aver messo il
     documento: DOMContentLoaded e' gia' passato, quindi si parte subito. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})(this);
