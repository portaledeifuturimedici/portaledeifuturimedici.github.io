/* =====================================================================
   procedure.js — le GUIDE: una domanda alla volta, fino alla risposta.

   PERCHE' ESISTE
   Il proprietario ha chiesto «i motori di esercitazione… gli esercizi
   (rendili guidati)». Il materiale davvero GUIDATO esisteva già e non era
   mai stato pubblicato: `procedure_{A,B}.md`, 120 file su 120 conformi,
   fuori sia da PUBLISHED sia da FULL_PUBLISHED. Sono alberi di decisione —
   una domanda, due o tre strade, e in fondo il criterio che risolve — cioè
   la forma che insegna un METODO invece di consegnare un risultato.

   COME SI USA, E COSA CAMBIA RISPETTO A LEGGERLI
   Stampato, un albero si legge tutto insieme: l'occhio arriva alla foglia
   giusta prima che tu abbia scelto, e la decisione — che è l'unica cosa che
   si sta allenando — non la prendi mai. Qui si vede UNA domanda per volta.
   Scegli, e solo allora compare l'esito di quella scelta e la domanda
   successiva. Alla fine il percorso resta scritto (si rilegge come un
   ragionamento) e si apre la sezione «Verifica» del sorgente, che è il
   controllo di senso: «se hai risposto X, hai preso la trappola Y».
   Anche la strada SBAGLIATA è una strada: la si può percorrere, e dice
   perché è sbagliata. Non c'è punteggio — non è un quiz, è un metodo.

   IL DATO (study_data.parse_procedure)
     {radice, alberi:[nodo], note:[...], verifica:[...]}
     nodo    = {q, opzioni:[opzione]}
     opzione = {etichetta, esito, dettagli:[...], poi: nodo?}
   Un file può avere PIU' alberi (misurato: 219 nodi-radice su 120 file):
   sono controlli separati sulla stessa procedura, e si percorrono in fila.

   MONTAGGIO
     <div data-procedure data-src="../data/procedure/s1c11-A.json"
          data-materia="chimica" data-titolo="Guida A"></div>
   oppure `Procedure.monta(nodo, dati, opzioni)` — la strada dell'hub.

   Vanilla JS, ES5, zero dipendenze.
   ===================================================================== */
