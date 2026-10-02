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
      if (b.dataset.pref === 'theme') temaScelto = prefs.theme;
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
      return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    function run() {
      var term = norm(q ? q.value.trim() : '');
      var n = 0;
      items.forEach(function (el) {
        var okF = filtro === 'all' || el.dataset.materia === filtro;
        var okQ = !term || norm(el.dataset.cerca).indexOf(term) !== -1;
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
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      /* data-copia (la live, commit 790d7d5fd di Luca): una seconda destinazione degli
         STESSI campi (le prenotazioni anche nel repo privato, via il worker di evento/).
         Parte prima del reset, non blocca e non decide l'esito: quello resta del servizio
         principale. Esce solo con EVENTO_COPIA_URL impostato (oggi vuoto) */
      if (form.dataset.copia) {
        try { fetch(form.dataset.copia, {method: 'POST', body: new FormData(form), keepalive: true})
                .catch(function () {}); } catch (e) {}
      }
      fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: {'Accept': 'application/json'},
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        aggiornaConta();
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
        /* data-vai (la live, commit e64635eb9 di Luca): la pagina a cui andare dopo
           l'invio riuscito (/evento-grazie/). Il blocco di data-dopo resta: e' la risposta
           se la pagina nuova non si apre */
        if (form.dataset.vai) { location.href = form.dataset.vai; }
      }).catch(function () {
        say('no', form.getAttribute('data-ko') || 'Invio non riuscito. Riprova tra poco.');
      }).then(function () { btn.disabled = false; });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('form[data-endpoint]'), modulo);
})();

/* --- app installabile: service worker, invito, copia offline --- */
(function () {
  'use strict';
  var link = document.querySelector('link[rel="manifest"]');
  if (!link) return;                    /* copia privata: qui l'app non esiste */

  /* LA RADICE DEL SITO SI LEGGE DAL MANIFEST, che ogni pagina scrive col
     proprio numero di livelli. Cosi' lo stesso file vale per la home e per una
     pagina di episodio, servito da `/appunti/` sul dominio o dalla radice in
     prova locale. Dedurla dal percorso della pagina sarebbe sbagliato appena il
     sito cambia posto — ed e' gia' cambiato. */
  /* L'URL ASSOLUTO (link.href), non l'attributo: da /appunti/index.html
     l'attributo e' «manifest.webmanifest», la base usciva VUOTA e lo scope del
     service worker diventava la pagina stessa invece della cartella (audit
     2026-09-24, MON-2). link.href e' gia' risolto: https://.../appunti/. */
  var BASE = link.href.replace(/manifest\.webmanifest$/, '');
  var inApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
              navigator.standalone === true;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(BASE + 'sw.js', {scope: BASE})
        .catch(function () { /* niente offline; la pagina resta identica */ });
    });
  }

  /* ---- invito a installare ---- */
  var invito = document.getElementById('app-installa');
  var bottone = document.getElementById('app-btn');
  var testo = document.getElementById('app-testo');
  var attesa = null;

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();                /* il momento lo scegliamo noi */
    attesa = ev;
    if (invito && !inApp) invito.classList.add('si');
  });
  if (bottone) bottone.addEventListener('click', function () {
    if (!attesa) return;
    attesa.prompt();
    attesa.userChoice.then(function () {
      attesa = null;
      if (invito) invito.classList.remove('si');
    });
  });
  window.addEventListener('appinstalled', function () {
    if (invito) invito.classList.remove('si');
  });

  /* iOS NON HA `beforeinstallprompt`: li' installare e' un gesto del menu di
     condivisione, e l'unica cosa utile e' dirlo a parole. Senza questo ramo
     l'invito non sarebbe mai comparso su iPhone e iPad — cioe' proprio dove
     serve di piu', visto che li' non c'e' nemmeno lo store come alternativa. */
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !inApp && invito && testo) {
    if (bottone) bottone.parentNode.removeChild(bottone);
    testo.textContent = 'Tocca Condividi, poi \u00abAggiungi alla schermata Home\u00bb: ' +
      'gli appunti si aprono a schermo pieno e restano leggibili anche senza rete.';
    invito.classList.add('si');
  }

  /* ---- copia offline di tutti gli appunti ---- */
  var salva = document.getElementById('app-salva');
  var stato = document.getElementById('app-stato');
  var blocco = document.getElementById('app-offline');
  if (!salva || !blocco || !('serviceWorker' in navigator)) return;

  /* Le pagine da salvare sono quelle che il catalogo mostra come PRONTE: si
     leggono dal DOM invece di scriverne un elenco a parte. Un secondo elenco
     divergerebbe dal primo il giorno che un episodio viene ritirato. */
  var pagine = [].map.call(document.querySelectorAll('a.ep.pronto[href]'),
                           function (a) { return a.href; });
  if (!pagine.length) return;
  var quante = document.getElementById('app-quante');
  if (quante) quante.textContent = String(pagine.length);
  blocco.classList.add('si');

  navigator.serviceWorker.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.tipo === 'salva-avanzamento' && stato)
      stato.textContent = d.fatte + ' di ' + d.totale;
    if (d.tipo === 'salva-finito') {
      salva.disabled = false;
      stato.textContent = (d.fatte === d.totale)
        ? ('Salvati tutti e ' + d.totale + '. Ora funzionano anche senza rete.')
        : ('Salvati ' + d.fatte + ' su ' + d.totale +
           ': riprova quando la rete \u00e8 migliore.');
    }
  });

  salva.addEventListener('click', function () {
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.active) { if (stato) stato.textContent = 'Riprova fra un istante.'; return; }
      salva.disabled = true;
      if (stato) stato.textContent = 'Salvo\u2026';
      reg.active.postMessage({tipo: 'salva-tutto', pagine: pagine});
    });
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
(function () {
  'use strict';
  var d = document;
  var isola = d.getElementById('studypack-dati');
  if (!isola) return;
  var D = null;
  try { D = JSON.parse(isola.textContent || 'null'); } catch (e) { D = null; }
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

/* --- contatore self-hosted (Cloudflare Worker) --- */
(function () {
  var U = 'https://counter.portaledeifuturimedici.com';
  if (!U) return;
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
