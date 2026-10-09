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
        if (window.studioLetto) window.studioLetto(CHIAVE, localStorage.getItem(CHIAVE));
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
    var casella = ok.closest ? ok.closest('label') : ok.parentNode;
    var d = {
      full_name: nome,
      first_name: spazio < 0 ? nome : nome.slice(0, spazio),
      last_name: spazio < 0 ? '' : nome.slice(spazio + 1),
      email: val('email'),
      phone: e164(tel),
      phone_raw: tel,
      consent: true,
      consent_text: casella ? String(casella.textContent || '').replace(/\s+/g, ' ').trim() : '',
      consent_at: new Date().toISOString(),
      page: val('pagina'),
      form: val('modulo'),
      source: CRM_FONTE
    };
    Array.prototype.forEach.call(form.querySelectorAll('input[name^="utm_"]'), function (f) {
      d[f.name] = String(f.value || '');
    });
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
      var crm = (ok && ok.checked && form.dataset.crm) || '';
      var corpo = new FormData(form);   /* i campi del clic, anche per la riserva */
      var esito = 0;   /* del servizio principale: 0 non ha risposto (o non e' partito), 1 bene, -1 male */
      var segno = 0;   /* del CRM: 0 la richiesta non e' finita, 1 consegna confermata, -1 no */
      var partito = false, scaduto = false, chiuso = false, timer = null;
      function mostra() {
        say('ok', form.getAttribute('data-ok') || 'Fatto. Ti rispondiamo appena possibile.');
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

/* --- /studio: riprendi gli episodi iniziati, dal piu' recente --- */
(function riprendi() {
  var box = document.getElementById('riprendi-studio');
  var dati = document.getElementById('studio-episodi');
  if (!box) return;
  var mappa;
  if (dati) {
    try { mappa = JSON.parse(dati.textContent || '{}'); } catch (e) { return; }
  } else {
    /* la home del completo non ripete la mappa (revisione S4, il peso): i titoli li ha
       l'isola della lezione (`#studypack-dati`, nell'ordine del corso), le icone delle
       materie stanno sul riquadro (`data-icone`) */
    var sp = document.getElementById('studypack-dati'), icone = {}, ls = [], q;
    if (!sp) return;
    try { icone = JSON.parse(box.getAttribute('data-icone') || '{}'); } catch (e) { icone = {}; }
    try { q = JSON.parse(sp.textContent || '{}'); } catch (e) { return; }
    /* le lezioni arrivano coi dati della home (`fonte`: semplificazione, commit 27) */
    if (q && !q.lezioni && q.fonte) {
      window.addEventListener('studypack:lezioni', function una() {
        window.removeEventListener('studypack:lezioni', una);
        riprendi();
      });
      return;
    }
    ls = (q && q.lezioni) || [];
    mappa = {};
    for (q = 0; q < ls.length; q++) {
      if (ls[q] && ls[q].p) mappa[ls[q].p] = { t: ls[q].t, m: ls[q].m, i: icone[ls[q].m] || '' };
    }
  }
  var ordine = Object.keys(mappa);
  var per_pagina = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var m = k && k.match(/^appunti-letto:.*?([^\/]+\.html)$/);
      if (!m || !mappa[m[1]]) continue;
      var grezzo = localStorage.getItem(k) || '';
      var taglio = grezzo.indexOf('|');
      /* voce vecchia (nessun separatore) = sezione sola, data ignota -> t = 0 */
      var v = { p: m[1],
                s: taglio < 0 ? grezzo : grezzo.slice(0, taglio),
                t: taglio < 0 ? 0 : (parseInt(grezzo.slice(taglio + 1), 10) || 0) };
      var gia = per_pagina[v.p];
      if (!gia || v.t > gia.t) per_pagina[v.p] = v;
    }
  } catch (e) { return; }
  var voci = ordine.filter(function (p) { return per_pagina[p]; })
                   .map(function (p) { return per_pagina[p]; });
  if (!voci.length) return;
  /* `ordine` sopra da' gia' l'ordine del corso: e' il criterio con cui restano
     ordinate fra loro le voci senza data, e il pari-merito di due letture
     nello stesso secondo. Sort stabile (richiesto da ES2019). */
  voci.sort(function (a, b) { return b.t - a.t; });

  var MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
              'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function quando(t) {
    if (!t) return 'senza data';
    var d = new Date(t * 1000), o = new Date();
    var g = Math.round((new Date(o.getFullYear(), o.getMonth(), o.getDate()) -
                        new Date(d.getFullYear(), d.getMonth(), d.getDate()))
                       / 86400000);
    if (g <= 0) return 'oggi';
    if (g === 1) return 'ieri';
    if (g < 7) return g + ' giorni fa';
    return d.getDate() + ' ' + MESI[d.getMonth()];
  }

  var base = box.getAttribute('data-base') || '';
  var lista = document.getElementById('riprendi-l');
  voci.slice(0, 5).forEach(function (v) {
    var a = document.createElement('a');
    a.setAttribute('href', base + v.p + (v.s ? '#' + v.s : ''));
    var t = document.createElement('span');
    t.className = 't';
    t.textContent = mappa[v.p].i + ' ' + mappa[v.p].t;
    var q = document.createElement('small');
    q.textContent = quando(v.t);
    a.appendChild(t); a.appendChild(q);
    lista.appendChild(a);
  });
  box.hidden = false;
})();

