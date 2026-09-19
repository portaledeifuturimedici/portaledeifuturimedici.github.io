/* =====================================================================
   esercizi.js — il motore degli ESERCIZI, a rivelazione progressiva.

   IL DIFETTO CHE CHIUDE (misurato sul sito costruito, 2026-07-30)
   Gli esercizi uscivano come markdown statico: TESTO, e subito sotto
   SVOLGIMENTO e RISULTATO. Non si poteva PROVARE un esercizio senza aver
   già letto la risposta — l'occhio la prende prima che tu decida di
   guardarla. È esattamente il difetto che il progetto ha curato per le
   flashcards nel 2026-07-21 («un elenco di domande con la risposta
   stampata sotto non è una flashcard e non allena il richiamo, anzi lo
   sabota») e che non era mai stato portato qui.

   GLI STADI VENGONO DALLO SCHEMA, NON DA UN'IPOTESI
   Il tipo di un esercizio lo decide la SEZIONE del sorgente, e study_data.py
   lo scrive nel dato (`tipo`):
     · `svolto`  → TESTO → [prova] → SVOLGIMENTO → RISULTATO   (3 stadi)
     · `pratica` → TESTO → [prova] → RISPOSTA                   (2 stadi)
   Tre campi, tre stadi. Il motore non spezza niente: NON taglia lo
   svolgimento in «passi» per frase. Misurato: 750 svolgimenti, mediana 361
   caratteri (~4 frasi), passi numerati scritti dall'autore solo in 20 su
   750. Un taglio per punto fermo darebbe passi arbitrari, e si vedrebbe.

   IL TENTATIVO NON SI CORREGGE, E LO DICE
   Il campo dove scrivi la tua prova non viene giudicato. Il sorgente non ha
   una risposta breve verificabile (le RISPOSTA sono frasi intere, spesso
   con più fatti dentro): fingere una correzione automatica sarebbe peggio
   che non correggere — direbbe «sbagliato» a una risposta giusta scritta
   con altre parole. Serve a un'altra cosa, ed è quella che conta: scrivere
   PRIMA di vedere. Il tentativo resta salvato in questo browser, così
   ricaricando la pagina non si perde.

   MONTAGGIO
     <div data-esercizi data-src="../data/esercizi/s1c11-A.json"
          data-materia="chimica" data-titolo="Esercizi A"></div>
   oppure `Esercizi.monta(nodo, dati, opzioni)` — è la strada dell'hub, che
   compone la serie da più lezioni.

   Vanilla JS, ES5, zero dipendenze: come flashcards.js e quiz.js.
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSIONE_STATO = 1;
  var PREFISSO_CHIAVE = 'esercizi.v1.';
  /* Quanti tentativi si tengono in memoria locale. Non è un limite di
     studio: è il tetto alla quota di localStorage (5 MB per dominio, e
     lì dentro ci stanno anche Leitner e il registro delle sbagliate).
     Oltre il tetto si buttano i più vecchi, mai quello che stai scrivendo. */
  var TENTATIVI_MAX = 400;
  var ATTESA_SPORTELLO = 5000, PASSO_SPORTELLO = 25;

  var ORDINE_DIFF = ['base', 'medio', 'sfida'];
  var ORDINE_TIPO = ['svolto', 'pratica'];
  var NOME_TIPO = { svolto: 'svolto', pratica: 'di pratica' };

  /* ---------------------------------------------------------------- *
   * 1. Normalizzazione del dato                                       *
   * ---------------------------------------------------------------- */

  function esisteArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  function testoDi(v) { return (typeof v === 'string') ? v : ''; }

  function normalizzaDiff(v) {
    var s = String(v || '').toLowerCase();
    for (var i = 0; i < ORDINE_DIFF.length; i++) if (ORDINE_DIFF[i] === s) return s;
    return 'medio';
  }

  function normalizzaTipo(v) {
    var s = String(v || '').toLowerCase();
    return s === 'svolto' ? 'svolto' : 'pratica';
  }

  /* L'id GLOBALE. Gli id degli esercizi sono unici DENTRO il file, non fra i
     file (`es-prat-...-01` si ripete): senza la lezione davanti, il tentativo
     scritto su un esercizio di biologia ricomparirebbe su un altro di chimica.
     Stessa forma di flashcards.js: `<lezione>#<id>`. */
  function idGlobale(es, lezione) {
    var k = es.k || lezione || '';
    return k ? (k + '#' + es.id) : String(es.id);
  }

  function normalizzaEsercizio(e) {
    if (!e || typeof e !== 'object') return null;
    var id = String(e.id || '').trim();
    var testo = testoDi(e.testo).trim();
    if (!id || !testo) return null;
    var tipo = normalizzaTipo(e.tipo);
    var v = {
      id: id, tipo: tipo, testo: testo,
      diff: normalizzaDiff(e.diff),
      tag: esisteArray(e.tag) ? e.tag.slice(0) : [],
      k: String(e.k || ''),
      /* IL RIMANDO. `rim` = puntatore alla tavola dei rimandi (che viaggia
         nello STESSO file, vedi study_data nota 11); `rim_off` = il MOTIVO
         per cui non ce n'è uno. Uno dei due c'è sempre: un esercizio senza
         rimando non perde nulla, si porta dietro la spiegazione. */
      rim: (e.rim && typeof e.rim === 'object') ? e.rim : null,
      rim_off: testoDi(e.rim_off).trim()
    };
    if (tipo === 'svolto') {
      v.svolgimento = testoDi(e.svolgimento).trim();
      v.risultato = testoDi(e.risultato).trim();
      /* Uno svolto SENZA i suoi due campi non è uno svolto: verrebbe fuori
         un esercizio a tre stadi con due stadi vuoti, cioè un vicolo cieco.
         Si declassa a pratica se almeno il risultato c'è, altrimenti cade. */
      if (!v.svolgimento || !v.risultato) {
        if (v.risultato || v.svolgimento) {
          v.tipo = 'pratica';
          v.risposta = v.risultato || v.svolgimento;
          delete v.svolgimento; delete v.risultato;
        } else { return null; }
      }
    } else {
      v.risposta = testoDi(e.risposta).trim();
      if (!v.risposta) return null;
    }
    return v;
  }

  function normalizzaSerie(dati) {
    var d = dati || {};
    var grezzi = esisteArray(d.esercizi) ? d.esercizi : (esisteArray(d) ? d : []);
    var lezione = (d.slug ? (d.slug + (d.parte ? '-' + d.parte : '')) : '');
    var fuori = [], i, v;
    for (i = 0; i < grezzi.length; i++) {
      v = normalizzaEsercizio(grezzi[i]);
      if (v) { v.gid = idGlobale(v, lezione); fuori.push(v); }
    }
    return {
      slug: String(d.slug || ''), parte: String(d.parte || ''),
      materia: String(d.materia || '').toLowerCase(),
      lezione: String(d.lezione || ''),
      lezioni: (d.lezioni && typeof d.lezioni === 'object') ? d.lezioni : {},
      /* la TAVOLA dei rimandi, co-locata col dato che la cita: nessun secondo
         scaricamento e nessun puntatore che possa restare appeso. */
      rimandi: (d.rimandi && typeof d.rimandi === 'object') ? d.rimandi : {},
      esercizi: fuori
    };
  }

  /* Il TITOLO LEGGIBILE. A schermo compariva l'identificatore interno
     (`es-livelli-ordine-01 [livelli·base]`): un codice che non è per il
     lettore. L'argomento e la difficoltà ci sono già nel dato, scritti a
     parole dall'autore: si usano quelli. L'id resta, ma come ANCORA
     (`id=` sull'articolo), non come intestazione. */
  function titoloDi(es) {
    if (es.tag && es.tag.length) return maiuscola(es.tag.join(' · '));
    /* nessuna etichetta: si ricava dall'id dell'autore, togliendo il
       prefisso di forma e il numero in coda. Non si inventa nulla. */
    var s = String(es.id).replace(/^es-(prat-)?/, '').replace(/-\d+$/, '');
    return maiuscola(s.replace(/-/g, ' ')) || 'Esercizio';
  }

  function maiuscola(s) {
    s = String(s || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ---------------------------------------------------------------- *
   * 2. Persistenza (localStorage, con rete di sicurezza)              *
   * ---------------------------------------------------------------- */

  var memoria = {};

  function leggiLS(chiave) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(chiave);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return memoria[chiave] || null;
  }

  function scriviLS(chiave, valore) {
    memoria[chiave] = valore;
    try {
      if (global.localStorage) global.localStorage.setItem(chiave, JSON.stringify(valore));
      return true;
    } catch (e) { return false; }
  }

  function statoVuoto() { return { v: VERSIONE_STATO, tentativi: {}, ordine: [] }; }

  function normalizzaStato(s) {
    if (!s || typeof s !== 'object' || esisteArray(s) || s.v !== VERSIONE_STATO) return statoVuoto();
    if (!s.tentativi || typeof s.tentativi !== 'object' || esisteArray(s.tentativi)) s.tentativi = {};
    if (!esisteArray(s.ordine)) s.ordine = [];
    return s;
  }

  /* UN cassetto solo per tutto /studio: come le flashcards, un tentativo
     scritto nella pagina della lezione dev'essere lì anche nell'hub. */
  function chiaveSerie(esplicita) {
    return PREFISSO_CHIAVE + String(esplicita || 'studio');
  }

  /* ---------------------------------------------------------------- *
   * 3. Foglio di stile                                                *
   * ---------------------------------------------------------------- */

  var CSS = [
    '.es{--es-materia:var(--accent,var(--fisica,#C13E7A));',
    '  --es-materia-scura:var(--ink,#201B2E);',
    '  --es-accent:var(--es-materia);--es-accent-t:var(--es-materia);',
    '  --es-pieno:var(--es-materia);--es-oncolor:var(--btn-oncolor,#14102A);',
    '  --es-ok:var(--sem-corretto,#78E060);--es-nota:var(--sem-energia,#FF9E3D);',
    '  color:var(--ink,#201B2E);font-family:inherit;',
    '  max-width:var(--measure,66ch);margin-inline:auto}',
    ':root[data-theme="day"] .es{--es-oncolor:var(--btn-oncolor,#FFFFFF);',
    '  --es-accent-t:var(--es-materia-scura);--es-pieno:var(--es-materia-scura);',
    '  --es-ok:var(--sem-corretto-dark,#1E7A38);--es-nota:var(--sem-energia-dark,#8A5300)}',
    '.es *{box-sizing:border-box}',
    '.es [hidden]{display:none !important}',
    '.es-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.es-head{margin-bottom:12px}',
    '.es-titolo{font-size:1.15rem;line-height:1.3;font-weight:700;margin:0}',
    '.es-sub{font-size:.82rem;color:var(--muted,#6B6480);margin:4px 0 0}',

    /* filtri richiudibili: sul telefono l'esercizio deve restare in alto */
    '.es-attrezzi{border:1px solid var(--line,#E7DFD4);border-radius:12px;',
    '  background:var(--surface,#fff);overflow:hidden;margin-bottom:14px}',
    '.es-attrezzi>summary{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:center;',
    '  padding:11px 14px;min-height:44px;cursor:pointer;font-size:.85rem;font-weight:700;',
    '  list-style:none;-webkit-tap-highlight-color:transparent}',
    '.es-attrezzi>summary::-webkit-details-marker{display:none}',
    '.es-attrezzi>summary::after{content:"+";margin-left:auto;font-weight:700;',
    '  color:var(--muted,#6B6480);font-size:1.05rem;line-height:1}',
    '.es-attrezzi[open]>summary::after{content:"\\2013"}',
    '.es-somm-s{font-weight:400;font-size:.78rem;color:var(--muted,#6B6480)}',
    '.es-strumenti{display:flex;flex-direction:column;gap:10px;padding:12px;',
    '  border-top:1px solid var(--line,#E7DFD4)}',
    '.es-riga{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.es-riga>.es-etichetta{font-size:.75rem;font-weight:700;letter-spacing:.04em;',
    '  text-transform:uppercase;color:var(--muted,#6B6480);flex:0 0 100%}',
    '.es-chip{min-height:36px;padding:6px 12px;border-radius:999px;cursor:pointer;',
    '  border:1px solid var(--line,#E7DFD4);background:transparent;color:inherit;',
    '  font:inherit;font-size:.82rem}',
    '.es-chip[aria-pressed="true"]{border-color:var(--es-accent);',
    '  background:var(--es-pieno);color:var(--es-oncolor);font-weight:700}',

    /* la scheda dell'esercizio */
    '.es-carta{border:1px solid var(--line,#E7DFD4);border-radius:14px;',
    '  background:var(--surface,#fff);padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.05)}',
    '.es-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline;margin-bottom:6px}',
    '.es-h{font-size:1.02rem;font-weight:700;margin:0;line-height:1.3}',
    /* etichetta SCRITTA, mai il solo colore: il tipo e la difficoltà sono
       informazione, e informazione affidata alla tinta non arriva a chi non
       la distingue (regola del progetto sulla ridondanza non cromatica). */
    '.es-tag{font-size:.72rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;',
    '  border:1px solid var(--line,#E7DFD4);border-radius:999px;padding:2px 9px;',
    '  color:var(--muted,#6B6480)}',
    '.es-tag-tipo{border-color:var(--es-accent);color:var(--es-accent-t)}',
    '.es-id{font-size:.7rem;color:var(--muted,#6B6480);word-break:break-all}',
    '.es-testo{margin:10px 0 0;line-height:1.6}',
    '.es-testo p{margin:0 0 .7em}.es-testo p:last-child{margin-bottom:0}',
    '.es-testo ol,.es-testo ul{margin:.2em 0 .8em;padding-left:1.4em}',
    '.es-testo li{margin:.25em 0;line-height:1.55}',
    '.es-tabwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.4em 0 .8em}',
    '.es-testo table{border-collapse:collapse;font-size:.9rem;min-width:100%}',
    '.es-testo th,.es-testo td{border:1px solid var(--line,#E7DFD4);padding:5px 9px;',
    '  text-align:left;vertical-align:top}',
    '.es-testo th{font-weight:700;background:var(--bg,transparent)}',

    /* il campo della prova */
    '.es-prova{margin-top:14px}',
    '.es-prova label{display:block;font-size:.82rem;font-weight:700;margin-bottom:5px}',
    '.es-prova textarea{width:100%;min-height:96px;padding:10px 12px;font:inherit;',
    '  font-size:.95rem;line-height:1.5;color:inherit;border-radius:10px;resize:vertical;',
    '  border:1px solid var(--line,#E7DFD4);background:var(--bg,transparent)}',
    '.es-prova textarea:focus-visible{outline:2px solid var(--es-accent);outline-offset:1px}',
    '.es-avviso{font-size:.78rem;color:var(--muted,#6B6480);margin:6px 0 0;line-height:1.45}',

    /* il RIMANDO — chiuso di suo, aperto solo da chi si è bloccato */
    '.es-rim{margin-top:14px;border:1px dashed var(--line,#E7DFD4);border-radius:12px;',
    '  background:var(--bg,transparent)}',
    '.es-rim>summary{padding:11px 14px;min-height:44px;cursor:pointer;font-size:.85rem;',
    '  font-weight:700;list-style-position:inside}',
    '.es-rim>summary:focus-visible{outline:2px solid var(--es-accent);outline-offset:2px}',
    '.es-rim-corpo{padding:0 14px 12px}',
    '.es-rim-tit{margin:0 0 6px;font-size:.78rem;font-weight:700;letter-spacing:.05em;',
    '  text-transform:uppercase;color:var(--es-accent-t)}',
    '.es-rim-voce{margin:0 0 8px;font-size:.92rem;line-height:1.55}',
    '.es-rim-voce:last-child{margin-bottom:0}',
    '.es-rim-voce b{font-weight:700}',
    '.es-rim-spento{margin-top:14px;padding:10px 14px;border:1px dashed var(--line,#E7DFD4);',
    '  border-radius:12px;font-size:.82rem;line-height:1.5;color:var(--muted,#6B6480)}',

    /* gli stadi rivelati */
    '.es-stadio{margin-top:14px;border-left:3px solid var(--es-accent);',
    '  padding:2px 0 2px 13px}',
    '.es-stadio h4{margin:0 0 4px;font-size:.78rem;font-weight:700;letter-spacing:.05em;',
    '  text-transform:uppercase;color:var(--es-accent-t)}',
    '.es-stadio .es-testo{margin-top:0}',
    '.es-passi{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
    '.es-btn{min-height:44px;padding:10px 16px;border-radius:10px;cursor:pointer;',
    '  font:inherit;font-size:.9rem;font-weight:700;border:1px solid var(--line,#E7DFD4);',
    '  background:transparent;color:inherit}',
    '.es-btn:focus-visible{outline:2px solid var(--es-accent);outline-offset:2px}',
    '.es-btn-primario{background:var(--es-pieno);color:var(--es-oncolor);',
    '  border-color:var(--es-pieno)}',
    '.es-btn[disabled]{opacity:.5;cursor:default}',

    /* navigazione + indice */
    '.es-nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:16px}',
    '.es-conta{font-size:.82rem;color:var(--muted,#6B6480);margin-left:auto}',
    '.es-indice{margin-top:16px;border:1px solid var(--line,#E7DFD4);border-radius:12px;',
    '  background:var(--surface,#fff);overflow:hidden}',
    '.es-indice>summary{padding:11px 14px;min-height:44px;cursor:pointer;',
    '  font-size:.85rem;font-weight:700}',
    '.es-elenco{list-style:none;margin:0;padding:0 14px 12px}',
    '.es-elenco li{margin:0}',
    '.es-voce{display:block;width:100%;text-align:left;background:transparent;border:0;',
    '  border-top:1px solid var(--line,#E7DFD4);padding:9px 2px;min-height:44px;',
    '  font:inherit;font-size:.85rem;color:inherit;cursor:pointer}',
    '.es-voce[aria-current="true"]{font-weight:700;color:var(--es-accent-t)}',
    '.es-voce-t{font-size:.72rem;color:var(--muted,#6B6480);display:block}',
    '.es-pannello{border:1px solid var(--line,#E7DFD4);border-radius:12px;padding:14px;',
    '  background:var(--surface,#fff)}',
    '.es-pannello h3{margin:0 0 6px;font-size:1rem}',
    '.es-pannello p{margin:0 0 8px;font-size:.9rem;line-height:1.5}',
    '@media (min-width:560px){.es-strumenti{padding:14px}}',
    '@media (prefers-reduced-motion:reduce){.es *{transition:none !important}}'
  ].join('\n');

  function iniettaCss(doc) {
    if (!doc || doc.getElementById('es-css')) return;
    if (doc.querySelector) {
      var nodi = doc.querySelectorAll('[data-motori-css]'), i, v;
      for (i = 0; i < nodi.length; i++) {
        v = String(nodi[i].getAttribute('data-motori-css') || '').toLowerCase();
        if (v === 'study' || v.indexOf('esercizi') >= 0) return;
      }
    }
    var st = doc.createElement('style');
    st.id = 'es-css';
    st.setAttribute('data-motori-css-esercizi', '1');
    st.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------------------------------------------------------------- *
   * 4. DOM + markdown                                                 *
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

  /* Markdown INLINE. Identico per regole a flashcards.js e quiz.js — l'HTML
     del sorgente viene neutralizzato PRIMA, sempre: il JSON è nostro, ma un
     motore che scrive innerHTML deve poter dimostrare da sé di non iniettare. */
  function inlineMd(s) {
    var codici = [];
    var t = escapeHtml(s);
    /* I `codici` escono di scena per primi, cosi' un ** dentro il codice non
       diventa grassetto. Segnaposto U+0000 — carattere che nei testi non compare
       mai: con un segnaposto fatto di cifre, un testo come «1 N = kg·m/s²»
       verrebbe scambiato per un segnaposto e mangiato (stessa scelta, e stessa
       ragione, di flashcards.js). */
    t = t.replace(/`([^`]+)`/g, function (_, dentro) {
      codici.push(dentro);
      return '\u0000' + (codici.length - 1) + '\u0000';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(«"'])\*([^*\n]+)\*(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/(^|[\s(«"'])_([^_\n]+)_(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codici[+i] + '</code>'; });
    return t;
  }

  function rigaTabella(r) {
    var s = r.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
    return s.split('|');
  }

  function separatoreTabella(r) {
    return /^\s*\|[\s:|-]+\|\s*$/.test(r);
  }

  /* Markdown a BLOCCHI: paragrafi, elenchi numerati/puntati, tabelle.
     Non è un parser markdown generale ed è deliberato: rende solo le forme
     che esistono davvero nel corpus (misurate — 3.810 campi: nessuna fence,
     nessun titolo; elenchi numerati e due tabelle nei file normalizzati).
     Serve perché un elenco di passi scritto DALL'AUTORE deve restare un
     elenco: appiattirlo in un paragrafo perderebbe l'unica struttura vera
     che alcuni svolgimenti hanno. */
  function bloccoMd(doc, testo) {
    var frag = doc.createDocumentFragment();
    var righe = String(testo || '').split('\n');
    var i = 0, para = [], lista = null, tipoLista = '';

    function chiudiPara() {
      if (!para.length) return;
      var p = el(doc, 'p', {});
      p.innerHTML = inlineMd(para.join('\n')).replace(/\n/g, '<br>');
      frag.appendChild(p);
      para = [];
    }
    function chiudiLista() {
      if (lista) { frag.appendChild(lista); lista = null; tipoLista = ''; }
    }

    while (i < righe.length) {
      var r = righe[i];
      var vuota = !r.trim();
      var mOl = /^\s*(\d+)[.)]\s+(.*)$/.exec(r);
      var mUl = /^\s*[-*•]\s+(.*)$/.exec(r);
      var tab = /^\s*\|/.test(r) && r.indexOf('|', 1) > 0;

      if (vuota) { chiudiPara(); chiudiLista(); i++; continue; }

      if (tab) {
        chiudiPara(); chiudiLista();
        var blocco = [];
        while (i < righe.length && /^\s*\|/.test(righe[i])) { blocco.push(righe[i]); i++; }
        frag.appendChild(tabella(doc, blocco));
        continue;
      }

      if (mOl || mUl) {
        chiudiPara();
        var voluto = mOl ? 'ol' : 'ul';
        if (tipoLista !== voluto) { chiudiLista(); lista = el(doc, voluto, {}); tipoLista = voluto; }
        var li = el(doc, 'li', {});
        li.innerHTML = inlineMd(mOl ? mOl[2] : mUl[1]);
        lista.appendChild(li);
        i++;
        continue;
      }

      chiudiLista();
      para.push(r);
      i++;
    }
    chiudiPara();
    chiudiLista();
    return frag;
  }

  function tabella(doc, righe) {
    var wrap = el(doc, 'div', { 'class': 'es-tabwrap' });
    var t = el(doc, 'table', {});
    var thead = null, tbody = el(doc, 'tbody', {});
    var prima = true, i, j;
    for (i = 0; i < righe.length; i++) {
      if (separatoreTabella(righe[i])) continue;
      var celle = rigaTabella(righe[i]);
      var intestazione = prima && i + 1 < righe.length && separatoreTabella(righe[i + 1]);
      var tr = el(doc, 'tr', {});
      for (j = 0; j < celle.length; j++) {
        var c = el(doc, intestazione ? 'th' : 'td',
          intestazione ? { scope: 'col' } : null);
        c.innerHTML = inlineMd(celle[j].trim());
        tr.appendChild(c);
      }
      if (intestazione) {
        thead = el(doc, 'thead', {});
        thead.appendChild(tr);
      } else {
        tbody.appendChild(tr);
      }
      prima = false;
    }
    if (thead) t.appendChild(thead);
    t.appendChild(tbody);
    wrap.appendChild(t);
    return wrap;
  }

  function numero(n) {
    var s = String(n), fuori = '', i, c = 0;
    for (i = s.length - 1; i >= 0; i--) {
      fuori = s.charAt(i) + fuori;
      if (++c % 3 === 0 && i > 0) fuori = '.' + fuori;
    }
    return fuori;
  }

  function plurale(n, uno, molti) { return numero(n) + ' ' + (n === 1 ? uno : molti); }

  /* ---------------------------------------------------------------- *
   * 5. L'applicazione                                                 *
   * ---------------------------------------------------------------- */

  function App(radice, dati, opzioni) {
    var doc = radice.ownerDocument || global.document;
    opzioni = opzioni || {};
    this.doc = doc;
    this.radice = radice;
    this.opzioni = opzioni;
    this.serie = normalizzaSerie(dati);
    this.materia = this.serie.materia ||
      String(opzioni.materia || radice.getAttribute('data-materia') || '').toLowerCase();
    this.titolo = opzioni.titolo || radice.getAttribute('data-titolo') ||
      (this.serie.lezione || 'Esercizi');
    this.chiave = chiaveSerie(opzioni.chiave || radice.getAttribute('data-chiave'));
    this.stato = normalizzaStato(leggiLS(this.chiave));
    this.filtri = { tipo: {}, diff: {} };
    this.pos = 0;
    this.stadio = 0;          /* 0 = solo testo · 1 = svolgimento/risposta · 2 = risultato */
    this.coda = this.serie.esercizi.slice(0);

    iniettaCss(doc);
    this.costruisci();
    this.disegna();
  }

  App.prototype.accentoInline = function (nodo) {
    /* La materia dà il colore, e il colore va scritto SUL contenitore del
       motore: dentro l'hub la pagina non è tinta di nessuna materia, e
       senza questa riga i comandi principali prenderebbero l'accento di
       difetto (fisica) su una serie di biologia. */
    if (!this.materia) return;
    nodo.style.setProperty('--es-materia', 'var(--' + this.materia + ')');
    nodo.style.setProperty('--es-materia-scura', 'var(--' + this.materia + '-dark, var(--ink,#201B2E))');
  };

  App.prototype.costruisci = function () {
    var doc = this.doc, self = this, n = {};
    svuota(this.radice);
    this.nodi = n;

    var sez = el(doc, 'section', { 'class': 'es' });
    this.accentoInline(sez);

    var head = el(doc, 'div', { 'class': 'es-head' });
    n.titolo = el(doc, 'h3', { 'class': 'es-titolo' }, this.titolo);
    n.sub = el(doc, 'p', { 'class': 'es-sub' }, '');
    head.appendChild(n.titolo);
    head.appendChild(n.sub);
    sez.appendChild(head);

    /* --- filtri --- */
    var det = el(doc, 'details', { 'class': 'es-attrezzi' });
    var somm = el(doc, 'summary', {});
    somm.appendChild(doc.createTextNode('Scegli quali esercizi '));
    n.sommario = el(doc, 'span', { 'class': 'es-somm-s' }, '');
    somm.appendChild(n.sommario);
    det.appendChild(somm);
    var str = el(doc, 'div', { 'class': 'es-strumenti' });

    n.chipTipo = [];
    var rt = el(doc, 'div', { 'class': 'es-riga' });
    rt.appendChild(el(doc, 'span', { 'class': 'es-etichetta' }, 'Tipo'));
    for (var a = 0; a < ORDINE_TIPO.length; a++) {
      (function (t) {
        var b = el(doc, 'button', { type: 'button', 'class': 'es-chip', 'aria-pressed': 'false' },
          t === 'svolto' ? 'svolti' : 'di pratica');
        b.addEventListener('click', function () {
          self.filtri.tipo[t] = !self.filtri.tipo[t];
          b.setAttribute('aria-pressed', self.filtri.tipo[t] ? 'true' : 'false');
          self.ricomponi();
        }, false);
        n.chipTipo.push({ b: b, t: t });
        rt.appendChild(b);
      })(ORDINE_TIPO[a]);
    }
    str.appendChild(rt);

    n.chipDiff = [];
    var rd = el(doc, 'div', { 'class': 'es-riga' });
    rd.appendChild(el(doc, 'span', { 'class': 'es-etichetta' }, 'Difficoltà'));
    for (var b2 = 0; b2 < ORDINE_DIFF.length; b2++) {
      (function (d) {
        var b = el(doc, 'button', { type: 'button', 'class': 'es-chip', 'aria-pressed': 'false' }, d);
        b.addEventListener('click', function () {
          self.filtri.diff[d] = !self.filtri.diff[d];
          b.setAttribute('aria-pressed', self.filtri.diff[d] ? 'true' : 'false');
          self.ricomponi();
        }, false);
        n.chipDiff.push({ b: b, d: d });
        rd.appendChild(b);
      })(ORDINE_DIFF[b2]);
    }
    str.appendChild(rd);
    det.appendChild(str);
    sez.appendChild(det);

    n.carta = el(doc, 'div', { 'class': 'es-carta' });
    sez.appendChild(n.carta);

    var nav = el(doc, 'div', { 'class': 'es-nav' });
    n.prec = el(doc, 'button', { type: 'button', 'class': 'es-btn' }, '← Precedente');
    n.prec.addEventListener('click', function () { self.vai(self.pos - 1); }, false);
    n.succ = el(doc, 'button', { type: 'button', 'class': 'es-btn' }, 'Successivo →');
    n.succ.addEventListener('click', function () { self.vai(self.pos + 1); }, false);
    n.conta = el(doc, 'p', { 'class': 'es-conta', 'aria-live': 'polite' }, '');
    nav.appendChild(n.prec);
    nav.appendChild(n.succ);
    nav.appendChild(n.conta);
    sez.appendChild(nav);

    /* L'INDICE SI COSTRUISCE SOLO QUANDO LO SI APRE.
       Misurato sul sito cifrato servito in locale: nell'hub «tutte e tre le
       materie» la selezione è di 1.558 esercizi, e costruirne l'elenco vuol
       dire 1.558 <button> con i loro ascoltatori. Fatto a ogni `disegna()` —
       cioè a ogni rivelazione di uno stadio e a ogni «successivo» — portava
       il tempo dal via al primo esercizio a 12,3 secondi. Costruirlo solo
       all'apertura del <details> lo riporta sotto il secondo, senza togliere
       una riga dall'elenco: un indice che nasconde delle voci sarebbe un buco,
       e i buchi qui non si aprono. */
    n.indice = el(doc, 'details', { 'class': 'es-indice' });
    n.indiceS = el(doc, 'summary', {}, 'Tutti gli esercizi di questa selezione');
    n.indice.appendChild(n.indiceS);
    n.elenco = el(doc, 'ul', { 'class': 'es-elenco' });
    n.indice.appendChild(n.elenco);
    n.indice.addEventListener('toggle', function () {
      if (n.indice.open) self.disegnaIndice();
    }, false);
    sez.appendChild(n.indice);

    this.radice.appendChild(sez);
  };

  App.prototype.filtrati = function () {
    var f = this.filtri, tutti = this.serie.esercizi, fuori = [], i;
    var nT = 0, nD = 0, k;
    for (k in f.tipo) if (f.tipo[k]) nT++;
    for (k in f.diff) if (f.diff[k]) nD++;
    for (i = 0; i < tutti.length; i++) {
      if (nT && !f.tipo[tutti[i].tipo]) continue;
      if (nD && !f.diff[tutti[i].diff]) continue;
      fuori.push(tutti[i]);
    }
    return fuori;
  };

  App.prototype.ricomponi = function () {
    var prima = this.coda[this.pos];
    this.coda = this.filtrati();
    /* si resta sull'esercizio di prima se il filtro non l'ha escluso: cambiare
       un filtro non deve far perdere il posto in cui si sta lavorando */
    this.pos = 0;
    if (prima) {
      for (var i = 0; i < this.coda.length; i++) {
        if (this.coda[i].gid === prima.gid) { this.pos = i; break; }
      }
    }
    this.stadio = 0;
    this.disegna();
  };

  App.prototype.vai = function (i) {
    if (i < 0 || i >= this.coda.length) return;
    this.pos = i;
    this.stadio = 0;
    this.disegna();
    try { this.nodi.carta.focus(); } catch (e) { }
  };

  App.prototype.salvaTentativo = function (gid, testo) {
    var s = this.stato;
    if (!testo) {
      delete s.tentativi[gid];
    } else {
      if (!s.tentativi.hasOwnProperty(gid)) s.ordine.push(gid);
      s.tentativi[gid] = testo;
    }
    while (s.ordine.length > TENTATIVI_MAX) {
      var via = s.ordine.shift();
      if (via !== gid) delete s.tentativi[via];
    }
    scriviLS(this.chiave, s);
  };

  App.prototype.disegna = function () {
    var doc = this.doc, self = this, n = this.nodi;
    var tot = this.serie.esercizi.length;
    var quanti = this.coda.length;
    var svolti = 0, i;
    for (i = 0; i < this.coda.length; i++) if (this.coda[i].tipo === 'svolto') svolti++;

    this.testo(n.sub, quanti === tot
      ? plurale(tot, 'esercizio', 'esercizi') + ' · ' + numero(svolti) + ' svolti, ' +
        numero(quanti - svolti) + ' di pratica'
      : plurale(quanti, 'esercizio', 'esercizi') + ' su ' + numero(tot) + ' con questi filtri');
    this.testo(n.sommario, quanti === tot ? '(tutti)' : '(' + numero(quanti) + ' su ' + numero(tot) + ')');

    svuota(n.carta);
    if (!quanti) {
      var v = el(doc, 'div', { role: 'status' });
      v.appendChild(el(doc, 'h4', {}, 'Nessun esercizio con questi filtri'));
      v.appendChild(el(doc, 'p', { 'class': 'es-avviso' },
        'Gli esercizi ci sono, ma nessuno ha insieme il tipo e la difficoltà che ' +
        'hai chiesto. Togli uno dei due e riprova.'));
      n.carta.appendChild(v);
      n.prec.disabled = n.succ.disabled = true;
      this.testo(n.conta, '');
      this.disegnaIndice();
      return;
    }

    var es = this.coda[this.pos];
    n.carta.setAttribute('tabindex', '-1');
    n.carta.setAttribute('id', 'es-' + es.id);

    var meta = el(doc, 'div', { 'class': 'es-meta' });
    meta.appendChild(el(doc, 'h4', { 'class': 'es-h' }, titoloDi(es)));
    meta.appendChild(el(doc, 'span', { 'class': 'es-tag es-tag-tipo' },
      'esercizio ' + NOME_TIPO[es.tipo]));
    meta.appendChild(el(doc, 'span', { 'class': 'es-tag' }, 'difficoltà ' + es.diff));
    n.carta.appendChild(meta);
    /* l'identificatore interno resta, ma come RIFERIMENTO in coda alla
       scheda: serve a chi segnala un errore, non a chi studia. */
    n.carta.appendChild(el(doc, 'p', { 'class': 'es-id' }, 'riferimento: ' + es.id));

    var testo = el(doc, 'div', { 'class': 'es-testo' });
    testo.appendChild(bloccoMd(doc, es.testo));
    n.carta.appendChild(testo);

    /* --- il campo della prova: c'è SEMPRE, ed è il punto di tutto --- */
    var prova = el(doc, 'div', { 'class': 'es-prova' });
    var idTa = 'es-ta-' + es.id;
    var lbl = el(doc, 'label', { 'for': idTa }, 'Prova tu, prima di guardare');
    var ta = el(doc, 'textarea', {
      id: idTa, rows: '4', spellcheck: 'false',
      placeholder: 'Scrivi qui il tuo ragionamento…'
    });
    ta.value = this.stato.tentativi[es.gid] || '';
    ta.addEventListener('input', function () { self.salvaTentativo(es.gid, ta.value); }, false);
    prova.appendChild(lbl);
    prova.appendChild(ta);
    prova.appendChild(el(doc, 'p', { 'class': 'es-avviso' },
      'Quello che scrivi non viene corretto: qui non c\'è una risposta breve da ' +
      'confrontare, e una correzione automatica direbbe «sbagliato» a una risposta ' +
      'giusta scritta con altre parole. Serve a scrivere PRIMA di vedere — è quello ' +
      'che fa la differenza. Resta salvato in questo browser.'));
    n.carta.appendChild(prova);

    /* --- IL RIMANDO --- */
    this.disegnaRimando(n.carta, es);

    /* --- gli stadi --- */
    var passi = el(doc, 'div', { 'class': 'es-passi' });
    if (es.tipo === 'svolto') {
      if (this.stadio >= 1) n.carta.appendChild(this.stadioNodo('Svolgimento', es.svolgimento));
      if (this.stadio >= 2) n.carta.appendChild(this.stadioNodo('Risultato', es.risultato));
      if (this.stadio < 2) {
        var b1 = el(doc, 'button', { type: 'button', 'class': 'es-btn es-btn-primario' },
          this.stadio === 0 ? 'Ho provato: mostra lo svolgimento' : 'Mostra il risultato');
        b1.addEventListener('click', function () { self.stadio++; self.disegna(); self.focusStadio(); }, false);
        passi.appendChild(b1);
      }
    } else {
      if (this.stadio >= 1) n.carta.appendChild(this.stadioNodo('Risposta', es.risposta));
      if (this.stadio < 1) {
        var b2 = el(doc, 'button', { type: 'button', 'class': 'es-btn es-btn-primario' },
          'Mostra la risposta');
        b2.addEventListener('click', function () { self.stadio = 1; self.disegna(); self.focusStadio(); }, false);
        passi.appendChild(b2);
      }
    }
    if (this.stadio > 0) {
      var br = el(doc, 'button', { type: 'button', 'class': 'es-btn' }, 'Nascondi di nuovo');
      br.addEventListener('click', function () { self.stadio = 0; self.disegna(); }, false);
      passi.appendChild(br);
    }
    n.carta.appendChild(passi);

    n.prec.disabled = this.pos <= 0;
    n.succ.disabled = this.pos >= quanti - 1;
    this.testo(n.conta, 'Esercizio ' + (this.pos + 1) + ' di ' + quanti);
    this.disegnaIndice();
  };

  /* IL RIMANDO — «se ti blocchi», e SOLO allora.
   *
   * LO STADIO GIUSTO, cioè il punto di tutto. Un aiuto ha tre posti possibili
   * e due sono sbagliati:
   *   · insieme al testo → è un suggerimento non richiesto: lo leggi prima di
   *     aver provato, e ti ruba il tentativo (lo stesso difetto della risposta
   *     stampata sotto la domanda, che questo motore ha appena chiuso);
   *   · dopo la soluzione → non serve più a niente, la risposta ce l'hai già.
   * Resta il mezzo: dopo che hai il testo davanti e PRIMA che tu abbia chiesto
   * lo svolgimento. Quindi il rimando compare a `stadio === 0` e sparisce alla
   * prima rivelazione — e anche lì è CHIUSO: aprirlo è un gesto tuo, non una
   * cosa che ti succede addosso.
   *
   * COSA CONTIENE, E COSA NO. Escono l'ERRORE tipico e il CRITERIO per
   * evitarlo. Non esce il campo «perché sbaglia» del sorgente, che spesso
   * scrive la risposta giusta per esteso: un aiuto che regala la risposta non
   * è un aiuto, è la soluzione anticipata con un altro nome. Il taglio lo fa
   * `rimandi.py` alla fonte, non questo motore.
   *
   * NIENTE BUCHI. Se il collegamento non c'è, non sparisce la voce: resta una
   * riga che dice che non c'è e PERCHÉ. «Non so cosa suggerirti su questo» è
   * un'informazione; il silenzio no.
   */
  App.prototype.disegnaRimando = function (dove, es) {
    var doc = this.doc;
    if (this.stadio !== 0) return;          /* dopo la rivelazione: inutile */

    var voce = null;
    if (es.rim && es.rim.t) voce = this.serie.rimandi[es.rim.t] || null;

    if (!voce) {
      var motivo = es.rim_off ||
        (es.rim ? 'il materiale collegato non è arrivato con questa pagina'
                : 'nessun materiale affine sopra la soglia di somiglianza');
      var p = el(doc, 'p', { 'class': 'es-rim-spento' },
        'Per questo esercizio non c\'è un rimando: ' + motivo + '. ' +
        'Il resto dell\'esercizio non cambia.');
      dove.appendChild(p);
      return;
    }

    var guida = (voce.c === 'guida');
    var d = el(doc, 'details', { 'class': 'es-rim' });
    d.appendChild(el(doc, 'summary', {}, guida
      ? 'Se ti blocchi: c\'è una guida passo passo su questo'
      : 'Se ti blocchi: l\'errore tipico su questo punto'));
    var corpo = el(doc, 'div', { 'class': 'es-rim-corpo' });

    if (voce.titolo) {
      corpo.appendChild(el(doc, 'p', { 'class': 'es-rim-tit' },
        (guida ? 'Guida: ' : 'Trappola: ') + voce.titolo));
    }
    if (guida) {
      /* SOLO la domanda da cui la guida parte. Il passo che ha fatto il
         punteggio NON si mostra: è il più affine proprio perché parla della
         stessa cosa, quindi quasi sempre contiene la risposta. Orientare sì,
         rispondere no — è lo stesso taglio fatto sulle trappole. */
      corpo.appendChild(el(doc, 'p', { 'class': 'es-avviso' },
        'Questa lezione ha una guida passo passo che parte proprio da questa ' +
        'domanda. La trovi fra le Guide della lezione: è un percorso a ' +
        'domande, una alla volta, e non ti dà la risposta di qui.'));
    } else {
      if (voce.errore) corpo.appendChild(this.rimandoVoce('L\'errore', voce.errore));
      if (voce.criterio) corpo.appendChild(this.rimandoVoce('Come lo eviti', voce.criterio));
    }
    d.appendChild(corpo);
    dove.appendChild(d);
  };

  App.prototype.rimandoVoce = function (etichetta, testo) {
    var doc = this.doc;
    var p = el(doc, 'p', { 'class': 'es-rim-voce' });
    p.appendChild(el(doc, 'b', {}, etichetta + '. '));
    /* il testo del sorgente è markdown inline e va NEUTRALIZZATO prima di
       essere reso: `inlineMd` escapa l'HTML e poi riapre solo grassetto,
       corsivo e codice. Stessa regola del resto del motore. */
    var span = el(doc, 'span', {});
    span.innerHTML = inlineMd(String(testo || ''));
    p.appendChild(span);
    return p;
  };

  App.prototype.focusStadio = function () {
    var nodi = this.nodi.carta.querySelectorAll('.es-stadio');
    if (nodi.length) { try { nodi[nodi.length - 1].focus(); } catch (e) { } }
  };

  App.prototype.stadioNodo = function (etichetta, contenuto) {
    var doc = this.doc;
    /* `role=group` + `tabindex=-1` per poterci portare il fuoco: chi naviga
       da tastiera deve finire SUL contenuto appena rivelato, non tornare in
       cima alla pagina. */
    var d = el(doc, 'div', { 'class': 'es-stadio', role: 'group', tabindex: '-1',
      'aria-label': etichetta });
    d.appendChild(el(doc, 'h4', {}, etichetta));
    var c = el(doc, 'div', { 'class': 'es-testo' });
    c.appendChild(bloccoMd(doc, contenuto));
    d.appendChild(c);
    return d;
  };

  App.prototype.disegnaIndice = function () {
    var doc = this.doc, self = this, n = this.nodi;
    this.testo(n.indiceS, 'Tutti gli esercizi di questa selezione (' +
      numero(this.coda.length) + ')');
    /* chiuso = nessuno lo sta guardando: si rimanda, e si segna che e' vecchio */
    if (!n.indice.open) { this._indiceVecchio = true; return; }
    svuota(n.elenco);
    for (var i = 0; i < this.coda.length; i++) {
      (function (es, idx) {
        var li = el(doc, 'li', {});
        var b = el(doc, 'button', { type: 'button', 'class': 'es-voce' });
        if (idx === self.pos) b.setAttribute('aria-current', 'true');
        b.appendChild(doc.createTextNode((idx + 1) + '. ' + titoloDi(es)));
        b.appendChild(el(doc, 'span', { 'class': 'es-voce-t' },
          'esercizio ' + NOME_TIPO[es.tipo] + ' · difficoltà ' + es.diff));
        b.addEventListener('click', function () { self.vai(idx); }, false);
        li.appendChild(b);
        n.elenco.appendChild(li);
      })(this.coda[i], i);
    }
    this._indiceVecchio = false;
  };

  App.prototype.testo = function (nodo, s) {
    svuota(nodo);
    nodo.appendChild(this.doc.createTextNode(s));
  };

  /* ---------------------------------------------------------------- *
   * 6. Montaggio                                                      *
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
    var s = el(doc, 'section', { 'class': 'es' });
    var p = el(doc, 'div', { 'class': 'es-pannello', role: 'alert' });
    p.appendChild(el(doc, 'h3', {}, 'Esercizi non disponibili'));
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
      catch (e) { erroreIn(radice, 'I dati degli esercizi non sono leggibili.'); return null; }
    }

    var src = radice.getAttribute('data-src');
    if (!src) { erroreIn(radice, 'Manca l\'attributo data-src o data-json.'); return null; }
    opzioni.sorgente = src;
    if (!global.fetch) { erroreIn(radice, 'Il browser non supporta il caricamento dei dati.'); return null; }

    var chiuso = false;
    var scadenza = global.setTimeout(function () {
      chiuso = true;
      erroreIn(radice, 'Gli esercizi ci stanno mettendo troppo a caricare. ' +
        'Controlla la connessione e ricarica la pagina.');
    }, 15000);
    /* I dati sotto /studio sono cifrati: l'unico che sa riaprirli è lo
       sportello (assets/studio_fetch.js). Se manca si DICE — una serie vuota
       qui sarebbe identica a «nessun esercizio per questo filtro». */
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
        catch (e) { erroreIn(radice, 'Gli esercizi non si sono aperti: ' + e.message); }
      }, function (err) {
        if (chiuso) return;
        global.clearTimeout(scadenza);
        erroreIn(radice, (err && err.messaggio) ||
          'Non sono riuscito a scaricare gli esercizi.');
      });
    });
    return null;
  }

  function avvia() {
    var doc = global.document;
    if (!doc) return;
    var nodi = doc.querySelectorAll('#esercizi-app,[data-esercizi]'), i;
    for (i = 0; i < nodi.length; i++) {
      if (!nodi[i].getAttribute('data-es-montato')) {
        nodi[i].setAttribute('data-es-montato', '1');
        monta(nodi[i]);
      }
    }
  }

  var Esercizi = {
    monta: monta,
    avvia: avvia,
    CSS: CSS,
    /* superficie pura, senza DOM: per i test e per tenere allineate le
       regole di normalizzazione con study_data.py */
    _logica: {
      normalizzaDiff: normalizzaDiff,
      normalizzaTipo: normalizzaTipo,
      normalizzaEsercizio: normalizzaEsercizio,
      normalizzaSerie: normalizzaSerie,
      normalizzaStato: normalizzaStato,
      idGlobale: idGlobale,
      titoloDi: titoloDi,
      inlineMd: inlineMd,
      numero: numero,
      plurale: plurale,
      ORDINE_DIFF: ORDINE_DIFF,
      ORDINE_TIPO: ORDINE_TIPO,
      TENTATIVI_MAX: TENTATIVI_MAX
    }
  };

  global.Esercizi = Esercizi;
  if (typeof module !== 'undefined' && module.exports) module.exports = Esercizi;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', avvia, false);
    } else {
      avvia();
    }
  }

})(typeof window !== 'undefined' ? window : this);
