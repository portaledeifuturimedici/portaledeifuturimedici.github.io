/* Generato da site_build.py */
(function () {
  'use strict';
  var LS = 'appunti-prefs';
  var root = document.documentElement;

  /* IL TEMA SEGUE IL SISTEMA finche' non lo scegli tu (decisione utente
     2026-09-29, fetta F1). La scelta si salva come `tema`, e SOLO quando c'e'
     stata: prima questo script salvava `theme: 'night'` a ogni visita, e il sito
     restava scuro per sempre anche a chi non aveva mai toccato il pulsante. Un
     `theme` delle versioni di prima conta solo se e' «day» (quello si otteneva
     solo cliccando). Stessa regola dello script in testa a ogni pagina. */
  var chiaro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function temaSistema() { return chiaro && chiaro.matches ? 'day' : 'night'; }
  var salvate = {};
  try { salvate = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) {}
  var temaScelto = (salvate.tema === 'day' || salvate.tema === 'night') ? salvate.tema
                   : (salvate.theme === 'day' ? 'day' : '');
  var prefs = {theme: temaScelto || temaSistema(), font: 'serif', fs: 1, lh: 1.75, measure: 66};
  ['font', 'fs', 'lh', 'measure'].forEach(function (k) {
    if (salvate[k] !== undefined) prefs[k] = salvate[k];
  });
  /* `fs` era una dimensione in px, ora e' una scala: una preferenza salvata
     prima della modifica varrebbe 19 (testo gigante). Si riporta al default. */
  if (!(prefs.fs > 0.5 && prefs.fs < 3)) prefs.fs = 1;
  /* il sistema cambia tema (di sera, per esempio): lo si segue, se non hai scelto */
  if (chiaro) {
    var segui = function () { if (!temaScelto) { prefs.theme = temaSistema(); apply(); } };
    if (chiaro.addEventListener) chiaro.addEventListener('change', segui);
    else if (chiaro.addListener) chiaro.addListener(segui);
  }

  function apply() {
    root.setAttribute('data-theme', prefs.theme);
    root.style.setProperty('--font-read', 'var(--font-' +
      (prefs.font === 'sans' ? 'sans' : prefs.font === 'legge' ? 'legge' : 'serif') + ')');
    /* SCALA, non dimensione assoluta: si moltiplica con `--fs-base`, che resta
       responsive. Cosi' «testo grande» e «schermo piccolo» convivono. */
    root.style.setProperty('--fs-scale', String(prefs.fs));
    root.style.setProperty('--lh', String(prefs.lh));
    root.style.setProperty('--measure', prefs.measure + 'ch');
    document.querySelectorAll('[data-pref]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(prefs[b.dataset.pref] == b.dataset.val));
    });
    var t = document.getElementById('theme-btn');
    if (t) {
      var night = prefs.theme === 'night';
      t.textContent = night ? '\u25D1' : '\u25D0';
      t.setAttribute('aria-label', night ? 'Passa al tema chiaro' : 'Passa al tema scuro');
    }
    /* si salvano le preferenze di lettura, e il tema SOLO se l'hai scelto */
    var da_salvare = {font: prefs.font, fs: prefs.fs, lh: prefs.lh, measure: prefs.measure};
    if (temaScelto) da_salvare.tema = temaScelto;
    try { localStorage.setItem(LS, JSON.stringify(da_salvare)); } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pref]');
    if (b) {
      var v = b.dataset.val;
      prefs[b.dataset.pref] = isNaN(parseFloat(v)) ? v : parseFloat(v);
      apply();
      return;
    }
    if (e.target.closest('#theme-btn')) {
      prefs.theme = prefs.theme === 'night' ? 'day' : 'night';
      temaScelto = prefs.theme;
      apply();
      return;
    }
    var pb = e.target.closest('#prefs-btn');
    var panel = document.getElementById('prefs');
    if (pb && panel) { panel.classList.toggle('show'); return; }
    if (panel && panel.classList.contains('show') &&
        !e.target.closest('#prefs') && !e.target.closest('#prefs-btn')) {
      panel.classList.remove('show');
    }
    if (e.target.closest('#prefs-close') && panel) panel.classList.remove('show');
    var nt = e.target.closest('#nav-toggle');
    if (nt) {
      /* dal 2026-09-16 il bottone apre il PANNELLO (`nav-menu`), non le voci
         della barra: le voci sono quattro e restano in riga; il «resto» del
         sito vive nel pannello, a ogni larghezza. */
      var menu = document.getElementById('nav-menu');
      if (menu) {
        var aperto = menu.hidden;
        menu.hidden = !aperto;
        nt.setAttribute('aria-expanded', String(aperto));
        /* il nome del bottone dice cosa fa ADESSO: a pannello aperto diceva
           ancora «Apri il menu», e chi naviga a voce lo sentiva cosi' */
        nt.setAttribute('aria-label', aperto ? 'Chiudi il menu' : 'Apri il menu');
      }
    } else if (e.target.closest('#nav-menu a')) {
      /* Si e' toccata una VOCE: il pannello ha finito il suo lavoro e si chiude,
         senza fermare la navigazione. Serve soprattutto alle ancore della stessa
         pagina (Chi siamo, Il metodo...): la pagina scorreva sotto, e il
         pannello — alto quanto lo schermo — restava aperto sopra la sezione
         appena raggiunta. */
      var m3 = document.getElementById('nav-menu');
      if (m3) m3.hidden = true;
      var b3 = document.getElementById('nav-toggle');
      if (b3) b3.setAttribute('aria-expanded', 'false');
    } else if (!e.target.closest('#nav-menu')) {
      /* un clic fuori lo chiude: su desktop il pannello copre la pagina e
         restare aperto mentre si legge sarebbe solo un ostacolo */
      var m2 = document.getElementById('nav-menu');
      if (m2 && !m2.hidden) {
        m2.hidden = true;
        var b2 = document.getElementById('nav-toggle');
        if (b2) b2.setAttribute('aria-expanded', 'false');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var panel = document.getElementById('prefs');
    if (panel) panel.classList.remove('show');
    var menu = document.getElementById('nav-menu');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      var b = document.getElementById('nav-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  });

  apply();

  /* ---- catalogo: ricerca + filtri ---- */
  var grid = document.getElementById('cat-grid');
  if (grid) {
    var items = Array.prototype.slice.call(grid.querySelectorAll('.ep'));
    var vuoto = document.getElementById('vuoto');
    var q = document.getElementById('cat-q');
    var chips = document.getElementById('chips');

    /* La materia puo' arrivare dall'URL (`appunti/?m=biologia`): sono i link
       delle schede-materia e del footer. Senza questo mostravano tutto. */
    var valide = items.reduce(function (s, el) { s[el.dataset.materia] = 1; return s; }, {});
    var param = (location.search.match(/[?&]m=([^&]+)/) || [])[1];
    var filtro = (param && valide[decodeURIComponent(param)]) ? decodeURIComponent(param) : 'all';
    if (chips) chips.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.f === filtro));
    });

    function norm(s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    /* L'INDICE DELLA RICERCA sta in un file a parte (`data-cerca-src`: cerca.json nel
       gratuito, data/cerca.json cifrato nel completo; piano di semplificazione del sito,
       commit 44): nella pagina erano due terzi del catalogo, scaricati anche da chi non
       cerca niente. Si legge al primo tasto, una volta sola; nel completo passa dallo
       sportello (StudioFetch), che lo decifra. Finche' non c'e' (in viaggio, o senza rete
       e senza copia) la ricerca guarda il testo della scheda; se la lettura fallisce, al
       tasto dopo si riprova. */
    var sorgente = grid.getAttribute('data-cerca-src');
    var indice = null, inViaggio = false;
    function leggiIndice() {
      if (indice || inViaggio || !sorgente) return;
      inViaggio = true;
      var p;
      try {
        var S = window.StudioFetch;
        p = (S && S.leggi) ? S.leggi(sorgente) : fetch(sorgente).then(function (r) {
          if (!r.ok) throw new Error('indice della ricerca: ' + r.status);
          return r.json();
        });
      } catch (e) { inViaggio = false; return; }
      p.then(function (d) {
        var x = {};
        items.forEach(function (el) {
          var id = el.getAttribute('data-id');
          x[id] = norm((d && d[id]) || el.textContent);
        });
        indice = x;
        inViaggio = false;
        run();
      }, function () { inViaggio = false; });
    }
    function testoDi(el) {
      return indice ? indice[el.getAttribute('data-id')] : norm(el.textContent);
    }
    function run() {
      var term = norm(q ? q.value.trim() : '');
      if (term) leggiIndice();
      var n = 0;
      items.forEach(function (el) {
        var okF = filtro === 'all' || el.dataset.materia === filtro;
        var okQ = !term || testoDi(el).indexOf(term) !== -1;
        var show = okF && okQ;
        el.hidden = !show;
        if (show) n++;
      });
      if (vuoto) vuoto.style.display = n ? 'none' : 'block';
      var c = document.getElementById('cat-count');
      /* il NOME di cio' che si conta lo dice la pagina (`data-cosa`, il lessico del
         generatore: «lezioni»), non questo script: una parola sola, in un posto solo */
      var cosa = c ? (c.getAttribute('data-cosa') || '') : '';
      if (c) c.textContent = n === items.length
        ? n + ' ' + cosa : n + ' di ' + items.length + ' ' + cosa;
    }
    if (q) q.addEventListener('input', run);
    /* la via d'uscita dal vicolo cieco: chi ha cercato una parola che non c'e'
       aveva davanti solo «Nessuna lezione», e doveva svuotare il campo a mano */
    var azzera = document.getElementById('cat-azzera');
    if (azzera && q) azzera.addEventListener('click', function () {
      q.value = '';
      run();
      try { q.focus(); } catch (e) {}
    });
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      filtro = b.dataset.f;
      chips.querySelectorAll('.chip').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === b));
      });
      /* l'URL segue il filtro: cosi' la vista filtrata si puo' condividere */
      if (window.history && history.replaceState) {
        history.replaceState(null, '',
          location.pathname + (filtro === 'all' ? '' : '?m=' + filtro));
      }
      run();
    });
    run();
  }

  /* L'indice sta in un <details> APERTO nel markup, cosi' chi non ha JS lo
     vede comunque. Fuori dal desktop si chiude: aperto occupa l'84% dello
     schermo di un telefono. Si fa qui e non in CSS perche' `open` e' un
     attributo, non una proprieta' di stile. */
  var tocWrap = document.querySelector('.toc-wrap');
  if (tocWrap && window.matchMedia('(max-width: 1080px)').matches) tocWrap.open = false;

  /* ---- indice di pagina: evidenzia la sezione a schermo ---- */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = {};
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      links[decodeURIComponent(a.getAttribute('href').slice(1))] = a;
    });
    var visibili = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visibili.add(en.target.id);
        else visibili.delete(en.target.id);
      });
      var first = null;
      Object.keys(links).forEach(function (id) {
        if (!first && visibili.has(id)) first = id;
      });
      Object.keys(links).forEach(function (id) {
        links[id].classList.toggle('on', id === first);
      });
    }, {rootMargin: '-76px 0px -70% 0px'});
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
    /* un <details> chiuso nasconde i suoi heading: aprilo se ci navighi dentro */
    toc.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      while (el) {
        if (el.tagName === 'DETAILS') el.open = true;
        el = el.parentElement;
      }
    });
  }

  /* ---- barra di avanzamento lettura (solo pagine appunti, lunghe) ---- */
  if (document.querySelector('.doc')) {
    var barra = document.createElement('div');
    barra.className = 'read-progress';
    barra.setAttribute('aria-hidden', 'true');
    barra.innerHTML = '<span></span>';
    document.body.appendChild(barra);
    var riemp = barra.firstChild;
    var el = document.scrollingElement || document.documentElement;
    var aggiorna = function () {
      var max = el.scrollHeight - el.clientHeight;
      var p = max > 0 ? el.scrollTop / max : 0;
      riemp.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%';
    };
    window.addEventListener('scroll', aggiorna, {passive: true});
    window.addEventListener('resize', aggiorna);
    aggiorna();
  }

  /* ---- riprendere da dove si era ----
     Una pagina di appunti e' lunga ~25 schermate su un telefono: senza questo,
     tornarci dopo una pausa vuol dire ri-cercare il punto a occhio, ed e' la
     differenza fra una pagina e un posto dove si studia.
     NON si riporta il lettore da soli — uno scroll che salta senza chiedere
     disorienta: si offre e basta. Si ricorda la SEZIONE, non il pixel: il
     contenuto puo' cambiare, i titoli restano.

     FORMATO del valore: `<sezione>|<secondi dal 1970>`. La data serve alla
     home dello studio per elencare gli episodi iniziati dal piu' recente:
     senza, l'ordine e' quello del corso e «riprendi» non sa da dove.
     Il separatore e' `|` perche' in un id NON puo' finirci: gli id li genera
     slugify(), che tiene solo [a-z0-9-]. La divisione non e' ambigua.
     COMPATIBILITA' — le voci scritte prima di questa versione sono la sola
     sezione, senza `|`: non si buttano (sarebbe il progresso di chi e' a meta'
     corso) e non si riscrivono con una data inventata. Si leggono come
     «iniziato, data ignota», e la prima volta che quella pagina viene riaperta
     e scrollata si riallineano da sole. */
  var sezioni = document.querySelectorAll('.read h4[id], .read h3[id], .parte[id]');
  if (sezioni.length) {
    var CHIAVE = 'appunti-letto:' + location.pathname;
    var salva = function () {
      var corrente = null;
      sezioni.forEach(function (s) {
        if (s.getBoundingClientRect().top < 120) corrente = s;
      });
      try {
        if (corrente) {
          localStorage.setItem(CHIAVE,
            corrente.id + '|' + Math.floor(Date.now() / 1000));
        } else localStorage.removeItem(CHIAVE);
      } catch (e) {}
    };
    var attesa;
    window.addEventListener('scroll', function () {
      clearTimeout(attesa); attesa = setTimeout(salva, 400);
    }, {passive: true});

    var visto = null;
    try { visto = localStorage.getItem(CHIAVE); } catch (e) {}
    /* la sezione e' cio' che sta PRIMA del separatore; senza separatore e'
       tutto il valore (voce vecchia). La data qui non serve: la barra offre
       il punto, non racconta quando ci sei passato. */
    if (visto && visto.indexOf('|') > -1) visto = visto.split('|')[0];
    var meta = visto && document.getElementById(visto);
    if (meta && window.scrollY < 100) {
      var titolo = (meta.textContent || '').replace('#', '').trim().slice(0, 44);
      var barra = document.createElement('div');
      barra.className = 'riprendi';
      barra.innerHTML = '<span>Eri arrivato a <b></b></span>' +
        '<button type="button" class="btn btn-ghost">Riprendi</button>' +
        '<button type="button" class="chiudi" aria-label="Chiudi">&times;</button>';
      barra.querySelector('b').textContent = titolo;
      barra.querySelector('.btn').addEventListener('click', function () {
        meta.scrollIntoView({behavior: 'smooth', block: 'start'});
        barra.remove();
      });
      barra.querySelector('.chiudi').addEventListener('click', function () {
        barra.remove();
      });
      document.body.appendChild(barra);
    }
  }

  /* ---- moduli: contatti e segnalazioni ---- */
  /* UN gestore per ogni <form data-endpoint> del sito, non uno per modulo: il
     modulo contatti (landing) e la segnalazione privata in fondo a ogni capitolo
     della dispensa (/studio, dal 2026-09-16) passano dalla STESSA validazione,
     dallo stesso honeypot e dallo stesso degrado onesto. Cio' che cambia fra i
     due sta nel markup, non qui: quali campi sono `required`, il consenso se c'e',
     le frasi di esito in `data-ok`/`data-ko`.
     Il FORM, non la <section id="contatti"> che lo contiene: prima funzionava
     solo perche' l'evento submit risaliva fin li'. */
  var EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  /* IL CRM DELLE PRENOTAZIONI (la live, 2026-10-08: EVENTO_CRM_URL). Un modulo che porta
     data-crm manda la prenotazione li' come JSON: un oggetto PIATTO coi nomi che il
     workflow del CRM mappa, e mai i campi che cominciano per "_" (la trappola per i
     programmi, l'oggetto dell'email di Formspree). La fonte e' il dominio del portale,
     messo qui dal generatore (SITE_URL_PUBBLICO). Dalla terza revisione dell'08/10 la
     prenotazione va PRIMA li', e al servizio principale solo di riserva: che cosa conti la
     risposta del CRM, e quando parte la riserva, lo dicono `crmConfermato` e «L'ESITO», piu'
     giu'. */
  var CRM_FONTE = "portaledeifuturimedici.com";
  var CRM_ATTESA_MS = 12000;
  /* il cellulare in forma internazionale (E.164) quando si capisce: tolti spazi e
     punteggiatura; "00" in testa vale "+"; senza prefisso, 10 cifre che cominciano per 3
     sono un cellulare italiano (+39), 12 che cominciano per 39 lo sono col prefisso
     scritto senza "+", da 9 a 11 che cominciano per 0 un fisso italiano (+39, e lo 0
     resta). Altrimenti le cifre come sono scritte: meglio un numero da guardare a mano
     che uno indovinato. Quello scritto parte comunque, accanto (phone_raw). */
  function e164(v) {
    var s = String(v || '').trim();
    var c = s.replace(/\D/g, '');
    if (!c) return '';
    if (s.charAt(0) === '+') return '+' + c;
    if (c.slice(0, 2) === '00') return '+' + c.slice(2);
    if (c.length === 10 && c.charAt(0) === '3') return '+39' + c;
    if (c.length === 12 && c.slice(0, 2) === '39') return '+' + c;
    if (c.length >= 9 && c.length <= 11 && c.charAt(0) === '0') return '+39' + c;
    return c;
  }
  /* i dati per il CRM, letti dal modulo DOPO che lo script ha scritto la pagina e le
     etichette del link: il consenso lo prova il testo della casella spuntata (com'e'
     a schermo, spazi compressi) con l'istante dell'invio */
  function datiCrm(form, ok) {
    function val(n) {
      var f = form.querySelector('[name="' + n + '"]');
      return f ? String(f.value || '').trim() : '';
    }
    var nome = val('nome').replace(/\s+/g, ' ');
    var spazio = nome.indexOf(' ');
    var tel = val('telefono');
    /* la segnalazione non ha la casella del consenso (legittimo interesse): `ok` e' null,
       e allora i tre campi del consenso non partono (09/10, i moduli del sito) */
    var casella = ok ? (ok.closest ? ok.closest('label') : ok.parentNode) : null;
    var d = {
      full_name: nome,
      first_name: spazio < 0 ? nome : nome.slice(0, spazio),
      last_name: spazio < 0 ? '' : nome.slice(spazio + 1),
      email: val('email'),
      phone: e164(tel),
      phone_raw: tel,
      page: val('pagina'),
      form: val('modulo'),
      source: CRM_FONTE
    };
    if (ok) {
      d.consent = true;
      d.consent_text = casella ? String(casella.textContent || '').replace(/\s+/g, ' ').trim() : '';
      d.consent_at = new Date().toISOString();
    }
    Array.prototype.forEach.call(form.querySelectorAll('input[name^="utm_"]'), function (f) {
      d[f.name] = String(f.value || '');
    });
    /* I MODULI DEL SITO (09/10, data-crm-tutto: contatti/assistenza, segnalazioni): partono
       anche tutti gli altri campi coi loro nomi (mai quelli che cominciano per "_"),
       l'oggetto (il `_subject` di Formspree) e un RIEPILOGO in HTML per la notifica a
       info@ del workflow «Moduli del sito». La prenotazione alla live non porta
       data-crm-tutto: il suo oggetto resta quello di sempre. */
    if (form.dataset.crmTutto) {
      var righe = [];
      Array.prototype.forEach.call(form.querySelectorAll('input[name],select[name],textarea[name]'),
        function (f) {
          var n = f.name;
          if (!n || n.charAt(0) === '_' || n.slice(0, 4) === 'utm_') return;
          if ((f.type === 'checkbox' || f.type === 'radio') && !f.checked) return;
          var v = String(f.value || '').trim();
          if (!(n in d)) d[n] = v;
          if (v) {
            var e = document.createElement('div');
            e.textContent = n + ': ' + v;
            righe.push(e.innerHTML);
          }
        });
      if (!d.form) d.form = form.id === 'segnala-form' ? 'segnalazione' : 'contatti';
      d.oggetto = val('_subject') || ('Modulo ' + d.form + ' dal sito');
      d.riepilogo = righe.join('<br>');
    }
    return d;
  }
  /* IL SEGNO VERO DI CONSEGNA del CRM (seconda revisione dell'08/10, stretto dalla terza). Il
     webhook in ingresso di HighLevel risponde HTTP 200 a qualunque indirizzo, anche
     inventato, col corpo {"status":"Success: test request received"} e nessun id (misurato
     con curl l'08/10): il 200 da solo non prova niente. Una risposta BUONA (r.ok) conta come
     consegna solo se il suo corpo JSON ha uno status che comincia per «Success» (maiuscole o
     minuscole) e in piu' porta un id non vuoto o dice «execution»: e' la risposta che ci si
     aspetta da un workflow PUBBLICATO, {"status":"Success: request sent to trigger execution
     server","id":"..."}, e NON e' ancora misurata: si conferma alla prima prenotazione di
     prova vera. Dalla terza revisione il segno decide anche se la prenotazione va a Formspree
     (la riserva, «L'ESITO» piu' giu'): un segno falso la lascerebbe al solo CRM, che forse
     non l'ha registrata. Per questo uno status che non comincia per «Success» non conferma
     mai, nemmeno con un id o con «execution» dentro («Error: ...»), e un id senza status
     nemmeno. Un corpo che non e' JSON, un errore di rete o di CORS: nessun segno. (Un JSON
     che e' un testo, un numero o un elenco non ha uno status: basta escludere null.) */
  function crmConfermato(j) {
    if (!j || typeof j.status !== 'string' || !/^success/i.test(j.status)) return false;
    if (typeof j.id === 'string' && j.id.trim() !== '') return true;
    return /execution/i.test(j.status);
  }
  function modulo(form) {
    /* la validazione la fa questo gestore (i campi evidenziati, i messaggi): quella
       del browser resta nel markup per chi invia SENZA lo script (la segnalazione ha
       method e action veri, revisione F6), e qui si spegne */
    form.noValidate = true;
    var msg = form.querySelector('.form-msg');
    var note = form.querySelector('textarea[maxlength]');
    var conta = form.querySelector('.conta span');
    var aggiornaConta = function () {
      if (note && conta) conta.textContent = String(note.value.length);
    };
    if (note && conta) {
      note.addEventListener('input', aggiornaConta);
      aggiornaConta();
    }
    function say(kind, text) {
      if (!msg) return;
      msg.className = 'form-msg show ' + kind;
      msg.textContent = text;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var tel = form.querySelector('[name=telefono]');
      var ok = form.querySelector('[name=consenso]');
      var valido = true;
      Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (f) {
        var bad = !f.value.trim() || (f.type === 'email' && !EMAIL_OK.test(f.value));
        f.setAttribute('aria-invalid', String(bad));
        if (bad) valido = false;
      });
      /* un'email FACOLTATIVA (la segnalazione) si valida solo se e' stata scritta */
      Array.prototype.forEach.call(form.querySelectorAll('input[type=email]:not([required])'),
        function (f) {
          var bad = f.value.trim() !== '' && !EMAIL_OK.test(f.value.trim());
          f.setAttribute('aria-invalid', String(bad));
          if (bad) valido = false;
        });
      /* il cellulare e' FACOLTATIVO: si valida solo se e' stato scritto */
      if (tel) {
        var v = tel.value.trim();
        var badTel = v !== '' && (v.replace(/\D/g, '').length < 8 ||
                                  !/^\+?[\d\s().-]{8,20}$/.test(v));
        tel.setAttribute('aria-invalid', String(badTel));
        if (badTel) valido = false;
      }
      if (!valido) { say('no', 'Controlla i campi evidenziati.'); return; }
      if (ok && !ok.checked) { say('no', 'Serve il consenso al trattamento dei dati per procedere.'); return; }
      var trappola = form.querySelector('[name=_gotcha]');
      if (trappola && trappola.value) { return; }   /* honeypot (anche Formspree lo filtra lato server) */
      if (!form.dataset.endpoint) {
        say('no', 'Il form non e\u0300 ancora collegato: manca la scelta del servizio ' +
                  'che ricevera\u0300 i contatti. Nessun dato e\u0300 stato inviato.');
        return;
      }
      /* l'indirizzo della pagina da cui si scrive: quello VERO, letto qui, non uno
         scritto dal generatore (che non sa sotto quale cartella verra' pubblicato) */
      var pagina = form.querySelector('[name=pagina]');
      if (pagina) pagina.value = String(location.href).split('#')[0].split('?')[0];
      /* LE ETICHETTE DEL LINK da cui si arriva (la live, 2026-10-08): ogni campo nascosto
         utm_* ancora vuoto prende il parametro omonimo dell'indirizzo (?utm_source=...),
         al massimo 100 caratteri. Solo nei moduli che hanno quei campi; il campo pagina
         resta senza la parte dopo il "?" */
      var etichette = form.querySelectorAll('input[type=hidden][name^="utm_"]');
      if (etichette.length) {
        try {
          var cercate = new URLSearchParams(location.search);
          Array.prototype.forEach.call(etichette, function (f) {
            if (!f.value) f.value = (cercate.get(f.name) || '').slice(0, 100);
          });
        } catch (e) {}
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      /* data-copia (la live, commit 790d7d5fd di Luca): una seconda destinazione degli
         STESSI campi (le prenotazioni anche nel repo privato, via il worker di evento/).
         Parte prima del reset, non blocca e non decide l'esito. Esce solo con
         EVENTO_COPIA_URL impostato (oggi vuoto) */
      if (form.dataset.copia) {
        try { fetch(form.dataset.copia, {method: 'POST', body: new FormData(form), keepalive: true})
                .catch(function () {}); } catch (e) {}
      }
      /* L'ESITO, con uno o due servizi (terza revisione dell'08/10). Il servizio principale
         (data-endpoint, Formspree) e, se il modulo porta data-crm e la casella del consenso
         e' spuntata, il CRM.
         PERCHE' COL CRM FORMSPREE E' SOLO LA RISERVA. data-endpoint e' lo STESSO servizio, e
         la stessa quota, del modulo contatti, della segnalazione in fondo a ogni pagina di
         materiale e dell'assistenza di /studio (FORM_ENDPOINT). Formspree gratuito accetta 50
         invii al mese e oltre risponde 429 (formspree.io/plans, letto l'08/10); la live ne
         aspetta 100-300. Mandata SEMPRE anche a Formspree (seconda revisione), ogni
         prenotazione consumava quella quota: le prime ~50 la finivano, e fino al primo del
         mese dopo contatti, segnalazioni e assistenza rispondevano «Invio non riuscito».
         IL PATTO:
         - col CRM parte SOLO la richiesta al CRM. Se conferma la consegna col segno vero
           (`crmConfermato`: un 200 da solo non basta, revisione del commit 23b0e09e2,
           rilievo 1) e' RIUSCITO, e Formspree non riceve niente;
         - se il CRM finisce senza il segno (una risposta cattiva, un 200 senza segno, un
           corpo che non e' JSON, la rete o il CORS) o non risponde entro CRM_ATTESA_MS dal
           clic, parte la RISERVA: una volta sola, al servizio principale, coi campi presi al
           clic (gli stessi del CRM). Da li' decide la sua risposta: bene riuscito, male non
           riuscito. Una conferma del CRM che arriva prima di quella risposta vale ancora;
         - senza data-crm (contatti, segnalazioni, avvisi), o senza la casella spuntata, il
           servizio principale parte subito e decide da solo, senza timer: come prima;
         - a riuscito la frase, il blocco di data-dopo, il reset e data-vai, insieme: prima
           del timer non resta niente in volo (la riserva parte solo a CRM finito), dopo il
           timer il CRM non si aspetta piu';
         - deciso l'esito, niente lo cambia: il bottone e' gia' tornato attivo, e un fatto
           che arriva dopo si mescolerebbe a un nuovo invio.
         Se il workflow pubblicato NON manda il segno (lo dice la prova vera), ogni
         prenotazione passa dalla riserva e consuma la quota come prima. Un timer e dei
         segni, non Promise.any/allSettled: i Safari vecchi non li hanno. */
      /* il CRM parte se il modulo lo porta e, se ha la casella del consenso, e' spuntata;
         senza un'email scritta bene (la segnalazione la lascia facoltativa) va solo alla
         riserva: Leadfather non crea un contatto senza email (09/10, i moduli del sito) */
      var mailCrm = form.querySelector('[name="email"]');
      var crm = (form.dataset.crm && (!ok || ok.checked) && mailCrm &&
                 EMAIL_OK.test(String(mailCrm.value || '').trim())) ? form.dataset.crm : '';
      var corpo = new FormData(form);   /* i campi del clic, anche per la riserva */
      var esito = 0;   /* del servizio principale: 0 non ha risposto (o non e' partito), 1 bene, -1 male */
      var segno = 0;   /* del CRM: 0 la richiesta non e' finita, 1 consegna confermata, -1 no */
      var partito = false, scaduto = false, chiuso = false, timer = null;
      function mostra() {
        say('ok', form.getAttribute('data-ok') || 'Fatto. Ti scriviamo quando escono appunti nuovi.');
        /* data-dopo (la live, 2026-09-30, pagina di Luca): l'id di un blocco della pagina
           da mostrare SOLO a invio riuscito, al posto del modulo (la prenotazione apre qui
           il bottone del calendario). Il fuoco va sul blocco: la regione dell'esito sta
           nel modulo, che sparisce, e chi usa un lettore di schermo sentirebbe il nulla */
        var dopo = form.dataset.dopo && document.getElementById(form.dataset.dopo);
        if (dopo) {
          dopo.hidden = false;
          form.hidden = true;
          if (dopo.focus) dopo.focus();
          if (dopo.scrollIntoView) dopo.scrollIntoView({block: 'center'});
        }
      }
      /* il servizio principale: senza il CRM parte subito, col CRM solo come riserva */
      function principale() {
        partito = true;
        fetch(form.dataset.endpoint, {
          method: 'POST',
          headers: {'Accept': 'application/json'},
          body: corpo
        }).then(function (r) { esito = r.ok ? 1 : -1; chiudi(); },
                function () { esito = -1; chiudi(); });
      }
      /* a ogni fatto (la fine della richiesta al CRM, il timer, la risposta del servizio
         principale) si guarda dove si e' arrivati, col patto qui sopra. Senza il CRM il
         servizio principale e' gia' partito, e la riserva non c'e' */
      function chiudi() {
        if (chiuso) return;
        if (!partito && (segno < 0 || scaduto)) principale();
        if (esito > 0 || segno > 0) {
          chiuso = true;
          if (timer) clearTimeout(timer);
          form.reset();
          aggiornaConta();
          mostra();
          /* data-vai (la live, commit e64635eb9 di Luca): la pagina a cui andare dopo
             l'invio riuscito (/evento-grazie/). Il blocco di data-dopo resta: e' la
             risposta se la pagina nuova non si apre */
          if (form.dataset.vai) { location.href = form.dataset.vai; }
        } else if (esito < 0) {
          /* la riserva (o, senza il CRM, il servizio principale) ha risposto male: il CRM
             ha gia' finito senza il segno, o non si aspetta piu' */
          chiuso = true;
          if (timer) clearTimeout(timer);
          say('no', form.getAttribute('data-ko') || 'Invio non riuscito. Riprova tra poco.');
        } else {
          return;
        }
        btn.disabled = false;
      }
      if (!crm) { principale(); return; }
      /* IL CRM, PER PRIMO: la fine della sua richiesta col suo segno (prima r.ok, poi il corpo
         JSON, `crmConfermato`). Un corpo che non e' JSON, un'eccezione, un errore di rete o
         di CORS finiscono nel ramo senza segno, e allora parte la riserva */
      var finita = function (confermata) { segno = confermata ? 1 : -1; chiudi(); };
      timer = setTimeout(function () { scaduto = true; chiudi(); }, CRM_ATTESA_MS);
      try {
        fetch(crm, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(datiCrm(form, ok))
        }).then(function (r) {
          if (!r.ok) return null;
          try { return r.json(); } catch (e) { return null; }
        }).then(function (j) { finita(crmConfermato(j)); },
                function () { finita(false); });
      } catch (e) { finita(false); }
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('form[data-endpoint]'), modulo);
})();

