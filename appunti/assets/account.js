/* --- area account (Fase 1) --- */
(function () {
  var API = 'https://account.portaledeifuturimedici.com';
  if (!API) return;
  var CH = 'appunti-tok';           /* la sessione vive in localStorage */

  function tok() { try { return localStorage.getItem(CH) || ''; } catch (e) { return ''; } }
  /* setTok RIDISEGNA la barra: e' l'unico punto da cui la sessione cambia, e
     legarla qui e' l'unico modo perche' nessun ramo futuro se ne dimentichi
     (il 401 sul profilo, l'uscita, la cancellazione dell'account). */
  function setTok(t) {
    try { t ? localStorage.setItem(CH, t) : localStorage.removeItem(CH); } catch (e) {}
    if (!t) setChi(null);
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
     Si accetta SOLO un percorso dello stesso sito: `/qualcosa`, mai `//altro`
     ne' `https://altro`. Un rinvio che prende l'indirizzo da un parametro e' il
     classico modo di far atterrare qualcuno su una pagina falsa col nostro
     dominio nella barra: chi entra da un link ricevuto per messaggio non deve
     poter essere portato altrove. */
  function dopoEntrato() {
    var t = '';
    try { t = new URLSearchParams(location.search).get('torna') || ''; } catch (e) {}
    return (/^\/[^\/\\]/.test(t) && t.indexOf('//') < 0) ? t : 'profilo.html';
  }

  /* Chi ha gia' la sessione non deve rivedere il modulo d'accesso: e' la
     seconda meta' dello stesso difetto. Misurato col token presente,
     `entra.html` mostrava di nuovo il modulo, titolo «Bentornato». */
  if (tok() && /\/(entra|registrati)\.html$/.test(location.pathname)) {
    location.replace(dopoEntrato());
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
        if (d.user) setChi(d.user);
        if (d.token) setTok(d.token);
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
           si attiva solo a indirizzo confermato, e il link vale un'ora. Chi non
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
                : 'Fatto: controlla la posta (anche lo spam). Il link vale un\u2019ora.');
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
      .then(function (d) {
        /* Se alla conferma e' partito un accesso dato in anticipo (o un
           pagamento in attesa), lo si dice: e' la ragione per cui chi
           arriva qui ha cliccato. */
        var aperto = d && ((d.accessi_attivati || 0) + (d.pagamenti_agganciati || 0)) > 0;
        esito.innerHTML = '<p><b>Indirizzo confermato.</b> ' + (aperto
          ? 'Il tuo accesso al pacchetto ora e\u0300 attivo. '
          : '') + 'Ora puoi <a href="entra.html">entrare</a>.</p>';
      })
      .catch(function () {
        /* Il link di conferma vale un'ora: chi lo apre tardi ne chiede un
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