(function (global) {
  'use strict';

  var ATTESA_SPORTELLO = 5000, PASSO_SPORTELLO = 25;

  /* ---------------------------------------------------------------- *
   * 1. Normalizzazione del dato                                       *
   * ---------------------------------------------------------------- */

  function esisteArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function testoDi(v) { return (typeof v === 'string') ? v.trim() : ''; }

  function normalizzaNodo(n, profondita) {
    /* La profondità è un freno, non un limite di dominio: un dato malformato
       che si auto-riferisse manderebbe la ricorsione all'infinito e la pagina
       in blocco. Il corpus reale arriva a 3 livelli (misurato). */
    if (!n || typeof n !== 'object' || profondita > 24) return null;
    var q = testoDi(n.q);
    var opz = esisteArray(n.opzioni) ? n.opzioni : [];
    var fuori = [], i;
    for (i = 0; i < opz.length; i++) {
      var o = opz[i];
      if (!o || typeof o !== 'object') continue;
      var et = testoDi(o.etichetta);
      var es = testoDi(o.esito);
      if (!et && !es) continue;
      var dett = [], j;
      if (esisteArray(o.dettagli)) {
        for (j = 0; j < o.dettagli.length; j++) {
          var d = testoDi(o.dettagli[j]);
          if (d) dett.push(d);
        }
      }
      fuori.push({
        etichetta: et || 'Prosegui', esito: es, dettagli: dett,
        poi: normalizzaNodo(o.poi, profondita + 1)
      });
    }
    if (!q || !fuori.length) return null;
    return { q: q, opzioni: fuori };
  }

  function normalizzaGuida(g, k) {
    if (!g || typeof g !== 'object') return null;
    var radice = testoDi(g.radice);
    var alberi = [], i;
    var grezzi = esisteArray(g.alberi) ? g.alberi : [];
    for (i = 0; i < grezzi.length; i++) {
      var a = normalizzaNodo(grezzi[i], 0);
      if (a) alberi.push(a);
    }
    if (!radice || !alberi.length) return null;
    var lista = function (v) {
      var fuori = [], j;
      if (!esisteArray(v)) return fuori;
      for (j = 0; j < v.length; j++) { var t = testoDi(v[j]); if (t) fuori.push(t); }
      return fuori;
    };
    return {
      radice: radice, alberi: alberi,
      note: lista(g.note), verifica: lista(g.verifica),
      k: String(g.k || k || '')
    };
  }

  function normalizzaRaccolta(dati) {
    var d = dati || {};
    var grezze = esisteArray(d.guide) ? d.guide : (esisteArray(d) ? d : []);
    var lezione = (d.slug ? (d.slug + (d.parte ? '-' + d.parte : '')) : '');
    var fuori = [], i, g;
    for (i = 0; i < grezze.length; i++) {
      g = normalizzaGuida(grezze[i], lezione);
      if (g) fuori.push(g);
    }
    return {
      slug: String(d.slug || ''), parte: String(d.parte || ''),
      materia: String(d.materia || '').toLowerCase(),
      lezione: String(d.lezione || ''),
      lezioni: (d.lezioni && typeof d.lezioni === 'object') ? d.lezioni : {},
      guide: fuori
    };
  }

  function contaNodo(n) {
    var nodi = 1, foglie = 0, i;
    for (i = 0; i < n.opzioni.length; i++) {
      if (n.opzioni[i].poi) {
        var c = contaNodo(n.opzioni[i].poi);
        nodi += c[0]; foglie += c[1];
      } else { foglie++; }
    }
    return [nodi, foglie];
  }

  function contaGuida(g) {
    var nodi = 0, foglie = 0, i;
    for (i = 0; i < g.alberi.length; i++) {
      var c = contaNodo(g.alberi[i]);
      nodi += c[0]; foglie += c[1];
    }
    return { nodi: nodi, foglie: foglie, alberi: g.alberi.length };
  }

  /* ---------------------------------------------------------------- *
   * 2. Foglio di stile                                                *
   * ---------------------------------------------------------------- */

  var CSS = [
    '.pr{--pr-materia:var(--accent,var(--fisica,#C13E7A));',
    '  --pr-materia-scura:var(--ink,#201B2E);',
    '  --pr-accent:var(--pr-materia);--pr-accent-t:var(--pr-materia);',
    '  --pr-pieno:var(--pr-materia);--pr-oncolor:var(--btn-oncolor,#14102A);',
    '  color:var(--ink,#201B2E);font-family:inherit;',
    '  max-width:var(--measure,66ch);margin-inline:auto}',
    ':root[data-theme="day"] .pr{--pr-oncolor:var(--btn-oncolor,#FFFFFF);',
    '  --pr-accent-t:var(--pr-materia-scura);--pr-pieno:var(--pr-materia-scura)}',
    '.pr *{box-sizing:border-box}',
    '.pr [hidden]{display:none !important}',
    '.pr-head{margin-bottom:12px}',
    '.pr-titolo{font-size:1.15rem;line-height:1.3;font-weight:700;margin:0}',
    '.pr-sub{font-size:.82rem;color:var(--muted,#6B6480);margin:4px 0 0}',
    '.pr-scelta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}',
    '.pr-scelta label{font-size:.8rem;font-weight:700}',
    '.pr-select{min-height:44px;padding:8px 10px;font:inherit;font-size:.88rem;',
    '  color:inherit;background:var(--surface,#fff);max-width:100%;',
    '  border:1px solid var(--line,#E7DFD4);border-radius:10px}',

    '.pr-obiettivo{border:1px solid var(--line,#E7DFD4);border-left:3px solid var(--pr-accent);',
    '  border-radius:12px;background:var(--surface,#fff);padding:13px 15px;margin-bottom:14px}',
    '.pr-obiettivo .pr-et{font-size:.72rem;font-weight:700;letter-spacing:.05em;',
    '  text-transform:uppercase;color:var(--pr-accent-t);display:block;margin-bottom:3px}',
    '.pr-obiettivo p{margin:0;line-height:1.5;font-weight:700}',

    /* il percorso già fatto */
    '.pr-percorso{list-style:none;margin:0 0 14px;padding:0;counter-reset:pr}',
    '.pr-passo{border-left:2px solid var(--line,#E7DFD4);padding:0 0 12px 14px;',
    '  position:relative;margin:0}',
    '.pr-passo:last-child{padding-bottom:6px}',
    '.pr-passo-q{font-size:.83rem;color:var(--muted,#6B6480);margin:0 0 3px;line-height:1.45}',
    /* la scelta fatta porta un segno SCRITTO («hai scelto»), non solo il
       rientro e la tinta: il colore non può essere l'unico portatore. */
    '.pr-passo-s{margin:0;line-height:1.5}',
    '.pr-passo-s b{color:var(--pr-accent-t)}',
    '.pr-passo-e{margin:4px 0 0;line-height:1.55}',
    '.pr-dett{margin:6px 0 0;padding-left:1.2em;font-size:.92rem}',
    '.pr-dett li{margin:.2em 0;line-height:1.5}',

    /* la domanda corrente */
    '.pr-carta{border:1px solid var(--line,#E7DFD4);border-radius:14px;',
    '  background:var(--surface,#fff);padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
    '.pr-n{font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;',
    '  color:var(--muted,#6B6480);margin:0 0 5px}',
    '.pr-q{font-size:1.05rem;font-weight:700;line-height:1.4;margin:0 0 12px}',
    '.pr-opzioni{display:flex;flex-direction:column;gap:8px}',
    '.pr-opz{display:block;width:100%;text-align:left;min-height:44px;padding:12px 14px;',
    '  border:1px solid var(--line,#E7DFD4);border-radius:11px;background:transparent;',
    '  color:inherit;font:inherit;font-size:.95rem;line-height:1.45;cursor:pointer}',
    '.pr-opz:hover{border-color:var(--pr-accent)}',
    '.pr-opz:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px}',
    '.pr-opz b{color:var(--pr-accent-t)}',

    '.pr-fine{border:1px solid var(--line,#E7DFD4);border-radius:14px;',
    '  background:var(--surface,#fff);padding:16px}',
    '.pr-fine h4{margin:0 0 6px;font-size:1rem}',
    '.pr-fine p{margin:0 0 8px;line-height:1.55}',
    '.pr-verifica{margin:8px 0 0;padding-left:1.2em}',
    '.pr-verifica li{margin:.35em 0;line-height:1.55}',
    '.pr-nota{font-size:.88rem;color:var(--muted,#6B6480);line-height:1.5}',

    '.pr-comandi{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}',
    '.pr-btn{min-height:44px;padding:10px 16px;border-radius:10px;cursor:pointer;',
    '  font:inherit;font-size:.9rem;font-weight:700;border:1px solid var(--line,#E7DFD4);',
    '  background:transparent;color:inherit}',
    '.pr-btn:focus-visible{outline:2px solid var(--pr-accent);outline-offset:2px}',
    '.pr-btn-primario{background:var(--pr-pieno);color:var(--pr-oncolor);',
    '  border-color:var(--pr-pieno)}',
    '.pr-btn[disabled]{opacity:.5;cursor:default}',
    '.pr-conta{font-size:.82rem;color:var(--muted,#6B6480);margin-left:auto}',
    '.pr-pannello{border:1px solid var(--line,#E7DFD4);border-radius:12px;padding:14px;',
    '  background:var(--surface,#fff)}',
    '.pr-pannello h3{margin:0 0 6px;font-size:1rem}',
    '@media (prefers-reduced-motion:reduce){.pr *{transition:none !important}}'
  ].join('\n');

  function iniettaCss(doc) {
    if (!doc || doc.getElementById('pr-css')) return;
    if (doc.querySelector) {
      var nodi = doc.querySelectorAll('[data-motori-css]'), i, v;
      for (i = 0; i < nodi.length; i++) {
        v = String(nodi[i].getAttribute('data-motori-css') || '').toLowerCase();
        if (v === 'study' || v.indexOf('procedure') >= 0) return;
      }
    }
    var st = doc.createElement('style');
    st.id = 'pr-css';
    st.setAttribute('data-motori-css-procedure', '1');
    st.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------------------------------------------------------------- *
   * 3. DOM + markdown inline                                          *
   * ---------------------------------------------------------------- */

  function el(doc, tag, attr, testo) {
    var n = doc.createElement(tag), k;
    if (attr) for (k in attr) if (attr.hasOwnProperty(k) && attr[k] != null) n.setAttribute(k, attr[k]);
    if (testo != null) n.appendChild(doc.createTextNode(testo));
    return n;
  }

  function svuota(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inlineMd(s) {
    var codici = [];
    var t = escapeHtml(s);
    /* segnaposto U+0000 per i `codici`: stessa scelta di flashcards.js —
       un segnaposto fatto di cifre morderebbe dentro «1 N = kg·m/s²». */
    t = t.replace(/`([^`]+)`/g, function (_, dentro) {
      codici.push(dentro);
      return '\u0000' + (codici.length - 1) + '\u0000';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(«"'])\*([^*\n]+)\*(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codici[+i] + '</code>'; });
    return t;
  }

  function conMd(doc, tag, attr, testo) {
    var n = el(doc, tag, attr);
    n.innerHTML = inlineMd(testo);
    return n;
  }

  /* ---------------------------------------------------------------- *
   * 4. L'applicazione                                                 *
   * ---------------------------------------------------------------- */

  function App(radice, dati, opzioni) {
    var doc = radice.ownerDocument || global.document;
    opzioni = opzioni || {};
    this.doc = doc;
    this.radice = radice;
    this.opzioni = opzioni;
    this.raccolta = normalizzaRaccolta(dati);
    this.materia = this.raccolta.materia ||
      String(opzioni.materia || radice.getAttribute('data-materia') || '').toLowerCase();
    this.titolo = opzioni.titolo || radice.getAttribute('data-titolo') ||
      (this.raccolta.lezione || 'Guide');
    this.iG = 0;
    iniettaCss(doc);
    this.costruisci();
    this.riparti();
  }

  App.prototype.guida = function () { return this.raccolta.guide[this.iG] || null; };

  App.prototype.riparti = function () {
    this.iAlbero = 0;
    this.percorso = [];      /* [{q, etichetta, esito, dettagli}] */
    this.pila = [];          /* i nodi attraversati, per tornare indietro */
    var g = this.guida();
    this.nodo = g ? g.alberi[0] : null;
    this.disegna();
  };

  App.prototype.accentoInline = function (nodo) {
    if (!this.materia) return;
    nodo.style.setProperty('--pr-materia', 'var(--' + this.materia + ')');
    nodo.style.setProperty('--pr-materia-scura', 'var(--' + this.materia + '-dark, var(--ink,#201B2E))');
  };

  App.prototype.costruisci = function () {
    var doc = this.doc, self = this, n = {};
    svuota(this.radice);
    this.nodi = n;

    var sez = el(doc, 'section', { 'class': 'pr' });
    this.accentoInline(sez);

    var head = el(doc, 'div', { 'class': 'pr-head' });
    n.titolo = el(doc, 'h3', { 'class': 'pr-titolo' }, this.titolo);
    n.sub = el(doc, 'p', { 'class': 'pr-sub' }, '');
    head.appendChild(n.titolo);
    head.appendChild(n.sub);
    sez.appendChild(head);

    /* Il selettore c'è solo con più di una guida: nell'hub la selezione può
       raccoglierne decine, nella pagina di una lezione ce n'è una sola e un
       menù con una voce sarebbe un comando che non comanda niente. */
    n.scelta = el(doc, 'div', { 'class': 'pr-scelta' });
    if (this.raccolta.guide.length > 1) {
      var lbl = el(doc, 'label', { 'for': 'pr-sel' }, 'Guida');
      n.sel = el(doc, 'select', { id: 'pr-sel', 'class': 'pr-select' });
      for (var i = 0; i < this.raccolta.guide.length; i++) {
        n.sel.appendChild(el(doc, 'option', { value: String(i) },
          (i + 1) + '. ' + this.raccolta.guide[i].radice));
      }
      n.sel.addEventListener('change', function () {
        self.iG = parseInt(n.sel.value, 10) || 0;
        self.riparti();
      }, false);
      n.scelta.appendChild(lbl);
      n.scelta.appendChild(n.sel);
    }
    sez.appendChild(n.scelta);

    n.obiettivo = el(doc, 'div', { 'class': 'pr-obiettivo' });
    sez.appendChild(n.obiettivo);

    n.percorso = el(doc, 'ol', { 'class': 'pr-percorso' });
    sez.appendChild(n.percorso);

    n.corpo = el(doc, 'div', {});
    sez.appendChild(n.corpo);

    var cmd = el(doc, 'div', { 'class': 'pr-comandi' });
    n.indietro = el(doc, 'button', { type: 'button', 'class': 'pr-btn' },
      '← Torna indietro di un passo');
    n.indietro.addEventListener('click', function () { self.indietro(); }, false);
    n.daccapo = el(doc, 'button', { type: 'button', 'class': 'pr-btn' }, 'Ricomincia');
    n.daccapo.addEventListener('click', function () { self.riparti(); }, false);
    n.conta = el(doc, 'p', { 'class': 'pr-conta', 'aria-live': 'polite' }, '');
    cmd.appendChild(n.indietro);
    cmd.appendChild(n.daccapo);
    cmd.appendChild(n.conta);
    sez.appendChild(cmd);

    this.radice.appendChild(sez);
  };

  App.prototype.scegli = function (o) {
    this.percorso.push({
      q: this.nodo.q, etichetta: o.etichetta, esito: o.esito, dettagli: o.dettagli
    });
    this.pila.push(this.nodo);
    this.nodo = o.poi || null;
    this.disegna();
    this.portaFuoco();
  };

  App.prototype.indietro = function () {
    if (!this.percorso.length) {
      /* nessun passo in questo albero: si torna a quello precedente, se c'è */
      if (this.iAlbero > 0) { this.iAlbero--; this.nodo = this.guida().alberi[this.iAlbero]; }
      this.disegna();
      return;
    }
    this.percorso.pop();
    this.nodo = this.pila.pop() || null;
    this.disegna();
    this.portaFuoco();
  };

  App.prototype.prossimoAlbero = function () {
    var g = this.guida();
    if (!g || this.iAlbero + 1 >= g.alberi.length) return;
    this.iAlbero++;
    this.nodo = g.alberi[this.iAlbero];
    this.disegna();
    this.portaFuoco();
  };

  App.prototype.portaFuoco = function () {
    try {
      var t = this.nodi.corpo.querySelector('[tabindex="-1"]');
      if (t) t.focus();
    } catch (e) { }
  };

  App.prototype.testo = function (nodo, s) {
    svuota(nodo);
    nodo.appendChild(this.doc.createTextNode(s));
  };

  App.prototype.disegna = function () {
    var doc = this.doc, self = this, n = this.nodi;
    var g = this.guida();

    svuota(n.obiettivo);
    svuota(n.percorso);
    svuota(n.corpo);

    if (!g) {
      this.testo(n.sub, '');
      var p = el(doc, 'div', { 'class': 'pr-pannello', role: 'status' });
      p.appendChild(el(doc, 'h3', {}, 'Nessuna guida in questa selezione'));
      p.appendChild(el(doc, 'p', {},
        'Per queste lezioni non è stata generata nessuna guida. Allarga la ' +
        'selezione, oppure aprine una dalla pagina di un episodio.'));
      n.corpo.appendChild(p);
      n.indietro.disabled = n.daccapo.disabled = true;
      this.testo(n.conta, '');
      return;
    }
    n.indietro.disabled = false;
    n.daccapo.disabled = false;

    var c = contaGuida(g);
    this.testo(n.sub, this.raccolta.guide.length > 1
      ? ('Guida ' + (this.iG + 1) + ' di ' + this.raccolta.guide.length +
         ' · ' + c.nodi + (c.nodi === 1 ? ' domanda' : ' domande') +
         ' · ' + c.foglie + (c.foglie === 1 ? ' esito' : ' esiti'))
      : (c.nodi + (c.nodi === 1 ? ' domanda' : ' domande') + ' · ' +
         c.foglie + (c.foglie === 1 ? ' esito possibile' : ' esiti possibili')));

    n.obiettivo.appendChild(el(doc, 'span', { 'class': 'pr-et' }, 'A che cosa serve'));
    n.obiettivo.appendChild(conMd(doc, 'p', {}, g.radice));

    /* --- il percorso già fatto, rileggibile come un ragionamento --- */
    var i, j;
    for (i = 0; i < this.percorso.length; i++) {
      var p2 = this.percorso[i];
      var li = el(doc, 'li', { 'class': 'pr-passo' });
      li.appendChild(conMd(doc, 'p', { 'class': 'pr-passo-q' }, p2.q));
      var s = el(doc, 'p', { 'class': 'pr-passo-s' });
      s.appendChild(el(doc, 'b', {}, 'Hai scelto: '));
      s.appendChild(doc.createTextNode(p2.etichetta));
      li.appendChild(s);
      if (p2.esito) li.appendChild(conMd(doc, 'p', { 'class': 'pr-passo-e' }, p2.esito));
      if (p2.dettagli && p2.dettagli.length) {
        var ul = el(doc, 'ul', { 'class': 'pr-dett' });
        for (j = 0; j < p2.dettagli.length; j++) {
          ul.appendChild(conMd(doc, 'li', {}, p2.dettagli[j]));
        }
        li.appendChild(ul);
      }
      n.percorso.appendChild(li);
    }

    if (this.nodo) {
      /* --- la domanda corrente --- */
      var carta = el(doc, 'div', { 'class': 'pr-carta', tabindex: '-1', role: 'group',
        'aria-label': 'Domanda della guida' });
      /* Con piu' controlli il numero e' quello del PASSO (il percorso non si
         azzera fra un controllo e l'altro: e' un ragionamento solo, e si
         rilegge intero). Chiamarlo «domanda 2» mentre e' la prima domanda del
         secondo controllo diceva due cose diverse nella stessa riga. */
      carta.appendChild(el(doc, 'p', { 'class': 'pr-n' },
        g.alberi.length > 1
          ? ('Controllo ' + (this.iAlbero + 1) + ' di ' + g.alberi.length +
             ' · passo ' + (this.percorso.length + 1))
          : ('Domanda ' + (this.percorso.length + 1))));
      carta.appendChild(conMd(doc, 'p', { 'class': 'pr-q' }, this.nodo.q));
      var box = el(doc, 'div', { 'class': 'pr-opzioni' });
      for (i = 0; i < this.nodo.opzioni.length; i++) {
        (function (o) {
          var b = el(doc, 'button', { type: 'button', 'class': 'pr-opz' });
          b.appendChild(el(doc, 'b', {}, o.etichetta));
          b.addEventListener('click', function () { self.scegli(o); }, false);
          box.appendChild(b);
        })(this.nodo.opzioni[i]);
      }
      carta.appendChild(box);
      n.corpo.appendChild(carta);
      this.testo(n.conta, 'passo ' + (this.percorso.length + 1));
      return;
    }

    /* --- foglia raggiunta --- */
    var fine = el(doc, 'div', { 'class': 'pr-fine', tabindex: '-1', role: 'status' });
    var altro = this.iAlbero + 1 < g.alberi.length;
    fine.appendChild(el(doc, 'h4', {},
      altro ? 'Primo controllo chiuso' : 'Sei arrivato in fondo'));
    fine.appendChild(el(doc, 'p', {},
      altro
        ? 'Questa procedura ha un secondo controllo, indipendente dal primo: ' +
          'la stessa domanda vista da un\'altra parte. Vale la pena farlo, ' +
          'perché è lì che di solito si sbaglia.'
        : 'Il percorso qui sopra è il ragionamento per intero: rileggilo dall\'alto ' +
          'e guarda quale domanda ha deciso tutto. È quella che ti serve all\'esame, ' +
          'non il risultato in fondo.'));

    if (altro) {
      var b3 = el(doc, 'button', { type: 'button', 'class': 'pr-btn pr-btn-primario' },
        'Prosegui col controllo successivo →');
      b3.addEventListener('click', function () { self.prossimoAlbero(); }, false);
      fine.appendChild(b3);
    } else {
      if (g.verifica.length) {
        fine.appendChild(el(doc, 'h4', {}, 'Verifica: controllo di senso'));
        fine.appendChild(el(doc, 'p', { 'class': 'pr-nota' },
          'Ogni riga descrive una risposta SBAGLIATA e dice perché lo è. ' +
          'Se ne riconosci una fra quelle che hai scelto, torna indietro e rifai ' +
          'quel passo: è lì che si perde il punto all\'esame.'));
        var uv = el(doc, 'ul', { 'class': 'pr-verifica' });
        for (i = 0; i < g.verifica.length; i++) {
          uv.appendChild(conMd(doc, 'li', {}, g.verifica[i]));
        }
        fine.appendChild(uv);
      }
      if (g.note.length) {
        fine.appendChild(el(doc, 'h4', {}, 'Da tenere a mente'));
        var un = el(doc, 'ul', { 'class': 'pr-verifica' });
        for (i = 0; i < g.note.length; i++) {
          un.appendChild(conMd(doc, 'li', {}, g.note[i]));
        }
        fine.appendChild(un);
      }
    }
    n.corpo.appendChild(fine);
    this.testo(n.conta, altro ? 'controllo ' + (this.iAlbero + 1) + ' chiuso' : 'guida completata');
  };

  /* ---------------------------------------------------------------- *
   * 5. Montaggio                                                      *
   * ---------------------------------------------------------------- */

  function sportello() {
    var s = global.StudioFetch;
    return (s && typeof s.leggi === 'function') ? s : null;
  }

  function conSportello(cb) {
    var s = sportello();
    if (s) { cb(s); return; }
    if (!global.setTimeout) { cb(null); return; }
    var atteso = 0;
    (function riprova() {
      var t = sportello();
      if (t) { cb(t); return; }
      atteso += PASSO_SPORTELLO;
      if (atteso >= ATTESA_SPORTELLO) { cb(null); return; }
      global.setTimeout(riprova, PASSO_SPORTELLO);
    })();
  }

  function erroreIn(radice, testo) {
    var doc = radice.ownerDocument || global.document;
    iniettaCss(doc);
    svuota(radice);
    var s = el(doc, 'section', { 'class': 'pr' });
    var p = el(doc, 'div', { 'class': 'pr-pannello', role: 'alert' });
    p.appendChild(el(doc, 'h3', {}, 'Guide non disponibili'));
    p.appendChild(el(doc, 'p', {}, testo));
    s.appendChild(p);
    radice.appendChild(s);
  }

  function monta(radice, dati, opzioni) {
    if (typeof radice === 'string') radice = global.document.getElementById(radice);
    if (!radice) return null;
    opzioni = opzioni || {};
    if (dati) return new App(radice, dati, opzioni);

    var idJson = radice.getAttribute('data-json');
    if (idJson) {
      var nodo = (radice.ownerDocument || global.document).getElementById(idJson);
      if (!nodo) { erroreIn(radice, 'Dati non trovati (data-json="' + idJson + '").'); return null; }
      try { return new App(radice, JSON.parse(nodo.textContent || nodo.innerText || '{}'), opzioni); }
      catch (e) { erroreIn(radice, 'I dati della guida non sono leggibili.'); return null; }
    }

    var src = radice.getAttribute('data-src');
    if (!src) { erroreIn(radice, 'Manca l\'attributo data-src o data-json.'); return null; }
    opzioni.sorgente = src;
    if (!global.fetch) { erroreIn(radice, 'Il browser non supporta il caricamento dei dati.'); return null; }

    var chiuso = false;
    var scadenza = global.setTimeout(function () {
      chiuso = true;
      erroreIn(radice, 'La guida ci sta mettendo troppo a caricare. Controlla la ' +
        'connessione e ricarica la pagina.');
    }, 15000);
    conSportello(function (sf) {
      if (chiuso) return;
      if (!sf) {
        global.clearTimeout(scadenza);
        erroreIn(radice, 'Il modulo che apre i materiali (studio_fetch.js) non è ' +
          'stato caricato: ricarica la pagina.');
        return;
      }
      sf.leggi(src, { credentials: 'same-origin' }).then(function (d) {
        if (chiuso) return;
        global.clearTimeout(scadenza);
        try { new App(radice, d, opzioni); }
        catch (e) { erroreIn(radice, 'La guida non si è aperta: ' + e.message); }
      }, function (err) {
        if (chiuso) return;
        global.clearTimeout(scadenza);
        erroreIn(radice, (err && err.messaggio) ||
          'Non sono riuscito a scaricare la guida.');
      });
    });
    return null;
  }

  function avvia() {
    var doc = global.document;
    if (!doc) return;
    var nodi = doc.querySelectorAll('#procedure-app,[data-procedure]'), i;
    for (i = 0; i < nodi.length; i++) {
      if (!nodi[i].getAttribute('data-pr-montato')) {
        nodi[i].setAttribute('data-pr-montato', '1');
        monta(nodi[i]);
      }
    }
  }

  var Procedure = {
    monta: monta,
    avvia: avvia,
    CSS: CSS,
    _logica: {
      normalizzaNodo: normalizzaNodo,
      normalizzaGuida: normalizzaGuida,
      normalizzaRaccolta: normalizzaRaccolta,
      contaGuida: contaGuida,
      inlineMd: inlineMd
    }
  };

  global.Procedure = Procedure;
  if (typeof module !== 'undefined' && module.exports) module.exports = Procedure;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', avvia, false);
    } else {
      avvia();
    }
  }

})(typeof window !== 'undefined' ? window : this);