/* --- l'app: il worker del portale e l'invito a installare --- */
(function () {
  'use strict';
  if (!document.querySelector('link[rel="manifest"]')) return;
  /* LA RADICE DEL DOMINIO. Dal 07/10 l'app e' tutto il portale e il worker sta alla radice,
     qualunque sia la pagina. Fino al 06/10 si deduceva dal manifest (che stava in /appunti/):
     le lezioni PRESERVATE chiedono ancora quello, e da li' la radice sarebbe /appunti/,
     cioe' il worker di ritiro. */
  var BASE = location.origin + '/';
  var inApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
              navigator.standalone === true;

  function registra() {
    if (!('serviceWorker' in navigator)) return;
    /* il worker di prima stava in /appunti/: la sua registrazione se ne va, quello della
       radice copre tutto */
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) {
          if (r.scope !== BASE && r.scope.indexOf(BASE) === 0) r.unregister();
        });
      }).catch(function () {});
    }
    navigator.serviceWorker.register(BASE + 'sw.js', {scope: BASE})
      .catch(function () { /* niente offline; la pagina resta identica */ });
  }
  /* nello Studypack completo questo script parte DOPO il cancello, a pagina gia' caricata:
     il `load` non arriva piu' */
  if (document.readyState === 'complete') registra();
  else window.addEventListener('load', registra);

  /* ---- l'invito a installare ---- */
  var attesa = null;
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function avvisa() {
    /* su iPhone e iPad si installa dal menu Condividi: niente bottone (Safari non ha
       l'evento, e un browser che lo finge non deve far promettere un bottone che li' non c'e') */
    [].forEach.call(document.querySelectorAll('[data-installa]'), function (b) {
      b.classList.toggle('si', !!attesa && !inApp && !ios);
    });
    try {
      window.dispatchEvent(new CustomEvent('app:stato'));
    } catch (e) { /* browser senza CustomEvent: la pagina dell'app resta col suo testo */ }
  }
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();                /* il momento lo sceglie chi legge: il bottone */
    attesa = ev;
    avvisa();
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest('[data-installa]');
    if (!b || !attesa) return;
    attesa.prompt();
    attesa.userChoice.then(function () { attesa = null; avvisa(); });
  });
  window.addEventListener('appinstalled', function () { attesa = null; avvisa(); });
  window.APP_PORTALE = {base: BASE, inApp: inApp, ios: ios,
                        puo: function () { return !!attesa; }};
  avvisa();
})();

