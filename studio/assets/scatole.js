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
     {v:1, esami:[{id,nome,materia,inizio,dataEsame,giorni:{"AAAA-MM-GG":{t,esito}},ultimoGiorno}],
      argomenti:[{id,nome,esame,track,box,ultimo,creato,ripassi,pendente,u}]}
   E' la stessa forma dell'originale (v:2 di Luca): un suo backup si importa.
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
    this.costruisci();
    if (!this.attivo && this.S.esami.length) this.attivo = this.S.esami[0].id;
    this.render();
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
                   dataEsame: eChiave(e.dataEsame) ? e.dataEsame : null,
                   giorni: giorni,
                   ultimoGiorno: eChiave(e.ultimoGiorno) ? e.ultimoGiorno : null });
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
                       u: typeof t.u === 'string' ? t.u : '' });
    });
    return { v: 1, esami: esami, argomenti: argomenti };
  };

  P.carica = function () {
    var raw = null;
    try { raw = global.localStorage && global.localStorage.getItem(CHIAVE); } catch (e) { raw = null; }
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

  P.salva = function () {
    try { global.localStorage.setItem(CHIAVE, JSON.stringify(this.S)); }
    catch (e) { this.avviso('La memoria del browser non è disponibile: i dati non vengono salvati.'); }
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
    return t.ultimo ? piu(t.ultimo, this.iv(t)[t.box] || 1) : (t.creato || OGGI());
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
   * calendario: una uscita al giorno per esame                        *
   * ---------------------------------------------------------------- */
  P.scegli = function (e, giorno) {
    var self = this;
    var cand = this.argDi(e.id).filter(function (t) { return !t.pendente && self.scadenza(t) <= giorno; });
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
  P.segna = function (t, box, track) {
    this.chiudiUscita(t, 'fatto');
    t.ultimo = OGGI();
    t.ripassi = (t.ripassi || 0) + 1;
    if (track) t.track = track;
    t.box = box;
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
              inizio: OGGI(), dataEsame: dataEsame || null, giorni: {}, ultimoGiorno: null };
    this.S.esami.push(e);
    var aggiunti = 0;
    if (e.materia && conEpisodi) {
      var oggi = OGGI(), self = this;
      this.materie[e.materia].episodi.forEach(function (ep) {
        self.S.argomenti.push({ id: nid(), nome: ep.t, esame: e.id, track: self.ordine[0], box: 0,
                                ultimo: null, creato: oggi, ripassi: 0, pendente: null, u: ep.u || '' });
        aggiunti++;
      });
    }
    this.attivo = e.id;
    this.mese = null;
    return aggiunti;
  };

  P.avviso = function (msg) {
    var t = this.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(function () { t.classList.remove('on'); }, 3200);
  };

  /* ---------------------------------------------------------------- *
   * scheletro della pagina                                            *
   * ---------------------------------------------------------------- */
  P.costruisci = function () {
    var self = this, r = this.radice;
    r.textContent = '';
    r.classList.add('sc');

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

    this.dlg = this.dialogo('sc-dlg');
    this.dlg2 = this.dialogo('sc-dlg sc-dlg-conferma');
    this.toast = el('div', 'sc-toast');
    this.toast.setAttribute('role', 'status');
    this.toast.setAttribute('aria-live', 'polite');
    r.appendChild(this.toast);
    if (this.avvisoIniziale) this.avviso(this.avvisoIniziale);
  };

  P.dialogo = function (cls) {
    var d = el('dialog', cls);
    var corpo = el('div', 'sc-pannello');
    d.appendChild(corpo);
    d.corpo = corpo;
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    this.radice.appendChild(d);
    return d;
  };
  P.apri = function (d) {
    if (d.open) return;
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
    var self = this;
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
    var labT = el('span', null, 'con i suoi episodi come argomenti');
    lab.appendChild(labT);
    lab.hidden = true;
    form.appendChild(lab);
    materia.onchange = function () {
      var m = self.materie[materia.value];
      lab.hidden = !m;
      if (m) {
        labT.textContent = 'con i suoi ' + m.episodi.length + ' episodi come argomenti';
        if (!nome.value.trim()) nome.value = m.nome;
      }
    };
    var riga = el('div', 'sc-riga');
    var data = el('input');
    data.type = 'date';
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
      var quanti = self.creaEsame(n, materia.value, data.value, !lab.hidden && conEp.checked);
      self.render();
      self.avviso(quanti ? '« ' + n + ' » creato con ' + quanti + ' argomenti: il calendario ne fa uscire uno al giorno da oggi.'
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
    v.appendChild(el('p', null, 'Parti da una materia del semestre filtro: i suoi episodi diventano gli argomenti, e da oggi il calendario ne fa uscire uno al giorno. Oppure crea un esame tuo qui sopra e scrivi gli argomenti a mano.'));
    var az = el('div', 'sc-azioni sc-azioni-centro');
    (this.cat.materie || []).forEach(function (m) {
      var b = bottone('btn btn-primary', m.nome + ' · ' + m.episodi.length + ' episodi', function () {
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
    griglia.appendChild(this.cartaCoda(e));
    s1.appendChild(griglia);
    v.appendChild(s1);

    /* calendario */
    var s2 = el('section', 'sc-sez');
    var h2 = el('div', 'sc-sez-h');
    h2.appendChild(el('h2', null, 'Calendario'));
    h2.appendChild(el('p', 'sc-nota', 'Le uscite passate restano segnate: spuntate se le hai spostate, in rosso se sono ancora in coda.'));
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
                              ultimo: null, creato: OGGI(), ripassi: 0, pendente: null, u: '' });
      self.render();
      self.avviso('« ' + n + ' » è nella scatola 1.');
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
    var ok;
    if (t.box < ultima) {
      ok = bottone('btn btn-primary', 'Ricordato → scatola ' + (t.box + 2) + ' (' + iv[t.box + 1] + ' g)', function () {
        self.segna(t, t.box + 1);
        fatto('Spostato: torna tra ' + iv[t.box] + ' ' + plur(iv[t.box], 'giorno', 'giorni') + '.');
      });
    } else if (succ) {
      var ing = this.ingresso(t.track, succ), giorni = this.percorsi[succ].iv[ing];
      ok = bottone('btn btn-primary', 'Ricordato → ' + this.percorsi[succ].breve.toLowerCase() + ' (' + giorni + ' g)', function () {
        self.segna(t, ing, succ);
        fatto('Promosso: ' + self.percorsi[succ].breve.toLowerCase() + ', torna tra ' + giorni + ' giorni.');
      });
    } else {
      ok = bottone('btn btn-primary', 'Ricordato → consolidato (altri ' + iv[ultima] + ' g)', function () {
        self.segna(t, ultima);
        fatto('Consolidato: torna tra ' + iv[ultima] + ' giorni.');
      });
    }
    az.appendChild(ok);
    az.appendChild(bottone('btn btn-ghost', 'Non ricordato → scatola 1', function () {
      self.segna(t, 0);
      fatto('Riparte dalla scatola 1.');
    }));
    if (t.pendente) {
      az.appendChild(bottone('btn btn-ghost', 'Lascio in coda', function () {
        fatto('Resta in coda: lo ritrovi domani fra gli arretrati.');
      }));
    }
    return az;
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
    var oggi = OGGI();
    for (var i = 0; i < spazio; i++) cal.appendChild(el('div', 'sc-cella sc-nulla'));
    for (var g = 1; g <= nGiorni; g++) {
      var k = this.mese.a + '-' + pad(this.mese.m + 1) + '-' + pad(g);
      var voce = e.giorni[k];
      var t = voce ? this.arg(voce.t) : null;
      var cella = el(t ? 'button' : 'div', 'sc-cella');
      if (t) cella.type = 'button';
      if (k === oggi) cella.classList.add('sc-oggi-c');
      if (diffGiorni(k, oggi) > 0) cella.classList.add('sc-futuro');
      cella.appendChild(el('span', 'sc-num', String(g)));
      if (t) {
        var chiusa = !!voce.esito || t.pendente !== k;
        cella.classList.add(chiusa ? 'sc-fatto' : 'sc-pend');
        cella.appendChild(el('span', 'sc-cella-t', t.nome));
        var st = el('span', 'sc-striscia');
        st.setAttribute('data-lv', String(this.livello(t.track, t.box)));
        cella.appendChild(st);
        cella.setAttribute('aria-label', g + ' ' + MESI[this.mese.m] + ': ' + t.nome + (chiusa ? ', spostato' : ', ancora in coda'));
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
    var self = this, t = this.arg(tid);
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
        : 'Mai ripassato: esce al primo giro utile.';
    }
    c.appendChild(st);
    if (t.u) {
      var a = el('a', 'sc-link-appunti', 'Apri gli appunti di questo episodio →');
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
        t.esame = sel.value; self.attivo = t.esame;
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
    this.S.argomenti = this.S.argomenti.filter(function (a) { return a.id !== tid; });
    this.S.esami.forEach(function (e) {
      Object.keys(e.giorni).forEach(function (k) { if (e.giorni[k] && e.giorni[k].t === tid) delete e.giorni[k]; });
    });
  };

  P.pannelloEsame = function (eid) {
    var self = this, e = this.esame(eid), c = this.dlg.corpo;
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
    data.onchange = function () {
      e.dataEsame = eChiave(data.value) ? data.value : null;
      self.render();
      self.avviso(e.dataEsame ? 'Esame fissato al ' + dataBreve(e.dataEsame) + '.' : 'Data rimossa.');
      self.pannelloEsame(e.id);
    };
    campo.appendChild(lab);
    campo.appendChild(data);
    c.appendChild(campo);

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
                              ultimo: null, creato: OGGI(), ripassi: 0, pendente: null, u: '' });
      self.render(); self.pannelloEsame(e.id);
    };
    add.appendChild(inp); add.appendChild(sel); add.appendChild(bt);
    c.appendChild(add);

    if (e.materia && this.materie[e.materia]) {
      var m = this.materie[e.materia];
      var gia = {};
      suoi.forEach(function (t) { gia[t.nome] = true; });
      var mancanti = m.episodi.filter(function (ep) { return !gia[ep.t]; });
      if (mancanti.length) {
        c.appendChild(bottone('btn btn-ghost sc-largo', 'Aggiungi gli episodi di ' + m.nome + ' che mancano (' + mancanti.length + ')', function () {
          var oggi = OGGI();
          mancanti.forEach(function (ep) {
            self.S.argomenti.push({ id: nid(), nome: ep.t, esame: e.id, track: self.ordine[0], box: 0,
                                    ultimo: null, creato: oggi, ripassi: 0, pendente: null, u: ep.u || '' });
          });
          self.render(); self.pannelloEsame(e.id);
          self.avviso(mancanti.length + ' ' + plur(mancanti.length, 'episodio aggiunto', 'episodi aggiunti') + '.');
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
          self.attivo = d.esami.length ? d.esami[0].id : null;
          self.mese = null;
          self.render();
          self.avviso('Backup importato: ' + d.argomenti.length + ' ' + plur(d.argomenti.length, 'argomento', 'argomenti') + '.');
        });
    };
    r.readAsText(f);
  };

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

  global.Scatole = { avvia: avvia, _date: { piu: piu, diffGiorni: diffGiorni, chiaveUTC: chiaveUTC } };
  /* Nella copia cifrata la pagina-cancello ricrea gli script DOPO aver messo il
     documento: DOMContentLoaded e' gia' passato, quindi si parte subito. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})(this);
