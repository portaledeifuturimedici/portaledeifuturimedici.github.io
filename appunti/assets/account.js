/* --- area account (Fase 1) --- */
(function () {
  var API = 'https://account.portaledeifuturimedici.com';
  /* La porta dell'area riservata, vista dalle pagine dell'account (/appunti/account/).
     E' VUOTA se chi costruisce non sa che /studio e' online: stessa regola
     fail-closed di barra e menu (`href_studio`), perche' un bottone che porta a
     un 404 e' peggio di un bottone che non c'e'. */
  var STUDIO = '../../studio/';
  if (!API) return;
  var CH = 'appunti-tok';           /* la sessione vive in localStorage */

  function tok() { try { return localStorage.getItem(CH) || ''; } catch (e) { return ''; } }
  /* setTok RIDISEGNA la barra: e' l'unico punto da cui la sessione cambia, e
     legarla qui e' l'unico modo perche' nessun ramo futuro se ne dimentichi
     (il 401 sul profilo, l'uscita, la cancellazione dell'account). */
  function setTok(t) {
    try { t ? localStorage.setItem(CH, t) : localStorage.removeItem(CH); } catch (e) {}
    /* Chi esce, viene sloggato o cancella l'account non deve lasciare nella
       scheda la chiave di /studio: il cancello la usa PRIMA di chiedere chi
       sei, e /studio resterebbe aperta al prossimo che usa quel browser
       (finding A10 della review del 2026-09-19). Stessa origine, stesso
       sessionStorage: e' la stessa voce che scrive il cancello. E il nome in
       barra se ne va col token. */
    if (!t) {
      try { sessionStorage.removeItem('studio-key'); } catch (e) {}
      setChi(null);
    }
    try { barraAccount(); } catch (e) {}
  }

  /* ---- CHI SEI, SCRITTO IN BARRA (utente 2026-09-19: «quando accedi vedi
     nella barra del sito il tuo nome e cognome o la tua email») ----
     Il nome si tiene sul dispositivo accanto al token, cosi' la barra lo
     scrive SUBITO a ogni pagina, senza aspettare il server. Si aggiorna da
     ogni risposta che porta l'utente (login, registrazione, /auth/me, profilo
     salvato) e sparisce col token: una barra non deve mai dire il nome di chi
     e' uscito. Si scrive con textContent, mai innerHTML: il nome lo digita
     l'utente, e trattarlo da HTML sarebbe una porta aperta. */
  var CHI = 'appunti-chi';
  function chi() { try { return localStorage.getItem(CHI) || ''; } catch (e) { return ''; } }
  function setChi(u) {
    try {
      var n = u ? String(u.nome || u.email || '').trim() : '';
      n ? localStorage.setItem(CHI, n) : localStorage.removeItem(CHI);
    } catch (e) {}
  }
  var chiedendo = false;

  /* ---- LA BARRA DEVE DIRE SE SEI DENTRO (2026-09-16) ----
     Fino a oggi non lo diceva: la voce era «Entra» su OGNI pagina anche a
     sessione viva, e qui c'era perfino un commento che dichiarava di non
     toccare il rendering. Conseguenza misurata sul sito vivo: il token
     sopravvive alla navigazione (localStorage, stessa origine) e la sessione
     lato server dura 90 giorni, ma chi cambiava pagina vedeva «Entra», ci
     cliccava, trovava il modulo e concludeva di essere stato buttato fuori.
     Non era la sessione a cadere: era l'interfaccia a non dirla mai.
     Gli `a[data-profilo]` sono DUE (la pillola in barra e la voce nel
     pannello, perche' sotto i 920 px la barra si nasconde): si aggiornano
     tutti, per selettore e non per id. */
  function barraAccount() {
    var dentro = !!tok();
    var voci = document.querySelectorAll('a[data-profilo]');
    for (var i = 0; i < voci.length; i++) {
      var a = voci[i];
      if (!a.getAttribute('data-entra')) a.setAttribute('data-entra', a.getAttribute('href'));
      if (dentro) {
        a.setAttribute('href', a.getAttribute('data-profilo'));
        a.innerHTML = '<span class="pallino" aria-hidden="true"></span><span class="nav-acc-nome"></span>';
        a.lastChild.textContent = chi() || 'Profilo';
        a.setAttribute('title', 'Sei entrato' + (chi() ? ' come ' + chi() : '') +
                       ': apri il tuo profilo');
      } else {
        a.setAttribute('href', a.getAttribute('data-entra'));
        a.textContent = 'Entra';
        a.removeAttribute('title');
      }
    }
    /* Sessione di prima di questa versione: il token c'e', il nome no. Lo si
       chiede UNA volta; se il server dice 401 la sessione era gia' morta. */
    if (dentro && !chi() && !chiedendo) {
      chiedendo = true;
      api('/auth/me').then(function (d) {
        if (d && d.user) { setChi(d.user); barraAccount(); }
      }).catch(function (e) { if (e && e.status === 401) setTok(''); });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', barraAccount);
  } else {
    barraAccount();
  }

  /* DOVE SI TORNA DOPO ESSERE ENTRATI (2026-09-18). Il cancello di /studio
     manda qui con `?torna=/studio/...`: chi voleva aprire una dispensa deve
     ritrovarsi sulla dispensa, non sul profilo, o il giro «clicco, entro, leggo»
     diventa «clicco, entro, e poi devo ricordarmi dov'ero».
     Si accetta SOLO un percorso dello stesso sito. Un rinvio che prende
     l'indirizzo da un parametro e' il classico modo di far atterrare qualcuno
     su una pagina falsa col nostro dominio nella barra: chi entra da un link
     ricevuto per messaggio non deve poter essere portato altrove.
     COME: si RISOLVE l'indirizzo come lo risolvera' il browser e si controlla
     il RISULTATO (stessa origine). Il filtro di prima guardava la stringa prima
     che il parser togliesse TAB e a-capo: '?torna=/%09/evil.example' passava
     e diventava //evil.example, un altro dominio (finding A3 della review del
     2026-09-19). */
  function dopoEntrato() {
    var t = '';
    try { t = new URLSearchParams(location.search).get('torna') || ''; } catch (e) {}
    if (t && t.charAt(0) === '/') {
      try {
        var u = new URL(t, location.href);
        /* Si torna all'URL ASSOLUTO gia' verificato, non al suo pathname: con
           `/.//evil.example` il pathname normalizzato e' `//evil.example`, che
           riusato come link relativo diventa un altro DOMINIO (audit 2026-09-24,
           ACC-1). u.href porta con se' l'origine appena controllata. */
        if (u.origin === location.origin) return u.href;
      } catch (e) {}
    }
    return 'profilo.html';
  }

  /* I link fra le pagine d'ingresso si portano dietro `?torna=`: chi arriva dal
     cancello di /studio e sceglie «Registrati» o «Password dimenticata» deve
     tornare comunque alla pagina che voleva aprire (finding A13/D19). */
  (function () {
    if (!/[?&]torna=/.test(location.search)) return;
    var q = location.search;
    var alt = document.querySelectorAll('.acc-alt a[href$=".html"]');
    for (var i = 0; i < alt.length; i++) {
      var h = alt[i].getAttribute('href');
      if (/^(entra|registrati|reimposta)\.html$/.test(h)) alt[i].setAttribute('href', h + q);
    }
  })();

  /* Chi ha gia' la sessione non deve rivedere il modulo d'accesso: e' la
     seconda meta' dello stesso difetto. Misurato col token presente,
     `entra.html` mostrava di nuovo il modulo, titolo «Bentornato».
     MA un token nel browser non e' una sessione viva: prima si chiede al
     server. Senza questa domanda un token scaduto rimandava subito a ?torna=
     (il cancello di /studio), che rimandava qui: un giro senza uscita (finding
     A2). Su 401 il token si butta e resta il modulo; se la rete non risponde
     si resta qui col modulo, senza sloggare nessuno. */
  if (tok() && /\/(entra|registrati)\.html$/.test(location.pathname)) {
    api('/auth/me').then(function () {
      location.replace(dopoEntrato());
    }).catch(function (e) {
      if (e && e.status === 401) setTok('');
    });
  }

  /* Tutto cio' che arriva dal server e finisce in una pagina passa da qui:
     le email e le note dei pagamenti vengono da FUORI (chi dona su Ko-fi
     sceglie l'email che vuole), e la pagina dello staff le mostra. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function giorno(ts) {
    return ts ? new Date(ts * 1000).toLocaleDateString('it-IT',
      { day: 'numeric', month: 'long', year: 'numeric' }) : 'per sempre';
  }
  /* Il codice sconto su Whop: cosa scrivere, dove, fino a quando. Il codice viene
     dal Worker ma passa comunque da esc(): e' testo, mai HTML. */
  function codiceSconto(perc, c) {
    var fino = c.scade_at ? ', fino al ' + new Date(c.scade_at * 1000).toLocaleDateString('it-IT',
      { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    return '<p>Il tuo <b>sconto sostenitore del ' + esc(perc) + '%</b>: usa il codice ' +
           '<b class="dato">' + esc(c.codice) + '</b> nel campo del codice sconto sulla ' +
           'pagina di pagamento di Whop. Vale una volta sola' + esc(fino) + '.</p>';
  }
  function euro(cent, valuta) {
    return cent == null ? '?' : (cent / 100).toFixed(2).replace('.', ',') + ' ' + (valuta || '');
  }

  /* ---- IL BOTTONE «ABBONATI» (2026-09-19, Stripe per gli acquisti) ----
     Il checkout lo crea il Worker per l'account ENTRATO, cosi' il pagamento
     torna all'account giusto senza passare dall'email. Chi non e' entrato
     segue il link del bottone: la pagina d'ingresso, con ritorno qui. */
  var abb = document.querySelectorAll('[data-abbonati]');
  for (var ia = 0; ia < abb.length; ia++) {
    abb[ia].addEventListener('click', function (ev) {
      if (!tok()) return;
      ev.preventDefault();
      var el = ev.currentTarget;
      el.setAttribute('aria-busy', 'true');
      /* il PIANO lo dice il bottone (2026-09-24); senza, il Worker vende il mensile */
      api('/pagamenti/stripe/checkout', { method: 'POST',
          body: { piano: el.getAttribute('data-piano') || 'mese' } }).then(function (d) {
        if (String(d.url || '').indexOf('https://checkout.stripe.com/') !== 0) throw new Error();
        location.href = d.url;
      }).catch(function (e) {
        el.removeAttribute('aria-busy');
        if (e && e.status === 401) { setTok(''); location.href = el.getAttribute('href'); return; }
        if (e && e.status === 409) { location.href = el.getAttribute('data-profilo') || '/'; return; }
        alert((e && e.message) || 'Il pagamento non è disponibile adesso: riprova fra poco.');
      });
    });
  }

  /* ---- I BOTTONI WHOP (2026-09-25) ----
     Il link del bottone e' il piano su Whop, e basta a comprare: il Worker
     riconosce chi paga dall'email. Per chi e' ENTRATO si fa meglio: il Worker
     crea un checkout che porta l'id dell'account (metadata), cosi' l'email
     usata su Whop non conta piu'. La scheda si apre SUBITO, dentro il clic
     (dopo la risposta del server il browser la bloccherebbe come popup), e
     riceve l'indirizzo quando arriva. Se il Worker non offre il checkout
     legato (404: chiave Whop non ancora configurata), se non risponde o se
     risponde con un indirizzo che non e' di Whop, si segue il link nudo:
     il pagamento resta possibile, solo agganciato per email. */
  var wh = document.querySelectorAll('a[data-whop]');
  for (var iw = 0; iw < wh.length; iw++) {
    wh[iw].addEventListener('click', function (ev) {
      if (!tok()) return;
      ev.preventDefault();
      var el = ev.currentTarget, nudo = el.getAttribute('href');
      var w = null;
      try { w = window.open('', '_blank'); } catch (e) {}
      if (w) { try { w.opener = null; } catch (e) {} }
      function vai(u) {
        if (w && !w.closed) { w.location.href = u; } else { location.href = u; }
      }
      function chiudi() { if (w) { try { w.close(); } catch (e) {} } }
      el.setAttribute('aria-busy', 'true');
      api('/pagamenti/whop/checkout', { method: 'POST',
          body: { piano: el.getAttribute('data-piano') || 'mese' } }).then(function (d) {
        el.removeAttribute('aria-busy');
        var u = String(d.url || '');
        vai(u.indexOf('https://whop.com/checkout/') === 0 ? u : nudo);
      }).catch(function (e) {
        el.removeAttribute('aria-busy');
        /* hai gia' un mensile Whop che addebita: un secondo mensile pagherebbe due
           volte al mese (Worker, `mensileWhopVivo`) */
        if (e && e.status === 409 && e.dati && e.dati.gia_abbonato) {
          chiudi();
          alert((e.message && e.message !== 'errore') ? e.message
                : 'Hai già un abbonamento mensile attivo: lo gestisci dal tuo account Whop.');
          return;
        }
        /* hai gia' il per sempre: niente secondo acquisto, si va al profilo */
        if (e && e.status === 409) {
          chiudi(); location.href = el.getAttribute('data-profilo') || '/'; return;
        }
        /* account bloccato: comprare non lo sbloccherebbe */
        if (e && e.status === 403) {
          chiudi(); alert((e && e.message) || 'Il tuo account non può fare acquisti.'); return;
        }
        if (e && e.status === 401) setTok('');
        vai(nudo);
      });
    });
  }

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
          err.dati = d;                  /* es. le concessioni in attesa di un 404 */
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
      /* il campo nome esiste solo nel modulo di registrazione */
      var camponome = form.querySelector('[name=nome]');
      var nome = camponome ? camponome.value.trim() : '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return messaggio(msg, 'no', 'Controlla l\'indirizzo email.');
      }
      if (camponome && nome.length < 2) {
        return messaggio(msg, 'no', 'Scrivi come ti chiami.');
      }
      if (pw.length < 10) {
        return messaggio(msg, 'no', 'La password deve avere almeno 10 caratteri.');
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      messaggio(msg, 'ok', 'Un attimo\u2026');
      deriva(email, pw).then(function (dk) {
        var modo = form.dataset.modo === 'login' ? '/auth/login' : '/auth/register';
        var corpo = { email: email, dk: dk };
        /* Il nome viaggia SOLO alla registrazione. In login non si manda: il
           server non lo leggerebbe, e spedire un dato personale a una rotta
           che non lo usa e' raccolta senza scopo. */
        if (camponome) corpo.nome = nome;
        return api(modo, { method: 'POST', body: corpo });
      }).then(function (d) {
        /* Iscrizione con un indirizzo GIA' registrato: il server risponde 202
           senza token e scrive a quell'indirizzo (non dice chi e' iscritto, per
           non farlo scoprire a chi prova indirizzi a caso). Qui lo si DICE,
           invece di navigare in silenzio verso una pagina che poi chiederebbe
           di entrare (finding A7 della review del 2026-09-19). */
        if (!d.token) {
          messaggio(msg, 'ok', 'Se questo indirizzo e\u0300 gia\u0300 registrato ti ' +
                    'abbiamo scritto: controlla la posta, oppure entra con la tua password.');
          btn.disabled = false;
          return;
        }
        if (d.user) setChi(d.user);
        setTok(d.token);
        /* ACC-9 (audit 2026-09-24): il nuovo iscritto deve sapere che c'e' una mail
           da aprire — o che NON e' partita, e allora non la aspetta invano. Senza
           conferma non si agganciano ne' pagamenti ne' accessi dati in anticipo. */
        if (camponome && d.mail_inviata === false) {
          return migra().then(function () {
            messaggio(msg, 'no', 'Account creato, ma la mail di conferma non e\u0300 ' +
                      'partita. Rimandala dal tuo profilo.');
            var va = document.createElement('a');
            va.className = 'btn btn-ghost'; va.href = dopoEntrato();
            va.textContent = 'Continua \u2192';
            msg.appendChild(va);
          });
        }
        if (camponome) {
          messaggio(msg, 'ok', 'Account creato. Ti abbiamo scritto a ' + email +
                    ': apri il link entro due giorni per confermare l\u2019indirizzo.');
          return migra().then(function () {
            setTimeout(function () { location.href = dopoEntrato(); }, 2200);
          });
        }
        /* il progresso gia' letto su questo dispositivo diventa suo */
        return migra().then(function () { location.href = dopoEntrato(); });
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

  /* ---- i tre campi di profilo (nome / universita / anno) ----
     Il modulo LEGGE da /auth/me e SALVA con PUT /account/profilo. Due regole
     che non sono cosmetiche:
       - il campo vuoto si manda come stringa vuota, ed e' il server a
         trasformarla in NULL: e' cosi' che un dato facoltativo si puo'
         TOGLIERE. Un campo che una volta scritto non si cancella piu' non e'
         facoltativo, e prometterlo nell'informativa sarebbe falso.
       - `null` in arrivo diventa campo vuoto, non la stringa 'null': chi si e'
         iscritto prima che questi campi esistessero ha NULL, ed e' la
         maggioranza degli utenti finche' non ripassano di qui. */
  var CAMPI_ANAG = ['nome', 'universita', 'anno_corso'];

  function riempiAnagrafica(u) {
    var f = document.getElementById('p-anagrafica');
    if (!f || !u) return;
    CAMPI_ANAG.forEach(function (c) {
      var el = f.querySelector('[name=' + c + ']');
      if (el) el.value = u[c] == null ? '' : String(u[c]);
    });
  }

  function salvaAnagrafica(ev) {
    ev.preventDefault();
    var f = ev.currentTarget, m = document.getElementById('p-anag-msg');
    var btn = f.querySelector('button[type=submit]');
    var corpo = {};
    CAMPI_ANAG.forEach(function (c) {
      var el = f.querySelector('[name=' + c + ']');
      if (el) corpo[c] = el.value.trim();
    });
    /* NOME VUOTO: non si blocca il salvataggio, si OMETTE il campo.
       Chi si e' iscritto prima che questo campo esistesse ha il nome a NULL:
       se il modulo rifiutasse di salvare finche' non lo compila, non potrebbe
       scrivere l'universita' senza prima dare il nome — cioe' un campo
       obbligatorio terrebbe in ostaggio due campi facoltativi, ed e' il modo
       classico di perdere proprio il dato che si voleva raccogliere.
       Omettere invece di mandare '' significa anche non CANCELLARE per sbaglio
       un nome gia' salvato.
       LIMITE, detto: da questo modulo il nome si cambia, non si svuota. Per
       togliere tutto c'e' «Elimina l'account», che cancella davvero. */
    var senzaNome = !corpo.nome;
    if (senzaNome) delete corpo.nome;
    if (!Object.keys(corpo).length) {
      return messaggio(m, 'no', 'Scrivi almeno un campo prima di salvare.');
    }
    btn.disabled = true;
    messaggio(m, 'ok', 'Salvo\u2026');
    api('/account/profilo', { method: 'PUT', body: corpo }).then(function (d) {
      /* Si ridisegna dalla RISPOSTA, non da quello che si e' digitato: il
         server normalizza e taglia, e mostrare l'input invece del salvato
         farebbe credere di aver salvato una cosa diversa da quella che c'e'. */
      riempiAnagrafica(d.user);
      setChi(d.user); barraAccount();
      messaggio(m, 'ok', senzaNome && !d.user.nome
        ? 'Salvato. Manca solo il nome: aggiungilo quando vuoi.'
        : 'Salvato.');
    }).catch(function (e) {
      /* Stessa regola del resto della pagina: si sloggia SOLO su 401, mai su
         un errore di rete. Un server momentaneamente giu' non deve costringere
         nessuno a rifare la password. */
      if (e && e.status === 401) {
        setTok('');
        messaggio(m, 'no', 'La sessione e\u0300 scaduta: entra di nuovo.');
      } else if (e && e.rete) {
        messaggio(m, 'no', 'Non riesco a raggiungere il server. Riprova fra poco: ' +
                           'quello che hai scritto e\u0300 ancora qui.');
      } else {
        messaggio(m, 'no', e.message || 'Non ha funzionato. Riprova.');
      }
    }).then(function () { btn.disabled = false; });
  }

  /* ---- DA RIPASSARE, E COSA SBAGLI (2026-09-19) ----
     I due numeri vengono da `study_state` e `study_tag_stats`, che i motori di
     studio riempiono da quando esiste la coda degli eventi (site_build,
     `_coda_studio_js`). Prima di allora le tabelle erano vuote: per questo il
     riquadro dice «qui comparira'» invece di un bel zero, che sembrerebbe un
     risultato invece che l'assenza di dati. */
  function mostraRipasso(d) {
    var box = document.getElementById('p-ripasso');
    if (!box) return;
    var n = d && d.quanti ? d.quanti : 0;
    if (!n) {
      box.innerHTML = '<p class="acc-nota">Niente in scadenza. Qui compaiono le ' +
        'carte e le domande che il ripasso ti rimette davanti quando è il ' +
        'momento: si riempie mentre studi nell’area riservata.</p>';
      return;
    }
    var tipi = d.per_tipo || {}, pezzi = [];
    if (tipi.flashcard) pezzi.push(tipi.flashcard + (tipi.flashcard === 1 ? ' carta' : ' carte'));
    if (tipi.quiz) pezzi.push(tipi.quiz + (tipi.quiz === 1 ? ' domanda' : ' domande'));
    if (tipi.esercizio) pezzi.push(tipi.esercizio + (tipi.esercizio === 1 ? ' esercizio' : ' esercizi'));
    box.innerHTML = '<p><b>' + n + (n === 1 ? ' cosa da ripassare' : ' cose da ripassare') +
      ' oggi</b>' + (pezzi.length ? ': ' + esc(pezzi.join(', ')) : '') + '.</p>' +
      '<p class="acc-nota"><a href="../../studio/">Apri l’area riservata</a> e ' +
      'riprendi da dove eri.</p>';
  }

  function mostraSbagli(d) {
    var box = document.getElementById('p-ripasso');
    if (!box) return;
    var righe = (d && d.argomenti) || [];
    if (!righe.length) return;      /* sotto i cinque tentativi e' rumore */
    var top = righe.slice(0, 3).map(function (x) {
      var tot = (x.ok || 0) + (x.ko || 0) + (x.quasi || 0);
      var pct = tot ? Math.round((x.ko || 0) * 100 / tot) : 0;
      return '<li>' + esc(x.tag) + ' <span>' + pct + '% sbagliate su ' + tot +
        ' tentativi</span></li>';
    }).join('');
    box.innerHTML += '<p class="acc-nota" style="margin-top:12px">Gli argomenti ' +
      'che ti costano di più:</p><ul class="acc-sbagli">' + top + '</ul>';
  }

  /* ---- I TUOI DISPOSITIVI (2026-09-19) ----
     `/auth/me` restituisce gia' le sessioni aperte (etichetta, ultimo
     accesso): il profilo non le mostrava, quindi chi aveva lasciato l'accesso
     aperto sul computer della biblioteca non aveva un posto da cui chiuderlo.
     Nessuna rotta nuova: si disegna cio' che c'e' e si usa `/auth/logout-all`,
     che esisteva e non era esposto. */
  function mostraDispositivi(sessioni) {
    var box = document.getElementById('p-dispositivi');
    if (!box) return;
    sessioni = sessioni || [];
    if (!sessioni.length) {
      box.innerHTML = '<p class="acc-nota">Nessuna sessione aperta.</p>';
      return;
    }
    /* L'etichetta la manda il browser quando entri: puo' mancare, e in quel
       caso non si inventa un nome. Si scrive con `esc`, perche' e' testo che
       arriva dal client. */
    box.innerHTML = sessioni.map(function (s) {
      return '<div class="acc-disp-r"><b>' +
        esc(s.client_label || 'Dispositivo senza nome') + '</b><span>ultimo accesso ' +
        esc(giorno(s.last_seen_at) || 'sconosciuto') + '</span></div>';
    }).join('');
  }

  /* ---- IL TUO ACCESSO (2026-09-19) ----
     Il profilo DICE cio' che il cancello di /studio decide: prima chi aveva un
     pagamento fermo per l'email non confermata lo scopriva solo come «vai a
     pagare» (finding A14 della review). */
  var abbStripe = false;
  function mostraAccesso(d) {
    var box = document.getElementById('p-accesso');
    if (!box) return;
    var diritti = d.entitlements || [], righe = [];
    var tutto = diritti.filter(function (x) { return x.scope === 'all'; });
    if (tutto.length) {
      var perSempre = tutto.some(function (x) { return !x.expires_at; });
      var fino = Math.max.apply(null, tutto.map(function (x) { return x.expires_at || 0; }));
      righe.push('<p><b>Pacchetto completo attivo</b> ' +
                 (perSempre ? 'per sempre' : 'fino al ' + esc(giorno(fino))) + '.</p>');
      /* Leggere «ce l'hai» e non avere da qui un modo per aprirlo e' il difetto
         che si vede il primo giorno: qui c'e' la porta. */
      if (STUDIO) {
        righe.push('<p><a class="btn btn-primary" href="' + STUDIO +
                   '">Apri l&rsquo;area riservata &rarr;</a></p>');
      }
    } else if (diritti.length) {
      /* Niente bottone per /studio qui: il cancello apre solo col pacchetto
         INTERO (`/studio/chiave` chiede lo scope 'all'), e un bottone verso una
         porta che rifiuta e' peggio di nessuno (verifica di ACC-11). */
      righe.push('<p>Hai accesso a: ' +
                 esc(diritti.map(function (x) { return x.scope; }).join(', ')) + '.</p>');
    } else {
      righe.push('<p>Non hai ancora il pacchetto. <a href="/#pacchetto">Vedi come ' +
                 'abbonarti</a>.</p>');
    }
    if (d.pagamenti_in_attesa) {
      righe.push("<p><b>Abbiamo ricevuto un tuo pagamento</b>: si attiva appena confermi " +
                 "l'indirizzo email.</p>");
    }
    if (d.user && !d.user.email_verified) {
      righe.push('<p class="acc-nota">Il tuo indirizzo non è ancora confermato: ' +
                 "serve a recuperare la password e ad attivare ciò che paghi o ricevi. " +
                 'Il bottone per rimandare il link sta qui sopra, accanto al tuo indirizzo.</p>');
    }
    /* «si applica da solo» solo se il Worker lo applica davvero (checkout e
       coupon accesi, finding Z6): altrimenti e' una promessa senza nessuno dietro */
    if (d.sconto) {
      /* SU WHOP (2026-09-25, «ok codice sconto»): il checkout non accetta uno sconto
         dal Worker, quindi lo sconto diventa un CODICE monouso che il Worker crea su
         Whop per questo account e che si scrive nel campo del codice sconto della
         pagina di pagamento. `sconto_codice` = gia' creato; `sconto_whop` = si puo'
         creare adesso (bottone). */
      if (d.sconto_codice && d.sconto_codice.codice) {
        righe.push(codiceSconto(d.sconto.percentuale, d.sconto_codice));
      } else if (d.sconto_whop) {
        righe.push('<p>Hai uno <b>sconto sostenitore del ' + esc(d.sconto.percentuale) +
                   '%</b> sul primo acquisto del pacchetto. <button class="btn btn-ghost" ' +
                   'type="button" id="p-sconto">Crea il mio codice sconto</button></p>');
      } else {
        righe.push('<p>Hai uno <b>sconto sostenitore del ' + esc(d.sconto.percentuale) +
                   '%</b> sul primo acquisto del pacchetto' + (d.sconto_applicabile
                     ? ': si applica da solo quando ti abboni.</p>' : '.</p>'));
      }
    }
    /* chi paga con Stripe deve poter disdire da qui (finding Y1) */
    abbStripe = !!d.abbonamento_stripe;
    if (abbStripe) {
      righe.push('<p><button class="btn btn-ghost" type="button" id="p-portale">' +
                 "Gestisci o disdici l'abbonamento</button></p>");
    }
    if (/[?&]pagamento=ok/.test(location.search)) {
      righe.unshift('<p><b>Grazie!</b> Il pagamento si attiva appena il servizio di ' +
                    'pagamento ce lo conferma, di solito in pochi secondi: se qui non lo ' +
                    'vedi ancora, ricarica la pagina fra poco.</p>');
    }
    box.innerHTML = righe.join('');
    if (d.ruolo === 'staff') document.getElementById('p-staff').hidden = false;
    var bs = document.getElementById('p-sconto');
    if (bs) bs.addEventListener('click', function () {
      bs.disabled = true;
      api('/pagamenti/whop/sconto', { method: 'POST', body: {} }).then(function (r) {
        if (!r || !r.codice) throw new Error();
        var p = bs.parentNode;
        p.outerHTML = codiceSconto(r.percentuale, r);
      }).catch(function (e) {
        bs.disabled = false;
        if (e && e.status === 401) { setTok(''); location.href = 'entra.html'; return; }
        bs.textContent = (e && e.message && e.message !== 'errore') ? e.message
                         : 'Non ha funzionato: riprova fra poco';
      });
    });
    var bp = document.getElementById('p-portale');
    if (bp) bp.addEventListener('click', function () {
      bp.disabled = true;
      api('/pagamenti/stripe/portale', { method: 'POST', body: {} }).then(function (r) {
        /* si va solo da Stripe: un indirizzo diverso non e' il portale */
        if (String(r.url || '').indexOf('https://billing.stripe.com/') !== 0) throw new Error();
        location.href = r.url;
      }).catch(function (e) {
        bp.disabled = false;
        if (e && e.status === 401) { setTok(''); location.href = 'entra.html'; return; }
        bp.textContent = (e && e.message) || 'Non ha funzionato: riprova fra poco';
      });
    });
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
        /* CONFERMA DELL'EMAIL (2026-09-19): l'accesso dato prima dell'iscrizione
           si attiva solo a indirizzo confermato, e il link vale due giorni. Chi non
           ha confermato lo vede qui, e puo' farsi rimandare la mail. */
        var vf = document.getElementById('p-verif');
        if (vf) vf.textContent = d.user.email_verified ? 'confermata' : 'da confermare';
        var vbox = document.getElementById('p-verif-box');
        if (vbox && !d.user.email_verified) {
          vbox.hidden = false;
          var vbtn = document.getElementById('p-verif-btn');
          var vmsg = document.getElementById('p-verif-msg');
          vbtn.addEventListener('click', function () {
            vbtn.disabled = true;
            api('/auth/conferma-di-nuovo', { method: 'POST' }).then(function (r) {
              messaggio(vmsg, 'ok', r.gia_confermata
                ? 'Il tuo indirizzo risulta già confermato.'
                : 'Fatto: controlla la posta (anche lo spam). Il link vale due giorni.');
            }).catch(function (e) {
              messaggio(vmsg, 'no', (e && e.message) || 'Non è partita. Riprova.');
              vbtn.disabled = false;
            });
          });
        }
        setChi(d.user); barraAccount();
        var dal = new Date(d.user.created_at * 1000);
        document.getElementById('p-dal').textContent =
          dal.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        riempiAnagrafica(d.user);
        mostraAccesso(d);
        mostraDispositivi(d.sessions);
        /* Due letture in piu', nessuna scrittura: il riquadro del ripasso e
           gli argomenti che costano di piu'. Se il Worker e' vecchio o le
           tabelle non ci sono, restano muti invece di rompere la pagina.
           Le due richieste partono INSIEME (sono indipendenti); si disegnano
           nello stesso ordine di prima, e un errore delle statistiche resta
           muto come prima (`ps.catch` evita solo l'avviso di promessa
           rifiutata mentre si aspetta il ripasso). */
        var pr = api('/studio/ripasso'), ps = api('/studio/statistiche');
        ps.catch(function () {});
        pr.then(mostraRipasso).then(function () {
          return ps.then(mostraSbagli);
        }).catch(function () {
          /* ACC-4 (audit 2026-09-24): col Worker vecchio la rotta non esiste e il
             riquadro restava su «Controllo...» per sempre. Si dice com'e'. */
          var bx = document.getElementById('p-ripasso');
          if (bx && /Controllo/.test(bx.textContent)) {
            bx.innerHTML = '<p class="acc-nota">Il ripasso non e\u0300 disponibile in ' +
                           'questo momento: riprova piu\u0300 tardi.</p>';
          }
        });
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

      var fAnag = document.getElementById('p-anagrafica');
      if (fAnag) fAnag.addEventListener('submit', salvaAnagrafica);
      document.getElementById('p-esci').addEventListener('click', function () {
        api('/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
          setTok(''); location.reload();
        });
      });
      /* Chiude TUTTE le sessioni, questa compresa: e' la cosa da fare quando
         hai lasciato l'accesso aperto sul computer di qualcun altro. */
      var bTutti = document.getElementById('p-esci-tutti');
      if (bTutti) bTutti.addEventListener('click', function () {
        bTutti.disabled = true;
        messaggio(document.getElementById('p-disp-msg'), 'ok',
                  'Chiudo tutte le sessioni…');
        api('/auth/logout-all', { method: 'POST' }).catch(function () {})
          .then(function () { setTok(''); location.reload(); });
      });
      document.getElementById('p-export').addEventListener('click', function () {
        api('/account/export').then(function (d) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)],
                                                { type: 'application/json' }));
          a.download = 'i-miei-dati.json';
          a.click();
        }).catch(function (e) {
          /* mai in silenzio (finding A17): chi chiede i propri dati deve sapere
             se li ha avuti. Si sloggia SOLO su 401, come nel resto della pagina. */
          var scaduta = !!(e && e.status === 401);
          if (scaduta) setTok('');
          alert(scaduta ? 'La sessione e\u0300 scaduta: entra di nuovo.'
                        : 'Non ha funzionato: riprova fra poco.');
        });
      });
      document.getElementById('p-elimina').addEventListener('click', function () {
        if (!confirm('Eliminare l\'account? I dati vengono cancellati, non ' +
                     'nascosti, e l\'operazione non si annulla.' +
                     (abbStripe ? ' Il tuo abbonamento viene disdetto subito: niente ' +
                                  'altri addebiti.' : ''))) return;
        api('/account', { method: 'DELETE' }).then(function () {
          setTok(''); location.href = '../index.html';
        }).catch(function (e) {
          /* una richiesta di cancellazione (GDPR, art. 17) non puo' restare
             senza risposta (finding A17): o e' fatta, o lo si dice */
          var scaduta = !!(e && e.status === 401);
          if (scaduta) setTok('');
          alert(scaduta ? 'La sessione e\u0300 scaduta: entra di nuovo e riprova.'
                        : (e && e.status === 502 && e.message) ||
                          "L'account NON e\u0300 stato eliminato: riprova fra poco.");
        });
      });
    }
  }

  /* ---- conferma indirizzo (link ricevuto per email) ---- */
  var esito = document.getElementById('esito');
  if (esito) {
    var t = (location.search.match(/[?&]t=([0-9a-f]{64})/) || [])[1];
    if (!t) esito.innerHTML = '<p>Link non valido.</p>';
    else api('/auth/token', { method: 'POST', body: { token: t } })
      .then(function (d) {
        /* Se alla conferma e' partito un accesso dato in anticipo (o un
           pagamento in attesa), lo si dice: e' la ragione per cui chi
           arriva qui ha cliccato. */
        var aperto = d && ((d.accessi_attivati || 0) + (d.pagamenti_agganciati || 0)) > 0;
        esito.innerHTML = '<p><b>Indirizzo confermato.</b> ' + (aperto
          ? 'Il tuo accesso al pacchetto ora e\u0300 attivo. '
          : '') + 'Ora puoi <a href="entra.html">entrare</a>.</p>';
      })
      .catch(function (e) {
        /* ACC-10 (audit 2026-09-24): senza rete non si sa se il link e' stato
           usato (il server lo consuma prima di rispondere), quindi non si dice
           «scaduto»: si dice cosa fare in entrambi i casi. */
        if (e && e.rete) {
          esito.innerHTML = '<p>Non riesco a raggiungere il server. Ricarica la ' +
            'pagina fra poco. Se poi dice che il link e\u0300 gia\u0300 usato, ' +
            '<a href="entra.html">entra</a>: nel tuo profilo vedi se l&rsquo;indirizzo ' +
            'risulta confermato.</p>';
          return;
        }
        /* Il link di conferma vale due giorni: chi lo apre tardi ne chiede un
           altro dal profilo, non dal recupero password. */
        esito.innerHTML = '<p>Questo link e\u0300 scaduto o gia\u0300 usato. ' +
          'Entra e, dal <a href="profilo.html">tuo profilo</a>, fatti mandare ' +
          'una mail di conferma nuova.</p>';
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

  /* ---- LA PAGINA DELLO STAFF (2026-09-19, «regolabile da chi lavora al sito») ----
     La pagina e' uguale per tutti: decide il Worker, che risponde solo a un
     account col ruolo staff. Qui si fa soltanto cio' che farebbe
     account_admin.py, con la sessione dello staff invece del token. */
  var sp = document.getElementById('staff');
  var sEmail = '';
  function sMsg(tipo, t) { messaggio(document.getElementById('s-msg'), tipo, t); }
  function errore(e) { return (e && e.message) || 'Non ha funzionato: riprova.'; }
  /* Sessione scaduta a meta' lavoro: si rientra e si torna qui (finding Z11).
     Un 404 SENZA «utente non trovato» e' il Worker che non riconosce piu' lo
     staff (ruolo tolto): lo si dice, invece di «nessun account». */
  function sGuasto(e) {
    if (e && e.status === 401) {
      setTok('');
      location.href = 'entra.html?torna=' + encodeURIComponent(location.pathname);
      return true;
    }
    if (e && e.status === 404 && e.message !== 'utente non trovato') {
      sMsg('no', 'Il tuo account non risulta piu\u0300 dello staff: chiedi a chi amministra.');
      return true;
    }
    return false;
  }
  function cerca(email) {
    sEmail = email;
    return api('/admin/entitlements?email=' + encodeURIComponent(email)).then(function (d) {
      var r = ['<p><b>' + esc(d.email) + '</b>' +
               (d.email_verificata ? '' : ' &middot; email NON confermata') + '</p>'];
      var ent = d.entitlements || [];
      r.push(ent.length ? '<ul class="acc-lista">' + ent.map(function (x) {
        return '<li>' + esc(x.scope) + ' &middot; fino al ' + esc(giorno(x.expires_at)) +
               ' &middot; ' + esc(x.source) + ' <button class="btn btn-ghost" type="button"' +
               ' data-revoca="' + esc(x.id) + '">Togli</button></li>';
      }).join('') + '</ul>' : '<p class="acc-nota">Nessun accesso attivo.</p>');
      /* ACC-5 (audit 2026-09-24): un iscritto che non ha confermato l'email puo'
         avere concessioni IN ATTESA, che partono alla conferma. Non mostrarle
         faceva dire «Nessun accesso attivo» a chi un accesso lo aveva gia'
         ricevuto: lo staff ne dava un secondo, e «Togli tutto» non lo toglieva. */
      var att2 = d.in_attesa || [];
      if (att2.length) {
        r.push('<p class="acc-nota">In attesa della conferma dell&rsquo;email:</p>' +
               '<ul class="acc-lista">' + att2.map(function (c) {
          return '<li>' + esc(c.scope) + ' &middot; ' +
                 (c.giorni ? esc(c.giorni) + ' giorni' : 'per sempre') +
                 ' dalla conferma <button class="btn btn-ghost" type="button"' +
                 ' data-revoca="' + esc(c.id) + '">Togli</button></li>';
        }).join('') + '</ul>');
      }
      var pag = d.pagamenti || [];
      if (pag.length) {
        r.push('<p class="acc-nota">Pagamenti:</p><ul class="acc-lista">' + pag.map(function (p) {
          return '<li>' + esc(p.provider) + ' &middot; ' + esc(euro(p.importo_cent, p.valuta)) +
                 ' &middot; ' + esc(p.stato) + ' &middot; ' + esc(giorno(p.ricevuto_at)) +
                 (p.nota ? ' &middot; ' + esc(p.nota) : '') + '</li>';
        }).join('') + '</ul>');
      }
      (d.sconti || []).forEach(function (s) {
        r.push('<p class="acc-nota">Sconto sostenitore ' + esc(s.percentuale) + '%: ' +
               (s.usato_at ? 'usato il ' + esc(giorno(s.usato_at)) : 'ancora da usare') + '</p>');
      });
      if (d.ruolo === 'bloccato') {
        r.splice(1, 0, '<p class="acc-nota"><b>Account bloccato</b>: i pagamenti ' +
                       'si registrano ma non aprono niente.</p>');
      }
      document.getElementById('s-info').innerHTML = r.join('');
      document.getElementById('s-blocca').hidden = false;
      document.getElementById('s-blocca').textContent =
        d.ruolo === 'bloccato' ? 'Sblocca' : 'Blocca';
      document.getElementById('s-blocca').setAttribute('data-bloccato',
        d.ruolo === 'bloccato' ? '1' : '');
      document.getElementById('s-scheda').hidden = false;
      /* niente riquadro vuoto: un messaggio senza testo si toglie */
      var sm = document.getElementById('s-msg');
      sm.className = 'form-msg'; sm.textContent = '';
    }).catch(function (e) {
      document.getElementById('s-scheda').hidden = true;
      if (sGuasto(e)) return;
      /* NON ISCRITTO: l'accesso si puo' dare lo stesso e parte quando si iscrive
         con questa email (concessioni in attesa, migrazione 0005): lo staff deve
         poter fare cio' che fa `account_admin.py dai` */
      if (e && e.status === 404 && e.dati && e.dati.in_attesa) {
        var att = e.dati.in_attesa;
        document.getElementById('s-info').innerHTML =
          '<p><b>' + esc(email) + '</b> &middot; non ancora iscritto</p>' + (att.length
            ? '<ul class="acc-lista">' + att.map(function (c) {
                return '<li>' + esc(c.scope) + ' &middot; in attesa: ' +
                  (c.giorni ? esc(c.giorni) + ' giorni' : 'per sempre') +
                  ' dall’iscrizione <button class="btn btn-ghost" type="button"' +
                  ' data-revoca="' + esc(c.id) + '">Togli</button></li>';
              }).join('') + '</ul>'
            : '<p class="acc-nota">Nessun accesso in attesa. Se gliene dai uno, parte da ' +
              'solo quando si iscrive con questa email.</p>') +
          /* i PAGAMENTI che aspettano questa email (2026-09-24): il premio del
             sostenitore registrato a mano per chi non e' iscritto sta li', e chi
             l'ha appena dato deve ritrovarlo qui */
          ((e.dati.pagamenti || []).length
            ? '<p class="acc-nota">Pagamenti in attesa di questa email:</p><ul class="acc-lista">' +
              e.dati.pagamenti.map(function (p) {
                return '<li>' + esc(p.provider) + ' &middot; ' +
                       esc(p.importo_cent == null ? 'premio' : euro(p.importo_cent, p.valuta)) +
                       ' &middot; ' + esc(p.stato) + ' &middot; ' + esc(giorno(p.ricevuto_at)) +
                       (p.nota ? ' &middot; ' + esc(p.nota) : '') + '</li>';
              }).join('') + '</ul>'
            : '');
        document.getElementById('s-blocca').hidden = true;
        document.getElementById('s-scheda').hidden = false;
        var sm = document.getElementById('s-msg');
        sm.className = 'form-msg'; sm.textContent = '';
        return;
      }
      sMsg('no', e && e.status === 404 ? 'Nessun account con questa email.' : errore(e));
    });
  }
  function caricaRimborsi() {
    var box = document.getElementById('s-rimborsi');
    api('/admin/pagamenti?stato=ignorato').then(function (d) {
      var righe = (d.pagamenti || []).filter(function (p) { return p.tipo === 'rimborso'; });
      box.innerHTML = righe.length ? '<ul class="acc-lista">' + righe.map(function (p) {
        return '<li>' + esc(p.provider) + ' &middot; ' + esc(euro(p.importo_cent, p.valuta)) +
               ' &middot; ' + esc(giorno(p.ricevuto_at)) + ' &middot; ' +
               esc(p.nota || '') + (p.email_norm ? ' <button class="btn btn-ghost" ' +
               'type="button" data-apri="' + esc(p.email_norm) + '">Apri ' +
               esc(p.email_norm) + '</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="acc-nota">Nessun rimborso da verificare.</p>';
    }).catch(function (e) {
      if (!sGuasto(e)) box.innerHTML = '<p class="acc-nota">' + esc(errore(e)) + '</p>';
    });
  }
  function caricaAttesa() {
    var box = document.getElementById('s-attesa');
    api('/admin/pagamenti?stato=in-attesa').then(function (d) {
      var righe = d.pagamenti || [];
      box.innerHTML = righe.length ? '<ul class="acc-lista">' + righe.map(function (p) {
        return '<li>' + esc(p.provider) + ' &middot; ' + esc(euro(p.importo_cent, p.valuta)) +
               ' &middot; ' + esc(p.email_norm || 'nessuna email') + ' &middot; ' +
               esc(giorno(p.ricevuto_at)) + '<br><input type="email" placeholder="email ' +
               "dell'account" + '" data-per="' + esc(p.id) + '"> <button class="btn btn-ghost"' +
               ' type="button" data-collega="' + esc(p.id) + '">Collega</button></li>';
      }).join('') + '</ul>' : '<p class="acc-nota">Nessun pagamento in attesa.</p>';
    }).catch(function (e) {
      if (!sGuasto(e)) box.innerHTML = '<p class="acc-nota">' + esc(errore(e)) + '</p>';
    });
  }
  /* I RECESSI (art. 54-bis, 2026-09-25): quelli ancora da gestire, dal piu' vecchio,
     con la scadenza del NOSTRO rimborso (14 giorni di calendario dall'arrivo: la
     data piu' prudente). Tutto cio' che viene dal modulo e' testo: esc(). Un
     Worker senza la rotta (migrazione 0009 non applicata) lo dice, non tace. */
  function caricaRecessi() {
    var box = document.getElementById('s-recessi');
    if (!box) return;
    api('/admin/recessi?da_gestire=1').then(function (d) {
      var righe = d.recessi || [];
      box.innerHTML = righe.length ? '<ul class="acc-lista">' + righe.map(function (r) {
        var bottone = function (stato, testo) {
          return ' <button class="btn btn-ghost" type="button" data-recesso="' + esc(r.id) +
                 '" data-stato="' + stato + '">' + testo + '</button>';
        };
        return '<li><b>n. ' + esc(r.id) + '</b> &middot; arrivato il ' + esc(giorno(r.ricevuto_at)) +
               ' &middot; rimborso entro il ' + esc(giorno((r.ricevuto_at || 0) + 14 * 86400)) +
               '<br>' + esc(r.nome) + ' &middot; ' + esc(r.email) + ' &middot; ' +
               esc(r.piano || 'acquisto non indicato') +
               (r.ricevuta ? ' &middot; ricevuta ' + esc(r.ricevuta) : '') +
               (r.email_account ? ' &middot; account ' + esc(r.email_account) : '') +
               (r.email_inviata ? '' : ' &middot; <b>ricevuta NON partita</b>') +
               (r.nota ? '<br><span class="acc-nota">' + esc(r.nota) + '</span>' : '') +
               '<br>' + bottone('rimborsato', 'Rimborsato') + bottone('respinto', 'Non dovuto') +
               bottone('spam', 'Spam') + '</li>';
      }).join('') + '</ul>' + (d.altri ? '<p class="acc-nota">E altri ancora: gestisci ' +
               'questi e ricarica.</p>' : '')
        : '<p class="acc-nota">Nessun recesso da gestire.</p>';
    }).catch(function (e) {
      /* il 404 PRIMA di sGuasto: qui lo staff e' gia' riconosciuto da /auth/me, e un
         404 e' il Worker di prima, senza la rotta — non un ruolo tolto */
      if (e && e.status === 404) {
        box.innerHTML = '<p class="acc-nota">Il registro dei recessi non risponde: il ' +
                        'Worker va aggiornato (migrazione 0009).</p>';
        return;
      }
      if (!sGuasto(e)) box.innerHTML = '<p class="acc-nota">' + esc(errore(e)) + '</p>';
    });
  }
  if (sp && tok()) {
    api('/auth/me').then(function (d) {
      if (d.ruolo !== 'staff') return;
      document.getElementById('staff-no').hidden = true;
      sp.hidden = false;
      caricaAttesa();
      caricaRimborsi();
      caricaRecessi();
    }).catch(function (e) { if (e && e.status === 401) setTok(''); });
  }
  if (sp) {
    document.getElementById('s-cerca').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var em = document.getElementById('s-email').value.trim();
      if (em) cerca(em);
    });
    sp.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var dai = t.getAttribute('data-dai'), rev = t.getAttribute('data-revoca'),
          premio = t.getAttribute('data-premio'),
          col = t.getAttribute('data-collega'), apri = t.getAttribute('data-apri');
      /* dopo un «togli» la chiave gia' consegnata vale fino alla prossima
         pubblicazione di /studio: lo staff lo deve sapere (finding X6) */
      var dopoTogli = 'Tolto. Se aveva gia\u0300 aperto /studio, la pubblicazione di ' +
                      'oggi gli resta leggibile finche\u0301 /studio non viene ripubblicata.';
      var rid = t.getAttribute('data-recesso');
      if (rid) {
        var stato = t.getAttribute('data-stato');
        if (!confirm('Segnare il recesso n. ' + rid + ' come «' + stato + '»?')) return;
        t.disabled = true;
        api('/admin/recessi/' + encodeURIComponent(rid), { method: 'POST',
                                                           body: { stato: stato } })
          .then(function () { sMsg('ok', 'Recesso n. ' + rid + ': ' + stato + '.'); caricaRecessi(); })
          .catch(function (e) { t.disabled = false; if (!sGuasto(e)) sMsg('no', errore(e)); });
        return;
      }
      if (premio && sEmail) {
        /* IL PREMIO DEL SOSTENITORE Ko-fi (revisione del 2026-09-24, PAG-D): e' la
           REGISTRAZIONE A MANO di una donazione, quindi vuole l'ID della donazione
           — il Worker la tratta come l'avviso di Ko-fi, idempotente su quell'id:
           un doppio clic, un rilancio dopo un timeout o l'avviso vero arrivato
           dopo non regalano altri 62 giorni. Il bottone si spegne finche' la
           richiesta non torna. */
        var origine = (prompt('ID della donazione Ko-fi (dalla mail di Ko-fi) per ' +
                              sEmail + ':') || '').trim();
        if (!origine) return;
        t.disabled = true;
        api('/admin/entitlements', { method: 'POST',
                                     body: { email: sEmail, premio: true, origine: origine } })
          .then(function (r) { return cerca(sEmail).then(function () { return r; }); })
          .then(function (r) {
            var sc = r && r.sconto ? ' Sconto del 20% registrato.'
                   : ' Nessuno sconto nuovo: ne aveva gia\u0300 avuto uno (una volta sola).';
            sMsg('ok', r && r.duplicato
              ? 'Questa donazione era gia\u0300 registrata: niente di nuovo.'
              : r && r.stato === 'in-attesa'
              ? (r.iscritto
                ? "Premio in attesa: e\u0300 iscritto ma non ha confermato l'email; parte " +
                  'alla conferma, in coda ai giorni che ha.' + sc
                : 'Premio in attesa: parte quando si iscrive con questa email e la ' +
                  'conferma.' + sc)
              : 'Premio dato: due mesi in coda a quelli che aveva.' + sc);
          })
          .catch(function (e) { if (!sGuasto(e)) sMsg('no', errore(e)); })
          .then(function () { t.disabled = false; });
      } else if (dai && sEmail) {
        /* in_attesa: se non c'e' ancora un account, la concessione aspetta l'email */
        var corpo = dai === 'sempre' ? { email: sEmail, per_sempre: true, in_attesa: true }
                                     : { email: sEmail, giorni: parseInt(dai, 10), in_attesa: true };
        api('/admin/entitlements', { method: 'POST', body: corpo })
          .then(function (r) { return cerca(sEmail).then(function () { return r; }); })
          .then(function (r) {
            sMsg('ok', (r && r.in_attesa
              ? (r.iscritto
                ? "Accesso in attesa: e\u0300 iscritto ma non ha confermato l'email, " +
                  "parte quando la conferma."
                : "Accesso in attesa: parte da solo quando si iscrive con questa email " +
                  "e la conferma, con i giorni contati da li'.")
              : r && r.email_verificata === false
              ? "Accesso concesso. Attenzione: l'email di questo account non e\u0300 " +
                'confermata, quindi non prova che sia di quella persona.'
              : 'Accesso concesso.'));
          })
          .catch(function (e) { if (!sGuasto(e)) sMsg('no', errore(e)); });
      } else if (rev) {
        api('/admin/entitlements', { method: 'DELETE', body: { id: rev } })
          .then(function (r) { return cerca(sEmail).then(function () { return r; }); })
          /* un diritto nato da Whop: la risposta dice che cosa resta da fare sulla
             dashboard di Whop (2026-09-25); tacerlo lo farebbe rinascere al rinnovo */
          .then(function (r) { sMsg('ok', (r && r.whop ? r.whop + '. ' : '') + dopoTogli); })
          .catch(function (e) { if (!sGuasto(e)) sMsg('no', errore(e)); });
      } else if (t.id === 's-blocca' && sEmail) {
        var sblocca = t.getAttribute('data-bloccato') === '1';
        if (!confirm(sblocca ? 'Sbloccare ' + sEmail + '?'
                             : 'Bloccare ' + sEmail + '? Perde tutti gli accessi, i ' +
                               'rinnovi (Stripe e Whop) vengono disdetti e le donazioni ' +
                               'future non riaprono niente.')) return;
        api('/admin/blocca', { method: 'POST',
                               body: sblocca ? { email: sEmail, sblocca: true } : { email: sEmail } })
          .then(function (r) { return cerca(sEmail).then(function () { return r; }); })
          .then(function (r) {
            sMsg('ok', sblocca ? 'Sbloccato.' : 'Bloccato. Abbonamento Stripe: ' +
                 ((r && r.abbonamento) || 'nessuno') + '. ' +
                 /* Whop (2026-09-25): il Worker dice se la membership e' disdetta o
                    va disdetta A MANO sulla dashboard di Whop */
                 (r && r.whop ? r.whop + '. ' : '') + dopoTogli.replace('Tolto. ', ''));
          })
          .catch(function (e) { if (!sGuasto(e)) sMsg('no', errore(e)); });
      } else if (apri) {
        document.getElementById('s-email').value = apri;
        cerca(apri);
      } else if (t.id === 's-togli' && sEmail) {
        if (!confirm('Togliere TUTTI gli accessi di ' + sEmail + '?')) return;
        api('/admin/entitlements?email=' + encodeURIComponent(sEmail)).catch(function (e) {
          /* non iscritto: si tolgono le concessioni che lo aspettano */
          if (e && e.status === 404 && e.dati && e.dati.in_attesa) {
            return { entitlements: e.dati.in_attesa };
          }
          throw e;
        }).then(function (d) {
          /* anche quelle IN ATTESA di un iscritto non confermato: prima restavano,
             e l'accesso si apriva alla conferma dopo un «Tolto» (ACC-5) */
          return Promise.all((d.entitlements || []).concat(d.in_attesa || []).map(function (x) {
            return api('/admin/entitlements', { method: 'DELETE', body: { id: x.id } });
          }));
        }).then(function () { return cerca(sEmail); })
          .then(function () { sMsg('ok', dopoTogli); })
          .catch(function (e) { if (!sGuasto(e)) sMsg('no', errore(e)); });
      } else if (col) {
        var inp = sp.querySelector('input[data-per="' + col.replace(/"/g, '') + '"]');
        var em2 = inp ? inp.value.trim() : '';
        if (!em2) return;
        api('/admin/pagamenti/collega', { method: 'POST', body: { id: col, email: em2 } })
          .then(function () { caricaAttesa(); cerca(em2); })
          .catch(function (e) { if (!sGuasto(e)) alert(errore(e)); });
      }
    });
  }

  /* ---- LA FUNZIONE DI RECESSO (art. 54-bis, 2026-09-25) ----
     Il modulo di recesso.html: nome, email per la ricevuta, quale acquisto. Il
     Worker registra e manda la ricevuta per email (`POST /recesso`); qui si scrive
     a schermo la data e l'ora in cui e' arrivato, che e' cio' che conta per il
     termine. Se il Worker non ha ancora la rotta (404) o la rete cade, NON si finge:
     si dice di scrivere all'email, che vale lo stesso. Il token, se c'e', viaggia
     da solo (`api`): lega il recesso all'account senza chiedere altro. */
  var rf = document.getElementById('recesso-form');
  if (rf) {
    rf.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('recesso-msg');
      var bt = rf.querySelector('button[type=submit]');
      var nome = String(rf.nome.value || '').trim();
      var email = String(rf.email.value || '').trim();
      if (nome.length < 2) { msg.className = 'form-msg show no'; msg.textContent = 'Scrivi come ti chiami.'; return; }
      if (email.indexOf('@') < 1 || email.lastIndexOf('.') < email.indexOf('@')) {
        msg.className = 'form-msg show no'; msg.textContent = "Controlla l'email: ci mandiamo la ricevuta."; return;
      }
      bt.disabled = true;
      msg.className = 'form-msg show'; msg.textContent = 'Invio in corso...';
      api('/recesso', { method: 'POST', body: {
        nome: nome, email: email, piano: rf.piano ? rf.piano.value : '',
        ricevuta: rf.ricevuta ? String(rf.ricevuta.value || '').trim() : '' } })
        .then(function (d) {
          var quando = new Date((d.ricevuto_at || 0) * 1000);
          var giorno = quando.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome',
            day: 'numeric', month: 'long', year: 'numeric' });
          var ora = quando.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome',
            hour: '2-digit', minute: '2-digit' });
          msg.className = 'form-msg show ok';
          msg.textContent = 'Abbiamo ricevuto il tuo recesso il ' + giorno + ' alle ' + ora + '. '
            + (d.email_inviata
               ? 'Ti abbiamo mandato la ricevuta a ' + email + '.'
               : "L'email con la ricevuta non è partita: salva o stampa questa pagina come prova, e scrivici.");
          rf.reset();
        })
        .catch(function (e) {
          bt.disabled = false;
          msg.className = 'form-msg show no';
          if (e && e.status === 429) { msg.textContent = 'Troppi invii: riprova fra un po’, oppure scrivici per email.'; return; }
          if (e && e.status === 400) { msg.textContent = (e.message && e.message !== 'errore') ? e.message : 'Controlla i campi e riprova.'; return; }
          msg.textContent = 'Il modulo non è raggiungibile adesso: scrivici per email dicendo che recedi, vale lo stesso.';
        });
    });
  }

  /* ACC-8 (audit 2026-09-24): i bottoni dei moduli con la password nascono
     SPENTI nell'HTML e si accendono qui, dopo che i gestori sopra sono
     agganciati. Se questo file non arriva, o si ferma prima, il modulo non
     parte: meglio di un GET con la password nell'URL. */
  var attende = document.querySelectorAll('[data-attende-js]');
  for (var ia2 = 0; ia2 < attende.length; ia2++) attende[ia2].disabled = false;

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