/* --- l'app: la pagina «Installa l'app» (i passi e «Salva tutto per usarlo offline») --- */
(function () {
  'use strict';
  var A = window.APP_PORTALE;
  var pag = document.getElementById('app-pagina');
  if (!A || !pag) return;
  function el(id) { return document.getElementById(id); }

  /* ---- i passi del dispositivo che stai usando: aperti ---- */
  var ua = navigator.userAgent || '';
  /* Safari sul Mac (verifica del 07/10, OFF-8): Macintosh e Safari, senza Chrome, Edge o
     Opera (che scrivono anche «Safari» nel loro nome). L'iPad che si presenta come Mac e' gia'
     A.ios, e viene prima. */
  var macSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) &&
                  !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox)\//.test(ua);
  var dispositivo = A.ios ? 'ios' : /SamsungBrowser/.test(ua) ? 'samsung'
    : /Firefox\//.test(ua) ? 'firefox' : /Android/.test(ua) ? 'android'
    : macSafari ? 'mac' : 'computer';
  var passi = pag.querySelector('details[data-dispositivo="' + dispositivo + '"]');
  if (passi) passi.open = true;
  var statoApp = el('app-stato');
  function dici() {
    if (!statoApp) return;
    statoApp.textContent = A.inApp ? 'Stai usando l\u2019app installata.'
      : A.ios ? 'Su iPhone e iPad si installa dal menu Condividi: i passi sono qui sotto.'
      : macSafari ? 'Su Mac con Safari si installa dal menu File: i passi sono qui sotto.'
      : A.puo() ? 'Il tuo browser la installa con il bottone qui sotto.'
      : 'I passi per il tuo dispositivo sono qui sotto.';
  }
  window.addEventListener('app:stato', dici);
  dici();

  /* ---- «Salva tutto per usarlo offline» ---- */
  var pannello = el('off-pannello');
  if (!pannello) return;
  /* LA CHIAVE SUL DISPOSITIVO (G2): lo stesso codice del cancello, site_lock.py */
  var ChiaveDispositivo = (function () {
    var DB_CHIAVI = 'portale-studio-chiavi', ARCHIVIO = 'chiavi', COPIA = 'portale-studio-';
    var GIORNI = 30, GIORNO_MS = 86400000, TOLLERANZA_MS = 3600000;
    var ATTESA_MS = 4000, GLOBALE = 'studioChiaveDispositivo', VOCE_TOK = 'appunti-tok';
    /* la sessione e' ancora quella? Si rilegge SUBITO PRIMA di ogni scrittura: un'uscita da
       un'altra scheda, mentre un «si'» era in volo, cancella il database, e una scrittura
       dopo lo ricreerebbe (revisione di sicurezza del 09/10, rilievo 2) */
    function ancora(tok) {
      try { return !!tok && localStorage.getItem(VOCE_TOK) === tok; } catch (e) { return false; }
    }
    function pronto() {
      try {
        return typeof indexedDB !== 'undefined' && typeof Promise === 'function' &&
               typeof crypto !== 'undefined' && !!crypto.subtle &&
               typeof TextEncoder === 'function';
      } catch (e) { return false; }
    }
    /* `crea` = false: se il database non c'e', NON si crea (si annulla l'aggiornamento):
       chi legge e basta non lascia un database vuoto sul dispositivo. */
    function apriDb(crea) {
      return new Promise(function (ok, ko) {
        var finito = false, req = null;
        var t = setTimeout(function () { fine(ko, new Error('attesa')); }, ATTESA_MS);
        function fine(f, x) {
          if (finito) return false;
          finito = true; clearTimeout(t); f(x);
          return true;
        }
        try { req = indexedDB.open(DB_CHIAVI, 1); } catch (e) { fine(ko, e); return; }
        req.onupgradeneeded = function () {
          if (!crea) { try { req.transaction.abort(); } catch (e) {} return; }
          var db = req.result;
          if (!db.objectStoreNames.contains(ARCHIVIO)) {
            db.createObjectStore(ARCHIVIO, {keyPath: 'sale'});
          }
        };
        req.onsuccess = function () {
          var db = req.result;
          db.onversionchange = function () { try { db.close(); } catch (e) {} };
          if (!fine(ok, db)) { try { db.close(); } catch (e) {} }
        };
        req.onerror = function (ev) {
          try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
          fine(ko, req.error || new Error('db'));
        };
      });
    }
    function fai(crea, modo, lavoro) {
      return apriDb(crea).then(function (db) {
        return new Promise(function (ok, ko) {
          var esito = {valore: null}, tx = null;
          function chiudi() { try { db.close(); } catch (e) {} }
          try { tx = db.transaction(ARCHIVIO, modo); } catch (e) { chiudi(); ko(e); return; }
          tx.oncomplete = function () { chiudi(); ok(esito.valore); };
          tx.onerror = function () { chiudi(); ko(tx.error || new Error('tx')); };
          tx.onabort = function () { chiudi(); ko(tx.error || new Error('tx')); };
          try { lavoro(tx.objectStore(ARCHIVIO), esito); }
          catch (e) { try { tx.abort(); } catch (x) {} }
        });
      });
    }
    function tutte() {
      return fai(false, 'readonly', function (st, esito) {
        esito.valore = [];
        var c = st.openCursor();
        c.onsuccess = function () {
          var cur = c.result;
          if (cur) { esito.valore.push(cur.value); cur['continue'](); }
        };
      }).then(function (v) { return v || []; }, function () { return []; });
    }
    function metti(voce) {
      return fai(true, 'readwrite', function (st) { st.put(voce); });
    }
    function togli(sali) {
      if (!sali || !sali.length) return Promise.resolve();
      return fai(false, 'readwrite', function (st) {
        for (var i = 0; i < sali.length; i++) st['delete'](sali[i]);
      }).then(function () {}, function () {});
    }
    /* TUTTO il database: l'uscita dall'account, il diritto tolto, «Cancella le copie». */
    function dimentica() {
      return new Promise(function (ok) {
        var req = null;
        try {
          if (typeof indexedDB !== 'undefined') req = indexedDB.deleteDatabase(DB_CHIAVI);
        } catch (e) { req = null; }
        if (!req) { ok(); return; }
        var t = setTimeout(ok, ATTESA_MS);
        req.onsuccess = req.onerror = req.onblocked = function () { clearTimeout(t); ok(); };
      });
    }
    /* l'impronta della SESSIONE: il token resta dov'e', qui se ne tiene solo l'impronta */
    function impronta(tok) {
      return crypto.subtle.digest('SHA-256',
                                  new TextEncoder().encode('portale-studio-sessione:' + tok))
        .then(function (b) {
          var a = new Uint8Array(b), s = '';
          for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
          return s;
        });
    }
    /* le pubblicazioni salvate (una cache per sale): {sale: true}, null = non si sa */
    function copie() {
      try {
        if (typeof caches === 'undefined' || !caches || !caches.keys) return Promise.resolve(null);
        return caches.keys().then(function (nomi) {
          var s = {};
          for (var i = 0; i < nomi.length; i++) {
            var n = String(nomi[i]);
            if (n.indexOf(COPIA) === 0) s[n.slice(COPIA.length)] = true;
          }
          return s;
        }, function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    }
    function vuoto(o) {
      for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) return false; }
      return true;
    }
    /* LA CHIAVE di `sale` per chi e' entrato con `tok`: {chiave, scade} oppure {motivo}:
       nessuno (nessun account entrato), niente (nessuna copia salvata), assente, scaduta,
       orologio, altra (c'e' solo la chiave di un'altra pubblicazione), guasto. Ogni voce che
       non vale piu' si cancella qui. `usa`: si sta aprendo una pagina (si segna l'uso). */
    function leggi(sale, tok, usa) {
      if (!tok) return dimentica().then(function () { return {motivo: 'nessuno'}; });
      if (!pronto()) return Promise.resolve({motivo: 'guasto'});
      return copie().then(function (cs) {
        if (cs && vuoto(cs)) return dimentica().then(function () { return {motivo: 'niente'}; });
        return Promise.all([impronta(tok), tutte()]).then(function (r) {
          var s = r[0], ora = Date.now(), via = [], mia = null, motivo = 'assente', altre = 0;
          for (var i = 0; i < r[1].length; i++) {
            var x = r[1][i], perche = '';
            if (cs && !cs[x.sale]) perche = 'copia';
            else if (x.sessione !== s) perche = 'sessione';
            else if (!(ora < x.scade)) perche = 'scaduta';
            else if (ora + TOLLERANZA_MS < (x.visto || x.rinnovata || 0)) perche = 'orologio';
            if (perche) {
              via.push(x.sale);
              if (x.sale === sale && (perche === 'scaduta' || perche === 'orologio')) motivo = perche;
            } else if (x.sale === sale) {
              mia = x;
            } else {
              altre++;
            }
          }
          return togli(via).then(function () {
            if (!mia) return {motivo: motivo === 'assente' && altre ? 'altra' : motivo};
            if (!usa || !ancora(tok)) return {chiave: mia.chiave, scade: mia.scade};
            mia.visto = Math.max(ora, mia.visto || 0);
            return metti(mia).then(null, function () {}).then(function () {
              return {chiave: mia.chiave, scade: mia.scade};
            });
          });
        });
      }).then(null, function () { return {motivo: 'guasto'}; });
    }
    /* DOPO IL SI' DEL WORKER per `sale`, con la chiave `grezza` (i suoi byte, in memoria) che
       ha appena aperto quella pubblicazione. La voce di `sale` si scrive o si rinnova SOLO se
       la sua copia e' salvata; se ne vanno le voci che il si' smentisce: senza copia, di
       un'altra sessione (la stessa regola di `leggi`), di un altro account, o di una madre che
       il Worker non riconosce piu'. `info` = {uid, madre: l'impronta della madre di QUESTA
       chiave, madri: le impronte che il Worker riconosce}. -> true se la voce c'e'. Non
       rifiuta mai. */
    function dopoSi(sale, grezza, tok, info) {
      if (!tok || !pronto()) return Promise.resolve(false);
      info = info || {};
      return copie().then(function (cs) {
        if (!cs) return false;
        if (vuoto(cs)) return dimentica().then(function () { return false; });
        return Promise.all([impronta(tok), tutte()]).then(function (r) {
          var s = r[0], via = [], madri = info.madri || [];
          for (var i = 0; i < r[1].length; i++) {
            var x = r[1][i];
            if (x.sale === sale) continue;
            if (!cs[x.sale] || x.sessione !== s ||
                (info.uid && x.uid && String(x.uid) !== String(info.uid)) ||
                (madri.length && madri.indexOf(x.madre || '') < 0)) via.push(x.sale);
          }
          return togli(via).then(function () {
            if (!cs[sale]) return togli([sale]).then(function () { return false; });
            return crypto.subtle.importKey('raw', grezza, 'AES-GCM', false, ['decrypt'])
              .then(function (k) {
                var ora = Date.now();
                if (!ancora(tok)) return Promise.reject(new Error('uscito'));
                return metti({sale: sale, chiave: k, sessione: s, uid: info.uid || null,
                              madre: info.madre || '', rinnovata: ora,
                              scade: ora + GIORNI * GIORNO_MS, visto: ora});
              }).then(function () { return true; });
          });
        });
      }).then(null, function () { return false; });
    }
    /* le voci delle copie che non ci sono piu' (un «Aggiorna» completo toglie la vecchia) */
    function pota() {
      if (!pronto()) return Promise.resolve();
      return copie().then(function (cs) {
        if (!cs) return;
        if (vuoto(cs)) return dimentica();
        return tutte().then(function (t) {
          var via = [];
          for (var i = 0; i < t.length; i++) { if (!cs[t[i].sale]) via.push(t[i].sale); }
          return togli(via);
        });
      }).then(null, function () {});
    }
    return {GIORNI: GIORNI, GLOBALE: GLOBALE, pronto: pronto, leggi: leggi, dopoSi: dopoSi,
            togli: togli, dimentica: dimentica, pota: pota};
  })();
  var BASE = A.base;
  var PAGINE = 'portale-pagine', IMMAGINI = 'portale-immagini', STUDIO = 'portale-studio-';
  var REG_GRATUITO = BASE + '__registro__/gratuito.json';
  var REG_STUDIO = BASE + '__registro__/studio.json';
  var GIORNO = 86400000;
  var GIORNI = parseInt(pannello.getAttribute('data-giorni'), 10) || 30;
  var API = pannello.getAttribute('data-api') || '';
  var COL_STUDIO = pannello.getAttribute('data-studio') === '1';
  /* le figure di Wikimedia: la miniatura della misura che serve, sotto l'indirizzo
     dell'originale (la stessa regola del worker, `site_pwa.MINIATURA_PX`) */
  var COMMONS = pannello.getAttribute('data-commons') || '';
  var MINIATURA = pannello.getAttribute('data-miniatura') || '';
  var TETTO_FIGURA = parseInt(pannello.getAttribute('data-tetto-figura'), 10) || 0;
  /* che cosa funziona davvero senza rete dello Studypack completo, in breve (la frase e'
     `OFFLINE_COMPLETO_BREVE`, la stessa della home di /studio): verifica del 07/10, OFF-1 */
  var VERO = pannello.getAttribute('data-vero') || '';
  var salva = el('off-salva'), cancella = el('off-cancella'), barra = el('off-barra'),
      stato = el('off-stato'), elenco = el('off-elenco'), spazio = el('off-spazio');
  /* su iPhone e iPad, in Safari: le copie salvate qui non passano all'app installata (OFF-4) */
  var avvisoIos = el('off-ios');
  if (avvisoIos && A.ios && !A.inApp) avvisoIos.hidden = false;
  /* `annuncio`: l'esito di un salvataggio resta a schermo, la vista non lo copre */
  var dati = null, lavoro = false, saleOnline = null, annuncio = false;

  if (!('caches' in window) || !window.fetch || !window.Promise ||
      !('serviceWorker' in navigator)) {
    stato.textContent = 'Questo browser non sa salvare le pagine per usarle senza rete.';
    salva.disabled = true;
    return;
  }

  function mb(n) {
    var x = n / 1048576;
    if (x < 0.1) return '0,1 MB';
    return x.toFixed(x < 10 ? 1 : 0).replace('.', ',') + ' MB';
  }
  function giorno(t) {
    var d = new Date(t);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function guasto(messaggio) { var e = new Error(messaggio); e.messaggio = messaggio; return e; }
  function token() {
    try { return localStorage.getItem('appunti-tok') || ''; } catch (e) { return ''; }
  }
  function b2a(b64) {
    var s = atob(b64), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function json(r) { return r ? r.json() : null; }

  /* l'elenco del sito gratuito: dalla rete, e senza rete dalla copia del guscio */
  function leggiElenco() {
    var url = BASE + 'offline.json';
    return fetch(url, {cache: 'reload'}).then(function (r) {
      if (!r.ok) throw guasto(String(r.status));
      return r.json();
    }).catch(function () {
      return caches.match(url).then(json);
    });
  }
  function registro(url) {
    return caches.match(url).then(json).catch(function () { return null; });
  }
  function nomiStudio() {
    return caches.keys().then(function (nomi) {
      return nomi.filter(function (n) { return n.indexOf(STUDIO) === 0; });
    });
  }
  /* le voci del sito gratuito: {url, gruppo, img} */
  function vociGratuite() {
    return (dati && dati.file || []).map(function (f) {
      var img = f[0].indexOf('https://') === 0;
      return {url: img ? f[0] : BASE + f[0], gruppo: f[1], img: img};
    });
  }
  /* c'e' una copia leggibile? (le pagine salvate scadono: una copia scaduta non conta) */
  function presente(url) {
    return caches.match(url).then(function (r) {
      if (!r) return false;
      var t = Number(r.headers.get('x-salvata') || 0);
      return !t || (Date.now() - t) < GIORNI * GIORNO;
    }, function () { return false; });
  }

  function riga(testo) {
    var li = document.createElement('li');
    li.textContent = testo;
    elenco.appendChild(li);
    return li;
  }
  function quante(ok, tot, molte) {
    return tot === 1 ? (ok ? 'sul dispositivo' : 'non ancora sul dispositivo')
                     : ok + ' ' + molte + ' su ' + tot;
  }

  /* COSA C'E' SUL DISPOSITIVO: contato nelle cache, non ricordato */
  function vista() {
    var voci = vociGratuite();
    return Promise.all([Promise.all(voci.map(function (v) { return presente(v.url); })),
                        registro(REG_GRATUITO), nomiStudio(), registro(REG_STUDIO),
                        navigator.storage && navigator.storage.estimate
                          ? navigator.storage.estimate().catch(function () { return null; })
                          : null,
                        navigator.storage && navigator.storage.persisted
                          ? navigator.storage.persisted().catch(function () { return false; })
                          : false])
      .then(function (r) {
        var ci = r[0], reg = r[1], studi = r[2], regS = r[3], stima = r[4], fisso = r[5];
        elenco.textContent = '';
        /* «salvato» lo dicono i registri di «Salva tutto», non la home e il catalogo che
           l'app tiene comunque nel suo guscio */
        var studio = studi.length && regS ? regS : null;
        var qualcosa = !!reg || !!studio;
        (dati && dati.gruppi || []).forEach(function (g) {
          var tot = 0, ok = 0;
          voci.forEach(function (v, i) { if (v.gruppo === g[0]) { tot++; if (ci[i]) ok++; } });
          if (tot) riga(g[1] + ': ' + quante(ok, tot, 'pagine'));
        });
        var ti = 0, oi = 0;
        voci.forEach(function (v, i) { if (v.img) { ti++; if (ci[i]) oi++; } });
        if (ti) riga('Le figure degli appunti: ' + quante(oi, ti, 'figure'));
        if (studio) {
          /* il vero accanto ai numeri (OFF-1); una copia di una pubblicazione di prima senza
             rete non si apre piu' (la chiave di oggi non la apre): lo si dice (OFF-2). FINO A
             QUANDO si apre senza rete lo dice la sua chiave sul dispositivo (G2), letta e non
             ricordata; la riga si scrive subito e si completa quando il database risponde */
          var rs = riga('Studypack completo: ' + regS.file + ' file, ' + mb(regS.byte) +
                        ', salvato il ' + giorno(regS.quando) + '.');
          var testa = rs.textContent.slice(0, -1);
          if (saleOnline && saleOnline !== regS.sale) {
            rs.textContent = testa + '. Online c\u2019\u00e8 una versione pi\u00f9 recente ' +
              'e questa copia senza rete non si apre pi\u00f9: premi \u00abAggiorna\u00bb.';
          } else {
            ChiaveDispositivo.leggi(regS.sale, token(), false).then(function (es) {
              var m = es.motivo;
              rs.textContent = testa + (es.chiave
                ? ': si apre senza rete fino al ' + giorno(es.scade) + '.'
                : m === 'nessuno'
                ? ': per aprirlo senza rete entra col tuo account.'
                : m === 'scaduta' || m === 'orologio'
                ? ': la chiave per aprirlo senza rete \u00e8 scaduta. Aprilo una volta con ' +
                  'la rete, o premi \u00abAggiorna\u00bb, e torna a valere.'
                : m === 'assente' || m === 'altra'
                ? ': la chiave per aprirlo senza rete non \u00e8 su questo dispositivo. ' +
                  'Premi \u00abAggiorna\u00bb con la rete.'
                : (VERO ? ': ' + VERO + '.' : '.'));
            });
          }
        } else if (COL_STUDIO) {
          riga('Studypack completo: ' + (token() ? 'non salvato.'
               : 'per salvarlo entra col tuo account.'));
        }
        var vecchio = reg && dati && reg.versione !== dati.versione;
        var quando = reg ? reg.quando : (studio ? studio.quando : 0);
        salva.textContent = qualcosa ? 'Aggiorna' : 'Salva tutto per usarlo offline';
        cancella.classList.toggle('si', qualcosa);
        if (!lavoro && !annuncio) {
          stato.textContent = !qualcosa ? ''
            : (vecchio ? 'Online c\u2019\u00e8 una versione pi\u00f9 recente: premi \u00abAggiorna\u00bb.'
               : 'Salvato il ' + giorno(quando) + ': si legge senza rete fino al ' +
                 giorno(quando + GIORNI * GIORNO) + '.');
        }
        spazio.textContent = stima && stima.usage
          ? 'Il portale occupa ' + mb(stima.usage) + ' sul dispositivo.' +
            (fisso ? ' Il browser tiene le copie anche quando lo spazio scarseggia.' : '')
          : '';
      });
  }

  /* lo STUDYPACK COMPLETO: l'elenco cifrato si apre con la chiave che l'account da' a chi ha
     il diritto (la stessa richiesta del cancello). Si chiede SEMPRE: la chiave sul dispositivo
     vuole un «si'» fresco, e il «si'» porta l'account e l'impronta della madre (G2). Se il
     Worker non sa rispondere (rete giu', 5xx, un Worker di prima) basta la chiave della
     sessione, se e' di questa pubblicazione: la copia si salva, ma la chiave sul dispositivo
     no. Un 401 o un «no» cancellano la chiave sul dispositivo (il diritto non c'e' piu').
     Rende {chiavi: [{k, madre}], info, fresco} oppure rifiuta con il messaggio. */
  function chiave(sale, tok) {
    var voce = null;
    try { voce = JSON.parse(sessionStorage.getItem('studio-key') || 'null'); } catch (e) {}
    var diSessione = voce && voce.salt === sale && voce.k ? voce.k : '';
    function nonSo(messaggio) {
      if (diSessione) return {chiavi: [{k: diSessione, madre: ''}], info: null, fresco: false};
      throw guasto(messaggio);
    }
    if (!API) return Promise.resolve().then(function () {
      return nonSo('Lo Studypack completo non si pu\u00f2 salvare adesso.');
    });
    return fetch(API + '/studio/chiave?sale=' + encodeURIComponent(sale),
                 {headers: {'Authorization': 'Bearer ' + tok}})
      .then(function (r) {
        if (r.status === 401) {
          return ChiaveDispositivo.dimentica().then(function () {
            throw guasto('La sessione \u00e8 scaduta: entra di nuovo col tuo account per ' +
                         'salvare anche lo Studypack completo.');
          });
        }
        return r.json().then(function (d) {
          if (r.status === 200 && d.consentito && d.chiave) {
            var madri = [];
            if (d.madre) madri.push(d.madre);
            if (d.madre_precedente) madri.push(d.madre_precedente);
            var chiavi = [{k: d.chiave, madre: d.madre || ''}];
            if (d.chiave_precedente) {
              chiavi.push({k: d.chiave_precedente, madre: d.madre_precedente || ''});
            }
            return {chiavi: chiavi, fresco: true,
                    info: {uid: d.uid || null, madre: d.madre || '', madri: madri}};
          }
          if (r.status === 200 && !d.consentito) {
            return ChiaveDispositivo.dimentica().then(function () {
              throw guasto('Il tuo account non ha lo Studypack completo: si salva il resto.');
            });
          }
          return nonSo('Non riesco a verificare il tuo accesso adesso: lo Studypack ' +
                       'completo non si \u00e8 salvato. Riprova tra poco.');
        }, function () {
          return nonSo('Non riesco a verificare il tuo accesso adesso: lo Studypack ' +
                       'completo non si \u00e8 salvato. Riprova tra poco.');
        });
      }, function () {
        return nonSo('Serve la rete per salvare lo Studypack completo.');
      });
  }
  /* apre l'elenco con la prima chiave che ci riesce: rende {lista, k, madre} */
  function apri(chiavi, iv, dati64) {
    var c = chiavi[0];
    return crypto.subtle.importKey('raw', b2a(c.k), 'AES-GCM', false, ['decrypt'])
      .then(function (ck) {
        return crypto.subtle.decrypt({name: 'AES-GCM', iv: b2a(iv)}, ck, b2a(dati64));
      })
      .then(function (buf) {
        return {lista: JSON.parse(new TextDecoder().decode(buf)), k: c.k, madre: c.madre};
      }, function (e) {
        if (chiavi.length > 1) return apri(chiavi.slice(1), iv, dati64);
        throw guasto('Lo Studypack completo \u00e8 appena stato ripubblicato: ' +
                     'ricarica la pagina e riprova.');
      });
  }
  function preparaStudio() {
    if (!COL_STUDIO) return Promise.resolve(null);
    var tok = token();
    if (!tok) return Promise.resolve({messaggio: 'Lo Studypack completo si salva quando ' +
                                                 'entri col tuo account.'});
    return fetch(BASE + 'studio/data/offline.json', {cache: 'reload', credentials: 'same-origin'})
      .then(function (r) {
        if (!r.ok) throw guasto('Lo Studypack completo non si pu\u00f2 salvare adesso: ' +
                                'riprova pi\u00f9 tardi.');
        return r.text();
      }, function () { throw guasto('Serve la rete per salvare lo Studypack completo.'); })
      .then(function (testo) {
        if (testo.slice(0, 5) !== 'VCS1.') {
          /* il completo in chiaro (la prova in locale): niente chiave */
          return {sale: 'chiaro', lista: JSON.parse(testo)};
        }
        var p = testo.split('.');
        saleOnline = p[1];
        return chiave(p[1], tok).then(function (c) {
          return apri(c.chiavi, p[2], p[3]).then(function (a) {
            var info = null;
            if (c.fresco) {
              info = {uid: c.info.uid, madre: a.madre, madri: c.info.madri};
            }
            return {sale: p[1], lista: a.lista, k: a.k, info: info, tok: tok};
          });
        });
      })
      .catch(function (e) { return {messaggio: e.messaggio || 'Lo Studypack completo non ' +
                                               'si \u00e8 salvato.'}; });
  }

  /* SCARICA: quattro alla volta. Ogni copia porta l'ora del salvataggio (`x-salvata`, la
     stessa marca del worker): e' cosi' che scade. Le figure di Wikimedia si chiedono in CORS. */
  function miniatura(u) {
    if (!COMMONS || !MINIATURA || u.indexOf(COMMONS) !== 0) return u;
    var m = /^([0-9a-f]\/[0-9a-f]{2}\/)([^\/?#]+\.(?:jpe?g|png|gif|webp))$/i
              .exec(u.slice(COMMONS.length));
    return m ? COMMONS + 'thumb/' + m[1] + m[2] + '/' + MINIATURA + 'px-' + m[2] : u;
  }
  function chiedi(v) {
    if (!v.img) return fetch(v.url, {cache: 'reload', credentials: 'same-origin'});
    var opz = {mode: 'cors', credentials: 'omit', cache: 'reload'};
    var u = miniatura(v.url);
    if (u === v.url) return fetch(u, opz);
    return fetch(u, opz).then(function (r) { return r.ok ? r : fetch(v.url, opz); },
                              function () { return fetch(v.url, opz); });
  }
  function una(v) {
    /* una figura gia' salvata non si riscarica: non cambia mai */
    var gia = v.img ? v.c.match(v.url) : Promise.resolve(null);
    return gia.then(function (x) {
      if (x) return 0;
      return chiedi(v).then(function (r) {
        if (!r.ok) throw guasto(String(r.status));
        if (v.img && TETTO_FIGURA &&
            Number(r.headers.get('content-length') || 0) > TETTO_FIGURA) {
          throw guasto('troppo pesante');
        }
        return r.blob().then(function (b) {
          var h = new Headers(r.headers);
          h.set('x-salvata', String(Date.now()));
          return v.c.put(v.url, new Response(b, {status: r.status, statusText: r.statusText,
                                                  headers: h}))
            .then(function () { return b.size; });
        });
      });
    });
  }
  function scarica(voci, avanza) {
    return new Promise(function (fine) {
      var i = 0, attivi = 0, esito = {fatte: 0, mancate: 0, byte: 0, gruppi: {}};
      function prossimo() {
        if (i >= voci.length && attivi === 0) { fine(esito); return; }
        while (attivi < 4 && i < voci.length) {
          (function (v) {
            attivi++;
            una(v).then(function (n) {
              esito.fatte++; esito.byte += n;
              esito.gruppi[v.gruppo] = (esito.gruppi[v.gruppo] || 0) + 1;
              return n;
            }, function () { esito.mancate++; return 0; }).then(function (n) {
              attivi--; avanza(n); prossimo();
            });
          })(voci[i++]);
        }
      }
      prossimo();
    });
  }

  salva.addEventListener('click', function () {
    if (lavoro || !dati) return;
    if (navigator.onLine === false) {
      stato.textContent = 'Sei senza rete: per salvare serve la connessione.';
      return;
    }
    lavoro = true;
    annuncio = false;
    salva.disabled = true;
    cancella.classList.remove('si');
    barra.classList.add('si');
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
    stato.textContent = 'Preparo l\u2019elenco\u2026';
    var totale = 0, fatte = 0, byte = 0, scaricati = 0, nota = '';
    /* l'avanzamento dice anche quanto e' arrivato (verifica del 07/10, OFF-9): su rete mobile
       il peso e' un costo */
    function avanza(n) {
      fatte++;
      scaricati += n || 0;
      barra.value = totale ? Math.round(100 * fatte / totale) : 0;
      stato.textContent = 'Salvo ' + fatte + ' di ' + totale + ' file (' + mb(scaricati) +
                          ')\u2026';
    }
    Promise.all([caches.open(PAGINE), caches.open(IMMAGINI), preparaStudio()])
      .then(function (r) {
        var cp = r[0], ci = r[1], st = r[2];
        var voci = vociGratuite().map(function (v) {
          v.c = v.img ? ci : cp; return v;
        });
        var figureGia = {};
        voci.forEach(function (v) { if (v.img) figureGia[v.url] = true; });
        var vs = [];
        var aperta = null;
        if (st && st.messaggio) nota = st.messaggio;
        var pronto = Promise.resolve(null);
        if (st && st.lista) {
          pronto = caches.open(STUDIO + st.sale).then(function (cs) {
            aperta = cs;
            var tutte = (st.lista.file || []).map(function (f) {
              return {url: BASE + 'studio/' + f[0], gruppo: f[1], img: false, c: cs};
            }).concat((st.lista.immagini || []).map(function (u) {
              return {url: u, gruppo: 'immagini', img: true, c: ci};
            }));
            /* la stessa pubblicazione gia' in parte salvata: si riprende da dove era (e le
               figure gia' salvate, o che il gratuito sta per salvare, non si riscaricano) */
            return Promise.all(tutte.map(function (v) {
              return v.img ? (figureGia[v.url] ? true : ci.match(v.url).then(function (x) {
                return !!x; })) : cs.match(v.url).then(function (x) { return !!x; });
            })).then(function (ci2) {
              vs = tutte.filter(function (v, k) { return !ci2[k]; });
              return registro(REG_STUDIO).then(function (prima) {
                return {tutte: tutte.length, gia: tutte.length - vs.length,
                        byte: prima && prima.sale === st.sale ? prima.byte || 0 : 0};
              });
            });
          });
        }
        return pronto.then(function (riprende) {
          totale = voci.length + vs.length;
          barra.value = 0;
          stato.textContent = 'Salvo 0 di ' + totale + ' file\u2026';
          return scarica(voci, avanza).then(function (eg) {
            byte += eg.byte;
            if (!eg.fatte) return eg;
            return cp.put(REG_GRATUITO, new Response(JSON.stringify({
              quando: Date.now(), versione: dati.versione, byte: eg.byte,
              file: eg.fatte, mancate: eg.mancate}),
              {headers: {'Content-Type': 'application/json'}})).then(function () { return eg; });
          }).then(function (eg) {
            if (!aperta) return [eg, null];
            return scarica(vs, avanza).then(function (es) {
              byte += es.byte;
              var salvati = riprende.gia + es.fatte;
              es.completo = !es.mancate && salvati > 0;
              es.fresco = !!st.info || st.sale === 'chiaro';
              es.scade = 0;
              if (!salvati) {
                /* dello Studypack non e' arrivato niente: la cache vuota non e' una copia, e
                   la chiave sul dispositivo nasce solo accanto a una copia vera (revisione di
                   sicurezza del 09/10, rilievo 3) */
                return caches.delete(STUDIO + st.sale).then(function () { return [eg, es]; });
              }
              var reg = {quando: Date.now(), sale: st.sale, byte: riprende.byte + es.byte,
                         file: salvati, mancate: es.mancate};
              return aperta.put(REG_STUDIO, new Response(JSON.stringify(reg),
                {headers: {'Content-Type': 'application/json'}})).then(function () {
                if (es.mancate) return null;
                /* lo Studypack salvato prima: se ne va solo quando il nuovo e' completo, e con
                   lui la sua chiave sul dispositivo (pota) */
                return nomiStudio().then(function (nomi) {
                  return Promise.all(nomi.filter(function (n) { return n !== STUDIO + st.sale; })
                                         .map(function (n) { return caches.delete(n); }));
                }).then(function () { return ChiaveDispositivo.pota(); });
              }).then(function () {
                /* LA CHIAVE SUL DISPOSITIVO (G2): la copia e' nella sua cache e il Worker ha
                   appena detto «si'» con la chiave che ha aperto l'elenco: resta qui, non
                   estraibile, per ChiaveDispositivo.GIORNI. Senza un «si'» fresco (la chiave
                   della sessione) non si scrive, e nemmeno accanto a una copia a meta'. */
                if (!st.info || !es.completo) return null;
                return ChiaveDispositivo.dopoSi(st.sale, b2a(st.k), st.tok, st.info);
              }).then(function (scritta) {
                es.scade = scritta ? Date.now() + ChiaveDispositivo.GIORNI * GIORNO : 0;
                return [eg, es];
              });
            });
          });
        });
      })
      .then(function (esiti) {
        var eg = esiti[0], es = esiti[1];
        var mancate = eg.mancate + (es ? es.mancate : 0);
        barra.value = 100;
        /* il gratuito e lo Studypack contati A PARTE, e per lo Studypack il vero su cosa si
           apre senza rete (verifica del 07/10, OFF-1: «873 file salvati, si leggono senza rete
           fino al...», e 784 di quelli in una sessione nuova non si aprivano) */
        var detto = eg.fatte + ' file del materiale gratuito (' + mb(eg.byte) + ')';
        if (es) {
          detto += es.fatte ? ' e ' + es.fatte + ' dello Studypack completo (' + mb(es.byte) + ')'
                   : es.completo ? '; lo Studypack completo era gi\u00e0 salvato'
                   : '; lo Studypack completo non si \u00e8 salvato';
        }
        /* fino a quando lo Studypack si apre senza rete: la scadenza della chiave appena
           scritta sul dispositivo (G2); senza un «si'» fresco del Worker la chiave non c'e',
           e lo si dice */
        var dettoStudio = !es ? ''
          : es.scade ? ' Lo Studypack completo si apre senza rete fino al ' + giorno(es.scade) +
                       ': la chiave che lo apre resta su questo dispositivo e si cancella ' +
                       'quando esci dall\u2019account.'
          : !es.completo ? ' Lo Studypack completo si apre senza rete quando \u00e8 salvato ' +
                           'per intero.'
          : !es.fresco ? ' Lo Studypack completo, per ora, si apre senza rete solo in questa ' +
                         'sessione: la sua chiave si salva la prima volta che lo apri con la rete.'
          : (VERO ? ' Lo Studypack completo: ' + VERO + '.' : '');
        stato.textContent = 'Fatto: ' + detto + '. Il materiale gratuito si legge senza rete ' +
          'fino al ' + giorno(Date.now() + GIORNI * GIORNO) + '.' + dettoStudio +
          (mancate ? ' ' + mancate + ' non sono arrivati: premi \u00abAggiorna\u00bb con una ' +
                     'rete migliore.' : '') + (nota ? ' ' + nota : '');
      }, function () {
        stato.textContent = 'Il salvataggio si \u00e8 interrotto. Controlla la rete e premi ' +
                            'di nuovo: riprende da dove era.';
      })
      .then(function () {
        lavoro = false;
        annuncio = true;
        salva.disabled = false;
        return vista();
      });
  });

  var conferma = 0;
  cancella.addEventListener('click', function () {
    if (lavoro) return;
    if (Date.now() - conferma > 6000) {
      conferma = Date.now();
      cancella.textContent = 'Tocca di nuovo per cancellare';
      return;
    }
    conferma = 0;
    cancella.textContent = 'Cancella le copie';
    caches.keys().then(function (nomi) {
      return Promise.all(nomi.filter(function (n) {
        return n === PAGINE || n === IMMAGINI || n.indexOf(STUDIO) === 0;
      }).map(function (n) { return caches.delete(n); }));
    }).then(function () {
      /* con le copie se ne va la chiave dello Studypack sul dispositivo (G2) */
      return ChiaveDispositivo.dimentica();
    }).then(function () {
      barra.value = 0;
      barra.classList.remove('si');
      annuncio = true;
      stato.textContent = 'Copie cancellate. Con la rete il portale funziona come prima.';
      return vista();
    });
  });

  leggiElenco().then(function (d) {
    dati = d;
    if (!dati) {
      stato.textContent = 'Senza rete non riesco a leggere cosa c\u2019\u00e8 da salvare.';
      salva.disabled = true;
      return;
    }
    salva.disabled = false;
    /* da dentro, con la rete: c'e' una pubblicazione piu' recente dello Studypack? */
    if (COL_STUDIO && token() && navigator.onLine !== false) {
      fetch(BASE + 'studio/data/offline.json', {cache: 'reload', credentials: 'same-origin'})
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (t) { if (t.slice(0, 5) === 'VCS1.') saleOnline = t.split('.')[1]; })
        .catch(function () {})
        .then(vista);
    }
    return vista();
  });
})();
/* --- home: prossima lezione e riga delle novita' (2026-09-29) --- */
(function () {
  'use strict';
  var d = document;

  /* giorno, minuti e data IN ITALIA, qualunque sia il fuso di chi legge */
  function partiRoma(t) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Rome', year: 'numeric',
        month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit',
        minute: '2-digit', hourCycle: 'h23'}).formatToParts(t).forEach(function (x) {
        p[x.type] = x.value;
      });
      var g = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6}[p.weekday];
      if (g === undefined) throw new Error('giorno');
      return {g: g, min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10),
              data: p.year + '-' + p.month + '-' + p.day};
    } catch (e) {
      var mm = t.getMonth() + 1, gg = t.getDate();
      return {g: t.getDay(), min: t.getHours() * 60 + t.getMinutes(),
              data: t.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' +
                    (gg < 10 ? '0' : '') + gg};
    }
  }

  /* ---- la prossima lezione, dal palinsesto dell'isola ---- */
  function prossima(voci, ora) {
    for (var k = 0; k <= 7; k++) {
      var g = (ora.g + k) % 7, cand = [], i;
      for (i = 0; i < voci.length; i++) if (voci[i].g === g) cand.push(voci[i]);
      cand.sort(function (a, b) { return (a.h * 60 + a.m) - (b.h * 60 + b.m); });
      for (i = 0; i < cand.length; i++) {
        var ini = cand[i].h * 60 + cand[i].m, fine = ini + (cand[i].durata || 90);
        if (k > 0) return {l: cand[i], stato: k === 1 ? 'domani' : 'giorno'};
        if (ora.min >= ini && ora.min < fine) return {l: cand[i], stato: 'corso'};
        if (ora.min < ini) return {l: cand[i], stato: 'oggi'};
      }
    }
    return null;
  }
  /* L'ULTIMA serata cominciata (quella in corso compresa), per il bottone «Guarda
     l'ultima registrazione»: porta alla playlist di quella serata (dati dell'utente del
     2026-09-30). Si cerca all'indietro, fino a una settimana. */
  function ultima(voci, ora) {
    for (var k = 0; k <= 7; k++) {
      var g = (ora.g - k + 7) % 7, cand = [], i;
      for (i = 0; i < voci.length; i++) if (voci[i].g === g) cand.push(voci[i]);
      cand.sort(function (a, b) { return (b.h * 60 + b.m) - (a.h * 60 + a.m); });
      for (i = 0; i < cand.length; i++) {
        if (k > 0 || cand[i].h * 60 + cand[i].m <= ora.min) return cand[i];
      }
    }
    return null;
  }
  /* La prossima lezione si RICALCOLA (rilievo 7): all'apertura, quando la pagina
     torna visibile o torna dalla memoria del browser, e ogni minuto. Aperta giovedi'
     alle 20:50, alle 23 non dice piu' «oggi alle 21». Ogni pezzo nel suo try: un
     errore qui non spegne la riga delle novita' (rilievo 8). */
  var isola = d.getElementById('palinsesto');
  var tit = d.getElementById('prossima-t');
  var chi = d.getElementById('prossima-chi');
  var pal = null;
  if (isola) {
    try { pal = JSON.parse(isola.textContent || 'null'); } catch (e) { pal = null; }
  }
  var statico = tit ? tit.textContent : '', sotto = chi ? chi.textContent : '';
  var reg = d.getElementById('prossima-reg');
  var regStatico = reg ? reg.getAttribute('href') : '';
  function aggiorna() {
    if (!tit || !pal || !pal.lezioni) return;
    var righe = d.querySelectorAll('[data-lezione]'), r;
    for (r = 0; r < righe.length; r++) righe[r].classList.remove('pal-su');
    var ora = partiRoma(new Date());
    if (reg) {
      var u = ultima(pal.lezioni, ora);
      reg.setAttribute('href', (u && u.playlist) || regStatico);
    }
    var p = prossima(pal.lezioni, ora);
    if (!p) { tit.textContent = statico; if (chi) chi.textContent = sotto; return; }
    var T = pal.t || {}, l = p.l;
    if (p.stato === 'corso') {
      tit.textContent = T.corso + ': ' + l.titolo;
    } else {
      var quando = p.stato === 'oggi' ? T.oggi : p.stato === 'domani' ? T.domani : l.giorno;
      tit.textContent = T.prossima + ': ' + quando + ' ' + T.alle + ' ' + l.ora +
                        ' \u00b7 ' + l.titolo;
    }
    if (chi) chi.textContent = T.con + ' ' + l.chi;
    for (r = 0; r < righe.length; r++) {
      if (righe[r].getAttribute('data-lezione') === String(l.g)) righe[r].classList.add('pal-su');
    }
  }
  function prova() { try { aggiorna(); } catch (e) {} }
  prova();
  if (window.addEventListener) window.addEventListener('pageshow', prova);
  if (d.addEventListener) d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'visible') prova();
  });
  if (typeof setInterval === 'function') setInterval(prova, 60000);

  /* ---- le righe sotto l'apertura scadono da sole (una copia vecchia in cache): quella
     delle novita' e, dal 2026-09-30, quella della live (`riga_evento`), ognuna col suo
     giorno. TUTTE: con due righe, cercarne una sola lasciava l'altra per sempre ---- */
  try {
    var righeFino = d.querySelectorAll('.novita-riga[data-fino]');
    for (var q = 0; q < righeFino.length; q++) {
      var nov = righeFino[q];
      if (nov && partiRoma(new Date()).data >= nov.getAttribute('data-fino')) nov.hidden = true;
    }
  } catch (e) {}
})();
/* --- lo Studypack pubblico: la lezione, le tappe e Oggi (2026-09-29) --- */
(function avvia() {
  'use strict';
  var d = document;
  var isola = d.getElementById('studypack-dati');
  if (!isola) return;
  var D = null;
  try { D = JSON.parse(isola.textContent || 'null'); } catch (e) { D = null; }
  /* nel completo le lezioni arrivano coi dati della home (commit 27). Finche' non ci sono,
     il nome e le tappe del markup sono quelli della PRIMA lezione del corso, non della
     lezione chiesta (?lezione=) ne' di quella a cui eri arrivato: si nascondono, e la
     sezione dice che sta aspettando (verifica del 02/10, rilievo NAV-05). Se i dati non
     arrivano home_studio.js lo dice (`studypack:lezioni-errore`): restano nascosti, e
     «Oggi» dice l'errore col suo «Riprova»; arrivati, anche dopo, lo script riparte. */
  if (D && !D.lezioni && D.fonte) {
    var sez = d.getElementById('lezione');
    var vela = [d.getElementById('sp-scelta'), sez ? sez.querySelector('.sp-tappe') : null];
    var mostra = function (si) {
      for (var v = 0; v < vela.length; v++) if (vela[v]) vela[v].style.display = si ? '' : 'none';
      if (!sez) return;
      if (si) sez.removeAttribute('aria-busy'); else sez.setAttribute('aria-busy', 'true');
    };
    mostra(false);
    window.addEventListener('studypack:lezioni-errore', function () {
      if (sez) sez.removeAttribute('aria-busy');
    });
    window.addEventListener('studypack:lezioni', function una() {
      window.removeEventListener('studypack:lezioni', una);
      mostra(true);
      avvia();
    });
    return;
  }
  if (!D || !D.lezioni || !D.lezioni.length || !D.modi) return;
  var radice = d.getElementById('studypack');
  /* mappe SENZA prototipo, lette solo per chiave propria: in un oggetto semplice
     «?lezione=constructor» (o __proto__, toString) trovava una «lezione» ereditata, e la
     pagina mostrava «undefined · undefined» con un «Leggi» verso un 404 */
  var diritto = false, conferma = false, corrente = null, i;
  var perSigla = Object.create(null), perPagina = Object.create(null);
  function di(mappa, k) {
    return typeof k === 'string' && Object.prototype.hasOwnProperty.call(mappa, k) ? mappa[k] : null;
  }
  for (i = 0; i < D.lezioni.length; i++) {
    perSigla[D.lezioni[i].s] = D.lezioni[i];
    perPagina[D.lezioni[i].p] = D.lezioni[i];
  }

  /* dove porta il bottone di una tappa: la regola di `destinazione_tappa` */
  function dest(L, tappa) {
    var modo = D.modi[tappa];
    var rel = 'appunti/' + L.p + (L.a && L.a[tappa] ? '#' + L.a[tappa] : '');
    var suStudio = D.studio !== null && D.studio !== undefined && !!L.o;
    if (modo === 'aperta' || (diritto && suStudio)) return {href: D.studio + rel, studio: '', aperta: true};
    if (modo === 'libera') return {href: D.app + L.p, studio: '', aperta: false};
    return {href: conferma && D.profilo ? D.profilo : D.vetrina, studio: suStudio ? rel : '', aperta: false};
  }

  function scrivi(id, v) { var n = d.getElementById(id); if (n) n.textContent = v; }

  function opzioni(m) {
    var sel = d.getElementById('sp-lezione');
    if (!sel || sel.getAttribute('data-materia') === m) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    for (var k = 0; k < D.lezioni.length; k++) {
      var L = D.lezioni[k];
      if (L.m !== m) continue;
      var o = d.createElement('option');
      o.setAttribute('value', L.s);
      o.textContent = L.n + ' \u00b7 ' + L.t;
      sel.appendChild(o);
    }
    sel.setAttribute('data-materia', m);
  }

  function mostra(L) {
    corrente = L;
    scrivi('sp-nome', L.nome + ' \u00b7 ' + L.t);
    scrivi('sp-modulo', L.mod || '');
    var tappe = d.querySelectorAll('li[data-tappa]');
    for (var k = 0; k < tappe.length; k++) {
      var li = tappe[k], t = li.getAttribute('data-tappa'), x = dest(L, t);
      var a = li.querySelector('a[data-tappa-vai]');
      if (a) {
        a.setAttribute('href', x.href);
        if (x.studio) a.setAttribute('data-studio', x.studio);
        else a.removeAttribute('data-studio');
      }
      if (x.aperta) li.setAttribute('data-aperta', '1');
      else li.removeAttribute('data-aperta');
    }
    var sm = d.getElementById('sp-materia'), sl = d.getElementById('sp-lezione');
    if (sm) sm.value = L.m;
    opzioni(L.m);
    if (sl) sl.value = L.s;
  }

  function ricorda(L) {
    try {
      if (window.history && history.replaceState) {
        history.replaceState(null, '', location.pathname + '?lezione=' +
                             encodeURIComponent(L.s) + (location.hash || ''));
      }
    } catch (e) {}
  }

  /* la lezione di partenza: l'indirizzo, poi l'ultima letta, poi la prima del corso */
  function partenza() {
    var q = '';
    try { q = new URLSearchParams(location.search).get('lezione') || ''; } catch (e) {}
    var dallIndirizzo = di(perSigla, q);
    if (dallIndirizzo) return dallIndirizzo;
    var meglio = null, quando = -1;
    try {
      for (var k = 0; k < localStorage.length; k++) {
        var chiave = localStorage.key(k);
        var m = chiave && chiave.match(/^appunti-letto:.*?([^\/]+\.html)$/);
        var letta = m ? di(perPagina, m[1]) : null;
        if (!letta) continue;
        var v = localStorage.getItem(chiave) || '', taglio = v.indexOf('|');
        var t = taglio < 0 ? 0 : (parseInt(v.slice(taglio + 1), 10) || 0);
        if (t > quando) { quando = t; meglio = letta; }
      }
    } catch (e) {}
    return meglio || D.lezioni[0];
  }

  var form = d.getElementById('sp-scegli');
  if (form) {
    form.hidden = false;
    form.addEventListener('submit', function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); });
    var sm = d.getElementById('sp-materia'), sl = d.getElementById('sp-lezione');
    if (sm) sm.addEventListener('change', function () {
      var scelta = null;
      for (var k = 0; k < D.lezioni.length && !scelta; k++) if (D.lezioni[k].m === sm.value) scelta = D.lezioni[k];
      if (scelta) { mostra(scelta); ricorda(scelta); }
    });
    if (sl) sl.addEventListener('change', function () {
      var L = di(perSigla, sl.value);
      if (L) { mostra(L); ricorda(L); }
    });
  }
  mostra(partenza());

  /* chi ha il completo: i bottoni col lucchetto fuori dalle tappe (ripasso e prova)
     aprono la loro pagina di /studio */
  function apriChiusi() {
    if (!radice || D.studio === null || D.studio === undefined) return;
    radice.setAttribute('data-completo', '1');
    var chiusi = radice.querySelectorAll('a[data-studio]');
    for (var k = 0; k < chiusi.length; k++) {
      var a = chiusi[k];
      if (a.hasAttribute('data-tappa-vai')) continue;
      a.setAttribute('href', D.studio + a.getAttribute('data-studio'));
      a.setAttribute('data-aperta', '1');
    }
  }

  /* chi ha il completo: le frasi per chi deve ancora prenderlo (l'apertura, la riga del
     ripasso, la riga verso la vetrina) lasciano il posto alle loro varianti, se ci sono
     (`data-per-diritto`): col diritto spariscono i lucchetti E le frasi di vendita */
  function varianti() {
    if (!radice) return;
    var v = radice.querySelectorAll('[data-per-diritto]');
    for (var k = 0; k < v.length; k++) v[k].hidden = v[k].getAttribute('data-per-diritto') !== 'completo';
  }

  /* chi deve confermare l'email: i bottoni col lucchetto di ripasso e prova portano al
     profilo (dove si rimanda il link di conferma), non alla vetrina */
  function chiusiAlProfilo() {
    var rip = d.getElementById('ripasso');
    if (!rip || !D.profilo) return;
    var bottoni = rip.querySelectorAll('a[href]');
    for (var k = 0; k < bottoni.length; k++) bottoni[k].setAttribute('href', D.profilo);
  }

  /* ---- Oggi: lo stato dell'account, chiesto al Worker ---- */
  var oggi = d.getElementById('oggi');
  function stato(s) {
    if (!oggi) return;
    oggi.setAttribute('data-stato', s);
    /* nell'attesa la sezione tiene il suo posto (la pagina non salta quando arriva la
       risposta) ma non mostra niente, nemmeno il titolo: la rende invisibile il foglio
       (`.sp-oggi[data-stato="attesa"]`), e aria-busy lo dice a chi usa un lettore */
    if (s === 'attesa') oggi.setAttribute('aria-busy', 'true');
    else oggi.removeAttribute('aria-busy');
    var blocchi = oggi.querySelectorAll('[data-per]'), trovato = false;
    for (var k = 0; k < blocchi.length; k++) {
      var qui = blocchi[k].getAttribute('data-per') === s;
      blocchi[k].hidden = !qui;
      if (qui) trovato = true;
    }
    oggi.hidden = !trovato && s !== 'attesa';
  }
  var api = oggi ? oggi.getAttribute('data-api') : '';
  var tok = '';
  try { tok = localStorage.getItem('appunti-tok') || ''; } catch (e) {}
  /* LA SESSIONE SCADUTA (401) la butta account.js: `setTok` e' l'unico punto da cui la
     sessione cambia, e ridisegna la barra, che altrimenti continuerebbe a dire «Profilo».
     Qui si da' il segnale, col token che il Worker ha rifiutato, in due forme perche'
     l'ordine fra i due file non e' garantito: l'evento se account.js e' gia' partito, il
     segno in window se parte dopo */
  function sessioneScaduta() {
    var segnale = {tok: tok, status: 401};
    try { window.__portaleSessioneScaduta = segnale; } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('portale:sessione-scaduta', {detail: segnale}));
    } catch (e) {}
  }
  if (oggi && api && tok && typeof fetch === 'function') {
    /* conta UNA risposta sola, la prima fra quella del Worker e il limite di tempo: una
       richiesta rimasta aperta non tiene la sezione in attesa per sempre */
    var deciso = false, ctl = null, limite = null;
    try { ctl = typeof AbortController === 'function' ? new AbortController() : null; } catch (e) { ctl = null; }
    var decidi = function (s) {
      if (deciso) return;
      deciso = true;
      if (limite !== null) clearTimeout(limite);
      if (s === 'completo') {
        diritto = true;
        if (corrente) mostra(corrente);
        apriChiusi();
        varianti();
      }
      if (s === 'conferma') {
        conferma = true;
        if (corrente) mostra(corrente);
        chiusiAlProfilo();
      }
      if (s === 'scaduta') sessioneScaduta();
      stato(s);
    };
    stato('attesa');
    limite = setTimeout(function () {
      if (ctl) { try { ctl.abort(); } catch (e) {} }
      decidi('ignoto');
    }, 8000);
    var opz = {headers: {'Authorization': 'Bearer ' + tok}};
    if (ctl) opz.signal = ctl.signal;
    var chiedi = function (percorso) {
      return fetch(api + percorso, opz).then(function (r) {
        if (r.status === 401) { var e = new Error('sessione scaduta'); e.scaduta = true; throw e; }
        if (!r.ok) throw new Error('risposta ' + r.status);
        return r.json();
      });
    };
    chiedi('/access?di=all').then(function (j) {
      if (j && j.consentito === true) return 'completo';
      /* senza il diritto, l'email: chi ha pagato e non ha ancora confermato l'indirizzo ha
         il pagamento fermo (il Worker lo aggancia alla conferma, e a un indirizzo non
         confermato non dice nemmeno se qualcuno ha pagato). Non lo si manda a comprare:
         lo si manda al profilo */
      return chiedi('/auth/me').then(function (m) {
        return m && m.user && m.user.email_verified === false ? 'conferma' : 'senza';
      });
    }).then(decidi, function (e) { decidi(e && e.scaduta ? 'scaduta' : 'ignoto'); });
  }
})();

