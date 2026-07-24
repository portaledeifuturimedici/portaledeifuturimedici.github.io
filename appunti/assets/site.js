/* Generato da site_build.py */
(function () {
  'use strict';
  var LS = 'appunti-prefs';
  var root = document.documentElement;

  var prefs = {theme: 'night', font: 'serif', fs: 1, lh: 1.75, measure: 66};
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  /* `fs` era una dimensione in px, ora e' una scala: una preferenza salvata
     prima della modifica varrebbe 19 (testo gigante). Si riporta al default. */
  if (!(prefs.fs > 0.5 && prefs.fs < 3)) prefs.fs = 1;

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
    try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) {}
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
      var links = document.getElementById('nav-links');
      var open = links.classList.toggle('open');
      nt.setAttribute('aria-expanded', String(open));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var panel = document.getElementById('prefs');
    if (panel) panel.classList.remove('show');
    var links = document.getElementById('nav-links');
    if (links) links.classList.remove('open');
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
      if (c) c.textContent = n === items.length
        ? n + ' episodi' : n + ' di ' + items.length + ' episodi';
    }
    if (q) q.addEventListener('input', run);
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
     contenuto puo' cambiare, i titoli restano. */
  var sezioni = document.querySelectorAll('.read h4[id], .read h3[id], .parte[id]');
  if (sezioni.length) {
    var CHIAVE = 'appunti-letto:' + location.pathname;
    var salva = function () {
      var corrente = null;
      sezioni.forEach(function (s) {
        if (s.getBoundingClientRect().top < 120) corrente = s;
      });
      try {
        if (corrente) localStorage.setItem(CHIAVE, corrente.id);
        else localStorage.removeItem(CHIAVE);
      } catch (e) {}
    };
    var attesa;
    window.addEventListener('scroll', function () {
      clearTimeout(attesa); attesa = setTimeout(salva, 400);
    }, {passive: true});

    var visto = null;
    try { visto = localStorage.getItem(CHIAVE); } catch (e) {}
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

  /* ---- form contatti ---- */
  /* il FORM, non la <section id="contatti"> che lo contiene: prima funzionava
     solo perche' l'evento submit risaliva fin li'. */
  var form = document.getElementById('contatti-form');
  if (form) {
    var msg = document.getElementById('form-msg');
    var note = form.querySelector('[name=suggerimenti]');
    var conta = document.getElementById('conta-note');
    if (note && conta) {
      var aggiornaConta = function () { conta.textContent = String(note.value.length); };
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
      var email = form.querySelector('[name=email]');
      var nome = form.querySelector('[name=nome]');
      var tel = form.querySelector('[name=telefono]');
      var ok = form.querySelector('[name=consenso]');
      var valido = true;
      [nome, email].forEach(function (f) {
        var bad = !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
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
      if (!ok.checked) { say('no', 'Serve il consenso al trattamento dei dati per procedere.'); return; }
      if (form.querySelector('[name=_gotcha]').value) { return; }   /* honeypot (anche Formspree lo filtra lato server) */
      if (!form.dataset.endpoint) {
        say('no', 'Il form non e\u0300 ancora collegato: manca la scelta del servizio ' +
                  'che ricevera\u0300 i contatti. Nessun dato e\u0300 stato inviato.');
        return;
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: {'Accept': 'application/json'},
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say('ok', 'Fatto. Ti scriviamo quando escono appunti nuovi.');
      }).catch(function () {
        say('no', 'Invio non riuscito. Riprova tra poco.');
      }).then(function () { btn.disabled = false; });
    });
  }
})();

/* --- contatore self-hosted (Cloudflare Worker) --- */
(function () {
  var U = 'https://appunti-counter.fazb97.workers.dev';
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