/* --- /studio: l'ancora apre il suo blocco (fetta S0) --- */
(function () {
  var mosso = false, tieniFino = 0, agganciata = false;
  function ferma() { mosso = true; }
  window.addEventListener('wheel', ferma, {passive: true});
  window.addEventListener('touchstart', ferma, {passive: true});
  window.addEventListener('keydown', ferma);
  window.addEventListener('mousedown', ferma);
  function vaiAllAncora(subito) {
    var h = String(location.hash || '').slice(1);
    if (!h) return;
    try { h = decodeURIComponent(h); } catch (e) {}
    var t = document.getElementById(h);
    if (!t) return;
    for (var n = t; n; n = n.parentElement) {
      if (n.tagName === 'DETAILS') n.open = true;
    }
    if (t.scrollIntoView) {
      try { t.scrollIntoView(subito ? {block: 'start', behavior: 'instant'} : {block: 'start'}); }
      catch (e) { t.scrollIntoView(true); }
    }
    if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(t.tagName) &&
        !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({preventScroll: true}); } catch (e) {}
  }
  function correggi() {
    if (!mosso && Date.now() < tieniFino) vaiAllAncora(true);
  }
  function tieni() {
    mosso = false;
    tieniFino = Date.now() + 10000;
    if (agganciata) return;
    agganciata = true;
    var i, fogli = document.querySelectorAll('link[rel="stylesheet"]');
    for (i = 0; i < fogli.length; i++) fogli[i].addEventListener('load', correggi);
    var imm = document.images || [];
    for (i = 0; i < imm.length; i++) {
      if (imm[i].complete) continue;
      imm[i].addEventListener('load', correggi);
      imm[i].addEventListener('error', correggi);
    }
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(correggi).observe(document.documentElement);
    }
  }
  /* IL CLIC SULL'ANCORA GIA' NELL'INDIRIZZO (08/10). Un link verso il frammento che
     l'indirizzo ha gia' non lo cambia: niente hashchange, e il blocco richiuso nel
     frattempo restava chiuso (la riga delle mappe in testa alla lezione, la fascia
     delle tappe, «Avanti»). Il clic normale su quel link riapre e riporta in vista,
     con la stessa finestra di tieni(); gli altri li governa hashchange. */
  window.addEventListener('click', function (ev) {
    if (!ev || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey ||
        ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a || !location.hash || a.getAttribute('href') !== location.hash) return;
    tieni();
    vaiAllAncora(false);
  });
  tieni();
  vaiAllAncora(true);
  window.addEventListener('load', correggi);
  window.addEventListener('hashchange', function () { tieni(); vaiAllAncora(false); });
})();