/* --- LA LIVE (/evento/): il conto alla rovescia e il bottone fisso da telefono --- */
(function () {
  'use strict';
  var d = document;
  var conto = d.getElementById('ev-conto');
  if (conto) {
    var ini = Date.parse(conto.getAttribute('data-inizio'));
    var fine = Date.parse(conto.getAttribute('data-fine'));
    var celle = conto.querySelector('.ev-conto-celle');
    var parti = {};
    Array.prototype.forEach.call(conto.querySelectorAll('[data-u]'), function (b) {
      parti[b.getAttribute('data-u')] = b;
    });
    var giro = function () {
      var ora = Date.now();
      if (ora >= fine) { celle.textContent = conto.getAttribute('data-finita'); return; }
      if (ora >= ini) {
        celle.textContent = conto.getAttribute('data-in-diretta');
        setTimeout(giro, 30000);
        return;
      }
      var resto = ini - ora;
      var g = Math.floor(resto / 864e5); resto -= g * 864e5;
      var h = Math.floor(resto / 36e5); resto -= h * 36e5;
      var m = Math.floor(resto / 6e4); resto -= m * 6e4;
      var s = Math.floor(resto / 1e3);
      parti.g.textContent = g + 'g'; parti.h.textContent = h + 'h';
      parti.m.textContent = m + 'm'; parti.s.textContent = s + 's';
      setTimeout(giro, 1000 - (ora % 1000));
    };
    if (ini > 0 && fine > ini && celle && parti.g && parti.h && parti.m && parti.s) {
      conto.hidden = false;
      giro();
    }
  }
  var fisso = d.getElementById('ev-fisso');
  var apertura = d.querySelector('.ev-hero');
  var iscrizione = d.getElementById('iscrizione');
  if (fisso && apertura && iscrizione && 'IntersectionObserver' in window) {
    var aperturaVista = true, iscrizioneVista = false;
    var aggiorna = function () {
      fisso.classList.toggle('si', !aperturaVista && !iscrizioneVista);
    };
    new IntersectionObserver(function (e) {
      aperturaVista = e[0].isIntersecting; aggiorna();
    }).observe(apertura);
    new IntersectionObserver(function (e) {
      iscrizioneVista = e[0].isIntersecting; aggiorna();
    }, {threshold: 0.15}).observe(iscrizione);
  }
})();

