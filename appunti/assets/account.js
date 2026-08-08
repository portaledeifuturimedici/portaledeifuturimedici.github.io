/* --- area account (Fase 1) --- */
(function () {
  var API = 'https://account.portaledeifuturimedici.com';
  if (!API) return;
  var CH = 'appunti-tok';           /* la sessione vive in localStorage */

  function tok() { try { return localStorage.getItem(CH) || ''; } catch (e) { return ''; } }
  function setTok(t) { try { t ? localStorage.setItem(CH, t) : localStorage.removeItem(CH); } catch (e) {} }

  function api(path, opz) {
    opz = opz || {};
    var h = { 'Content-Type': 'application/json' };
    if (tok()) h['Authorization'] = 'Bearer ' + tok();
    return fetch(API + path, {
      method: opz.method || 'GET', headers: h,
      body: opz.body ? JSON.stringify(opz.body) : undefined,
    }).catch(function () {
      /* La rete non ha risposto (offline, CORS, server giu'). NON e' la stessa
         cosa di "credenziali rifiutate": si marca l'errore, cosi' chi chiama
         non lo scambia per un token scaduto e non butta fuori l'utente. */
      var e = new Error('rete non raggiungibile'); e.rete = true; throw e;
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var err = new Error(d.error || 'errore');
          err.status = r.status;         /* 401 = davvero non autenticato */
          throw err;
        }
        return d;
      });
    });
  }

  var hex = function (b) {
    return [].map.call(new Uint8Array(b), function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
  };

  /* Derivazione lato browser: e' il lavoro pesante, e sta qui apposta.
     Il salt e' deterministico sull'email, cosi' due dispositivi ottengono lo
     stesso risultato dalla stessa password senza essersi mai parlati. */
  function deriva(email, password) {
    var enc = new TextEncoder();
    return api('/auth/params').then(function (p) {
      return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2',
                                     false, ['deriveBits'])
        .then(function (k) {
          return crypto.subtle.deriveBits({
            name: 'PBKDF2', hash: 'SHA-256',
            salt: enc.encode(p.client_salt + ':' + email.trim().toLowerCase()),
            iterations: p.client_iters,
          }, k, 256);
        }).then(hex);
    });
  }

  function messaggio(el, tipo, testo) {
    if (!el) return;
    el.className = 'form-msg show ' + tipo;
    el.textContent = testo;
  }

  /* ---- entra / registrati ---- */
  var form = document.getElementById('acc-form');
  if (form) {
    var msg = document.getElementById('acc-msg');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = form.querySelector('[name=email]').value.trim();
      var pw = form.querySelector('[name=password]').value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return messaggio(msg, 'no', 'Controlla l\'indirizzo email.');
      }
      if (pw.length < 10) {
        return messaggio(msg, 'no', 'La password deve avere almeno 10 caratteri.');
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      messaggio(msg, 'ok', 'Un attimo\u2026');
      deriva(email, pw).then(function (dk) {
        var modo = form.dataset.modo === 'login' ? '/auth/login' : '/auth/register';
        return api(modo, { method: 'POST', body: { email: email, dk: dk } });
      }).then(function (d) {
        if (d.token) setTok(d.token);
        /* il progresso gia' letto su questo dispositivo diventa suo */
        return migra().then(function () { location.href = 'profilo.html'; });
      }).catch(function (e) {
        messaggio(msg, 'no', e.message || 'Non ha funzionato. Riprova.');
        btn.disabled = false;
      });
    });
  }

  /* ---- migrazione del progresso locale al primo accesso ---- */
  function migra() {
    var items = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var m = k && k.match(/^appunti-letto:.*?(s[12][fcb]\d{2})\.html$/);
        if (m) {
          var v = parseInt(localStorage.getItem(k), 10);
          if (v >= 0) items.push({ ep: m[1], pct: Math.min(100, v) });
        }
      }
    } catch (e) {}
    if (!items.length) return Promise.resolve();
    return api('/progress/batch', { method: 'POST', body: { items: items } })
      .catch(function () { /* se fallisce si riprova al prossimo accesso */ });
  }

  /* ---- la curva di apprendimento ----
     Due segni sovrapposti, perche' raccontano due cose diverse:
       - l'AREA sotto la linea = quanto del programma hai coperto, nel tempo;
       - i TRATTINI in basso = i giorni in cui hai davvero aperto gli appunti.
     Il secondo e' quello che conta di piu': una curva che sale a scatti dopo
     lunghi vuoti e' un'altra storia rispetto a una che sale piano ogni giorno,
     e i trattini lo mostrano senza bisogno di spiegarlo.
     Niente librerie: e' SVG scritto a mano, ~40 righe, nessun download in piu'. */
  function disegnaCurva(d) {
    var box = document.getElementById('p-curva');
    if (!box) return;
    var giorni = d.giorni || [], tappe = (d.tappe || []).filter(function (t) {
      return t.updated_at;
    });
    if (giorni.length < 2) return;   /* con un giorno solo non c'e' una curva */

    var W = 640, H = 150, PB = 22;   /* PB = spazio in basso per i trattini */
    var t0 = Math.min.apply(null, tappe.map(function (t) { return t.updated_at; })
                                       .concat([nuovoT(giorni[0])]));
    var t1 = Math.max(nuovoT(d.oggi), t0 + 86400);
    function nuovoT(iso) { return Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 1000); }
    function x(t) { return ((t - t0) / (t1 - t0)) * (W - 8) + 4; }

    /* avanzamento cumulativo: ogni episodio toccato aggiunge la sua quota */
    var cum = 0, punti = [[x(t0), H - PB]];
    tappe.sort(function (a, b) { return a.updated_at - b.updated_at; })
         .forEach(function (t) {
      cum += (t.completed_at ? 100 : (t.pct || 0)) / 100;
      punti.push([x(t.updated_at), cum]);
    });
    var max = Math.max(cum, 1);
    var linea = punti.map(function (p, i) {
      var yy = i === 0 ? H - PB : (H - PB) - (p[1] / max) * (H - PB - 8);
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + yy.toFixed(1);
    }).join(' ');
    var area = linea + ' L' + x(t1).toFixed(1) + ' ' + (H - PB) + ' Z';

    var tratti = giorni.map(function (g) {
      var gx = x(nuovoT(g)).toFixed(1);
      return '<line x1="' + gx + '" y1="' + (H - PB + 6) + '" x2="' + gx +
             '" y2="' + (H - 6) + '" />';
    }).join('');

    /* Riassunto in parole: la curva si guarda, ma il numero si ricorda. */
    var coperti = cum.toFixed(1).replace('.', ',');
    var arco = Math.round((nuovoT(d.oggi) - nuovoT(giorni[0])) / 86400) + 1;
    var costanza = Math.round((giorni.length / Math.max(arco, 1)) * 100);

    box.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="acc-svg" role="img" ' +
      'aria-label="Curva di apprendimento: ' + coperti + ' episodi coperti in ' +
      giorni.length + ' giorni di studio">' +
      '<path class="acc-area" d="' + area + '"/>' +
      '<path class="acc-linea" d="' + linea + '"/>' +
      '<g class="acc-giorni">' + tratti + '</g></svg>' +
      '<p class="acc-legenda"><b>' + coperti + '</b> episodi coperti &middot; ' +
      '<b>' + giorni.length + '</b> giorni di studio su ' + arco +
      ' &middot; costanza <b>' + costanza + '%</b></p>' +
      '<p class="acc-nota">I trattini in basso sono i giorni in cui hai aperto ' +
      'gli appunti. Studiare poco ma spesso batte le maratone: e\u0300 la ' +
      'ripetizione distanziata nel tempo a fissare le cose.</p>';
  }

  /* ---- profilo ---- */
  var prof = document.getElementById('profilo');
  if (prof) {
    if (!tok()) { /* resta visibile il blocco "devi entrare" */ }
    else {
      api('/auth/me').then(function (d) {
        document.getElementById('profilo-vuoto').hidden = true;
        prof.hidden = false;
        document.getElementById('p-email').textContent = d.user.email;
        var dal = new Date(d.user.created_at * 1000);
        document.getElementById('p-dal').textContent =
          dal.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        return api('/progress');
      }).then(function (p) {
        var items = (p.items || []).filter(function (x) { return x.pct > 0 || x.completed_at; });
        document.getElementById('p-letti').textContent = String(items.length);
        if (!items.length) return;
        items.sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
        document.getElementById('p-progresso').innerHTML = items.map(function (x) {
          var pct = x.completed_at ? 100 : (x.pct || 0);
          return '<a class="acc-ep" href="../appunti/' + x.ep_short + '.html">' +
            '<span class="acc-ep-id">' + x.ep_short.toUpperCase() + '</span>' +
            '<span class="acc-barra"><i style="width:' + pct + '%"></i></span>' +
            '<span class="acc-pct">' + (x.completed_at ? 'letto' : pct + '%') + '</span></a>';
        }).join('');
      }).then(function () {
        return api('/progress/curva').then(disegnaCurva).catch(function () {});
      }).catch(function (e) {
        /* Si scarta la sessione SOLO se il server l'ha rifiutata (401). Se la
           rete non risponde il token resta dov'e': un backend momentaneamente
           giu' non deve sloggare nessuno — al ritorno della connessione si
           riprende senza dover reinserire la password. */
        if (e && e.status === 401) setTok('');
        var vuoto = document.getElementById('profilo-vuoto');
        vuoto.hidden = false;
        prof.hidden = true;
        if (e && e.rete) {
          vuoto.innerHTML = '<p>Non riesco a raggiungere il server in questo ' +
            'momento. Il tuo accesso e\u0300 salvo: riprova fra poco.</p>';
        }
      });

      document.getElementById('p-esci').addEventListener('click', function () {
        api('/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
          setTok(''); location.reload();
        });
      });
      document.getElementById('p-export').addEventListener('click', function () {
        api('/account/export').then(function (d) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)],
                                                { type: 'application/json' }));
          a.download = 'i-miei-dati.json';
          a.click();
        }).catch(function () {});
      });
      document.getElementById('p-elimina').addEventListener('click', function () {
        if (!confirm('Eliminare l\'account? I dati vengono cancellati, non ' +
                     'nascosti, e l\'operazione non si annulla.')) return;
        api('/account', { method: 'DELETE' }).then(function () {
          setTok(''); location.href = '../index.html';
        }).catch(function () {});
      });
    }
  }

  /* ---- conferma indirizzo (link ricevuto per email) ---- */
  var esito = document.getElementById('esito');
  if (esito) {
    var t = (location.search.match(/[?&]t=([0-9a-f]{64})/) || [])[1];
    if (!t) esito.innerHTML = '<p>Link non valido.</p>';
    else api('/auth/token', { method: 'POST', body: { token: t } })
      .then(function () {
        esito.innerHTML = '<p><b>Indirizzo confermato.</b> Ora puoi ' +
          '<a href="entra.html">entrare</a>.</p>';
      })
      .catch(function () {
        esito.innerHTML = '<p>Questo link e\u0300 scaduto o gia\u0300 usato. ' +
          'Puoi <a href="reimposta.html">chiederne uno nuovo</a>.</p>';
      });
  }

  /* ---- reimposta password (due fasi: chiedo il link / scelgo la password) ---- */
  var chiedi = document.getElementById('reset-chiedi');
  if (chiedi) {
    var tReset = (location.search.match(/[?&]t=([0-9a-f]{64})/) || [])[1];
    if (tReset) {
      document.getElementById('chiedi').hidden = true;
      document.getElementById('nuova').hidden = false;
      document.getElementById('reset-nuova').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var m2 = document.getElementById('nuova-msg');
        var pw = document.getElementById('r-pw').value;
        var em = document.getElementById('r-email2').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
          return messaggio(m2, 'no', 'Scrivi l\'indirizzo del tuo account.');
        }
        if (pw.length < 10) return messaggio(m2, 'no', 'Almeno 10 caratteri.');
        /* L'email serve QUI perche' il salt della derivazione e' costruito su
           di essa: senza, la password derivata non combacerebbe al prossimo
           accesso. Si chiede all'utente invece di farsela dire dal server: il
           token e' monouso e consumarlo due volte lo brucerebbe. */
        deriva(em, pw)
          .then(function (dk) {
            return api('/auth/token',
                       { method: 'POST', body: { token: tReset, dk: dk, email: em } });
          })
          .then(function () {
            messaggio(m2, 'ok', 'Password aggiornata. Ora puoi entrare.');
            setTimeout(function () { location.href = 'entra.html'; }, 1200);
          })
          .catch(function (e) { messaggio(m2, 'no', e.message || 'Link scaduto.'); });
      });
    } else {
      chiedi.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var m3 = document.getElementById('reset-msg');
        var email = document.getElementById('r-email').value.trim();
        api('/auth/reset-request', { method: 'POST', body: { email: email } })
          .then(function () {
            messaggio(m3, 'ok', 'Se esiste un account con questo indirizzo, ' +
                                'ti arriva un link fra poco.');
          })
          .catch(function () {
            messaggio(m3, 'ok', 'Se esiste un account con questo indirizzo, ' +
                                'ti arriva un link fra poco.');
          });
      });
    }
  }

  /* ---- sincronizzazione del progresso dalle pagine di lettura ---- */
  /* Non tocca il rendering: la barra si disegna gia' da localStorage in modo
     sincrono. Qui si SPINGE il dato al server, e basta. */
  var ep = (location.pathname.match(/(s[12][fcb]\d{2})\.html$/) || [])[1];
  if (ep && tok()) {
    var ultimo = -1, penna;
    window.addEventListener('scroll', function () {
      clearTimeout(penna);
      penna = setTimeout(function () {
        var h = document.documentElement;
        var pct = Math.round((h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100);
        pct = Math.max(0, Math.min(100, pct));
        if (pct <= ultimo + 4) return;     /* si scrive a scatti, non a ogni pixel */
        ultimo = pct;
        api('/progress/' + ep, { method: 'PUT', body: { pct: pct } }).catch(function () {});
      }, 1500);
    }, { passive: true });
  }
})();