/* --- /studio: la mappa mentale a schermo intero (09/10) --- */
(function () {
  var LIVELLI = [1, 1.5, 2, 3, 4];
  var finestra = null, tela = null, origine = null, disegno = null, z = 0;
  function bottone(testo, nome, azione) {
    var b = document.createElement('button');
    b.setAttribute('type', 'button');
    b.className = 'mappa-schermo-b';
    b.setAttribute('aria-label', nome || testo);
    b.setAttribute('data-azione', azione);
    b.textContent = testo;
    return b;
  }
  function applica() {
    if (disegno) disegno.style.width = (LIVELLI[z] * 100) + '%';
    var bs = finestra ? finestra.querySelectorAll('[data-azione]') : [];
    for (var i = 0; i < bs.length; i++) {
      var a = bs[i].getAttribute('data-azione');
      bs[i].disabled = (a === 'piu' && z >= LIVELLI.length - 1) || (a === 'meno' && z <= 0);
    }
  }
  function rimetti() {
    if (disegno) { disegno.style.width = ''; if (origine) origine.appendChild(disegno); }
    if (origine && origine.focus) origine.focus();
    disegno = null; origine = null;
  }
  function costruisci(fig) {
    finestra = document.createElement('dialog');
    finestra.className = 'mappa-schermo';
    var barra = document.createElement('div');
    barra.className = 'mappa-schermo-barra';
    barra.appendChild(bottone('−', fig.getAttribute('data-meno'), 'meno'));
    barra.appendChild(bottone('+', fig.getAttribute('data-piu'), 'piu'));
    barra.appendChild(bottone(fig.getAttribute('data-chiudi') || '×',
                              fig.getAttribute('data-chiudi'), 'chiudi'));
    tela = document.createElement('div');
    tela.className = 'mappa-schermo-tela';
    finestra.appendChild(barra);
    finestra.appendChild(tela);
    finestra.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-azione]') : null;
      if (!b) return;
      var a = b.getAttribute('data-azione');
      if (a === 'chiudi') { if (finestra.open) finestra.close(); }
      else if (a === 'piu' && z < LIVELLI.length - 1) { z++; applica(); }
      else if (a === 'meno' && z > 0) { z--; applica(); }
    });
    finestra.addEventListener('close', rimetti);
    document.body.appendChild(finestra);
  }
  /* IL GRADINO DI PARTENZA (09/10, misurato sul telefono): la mappa e' piu' larga che alta e
     un telefono in verticale la mostrava in una striscia in alto, col testo illeggibile. Si
     parte dal gradino piu' alto in cui la mappa entra ancora tutta in ALTEZZA nella tela (si
     scorre di lato), e centrati: su uno schermo largo resta il primo, la mappa intera. */
  function iniziale(s) {
    var vb = String(s.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    var w = tela.clientWidth, h = tela.clientHeight, z0 = 0;
    if (vb.length !== 4 || !(vb[2] > 0) || !(w > 0) || !(h > 0)) return 0;
    for (var i = 0; i < LIVELLI.length; i++) {
      if (w * LIVELLI[i] * vb[3] / vb[2] <= h) z0 = i;
    }
    return z0;
  }
  function apri(btn) {
    var s = btn.querySelector('svg'), fig = btn.closest('.mappa-disegno');
    if (!s || !fig) return;
    if (!finestra) {
      if (typeof document.createElement('dialog').showModal !== 'function') return;
      costruisci(fig);
    }
    if (finestra.open) return;
    origine = btn; disegno = s; z = 0;
    tela.appendChild(s);
    applica();
    finestra.showModal();
    z = iniziale(s);
    applica();
    if (tela.scrollWidth > tela.clientWidth) {
      tela.scrollLeft = (tela.scrollWidth - tela.clientWidth) / 2;
    }
  }
  document.addEventListener('click', function (ev) {
    if (!ev || ev.defaultPrevented) return;
    var b = ev.target && ev.target.closest ? ev.target.closest('.mappa-apri') : null;
    if (b) apri(b);
  });
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

/* --- eventi di studio: coda locale LEGATA ALL'ACCOUNT, invio a blocchi --- */
(function () {
  'use strict';
  var API = 'https://account.portaledeifuturimedici.com';
  var CODA = 'studio-coda';
  var TOK = 'appunti-tok';
  var VERSIONE = 2;
  var MAX_CODA = 300;               /* oltre, si buttano i piu' VECCHI */
  var BLOCCO = 50;                  /* = EVENTI_MAX del Worker */
  var GIORNO = 86400000;
  var ATTESA_MAX = 30 * GIORNO;     /* un evento che non parte da trenta giorni se ne va */
  var MAX_NOTI = 8;                 /* i token di cui si ricorda l'account */
  /* i tipi che solo un database con la migrazione 0011 accetta */
  var TIPI_0011 = { guida: 1, lettura: 1, tappa: 1 };
  var inviando = false, chiedendo = false;

  /* dove sta il Worker: studio_sync.js parte da solo leggendo questo indirizzo; e se
     e' gia' stato eseguito (un altro ordine degli script) lo si avvia da qui */
  window.STUDIO_SYNC = { api: API };
  try {
    if (window.Sync && typeof window.Sync.avvia === 'function') window.Sync.avvia({ api: API });
  } catch (e0) {}

  function tok() { try { return localStorage.getItem(TOK) || ''; } catch (e) { return ''; } }
  function eElenco(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function eMappa(x) { return !!x && typeof x === 'object' && !eElenco(x); }
  function proprio(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* L'IMPRONTA del token (FNV-1a a 32 bit + lunghezza): dice se il token e' ancora
     quello con cui un evento e' nato, senza tenerne una copia accanto agli eventi */
  function impronta(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8) + '.' + s.length;
  }
  /* la coda: `chi` = {impronta: {u, t}} (di chi e' un token, e da quando lo si sa),
     `letti` = {impronta + ' ' + pagina: giorno} (l'evento `lettura` di oggi c'e'
     gia'), `persi` = quanti eventi se ne sono andati senza partire */
  function vuota() {
    return { v: VERSIONE, chi: {}, morto: null, n: 0, eventi: [], letti: {}, persi: { orfani: 0, inAttesa: 0 } };
  }
  function leggi() {
    var q;
    try { q = JSON.parse(localStorage.getItem(CODA) || 'null'); } catch (e) { q = null; }
    /* la coda di PRIMA (un elenco nudo) non dice di chi sono i suoi eventi: si scarta */
    if (!q || typeof q !== 'object' || eElenco(q) || q.v !== VERSIONE || !eElenco(q.eventi)) return vuota();
    if (!(typeof q.n === 'number' && q.n >= 0)) q.n = 0;
    if (!eMappa(q.chi)) q.chi = {};
    if (!eMappa(q.letti)) q.letti = {};
    if (!eMappa(q.persi)) q.persi = { orfani: 0, inAttesa: 0 };
    if (!(q.persi.orfani >= 0)) q.persi.orfani = 0;
    if (!(q.persi.inAttesa >= 0)) q.persi.inAttesa = 0;
    return q;
  }
  function salva(q) {
    var adesso = Date.now(), tenuti = [], i, v, k;
    for (i = 0; i < q.eventi.length; i++) {
      v = q.eventi[i];
      if (!v || typeof v !== 'object' || typeof v.t !== 'number') continue;
      if (adesso - v.t < ATTESA_MAX) tenuti.push(v); else perso(q, v);
    }
    while (tenuti.length > MAX_CODA) perso(q, tenuti.shift());
    q.eventi = tenuti;
    /* dei segni di lettura conta solo il giorno di oggi */
    var oggi = giornoLocale(adesso), letti = {};
    for (k in q.letti) if (proprio(q.letti, k) && q.letti[k] === oggi) letti[k] = oggi;
    q.letti = letti;
    /* dei token noti, i MAX_NOTI piu' recenti */
    var noti = [];
    for (k in q.chi) if (proprio(q.chi, k) && eMappa(q.chi[k]) && typeof q.chi[k].u === 'string') noti.push(k);
    noti.sort(function (a, b) { return (q.chi[b].t || 0) - (q.chi[a].t || 0); });
    var chi = {};
    for (i = 0; i < noti.length && i < MAX_NOTI; i++) chi[noti[i]] = q.chi[noti[i]];
    q.chi = chi;
    try { localStorage.setItem(CODA, JSON.stringify(q)); } catch (e) {}
  }
  /* un evento che se ne va senza essere partito: lo si conta, non sparisce in silenzio */
  function perso(q, v) { if (v && v.u) q.persi.inAttesa++; else q.persi.orfani++; }
  /* di chi e' il token con questa impronta, se lo si e' saputo */
  function utenteDi(q, f) {
    var c = q.chi[f];
    return eMappa(c) && typeof c.u === 'string' && c.u ? c.u : null;
  }
  function ricorda(q, f, u) { q.chi[f] = { u: u, t: Date.now() }; }
  /* l'account del token `t` (impronta `f`): quello gia' saputo, oppure quello che
     studio_sync.js ha confermato con una lettura riuscita con QUESTO token */
  function noto(q, t, f) {
    var u = utenteDi(q, f);
    if (u) return u;
    try {
      u = window.Sync && typeof window.Sync.legato === 'function'
        ? window.Sync.legato({ token: function () { return t; } }) : null;
    } catch (e) { u = null; }
    if (typeof u === 'string' && u) { ricorda(q, f, u); return u; }
    return null;
  }
  /* gli eventi senza account prendono quello del loro token, appena lo si sa */
  function timbra(q) {
    for (var i = 0; i < q.eventi.length; i++) {
      var v = q.eventi[i], u;
      if (v && !v.u && (u = utenteDi(q, v.f))) v.u = u;
    }
  }
  function capace(u) {
    try { return !!(window.Sync && typeof window.Sync.legato === 'function' && window.Sync.legato() === u); }
    catch (e) { return false; }
  }
  /* cio' che puo' partire ADESSO col token di adesso: solo eventi del SUO account */
  function pronti(q, f) {
    var u = utenteDi(q, f), fuori = [], nuovi, i, v;
    if (!u) return fuori;
    nuovi = capace(u);
    for (i = 0; i < q.eventi.length; i++) {
      v = q.eventi[i];
      if (v.u !== u) continue;                       /* di un altro account: aspetta il suo */
      if (v.e && TIPI_0011[v.e.kind] === 1 && !nuovi) continue;
      fuori.push(v);
    }
    return fuori;
  }
  /* un evento in coda: l'identificativo (per i doppioni sul server), quando e' nato,
     l'impronta del token e, se lo si sa, l'account */
  function accoda(q, t, f, ev) {
    q.n += 1;
    var voce = { i: Date.now().toString(36) + '-' + q.n.toString(36) + '-' +
                    Math.random().toString(36).slice(2, 8),
                 t: Date.now(), f: f, e: ev };
    var u = noto(q, t, f);
    if (u) voce.u = u;
    q.eventi.push(voce);
  }
  /* cio' che parte: l'evento del motore, il suo identificativo e da quanti SECONDI
     e' successo (una durata: l'orologio sbagliato del dispositivo non conta) */
  function perIlServer(v, adesso) {
    var e = {}, k;
    for (k in v.e) if (proprio(v.e, k)) e[k] = v.e[k];
    e.i = v.i;
    e.eta = Math.max(0, Math.floor((adesso - v.t) / 1000));
    return e;
  }

  /* La chiama il motore dopo ogni giudizio. Non tocca la rete. */
  window.studioEvento = function (ev) {
    var t = tok();
    if (!ev || typeof ev !== 'object' || !t) return;
    var q = leggi(), f = impronta(t);
    accoda(q, t, f, ev);
    salva(q);
    if (pronti(q, f).length >= BLOCCO) manda();
  };

  /* Di chi e' questo token? Lo si chiede UNA volta per token (`/auth/me` esiste
     anche sul Worker di prima della 0011). La risposta vale per il token che l'ha
     chiesta anche se nel frattempo e' cambiato: la si ricorda (sotto la SUA
     impronta) e i suoi eventi prendono l'account. 401: la sessione non vale piu',
     e si smette di chiedere finche' il token non cambia. */
  function chiedi(t, f) {
    if (chiedendo) return;
    chiedendo = true;
    fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + t } }).then(function (r) {
      if (r.status === 401) return { morto: true };
      return r.ok ? r.json() : null;
    }).then(function (d) {
      chiedendo = false;
      var q = leggi();
      if (d && d.morto) { if (tok() === t) { q.morto = f; salva(q); } return; }
      var u = d && d.user && d.user.id !== undefined && d.user.id !== null ? String(d.user.id) : '';
      if (!u) return;
      ricorda(q, f, u);
      timbra(q);
      salva(q);
      manda();
    }).catch(function () { chiedendo = false; });
  }

  function manda(nascosta) {
    if (inviando) return;
    var t = tok();
    if (!t) return;
    var f = impronta(t), q = leggi();
    if (q.morto === f) return;
    /* di chi e' il token lo si chiede anche a coda vuota: un evento nato quando
       l'account e' gia' noto parte col suo nome, e se lo studente esce prima del
       prossimo invio lo ritrova quando rientra, anche con un token nuovo */
    if (!noto(q, t, f)) { chiedi(t, f); return; }
    timbra(q);
    var lotto = pronti(q, f).slice(0, BLOCCO), ids = {}, eventi = [], adesso = Date.now(), i;
    salva(q);
    if (!lotto.length) return;
    for (i = 0; i < lotto.length; i++) { ids[lotto[i].i] = true; eventi.push(perIlServer(lotto[i], adesso)); }
    inviando = true;
    fetch(API + '/studio/eventi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
      body: JSON.stringify({ eventi: eventi }),
      /* a pagina nascosta la pagina puo' chiudersi mentre il lotto viaggia */
      keepalive: nascosta === true
    }).then(function (r) {
      inviando = false;
      /* 401 = la sessione non vale piu': la coda resterebbe li' per sempre,
         quindi si smette di provare finche' non si rientra. */
      if (r.status === 401) { var qm = leggi(); qm.morto = f; salva(qm); return; }
      if (!r.ok) return;                             /* si riprova al giro dopo */
      var q2 = leggi();
      q2.eventi = q2.eventi.filter(function (v) { return !ids[v.i]; });
      salva(q2);
      if (pronti(q2, f).length) manda();
    }).catch(function () { inviando = false; });
  }

  /* Cosa c'e' in coda e cosa se n'e' andato senza partire (per chi lo mostra: la
     home di /studio, e le prove). Non tocca niente. */
  window.studioCoda = {
    rapporto: function () {
      var q = leggi(), t = tok(), u = t ? utenteDi(q, impronta(t)) : null, i, v;
      var r = { inCoda: q.eventi.length, tuoi: 0, altri: 0, senzaAccount: 0,
                persi: { orfani: q.persi.orfani, inAttesa: q.persi.inAttesa } };
      for (i = 0; i < q.eventi.length; i++) {
        v = q.eventi[i];
        if (!v.u) r.senzaAccount++; else if (u && v.u === u) r.tuoi++; else r.altri++;
      }
      return r;
    }
  };

  /* IL SEGNO DI LETTURA del completo. site.js lo salva a ogni pausa dello
     scorrimento (`appunti-letto:<pagina>` = `<sezione>|<secondi>`, oppure lo toglie
     quando si torna in cima) e passa di qui. Al server ne va poco, apposta:
     l'EVENTO `lettura` una volta al giorno per pagina e per token (il giorno e'
     quello LOCALE, e si tiene nella coda: il segno sparisce ogni volta che si torna
     in cima, e un giorno letto dal segno faceva ripartire l'evento a ogni ritorno),
     e il salvataggio `letto:<pagina>` (studio_sync.js) quando la sezione cambia, al
     piu' ogni cinque minuti, e sempre quando la pagina si nasconde. A ogni pausa
     sarebbero decine di scritture sul database per ogni lezione letta. */
  var LETTO_OGNI = 5 * 60000;
  var letto = { nome: '', sezione: '', spinto: '', quando: 0 };
  function giornoLocale(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function parti(v) { return typeof v === 'string' ? v.split('|') : []; }
  function spingiLetto(subito) {
    if (!letto.nome || !letto.sezione || letto.sezione === letto.spinto) return;
    try {
      if (window.Sync && typeof window.Sync.spingi === 'function' &&
          window.Sync.spingi(letto.nome, subito ? { subito: true } : undefined)) {
        letto.spinto = letto.sezione;
        letto.quando = Date.now();
      }
    } catch (e) {}
  }
  window.studioLetto = function (chiave, valore) {
    var pagina = String(chiave).slice('appunti-letto:'.length);
    letto.nome = 'letto:' + pagina;
    letto.sezione = parti(valore)[0] || '';
    if (!valore) return;
    var t = tok();
    if (t) {
      var q = leggi(), f = impronta(t), oggi = giornoLocale(Date.now()), k = f + ' ' + pagina;
      if (q.letti[k] !== oggi) {
        q.letti[k] = oggi;
        var m = /(s[12][fcb][0-9]{2})[.]html$/.exec(pagina);
        accoda(q, t, f, { kind: 'lettura', item: 'lettura:' + pagina, lezione: m ? m[1] : null,
                          esito: 'ok', ultimo: oggi });
        salva(q);
      }
    }
    if (Date.now() - letto.quando >= LETTO_OGNI) spingiLetto(false);
  };

  /* Tre momenti: all'apertura (la coda di ieri parte), ogni due minuti, e
     quando la pagina si nasconde — che sul telefono e' l'unico «dopo» che
     esiste davvero. In piu' dopo ogni lettura dello stato (studio_sync.js):
     e' li' che i tipi nuovi diventano spedibili. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { manda(); });
  } else { manda(); }
  setInterval(function () { manda(); }, 120000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { spingiLetto(true); manda(true); }
  });
  window.addEventListener('studio:stato', function () { manda(); });
})();

/* --- il nome dello studente nella barra dello Studypack completo (fetta S5) --- */
(function () {
  'use strict';
  var TOK = 'appunti-tok', CHI = 'appunti-chi';
  function nome() {
    try {
      if (!localStorage.getItem(TOK)) return '';
      return String(localStorage.getItem(CHI) || '').trim();
    } catch (e) { return ''; }
  }
  function scrivi() {
    var n = nome(), voci = document.querySelectorAll('a[data-nome]');
    for (var i = 0; i < voci.length; i++) {
      var a = voci[i];
      if (a.getAttribute('data-testo') === null) a.setAttribute('data-testo', a.textContent);
      if (!n) {
        a.textContent = a.getAttribute('data-testo');
        a.removeAttribute('title');
        continue;
      }
      var p = document.createElement('span');
      p.className = 'pallino';
      p.setAttribute('aria-hidden', 'true');
      var s = document.createElement('span');
      s.className = 'nav-acc-nome';
      s.textContent = n;
      a.textContent = '';
      a.appendChild(p);
      a.appendChild(s);
      a.setAttribute('title', 'Sei entrato come ' + n + ': apri il tuo profilo');
    }
  }
  scrivi();
  window.addEventListener('storage', function (ev) {
    if (!ev || ev.key === null || ev.key === TOK || ev.key === CHI) scrivi();
  });
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

/* --- lo Studypack sul dispositivo: la riga della home di /studio (07/10) --- */
(function () {
  'use strict';
  var riga = document.getElementById('hs-offline');
  var dove = document.getElementById('hs-offline-stato');
  if (!riga || !dove) return;
  function dici(chiave, coda) {
    var t = riga.getAttribute('data-' + chiave) || '';
    dove.textContent = coda ? t + ' ' + coda + '.' : t;
    riga.setAttribute('data-stato', chiave);
  }
  dici('niente');
  if (!('caches' in window) || !window.Promise) return;
  var sale = null;
  try { sale = (JSON.parse(sessionStorage.getItem('studio-key') || 'null') || {}).salt || null; }
  catch (e) { sale = null; }
  function giorno(t) {
    var d = new Date(t);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  caches.match(location.origin + '/__registro__/studio.json')
    .then(function (r) { return r ? r.json() : null; })
    .then(function (reg) {
      if (!reg || !reg.quando) return;
      if (sale && reg.sale && reg.sale !== sale) { dici('vecchio'); return; }
      dici('salvato', giorno(reg.quando));
    })
    .catch(function () { /* la frase di partenza resta: niente di inventato */ });
})();

/* --- contatore self-hosted (Cloudflare Worker) --- */
(function () {
  var U = 'https://studio-counter.fazb97.workers.dev';
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