/* --- contatore self-hosted (Cloudflare Worker) --- */
(function () {
  var U = 'https://counter.portaledeifuturimedici.com';
  if (!U) return;
  /* solo dal sito vero: mai da file://, localhost, 127.0.0.1, *.github.io o un'anteprima */
  var H = ["portaledeifuturimedici.com", "www.portaledeifuturimedici.com"];
  var L = window.location || {};
  if (L.protocol !== "https:" || H.indexOf(String(L.hostname || "").toLowerCase()) < 0) return;
  function hit(e) {
    var b = JSON.stringify({ p: location.pathname, e: e || "" });
    try { if (navigator.sendBeacon) { navigator.sendBeacon(U + "/hit", b); return; } } catch (_) {}
    try { fetch(U + "/hit", { method: "POST", body: b, keepalive: true }); } catch (_) {}
  }
  hit();
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-count]");
    if (el) hit(el.getAttribute("data-count"));
  });
})();

/* ---- «Segnala un errore» (fetta F6): l'ancora apre il modulo ---- */
(function () {
  function apri() {
    var d = document.getElementById('segnala');
    if (d && d.tagName === 'DETAILS' && !d.open) d.open = true;
  }
  function daAncora() { if (location.hash === '#segnala') apri(); }
  window.addEventListener('hashchange', daAncora);
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href="#segnala"]');
    if (a) apri();
  });
  daAncora();
})();
