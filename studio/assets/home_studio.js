/* =====================================================================
   home_studio.js — LA HOME DELLO STUDYPACK COMPLETO (fetta S4 del lancio)
   Vanilla JS, ZERO dipendenze, niente CDN. Compatibile ES5 come gli altri
   motori (var/function, nessuna arrow, nessun template literal).

   COS'E'. Il motore della home di /studio: «Oggi» e il piano di studio.
   La pagina (site_build.py, `pagina_home_studio`) porta il markup; i dati e
   i testi che lo script scrive stanno in `data/home.json` (DATI_HOME), letto
   dallo sportello dei dati (revisione S4: nella pagina pesavano troppo, vedi
   `carica`); qui si decide che cosa dire e si risponde ai gesti. Solo
   textContent e attributi: nessun HTML composto qui dentro.

   OGGI, in quest'ordine di verita':
     - lo studente ha un piano (`studio-masterplan`, la cfg delle tre
       domande): Oggi dice SOLO cio' che dice `Masterplan.dose` per oggi,
       ricalcolato da `Masterplan.riadatta` sullo stato di adesso; se la
       dose e' vuota, «fatto per oggi» (c'era una lista ed e' fatta) o
       «giorno libero» (la lista di oggi e' vuota);
     - senza piano, la PRECEDENZA DI RISERVA: le domande sbagliate (la
       parte con piu' errori), le carte che sbagli piu' spesso, la prima
       tappa non fatta della lezione a cui sei arrivato; e sempre l'invito
       a costruire il piano. Il primo giorno (niente di tutto questo) solo
       l'invito.
   Mai «sei pronto», mai un esito: il piano dice che cosa fare e quanto.

   LO STATO viene da studio_sync.js (`Sync.perPiano(Sync.leggi())`: i
   progressi di questo browser e quelli arrivati dal server), piu' la tappa
   Richiama letta dalle carte e dai quiz di QUESTO browser (la tappa che si
   legge da sola, senza chiederla). Le risposte («so spiegarlo», «incerto»,
   «no», «fatto») si scrivono in `studio-tappe` e partono come evento
   `tappa` (la coda di site.js, `studioEvento`).

   IL PIANO SI SALVA SENZA IL CALENDARIO (`studio-masterplan` = {v, cfg,
   piano, aggiornato}): il piano intero ha una voce per ogni giorno fino
   all'esame e non sta nel tetto del server. Si salva `Masterplan.daSalvare`
   quando il modulo ce l'ha (v2), altrimenti la forma ridotta di qui (tutto
   tranne i giorni, e dei giorni solo quello in cui il piano e' nato);
   `riadatta` lo accetta com'e' e ricalcola il resto a ogni visita.

   LE CHIAVI che questo file scrive: `studio-masterplan`, `studio-tappe`,
   `studio-lezione` (le tre del registro di studio_sync.js, sincronizzate).
   Nessun'altra.

   PROVE: tests/test_home_studio_js.mjs (eseguito, con le mutazioni),
   lanciato da tests/test_site_home_studio.py.
   ===================================================================== */

(function (global) {
  'use strict';

  var CHIAVE_PIANO = 'studio-masterplan';
  var CHIAVE_TAPPE = 'studio-tappe';
  var CHIAVE_LEZIONE = 'studio-lezione';
  var PREFISSO_LETTO = 'appunti-letto:';
  var CHIAVE_SBAGLIATE = 'quiz.v1.sbagliate';
  var VERSIONE = 1;
  var GIORNO_MS = 86400000;
  /* quanto Oggi tiene il posto, al primo ingresso su un browser, aspettando la prima
     lettura dal server (lo stesso limite dell'hub pubblico, OGGI_ATTESA_MS di site.js) */
  var OGGI_ATTESA_MS = 8000;
  var CHIAVE_TOKEN_BASE = 'appunti-tok';
  var CHIAVE_SYNC = 'studio-sync';

  var TAPPE = ['capisci', 'fai', 'richiama', 'nonCascarci'];
  /* le tappe con la domanda «Come te la senti?» e quella col solo «Fatto»;
     Richiama si legge da sola (carte e quiz) */
  var CON_DOMANDA = { capisci: 'so_capisci', fai: 'so_fai' };
  var SOLO_FATTO = { nonCascarci: 1 };
  /* la risposta -> l'esito dell'evento (Worker: ok = so, quasi = incerto, ko = no) */
  var ESITO_EVENTO = { so: 'ok', incerto: 'quasi', no: 'ko', fatto: 'ok' };

  var RE_PARTE = /^(s[12][fcb]\d{2})-([AB])$/;
  var RE_ITEM_PARTE = /^(s[12][fcb]\d{2})(?:_[a-z0-9_]*)?-([AB])(?:-|#)/;
  var RE_CARTE = /^flashcards\.v1\.(s[12][fcb]\d{2})-([AB])$/;
  var RE_QUIZ = /^quiz\.v1\.(s[12][fcb]\d{2})-([AB])$/;
  var RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

  /* ------------------------------------------------------------------ *
   * piccoli attrezzi                                                    *
   * ------------------------------------------------------------------ */
  function eArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function eOggetto(x) { return !!x && typeof x === 'object' && !eArray(x); }
  function proprio(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function eGiorno(s) { return typeof s === 'string' && RE_GIORNO.test(s); }

  /* il giorno LOCALE dello studente, mai toISOString (UTC: fra mezzanotte e
     l'una, le due d'estate, direbbe ancora ieri) */
  function giornoLocale(ms, Data) {
    var D = Data || Date, d = new D(ms);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }
  /* giorni di calendario fra due date 'AAAA-MM-GG' (b - a), senza orologio */
  function giorniFra(a, b) {
    function n(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / GIORNO_MS; }
    return Math.round(n(b) - n(a));
  }
  function spostaGiorno(s, k) {
    var p = s.split('-'), t = Date.UTC(+p[0], +p[1] - 1, +p[2]) + k * GIORNO_MS, d = new Date(t);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getUTCDate()).slice(-2);
  }

  function leggiJson(st, chiave) {
    try {
      var v = st && st.getItem(chiave);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  /* le TRE scritture di questo file, una per chiave e col suo nome in chiaro: chi legge
     il codice (e il presidio dell'informativa, che legge le chiavi di ogni setItem) vede
     quali chiavi scrive. Nessuna scrittura con una chiave calcolata. */
  function scriviPiano(st, valore) {
    try { st.setItem(CHIAVE_PIANO, JSON.stringify(valore)); return true; } catch (e) { return false; }
  }
  function scriviTappe(st, valore) {
    try { st.setItem(CHIAVE_TAPPE, JSON.stringify(valore)); return true; } catch (e) { return false; }
  }
  function scriviLezione(st, valore) {
    try { st.setItem(CHIAVE_LEZIONE, JSON.stringify(valore)); return true; } catch (e) { return false; }
  }

  /* i {segnaposto} di un testo dell'isola, riempiti; uno che manca resta
     com'e' (il collaudo lo vede, a schermo non deve mai arrivare) */
  function riempi(t, valori) {
    return String(t || '').replace(/\{([a-z_]+)\}/g, function (m, k) {
      return proprio(valori, k) && valori[k] !== null && valori[k] !== undefined ? String(valori[k]) : m;
    });
  }

  /* ------------------------------------------------------------------ *
   * il catalogo dell'isola                                              *
   * ------------------------------------------------------------------ */
  /* la mole del piano: le parti del catalogo in ordine di corso,
     {slug, parte, materia, ep} (la forma di data/index.json) */
  function moleDa(D) {
    var out = [], i, s, L, p;
    for (i = 0; i < D.ordine.length; i++) {
      s = D.ordine[i];
      L = proprio(D.lezioni, s) ? D.lezioni[s] : null;
      if (!L || !eOggetto(L.a)) continue;
      for (p = 0; p < 2; p++) {
        var lettera = p ? 'B' : 'A';
        if (proprio(L.a, lettera)) out.push({ slug: s, parte: lettera, materia: L.m, ep: L.ep });
      }
    }
    return out;
  }

  function lezioneDi(D, parte) {
    var m = RE_PARTE.exec(String(parte || ''));
    if (!m || !proprio(D.lezioni, m[1])) return null;
    return { s: m[1], p: m[2], L: D.lezioni[m[1]] };
  }

  /* il nome di una parte a schermo: «Fisica · lezione 1 di 10 (parte A)» */
  function nomeParte(D, parte) {
    var x = lezioneDi(D, parte);
    return x ? riempi(D.testi.parte, { lezione: x.L.nome, parte: x.p }) : parte;
  }

  function nomeTappa(D, tappa) {
    for (var i = 0; i < D.tappe.length; i++) if (D.tappe[i][0] === tappa) return D.tappe[i][1];
    return tappa;
  }
  function bottoneTappa(D, tappa) {
    for (var i = 0; i < D.tappe.length; i++) if (D.tappe[i][0] === tappa) return D.tappe[i][2];
    return tappa;
  }

  /* dove si fa una tappa: la pagina della lezione, all'ancora del suo primo
     blocco in quella parte (la stessa di `ancora_tappa` in site_build.py) */
  function linkTappa(D, parte, tappa) {
    var x = lezioneDi(D, parte);
    if (!x) return '';
    var ancore = x.L.a[x.p] || [], k = TAPPE.indexOf(tappa);
    var a = k >= 0 && ancore[k] ? '#' + ancore[k] : '';
    return riempi(D.link.lezione, { p: x.L.p }) + a;
  }
  function linkDi(D, tipo, parte) {
    var x = lezioneDi(D, parte);
    return x ? riempi(D.link[tipo], { s: x.s, parte: x.p }) : '';
  }

  /* un numero in lettere per le frasi («fra tre giorni»); oltre l'elenco, in cifre */
  function inLettere(D, n) {
    return D.numeri && n >= 0 && n < D.numeri.length ? D.numeri[n] : String(n);
  }

  /* ------------------------------------------------------------------ *
   * lo stato per il piano                                               *
   * ------------------------------------------------------------------ */
  /* CHI HA TOCCATO UN CASSETTO. I cassetti dei motori (le carte e i quiz di una
     lezione, `flashcards.v1.*` e `quiz.v1.*`) non sono nel registro della
     sincronizzazione: quando sul browser entra un altro account restano dove sono, e
     sono di chi c'era prima. Quindi si leggono solo se toccati DOPO l'ingresso
     dell'account di adesso (`legato` di studio_sync.js, in millisecondi): la regola di
     `Sync.perPiano` per le domande sbagliate (revisione della fetta S4: allo studente B
     la home proponeva le carte sbagliate da A e gli dava Richiama per fatta).
     `legato` null = browser mai legato a un account: tutto e' di chi lo usa. */
  function dopoIngresso(ms, legato) {
    if (legato === null || legato === undefined) return true;
    return typeof ms === 'number' && isFinite(ms) && ms >= legato;
  }

  /* La tappa Richiama, letta da sola: l'ultimo giorno in cui le carte (il
     cassetto della lezione, `flashcards.v1.<lezione>-<parte>`) o un quiz della
     parte (`quiz.v1.<lezione>-<parte>`) sono stati fatti in QUESTO browser, dopo
     l'ingresso dell'account di adesso (`legato`, vedi `dopoIngresso`).
     Il cassetto comune delle raccolte (`flashcards.v1.studio`) non dice la
     parte: non conta (limite dichiarato). -> {parte: 'AAAA-MM-GG'} */
  function richiamaLocale(st, Data, legato) {
    var out = {}, i, k, m, v, g, j;
    if (!st || typeof st.length !== 'number') return out;
    for (i = 0; i < st.length; i++) {
      k = st.key(i);
      if (typeof k !== 'string') continue;
      g = null;
      if ((m = RE_CARTE.exec(k))) {
        v = leggiJson(st, k);
        if (eOggetto(v) && typeof v.agg === 'number' && isFinite(v.agg) && v.agg > 0 &&
            dopoIngresso(v.agg, legato)) g = giornoLocale(v.agg, Data);
      } else if ((m = RE_QUIZ.exec(k))) {
        v = leggiJson(st, k);
        if (eOggetto(v) && eArray(v.storia)) {
          for (j = 0; j < v.storia.length; j++) {
            var q = v.storia[j];
            if (eOggetto(q) && typeof q.quando === 'number' && isFinite(q.quando) && q.quando > 0 &&
                dopoIngresso(q.quando, legato)) {
              var gq = giornoLocale(q.quando, Data);
              if (!g || gq > g) g = gq;
            }
          }
        }
      }
      if (m && g) {
        var parte = m[1] + '-' + m[2];
        if (!out[parte] || g > out[parte]) out[parte] = g;
      }
    }
    return out;
  }

  /* le sbagliate senza studio_sync.js: il registro di quiz.js di questo browser */
  function sbagliateLocali(st) {
    var reg = leggiJson(st, CHIAVE_SBAGLIATE), out = {}, k, m;
    if (!eOggetto(reg) || !eOggetto(reg.q)) return out;
    for (k in reg.q) {
      if (!proprio(reg.q, k) || !(m = RE_ITEM_PARTE.exec(k))) continue;
      var p = m[1] + '-' + m[2];
      if (!out[p]) out[p] = { n: 0, ultima: null };
      out[p].n++;
    }
    return out;
  }

  function giornoDiTappa(x) {
    if (eGiorno(x)) return x;
    return eOggetto(x) && eGiorno(x.fatto) ? x.fatto : null;
  }

  /* lo stato che il piano si aspetta (intestazione di masterplan.js), con la
     tappa Richiama letta dalle carte e dai quiz se e' piu' recente. Porta anche
     `legato` (l'ingresso dell'account di adesso, o null): chi legge i cassetti dei
     motori (`parteBestia`) ne ha bisogno, e il piano lo ignora. */
  function statoPerPiano(amb) {
    var st = null, legato = null;
    if (amb.Sync && typeof amb.Sync.perPiano === 'function' && typeof amb.Sync.leggi === 'function') {
      try {
        var qui = amb.Sync.leggi(amb.storage);
        if (eOggetto(qui) && typeof qui.legato === 'number' && isFinite(qui.legato)) legato = qui.legato;
        st = amb.Sync.perPiano(qui);
      } catch (e) { st = null; }
    }
    if (!eOggetto(st)) {
      var blob = leggiJson(amb.storage, CHIAVE_TAPPE);
      st = { tappe: eOggetto(blob) ? blob : {}, sbagliate: sbagliateLocali(amb.storage), scatole: {} };
    }
    var tappe = {}, p;
    for (p in st.tappe) if (proprio(st.tappe, p)) tappe[p] = eOggetto(st.tappe[p]) ? copia(st.tappe[p]) : st.tappe[p];
    var r = richiamaLocale(amb.storage, amb.Data, legato);
    for (p in r) {
      if (!proprio(r, p)) continue;
      if (!eOggetto(tappe[p])) tappe[p] = {};
      var ora = giornoDiTappa(tappe[p].richiama);
      if (!ora || r[p] > ora) tappe[p].richiama = r[p];
    }
    return { tappe: tappe, sbagliate: eOggetto(st.sbagliate) ? st.sbagliate : {},
             scatole: eOggetto(st.scatole) ? st.scatole : {}, legato: legato, richiamaQui: r };
  }

  function copia(x) {
    if (eArray(x)) { var a = []; for (var i = 0; i < x.length; i++) a.push(copia(x[i])); return a; }
    if (eOggetto(x)) { var o = {}; for (var k in x) if (proprio(x, k)) o[k] = copia(x[k]); return o; }
    return x;
  }

  /* ------------------------------------------------------------------ *
   * la lezione a cui sei arrivato                                       *
   * ------------------------------------------------------------------ */
  /* La lezione CORRENTE: fra quella scelta qui (`studio-lezione`, {s, t}) e
     l'ultima letta (il segno di lettura, `appunti-letto:<pagina>` =
     «<sezione>|<secondi>»), la piu' recente; senza niente, la prima del corso.
     -> {s, t (ms), sezione, fonte: 'scelta'|'letta'|'prima'} */
  function lezioneCorrente(D, st) {
    var perPagina = {}, i, s;
    for (i = 0; i < D.ordine.length; i++) {
      s = D.ordine[i];
      if (proprio(D.lezioni, s)) perPagina[D.lezioni[s].p] = s;
    }
    var meglio = null;
    try {
      for (i = 0; st && i < st.length; i++) {
        var k = st.key(i);
        var m = typeof k === 'string' && k.indexOf(PREFISSO_LETTO) === 0 ? /([^\/]+\.html)$/.exec(k) : null;
        if (!m || !proprio(perPagina, m[1])) continue;
        var v = st.getItem(k) || '', taglio = v.indexOf('|');
        var t = taglio < 0 ? 0 : (parseInt(v.slice(taglio + 1), 10) || 0) * 1000;
        if (!meglio || t > meglio.t) meglio = { s: perPagina[m[1]], t: t, sezione: taglio < 0 ? v : v.slice(0, taglio), fonte: 'letta' };
      }
    } catch (e) { /* un segno che non si legge non ferma la home */ }
    var scelta = leggiJson(st, CHIAVE_LEZIONE);
    if (eOggetto(scelta) && typeof scelta.s === 'string' && proprio(D.lezioni, scelta.s) &&
        typeof scelta.t === 'number' && (!meglio || scelta.t > meglio.t)) {
      meglio = { s: scelta.s, t: scelta.t, sezione: '', fonte: 'scelta' };
    }
    if (!meglio && D.ordine.length) meglio = { s: D.ordine[0], t: 0, sezione: '', fonte: 'prima' };
    return meglio;
  }

  /* ------------------------------------------------------------------ *
   * senza piano: la precedenza di riserva                               *
   * ------------------------------------------------------------------ */
  /* Le carte che sbagli piu' spesso: la carta col tasso d'errore piu' alto
     fra quelle sbagliate almeno una volta, in qualunque cassetto di questo
     browser toccato dopo l'ingresso dell'account di adesso (`legato`: una carta
     non ha la sua data, il cassetto si', `agg`); -> la sua parte, o null. */
  function parteBestia(D, st, legato) {
    var meglio = null, i, k, m, v, id, c, parte;
    if (!st || typeof st.length !== 'number') return null;
    for (i = 0; i < st.length; i++) {
      k = st.key(i);
      if (typeof k !== 'string' || k.indexOf('flashcards.v1.') !== 0) continue;
      v = leggiJson(st, k);
      if (!eOggetto(v) || !eOggetto(v.carte)) continue;
      if (!dopoIngresso(v.agg, legato)) continue;
      m = RE_CARTE.exec(k);
      for (id in v.carte) {
        if (!proprio(v.carte, id)) continue;
        c = v.carte[id];
        if (!eOggetto(c) || !(c.ko >= 1)) continue;
        parte = null;
        if (m) parte = m[1] + '-' + m[2];
        else { var mi = RE_ITEM_PARTE.exec(id); if (mi) parte = mi[1] + '-' + mi[2]; }
        if (!parte || !lezioneDi(D, parte)) continue;
        var ok = c.ok > 0 ? c.ok : 0, tasso = c.ko / (c.ko + ok);
        if (!meglio || tasso > meglio.tasso || (tasso === meglio.tasso && c.ko > meglio.ko)) {
          meglio = { parte: parte, tasso: tasso, ko: c.ko };
        }
      }
    }
    return meglio ? meglio.parte : null;
  }

  /* la prima tappa non fatta, dalla lezione corrente in avanti nel corso */
  function tappaDaFare(D, stato, corrente) {
    var inizio = corrente ? D.ordine.indexOf(corrente.s) : 0, i, p, t;
    if (inizio < 0) inizio = 0;
    for (i = inizio; i < D.ordine.length; i++) {
      var L = D.lezioni[D.ordine[i]];
      for (p = 0; p < 2; p++) {
        var parte = D.ordine[i] + '-' + (p ? 'B' : 'A');
        if (!L || !proprio(L.a, p ? 'B' : 'A')) continue;
        var tp = eOggetto(stato.tappe[parte]) ? stato.tappe[parte] : {};
        for (t = 0; t < TAPPE.length; t++) {
          if (!giornoDiTappa(tp[TAPPE[t]])) return { parte: parte, tappa: TAPPE[t] };
        }
      }
    }
    return null;
  }

  /* LA PRECEDENZA DI RISERVA, UNA voce sola (una proposta, un bottone):
     sbagliate > carte piu' sbagliate > tappa della lezione corrente. */
  function riserva(D, stato, st, corrente, minuti) {
    var meglio = null, p;
    for (p in stato.sbagliate) {
      if (!proprio(stato.sbagliate, p) || !lezioneDi(D, p)) continue;
      var x = stato.sbagliate[p];
      if (!eOggetto(x) || !(x.n > 0)) continue;
      if (!meglio || x.n > meglio.n || (x.n === meglio.n && D.ordine.indexOf(p.slice(0, 5)) < D.ordine.indexOf(meglio.parte.slice(0, 5)))) {
        meglio = { parte: p, n: x.n };
      }
    }
    if (meglio) return { tipo: 'sbagliate', parte: meglio.parte, tappa: 'richiama', minuti: minuti.sbagliate };
    var b = parteBestia(D, st, stato.legato === undefined ? null : stato.legato);
    if (b) return { tipo: 'bestie', parte: b, tappa: 'richiama', minuti: minuti.ripasso };
    /* la tappa col suo tempo, dal piano (RITMI): senza il piano caricato non si
       propone una durata inventata, e la tappa non si propone. E solo per una
       lezione a cui sei ARRIVATO (letta o scelta): il primo giorno la prima lezione
       del corso non e' «la tua», e Oggi e' l'invito a costruire il piano */
    var t = corrente && corrente.fonte !== 'prima' ? tappaDaFare(D, stato, corrente) : null;
    var quanto = t && minuti.tappe ? minuti.tappe[t.tappa] : 0;
    if (t && quanto > 0) return { tipo: 'tappa', parte: t.parte, tappa: t.tappa, minuti: quanto };
    return null;
  }

  /* ------------------------------------------------------------------ *
   * il piano                                                            *
   * ------------------------------------------------------------------ */
  /* la forma da salvare: `Masterplan.daSalvare` (v2), o tutto tranne i giorni
     e dei giorni solo quello in cui il piano e' nato (la lista di oggi dice a
     `riadatta` cio' che e' gia' fatto) */
  function daSalvare(M, piano) {
    if (M && typeof M.daSalvare === 'function') return M.daSalvare(piano);
    if (!eOggetto(piano)) return null;
    var out = {}, k;
    for (k in piano) if (proprio(piano, k) && k !== 'giorni') out[k] = copia(piano[k]);
    out.giorni = {};
    if (eOggetto(piano.giorni) && proprio(piano.giorni, piano.generato)) {
      out.giorni[piano.generato] = copia(piano.giorni[piano.generato]);
    }
    return out;
  }

  function leggiPiano(st) {
    var v = leggiJson(st, CHIAVE_PIANO);
    return eOggetto(v) && eOggetto(v.cfg) ? v : null;
  }

  /* il piano di oggi dal salvato: riadatta sul salvato (il passato non si
     tocca), o pianifica da capo se il salvato non ha ancora un piano */
  function calcolaPiano(M, salvato, stato, oggi, mole) {
    if (!M || !salvato) return null;
    try {
      return eOggetto(salvato.piano) ? M.riadatta(salvato.piano, stato, oggi, null, mole)
                                      : M.pianifica(salvato.cfg, mole, stato, oggi);
    } catch (e) { return null; }
  }

  /* il giorno della settimana di un 'AAAA-MM-GG', lunedi' = 0: l'ordine di cfg.giorni
     (lo stesso di masterplan.js). Senza orologio: il giorno di calendario e basta. */
  function giornoSettimana(s) {
    var p = s.split('-');
    return (new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() + 6) % 7;
  }
  /* i giorni di studio di una cfg, [lun..dom]: la regola del piano (masterplan.js,
     §2/§6), nessun giorno acceso o il campo che manca = tutti i giorni */
  function giorniDiStudio(cfg) {
    var src = eOggetto(cfg) && eArray(cfg.giorni) && cfg.giorni.length === 7 ? cfg.giorni : null;
    var g = [], almeno = false, i;
    for (i = 0; i < 7; i++) {
      var on = !!src && (src[i] === true || src[i] === 1);
      g.push(on);
      if (on) almeno = true;
    }
    if (!almeno) for (i = 0; i < 7; i++) g[i] = true;
    return g;
  }

  /* I GIORNI SALTATI: fra il giorno in cui il piano salvato e' nato e oggi c'e' almeno
     un giorno di STUDIO (acceso nei giorni della cfg) che aveva qualcosa in programma,
     o che il salvato non porta piu' (la forma ridotta tiene solo il giorno di nascita).
     Un giorno che il piano stesso ha spento non e' un giorno perso: prima della
     revisione S4 ogni lunedi' diceva «Bentornato ... non ti abbiamo visto da un po'» a
     chi aveva il weekend libero nel suo piano. */
  function saltati(salvato, oggi) {
    var p = salvato && salvato.piano;
    if (!eOggetto(p) || !eGiorno(p.generato) || giorniFra(p.generato, oggi) < 2) return false;
    var studio = giorniDiStudio(eOggetto(salvato.cfg) ? salvato.cfg : p.cfg);
    for (var d = spostaGiorno(p.generato, 1); d < oggi; d = spostaGiorno(d, 1)) {
      if (!studio[giornoSettimana(d)]) continue;
      if (!eOggetto(p.giorni) || !proprio(p.giorni, d)) return true;
      if (eArray(p.giorni[d]) && p.giorni[d].length) return true;
    }
    return false;
  }

  /* il piano ha qualcosa da oggi in poi? (un piano che non riesce a mettere niente
     prima dell'esame non e' un piano con un giorno libero: revisione S4) */
  function pianoConQualcosa(piano, oggi) {
    if (!eOggetto(piano) || !eOggetto(piano.giorni)) return false;
    for (var d in piano.giorni) {
      if (proprio(piano.giorni, d) && d >= oggi && eArray(piano.giorni[d]) && piano.giorni[d].length) return true;
    }
    return false;
  }

  /* CHE COSA DICE OGGI, deciso (puro). -> {tipo, voci, avvisi, minuti, rientro}
       tipo 'dose'     il piano ha qualcosa per oggi (voci = la dose)
            'fatto'    la lista di oggi c'era ed e' fatta (minuti = la lista)
            'libero'   oggi e' un giorno SPENTO nel piano (una pausa dichiarata)
            'oggivuoto' oggi e' un giorno di studio, ma la lista e' vuota (il piano
                       ha qualcosa negli altri giorni)
            'pianovuoto' il piano non riesce a mettere niente prima dell'esame
            'esame'    oggi e' il giorno dell'esame
            'passato'  la data dell'esame e' passata
            'nonvalido' la cfg non regge (campo, motivo)
            'riserva'  niente piano: la voce della precedenza di riserva
            'vuoto'    niente piano e niente da proporre: il primo giorno
     «giorno libero» solo per una pausa del piano: prima della revisione S4 una lista
     vuota era sempre un giorno libero, anche quando il piano non conteneva niente. */
  function decidi(M, piano, stato, oggi, salvato, voceRiserva) {
    /* un piano salvato che il modulo non riesce a ricalcolare (risposte che non si
       leggono piu'): lo si dice, e si offre di cambiarlo; non si torna al primo giorno */
    if (salvato && !piano && M) {
      return { tipo: 'nonvalido', voci: [], avvisi: [], minuti: 0, rientro: false };
    }
    if (!salvato || !piano) {
      return { tipo: voceRiserva ? 'riserva' : 'vuoto', voci: voceRiserva ? [voceRiserva] : [],
               avvisi: [], minuti: 0, rientro: false };
    }
    var av = eOggetto(piano.avviso) ? piano.avviso : null;
    if (av && av.codice === 'esame-passato') return { tipo: 'passato', voci: [], avvisi: [], minuti: 0, rientro: false };
    if (av && av.codice === 'cfg-non-valida') {
      return { tipo: 'nonvalido', voci: [], avvisi: [av], minuti: 0, rientro: false };
    }
    var voci = M.dose(piano, stato, oggi);
    var lista = eOggetto(piano.giorni) && eArray(piano.giorni[oggi]) ? piano.giorni[oggi] : [];
    var minuti = 0, i;
    for (i = 0; i < lista.length; i++) minuti += lista[i] && lista[i].minuti > 0 ? lista[i].minuti : 0;
    var cfg = eOggetto(salvato.cfg) ? salvato.cfg : piano.cfg;
    var tipo;
    if (voci.length) tipo = 'dose';
    else if (lista.length) tipo = 'fatto';
    else if (eOggetto(cfg) && cfg.appello === oggi) tipo = 'esame';
    else if (!pianoConQualcosa(piano, oggi)) tipo = 'pianovuoto';
    else if (!giorniDiStudio(cfg)[giornoSettimana(oggi)]) tipo = 'libero';
    else tipo = 'oggivuoto';
    /* sul piano vuoto e il giorno dell'esame gli avvisi («non entra») e il rientro non
       dicono niente di utile: la frase e' una, e il gesto e' cambiare il piano */
    var muto = tipo === 'pianovuoto' || tipo === 'esame';
    return { tipo: tipo, voci: voci, avvisi: av && !muto ? [av] : [], minuti: minuti,
             rientro: !muto && saltati(salvato, oggi) };
  }

  /* le frasi degli avvisi del piano (solo quelle che il documento dei testi ha) */
  function frasiAvvisi(D, avvisi) {
    var out = [], i, j;
    function nome(m) {
      for (var k = 0; k < D.materie.length; k++) if (D.materie[k][0] === m) return D.materie[k][1];
      return m;
    }
    for (i = 0; i < avvisi.length; i++) {
      var a = avvisi[i];
      if (a.codice === 'non-entra') {
        var righe = eArray(a.materie) && a.materie.length ? a.materie : [a];
        for (j = 0; j < righe.length; j++) {
          /* nessuna lezione intera: una frase sua (prima: «Ti proponiamo 0 lezioni su 10») */
          if (!(righe[j].lezioni_incluse > 0)) {
            out.push(riempi(D.testi.non_entra_nessuna, { materia: nome(righe[j].materia) }));
            continue;
          }
          out.push(riempi(D.testi.non_entra, { materia: nome(righe[j].materia),
            incluse: righe[j].lezioni_incluse, totali: righe[j].lezioni_totali }));
        }
        if (eArray(a.ritardo)) for (j = 0; j < a.ritardo.length; j++) out.push(riempi(D.testi.ritardo, { materia: nome(a.ritardo[j].materia) }));
      } else if (a.codice === 'ritardo-partenza') {
        var r = eArray(a.materie) && a.materie.length ? a.materie : [a];
        for (j = 0; j < r.length; j++) out.push(riempi(D.testi.ritardo, { materia: nome(r[j].materia) }));
      } else if (a.codice === 'recuperato') {
        out.push(riempi(D.testi.in_pari, { materia: nome(a.materia) }));
      } else if (a.codice === 'cfg-non-valida' && a.campo === 'oreAlGiorno' && a.minimo > 0) {
        out.push(riempi(D.testi.q_minimo, { minimo: a.minimo }));
      }
    }
    return out;
  }

  /* LE MATERIE FUORI DAL PIANO (revisione S4). La domanda chiede «Da quale materia vuoi
     iniziare?», e con una materia sola il piano mette solo quella fino all'esame (la
     nota del documento dei testi, §4): chi sceglie Chimica non vede mai Fisica e
     Biologia, e non lo sa. Quale delle due strade (la domanda che dice il vero, o il
     piano che parte dalla materia scelta e poi aggiunge le altre) la sceglie l'utente al
     gate 8b; intanto lo si dice a schermo. -> la frase, o null se non manca niente. */
  function fraseFuori(D, cfg) {
    if (!eOggetto(cfg) || !eArray(cfg.materie)) return null;
    var dentro = {}, sono = [], fuori = [], i;
    for (i = 0; i < cfg.materie.length; i++) {
      var m = cfg.materie[i], nm = typeof m === 'string' ? m : (eOggetto(m) ? m.nome : null);
      if (typeof nm === 'string') dentro[nm] = true;
    }
    for (i = 0; i < D.materie.length; i++) (proprio(dentro, D.materie[i][0]) ? sono : fuori).push(D.materie[i][1]);
    if (!fuori.length || !sono.length) return null;
    function elenco(nomi) {
      return nomi.length < 2 ? nomi.join('') : nomi.slice(0, -1).join(', ') + ' ' + D.testi.e + ' ' + nomi[nomi.length - 1];
    }
    return riempi(D.testi.fuori_piano, { materie: elenco(sono), fuori: elenco(fuori) });
  }

  /* oggi una tappa ha avuto «no» o «incerto»: tornera' nei prossimi giorni */
  function daRifareOggi(stato, oggi) {
    for (var p in stato.tappe) {
      if (!proprio(stato.tappe, p) || !eOggetto(stato.tappe[p])) continue;
      for (var i = 0; i < TAPPE.length; i++) {
        var x = stato.tappe[p][TAPPE[i]];
        if (eOggetto(x) && x.fatto === oggi && (x.esito === 'no' || x.esito === 'incerto')) return true;
      }
    }
    return false;
  }

  /* la cfg dalle risposte del modulo, o un errore. `minimo` = la tappa piu'
     lunga del piano (RITMI.tappaMin): sotto, non entra nemmeno un passo. `oggi`: la
     data dell'esame viene dopo (il giorno stesso non c'e' niente da pianificare) */
  function cfgDalleRisposte(r, D, minimo, oggi) {
    var appello = r.appello === 'altra' ? r.data : r.appello;
    if (!eGiorno(appello)) return { errore: 'manca' };
    if (eGiorno(oggi) && appello <= oggi) return { errore: 'data' };
    var minuti = r.tempo === 'personalizza' ? parseInt(r.minuti, 10) : parseInt(r.tempo, 10);
    if (!(minuti > 0)) return { errore: 'manca' };
    if (minimo > 0 && minuti < minimo) return { errore: 'minimo' };
    var materie = [], i;
    for (i = 0; i < D.materie.length; i++) {
      var m = D.materie[i][0];
      if (r.materia === 'tutte' || r.materia === m) {
        var pr = parseInt(r.priorita && r.priorita[m], 10);
        materie.push({ nome: m, priorita: pr > 1 ? pr : 1 });
      }
    }
    if (!materie.length) return { errore: 'manca' };
    var giorni = [], almeno = false;
    for (i = 0; i < 7; i++) {
      var on = !r.giorni || r.giorni[i] !== false;
      giorni.push(on);
      if (on) almeno = true;
    }
    if (!almeno) return { errore: 'giorni' };
    return { cfg: { appello: appello, materie: materie, oreAlGiorno: minuti / 60, giorni: giorni } };
  }

  /* ------------------------------------------------------------------ *
   * la pagina                                                           *
   * ------------------------------------------------------------------ */
  function Home(doc, D, amb) {
    this.doc = doc;
    this.D = D;
    this.amb = amb;
    this.st = amb.storage;
    this.M = amb.Masterplan || null;
    this.mole = moleDa(D);
    this.nodi = {
      stato: doc.getElementById('hs-stato'),
      eco: doc.getElementById('hs-eco'),
      form: doc.getElementById('piano'),
      cambia: doc.getElementById('hs-cambia')
    };
    this.ultimoStato = null;
    /* l'attesa della conferma dei dati (vedi `chiediConferma`) e quella della prima
       lettura su un browser nuovo (`primaLettura`) */
    this.attesaChiesta = false;
    this.erroreAttesa = false;
    this.aspettaPrima = false;
  }

  Home.prototype.oggi = function () { return giornoLocale(this.amb.adesso(), this.amb.Data); };

  Home.prototype.minuti = function () {
    var R = this.M && this.M.RITMI ? this.M.RITMI : null;
    var tappe = R && R.tappe ? R.tappe : {};
    return { tappe: tappe, ripasso: R ? R.ripasso : 0, sbagliate: R ? R.sbagliate : 0,
             minimo: R && R.tappaMin > 0 ? R.tappaMin : 0,
             rinvioNo: R ? R.rinvioNo : 1, rinvioIncerto: R ? R.rinvioIncerto : 0 };
  };

  /* i dati legati a un account e il token non ancora confermato: non si
     mostra niente e non si accettano gesti (la regola di scatole.js, S2b) */
  Home.prototype.inAttesa = function () {
    var S = this.amb.Sync;
    try { return !!(S && typeof S.inAttesa === 'function' && S.inAttesa()); } catch (e) { return false; }
  };

  /* LA CONFERMA DEI DATI IN ATTESA: una lettura dal server, forzata (il freno di un
     minuto del modulo vale per le riletture in vista, non per un token che nessuno ha
     ancora confermato), chiesta una volta per ogni ingresso nell'attesa, da qualunque
     strada ci si arrivi (il montaggio, un token cambiato in un'altra scheda). Riuscita,
     la sincronizzazione avvisa (`studio:stato`) e Oggi si ridisegna; fallita, lo si dice
     col motivo e con «Riprova» (la regola di scatole.js). Prima della revisione S4 la
     frase «stiamo ritrovando i tuoi progressi» restava per sempre col server giu', e
     senza un bottone. */
  Home.prototype.chiediConferma = function () {
    var self = this, S = this.amb.Sync, p = null;
    this.attesaChiesta = true;
    try { p = S && typeof S.rileggi === 'function' ? S.rileggi(true) : null; } catch (e) { p = null; }
    function dopo(r) {
      self.erroreAttesa = self.inAttesa() ? ((r && r.esito) || 'errore') : false;
      self.disegna();
      self.statoTappe();
    }
    if (p && typeof p.then === 'function') p.then(dopo, function () { dopo(null); }); else dopo(null);
  };
  /* «Riprova» */
  Home.prototype.riprova = function () {
    this.erroreAttesa = false;
    this.attesaChiesta = false;
    this.disegna();
    this.statoTappe();
  };

  /* IL PRIMO INGRESSO SU QUESTO BROWSER (revisione S4): la sincronizzazione e'
     configurata (`window.STUDIO_SYNC`, che site.js scrive e da cui studio_sync.js
     parte), c'e' un token, e questo browser non e' mai stato legato a un account: la
     prima lettura dal server e' in volo, e cio' che c'e' qui (niente) non e' ancora il
     vero. Oggi tiene il posto finche' la lettura non torna, al piu' OGGI_ATTESA_MS; poi
     decide. Prima il dispositivo nuovo diceva per un lampo «Non sappiamo ancora quando
     hai l'esame», e chi rispondeva in quel momento faceva un piano nuovo che il server
     poi batteva. */
  Home.prototype.primaLettura = function () {
    var S = this.amb.Sync, cfg = this.amb.config, tok = null;
    if (!S || typeof S.leggi !== 'function' || !eOggetto(cfg) || typeof cfg.api !== 'string' || !cfg.api) return false;
    try { tok = this.st.getItem(S.CHIAVI && S.CHIAVI.token ? S.CHIAVI.token : CHIAVE_TOKEN_BASE); } catch (e) { tok = null; }
    if (!tok) return false;
    try { var s = S.leggi(this.st); return eOggetto(s) && s.utente === null; } catch (e2) { return false; }
  };

  Home.prototype.el = function (tag, classe, testo) {
    var n = this.doc.createElement(tag);
    if (classe) n.setAttribute('class', classe);
    if (testo !== undefined && testo !== null) n.textContent = testo;
    return n;
  };

  /* salva il piano (forma ridotta) e, se e' una SCELTA dello studente, lo segna per il
     server (`spingi`, che lo timbra con l'ora di adesso).
     `automatico` = il risalvataggio del primo passaggio del giorno (la lista di oggi per
     `riadatta`), che non e' una scelta: non si spinge e `aggiornato` resta quello
     dell'ultima scelta. Il valore cambiato studio_sync.js lo trova da se' alla lettura o
     alla spinta successiva, e lo spedisce con l'ora della sua versione di base, non con
     quella di adesso. Prima della revisione S4 il portatile rimasto a ieri, aperto il
     mattino, risalvava la cfg vecchia con l'ora di adesso e se la lettura tardava piu'
     dei 2 s della spinta cancellava sul server il piano cambiato ieri sera sul telefono
     (regola 3 di `Sync.unisci`: vince il salvataggio piu' recente). */
  Home.prototype.salva = function (cfg, piano, automatico, aggiornato) {
    var quando = automatico && typeof aggiornato === 'number' && isFinite(aggiornato) ? aggiornato : this.amb.adesso();
    var ok = scriviPiano(this.st, { v: VERSIONE, cfg: cfg, piano: daSalvare(this.M, piano), aggiornato: quando });
    if (!automatico) this.spingi(CHIAVE_PIANO);
    return ok;
  };

  Home.prototype.spingi = function (nome) {
    var S = this.amb.Sync;
    try { if (S && typeof S.spingi === 'function') S.spingi(nome); } catch (e) { /* mai fermare lo studio */ }
  };

  /* LA TAPPA RICHIAMA VIAGGIA (revisione S4). Le carte e i quiz stanno nei cassetti di
     QUESTO browser, fuori dalla sincronizzazione: il telefono sapeva che Richiama era
     fatta, il PC no, e ci riproponeva per giorni la stessa tappa. Il giorno letto dai
     cassetti (`richiamaLocale`, solo quelli dell'account di adesso) si scrive in
     `studio-tappe`, che e' sincronizzata, quando e' piu' recente di cio' che la chiave ha
     gia'; una parte che la chiave porta illeggibile non si tocca. */
  Home.prototype.portaRichiama = function (r) {
    if (!eOggetto(r)) return;
    var blob = leggiJson(this.st, CHIAVE_TAPPE), cambiato = false, p;
    if (!eOggetto(blob)) blob = {};
    for (p in r) {
      if (!proprio(r, p) || !RE_PARTE.test(p) || !eGiorno(r[p])) continue;
      if (proprio(blob, p) && blob[p] !== null && blob[p] !== undefined && !eOggetto(blob[p])) continue;
      var ora = eOggetto(blob[p]) ? giornoDiTappa(blob[p].richiama) : null;
      if (ora && ora >= r[p]) continue;
      if (!eOggetto(blob[p])) blob[p] = {};
      blob[p].richiama = r[p];
      cambiato = true;
    }
    if (cambiato && scriviTappe(this.st, blob)) this.spingi(CHIAVE_TAPPE);
  };

  /* il cuore: che cosa dice Oggi adesso */
  Home.prototype.disegna = function () {
    var n = this.nodi.stato, D = this.D, T = D.testi;
    if (!n) return;
    var oggi = this.oggi(), att = this.inAttesa();
    var primo = !att && this.aspettaPrima && this.primaLettura();
    var eraInAttesa = !!(this.ultimoStato && this.ultimoStato.tipo === 'attesa');
    n.textContent = '';
    if (att || primo) {
      n.setAttribute('data-stato', 'attesa');
      /* i dati di prima non restano nel modulo aperto (un'altra scheda puo' aver
         cambiato l'account mentre si rispondeva) */
      if (this.nodi.form) this.nodi.form.hidden = true;
      var err = att ? this.erroreAttesa : false, self = this;
      if (err) n.removeAttribute('aria-busy'); else n.setAttribute('aria-busy', 'true');
      if (err === 'non-autenticato') {
        n.appendChild(this.el('p', 'hs-sotto', T.attesa_sessione));
      } else if (err) {
        n.appendChild(this.el('p', 'hs-sotto', T.attesa_rete));
      } else {
        n.appendChild(this.el('p', 'hs-sotto', T.attesa));
      }
      if (err) {
        var cta = this.el('div', 'hero-cta hs-cta');
        if (err === 'non-autenticato' && D.link && D.link.entra) cta.appendChild(this.link(T.entra, D.link.entra, true));
        cta.appendChild(this.bottone(T.riprova, !(err === 'non-autenticato' && D.link && D.link.entra),
                                     function () { self.riprova(); }));
        n.appendChild(cta);
      }
      this.ultimoStato = { tipo: 'attesa' };
      this.aggiornaCambia(null);
      this.statoTappe();
      if (att && !this.attesaChiesta) this.chiediConferma();
      return;
    }
    n.removeAttribute('aria-busy');
    this.attesaChiesta = false;
    this.erroreAttesa = false;
    var stato = statoPerPiano(this.amb);
    this.portaRichiama(stato.richiamaQui);
    var salvato = leggiPiano(this.st);
    var piano = this.M ? calcolaPiano(this.M, salvato, stato, oggi, this.mole) : null;
    /* il primo passaggio di un giorno salva il piano di oggi: domani `riadatta`
       ritrova la lista di oggi (cio' che e' gia' fatto non torna). E' automatico:
       non diventa piu' recente di una scelta fatta su un altro dispositivo (`salva`) */
    if (salvato && piano && (!eOggetto(salvato.piano) || salvato.piano.generato !== oggi)) {
      this.salva(salvato.cfg, piano, true, salvato.aggiornato);
    }
    var corrente = lezioneCorrente(D, this.st);
    /* la riserva e' per chi non ha un piano (o non ha il modulo che lo calcola) */
    var voceRiserva = salvato && this.M ? null : riserva(D, stato, this.st, corrente, this.minuti());
    var s = decidi(this.M, piano, stato, oggi, salvato, voceRiserva);
    this.ultimoStato = s;
    this.stato = stato;
    n.setAttribute('data-stato', s.tipo);
    this.aggiornaCambia(salvato);

    var titolo = null, sotto = null;
    if (s.tipo === 'vuoto' || s.tipo === 'riserva') { titolo = T.vuoto_titolo; sotto = T.vuoto_riga; }
    else if (s.tipo === 'libero') { titolo = T.libero_titolo; sotto = T.libero_riga; }
    else if (s.tipo === 'oggivuoto') { titolo = T.libero_titolo; sotto = T.oggi_vuoto_riga; }
    /* «Fatto per oggi» non dichiara minuti fatti: i minuti sono la stima del piano, non
       una misura (revisione S4: «60 minuti fatti» dopo due «no» e cinque minuti di clic) */
    else if (s.tipo === 'fatto') { titolo = T.fatto_titolo; sotto = T.fatto_riga; }
    else if (s.tipo === 'passato') { titolo = null; sotto = T.esame_passato; }
    else if (s.tipo === 'esame') { titolo = null; sotto = T.esame_oggi; }
    else if (s.tipo === 'pianovuoto') { titolo = null; sotto = T.piano_vuoto; }
    else if (s.tipo === 'nonvalido') { titolo = null; sotto = T.piano_non_regge; }
    if (s.rientro) {
      n.appendChild(this.el('h2', 'hs-titolo', T.rientro_titolo));
      n.appendChild(this.el('p', 'hs-sotto', T.rientro_riga));
    }
    /* la voce di riserva viene PRIMA dell'invito a costruire il piano: e' la cosa
       da fare adesso, e il bottone pieno e' il suo */
    if (s.voci.length) n.appendChild(this.lista(s.voci, s.tipo));
    if (titolo) n.appendChild(this.el('h2', 'hs-titolo', titolo));
    if (sotto) n.appendChild(this.el('p', 'hs-sotto', sotto));
    if (s.tipo === 'fatto' && daRifareOggi(stato, oggi)) n.appendChild(this.el('p', 'hs-sotto', T.fatto_da_rifare));
    var avvisi = frasiAvvisi(D, s.avvisi);
    if (s.tipo === 'dose' || s.tipo === 'fatto' || s.tipo === 'libero' || s.tipo === 'oggivuoto') {
      var fuori = fraseFuori(D, salvato && salvato.cfg);
      if (fuori) avvisi.push(fuori);
    }
    for (var i = 0; i < avvisi.length; i++) n.appendChild(this.el('p', 'hs-avviso', avvisi[i]));

    var cta = this.el('div', 'hero-cta hs-cta');
    if (s.tipo === 'vuoto' || s.tipo === 'riserva') {
      if (this.M) cta.appendChild(this.bottone(T.vuoto_cta, s.tipo === 'vuoto', this.apriModulo));
      var prima = D.lezioni[D.ordine[0]];
      if (s.tipo === 'vuoto' && prima) cta.appendChild(this.link(riempi(T.vuoto_parti, { prima_lezione: prima.nome }),
        riempi(D.link.lezione, { p: prima.p }), false));
    } else if ((s.tipo === 'libero' || s.tipo === 'oggivuoto') && corrente) {
      var L = D.lezioni[corrente.s];
      if (L) cta.appendChild(this.link(L.nome + ' · ' + L.t, riempi(D.link.lezione, { p: L.p }), false));
    } else if (s.tipo === 'passato' || s.tipo === 'nonvalido' || s.tipo === 'esame' || s.tipo === 'pianovuoto') {
      cta.appendChild(this.bottone(T.cambia, true, this.apriModulo));
    }
    if (cta.firstChild) n.appendChild(cta);
    /* e lo stato delle tappe della lezione mostrata, sullo stesso stato */
    this.statoTappe();
    /* i dati appena confermati: la lezione scelta qui (anche altrove) torna nel selettore */
    if (eraInAttesa) this.allinea();
  };

  /* la «Cambia il piano» sotto Oggi esce solo con un piano */
  Home.prototype.aggiornaCambia = function (salvato) {
    var b = this.nodi.cambia;
    if (!b) return;
    b.hidden = !(salvato && this.M);
    /* la riga che lo contiene sparisce con lui: una riga vuota lascerebbe un buco */
    if (b.parentNode && b.parentNode.nodeType === 1) b.parentNode.hidden = b.hidden;
  };

  Home.prototype.bottone = function (testo, pieno, azione) {
    var self = this, b = this.el('button', pieno ? 'btn btn-primary' : 'btn btn-ghost', testo);
    b.setAttribute('type', 'button');
    b.addEventListener('click', function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); azione.call(self); });
    return b;
  };
  Home.prototype.link = function (testo, href, pieno) {
    var a = this.el('a', pieno ? 'btn btn-primary' : 'btn btn-ghost', testo);
    a.setAttribute('href', href);
    return a;
  };

  /* l'elenco delle voci: una frase, dove si fa, e la risposta se la tappa la chiede */
  Home.prototype.lista = function (voci, tipo) {
    var D = this.D, T = D.testi, ol = this.el('ol', 'hs-voci'), i;
    for (i = 0; i < voci.length; i++) {
      var v = voci[i], li = this.el('li', 'hs-voce');
      li.setAttribute('data-parte', v.parte);
      li.setAttribute('data-tappa', v.tappa);
      li.setAttribute('data-tipo', v.tipo);
      var nome = nomeParte(D, v.parte), x = lezioneDi(D, v.parte), frase, href, cta;
      if (v.tipo === 'sbagliate') {
        frase = riempi(T.sbagliate, { lezione: nome });
        href = linkDi(D, 'sbagliate', v.parte);
        cta = T.sbagliate_cta;
      } else if (v.tipo === 'bestie') {
        frase = riempi(T.bestie, { lezione: nome });
        href = linkDi(D, 'bestie', v.parte);
        cta = T.bestie_cta;
      } else {
        frase = riempi(T.dose, { lezione: nome, tappa: nomeTappa(D, v.tappa), minuti: v.minuti });
        href = linkTappa(D, v.parte, v.tappa);
        cta = bottoneTappa(D, v.tappa);
      }
      li.appendChild(this.el('p', 'hs-frase', frase));
      if (x) li.appendChild(this.el('p', 'hs-titolo-lezione', x.L.t));
      var az = this.el('p', 'hs-azioni');
      az.appendChild(this.link(cta, href, i === 0));
      li.appendChild(az);
      if (v.tipo !== 'sbagliate' && v.tipo !== 'bestie') this.risposte(li, v);
      ol.appendChild(li);
    }
    return ol;
  };

  /* «Come te la senti?» dopo Capisci e Fai; «Fatto» per Non cascarci; niente per
     Richiama, che si legge da sola */
  Home.prototype.risposte = function (li, v) {
    var T = this.D.testi, self = this, box, scelte, i;
    if (proprio(CON_DOMANDA, v.tappa)) {
      box = this.el('div', 'hs-come');
      box.setAttribute('role', 'group');
      box.appendChild(this.el('span', 'hs-come-d', T.come));
      scelte = [['so', T[CON_DOMANDA[v.tappa]]], ['incerto', T.incerto], ['no', T.no]];
    } else if (proprio(SOLO_FATTO, v.tappa)) {
      box = this.el('div', 'hs-come');
      scelte = [['fatto', T.fatto_cta]];
    } else {
      return;
    }
    for (i = 0; i < scelte.length; i++) {
      (function (r, testo) {
        var b = self.el('button', 'btn btn-ghost hs-risposta', testo);
        b.setAttribute('type', 'button');
        b.setAttribute('data-risposta', r);
        b.addEventListener('click', function () { self.rispondi(v.parte, v.tappa, r); });
        box.appendChild(b);
      })(scelte[i][0], scelte[i][1]);
    }
    li.appendChild(box);
  };

  /* LA RISPOSTA: si scrive in studio-tappe (sincronizzato), parte come evento
     `tappa`, e Oggi si ricalcola; il fuoco va alla prossima cosa da fare (o, per una
     risposta data nella lezione, resta li') e la frase di ritorno la legge chi ascolta
     (aria-live) */
  Home.prototype.rispondi = function (parte, tappa, risposta, dallaLezione) {
    if (this.inAttesa() || !RE_PARTE.test(parte) || TAPPE.indexOf(tappa) < 0) return false;
    var oggi = this.oggi(), blob = leggiJson(this.st, CHIAVE_TAPPE);
    if (!eOggetto(blob)) blob = {};
    if (!eOggetto(blob[parte])) blob[parte] = {};
    blob[parte][tappa] = risposta === 'fatto' ? oggi : { fatto: oggi, esito: risposta };
    if (!scriviTappe(this.st, blob)) return false;
    this.spingi(CHIAVE_TAPPE);
    var S = this.amb.Sync, x = lezioneDi(this.D, parte);
    try {
      var item = S && typeof S.itemTappa === 'function' ? S.itemTappa(parte, tappa) : null;
      if (item && typeof this.amb.studioEvento === 'function') {
        this.amb.studioEvento({ kind: 'tappa', item: item, lezione: parte,
                                materia: x ? x.L.m : null, esito: ESITO_EVENTO[risposta], ultimo: oggi });
      }
    } catch (e) { /* un evento non deve mai fermare lo studio */ }
    this.eco(this.fraseDopo(risposta));
    this.disegna();
    if (dallaLezione) this.fuocoLezione(parte, tappa, risposta);
    else this.fuoco();
    return true;
  };

  /* dopo una risposta data nella lezione il fuoco resta sul bottone premuto (ridisegnato):
     portarlo su Oggi, in cima alla pagina, farebbe perdere il posto a chi usa la tastiera */
  Home.prototype.fuocoLezione = function (parte, tappa, risposta) {
    var box = this.doc.querySelector('[data-hs-come="' + tappa + '"]');
    var b = box ? box.querySelectorAll('button') : [], i;
    for (i = 0; i < b.length; i++) {
      if (b[i].getAttribute('data-parte') === parte && b[i].getAttribute('data-risposta') === risposta) {
        try { b[i].focus(); } catch (e) {}
        return;
      }
    }
  };

  /* LE RISPOSTE NELLA LEZIONE (revisione S4): sotto ogni tappa che le chiede, per la
     lezione mostrata, parte per parte, gli stessi gesti di Oggi («So spiegarlo / Incerto /
     No» per Capisci e Fai, «Fatto» per Non cascarci). Prima si rispondeva solo dentro Oggi:
     chi studiava una lezione scelta dal selettore non aveva dove dirlo, e il piano gli
     riproponeva le tappe fatte. */
  Home.prototype.comeLezione = function (box, s, L) {
    var tappa = box.getAttribute('data-hs-come'), T = this.D.testi, self = this, p, i;
    box.textContent = '';
    var scelte = proprio(CON_DOMANDA, tappa) ? [['so', T[CON_DOMANDA[tappa]]], ['incerto', T.incerto], ['no', T.no]]
      : (proprio(SOLO_FATTO, tappa) ? [['fatto', T.fatto_cta]] : null);
    if (!scelte || !L) { box.hidden = true; return; }
    if (proprio(CON_DOMANDA, tappa)) box.appendChild(this.el('p', 'hs-come-q', T.come));
    for (p = 0; p < 2; p++) {
      var lettera = p ? 'B' : 'A';
      if (!proprio(L.a, lettera)) continue;
      var g = this.el('div', 'hs-come'), nome = riempi(T.parte_sola, { parte: lettera });
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', nome);
      g.appendChild(this.el('span', 'hs-come-d', nome));
      for (i = 0; i < scelte.length; i++) {
        (function (parte, r, testo) {
          var b = self.el('button', 'btn btn-ghost hs-risposta', testo);
          b.setAttribute('type', 'button');
          b.setAttribute('data-risposta', r);
          b.setAttribute('data-parte', parte);
          b.addEventListener('click', function () { self.rispondi(parte, tappa, r, true); });
          g.appendChild(b);
        })(s + '-' + lettera, scelte[i][0], scelte[i][1]);
      }
      box.appendChild(g);
    }
    box.hidden = !box.firstChild;
  };

  Home.prototype.fraseDopo = function (risposta) {
    var T = this.D.testi, m = this.minuti();
    if (risposta === 'no') {
      return m.rinvioNo === 1 ? T.dopo_no : riempi(T.dopo_no_giorni, { giorni: inLettere(this.D, m.rinvioNo) });
    }
    if (risposta === 'incerto') return riempi(T.dopo_incerto, { giorni: inLettere(this.D, m.rinvioIncerto) });
    return '';
  };

  /* la frase di ritorno: la regione `aria-live` resta SEMPRE nella pagina (una
     regione che compare insieme al suo testo non viene letta), cambia solo il testo */
  Home.prototype.eco = function (testo) {
    var e = this.nodi.eco;
    if (e) e.textContent = testo || '';
  };

  /* il fuoco dopo un gesto: il primo bottone della prima voce, o il titolo */
  Home.prototype.fuoco = function () {
    var n = this.nodi.stato;
    if (!n) return;
    var dove = n.querySelector('a.btn') || n.querySelector('button') || n.querySelector('h2');
    if (dove) {
      if (!dove.getAttribute('tabindex') && dove.tagName === 'H2') dove.setAttribute('tabindex', '-1');
      try { dove.focus(); } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------ *
   * le tre domande                                                      *
   * ------------------------------------------------------------------ */
  Home.prototype.apriModulo = function () {
    var f = this.nodi.form;
    if (!f) return;
    this.prepara();
    f.hidden = false;
    var primo = f.querySelector('input');
    try { if (primo) primo.focus(); } catch (e) {}
  };

  /* le date d'appello gia' passate (e quella di oggi: il giorno dell'esame non c'e'
     niente da pianificare) non si offrono, e una nascosta non resta scelta; il modulo
     riprende le risposte del piano salvato; il minimo dei minuti e' quello del piano */
  Home.prototype.prepara = function () {
    var f = this.nodi.form, oggi = this.oggi(), i;
    if (!f) return;
    var radio = f.querySelectorAll('input[name="appello"]');
    for (i = 0; i < radio.length; i++) {
      var v = radio[i].getAttribute('value');
      var l = radio[i].closest ? radio[i].closest('label') : null;
      if (l && eGiorno(v)) {
        l.hidden = v <= oggi;
        if (l.hidden) radio[i].checked = false;
      }
    }
    var min = this.minuti().minimo, mi = f.querySelector('input[name="minuti"]');
    if (mi && min > 0) mi.setAttribute('min', String(min));
    var s = leggiPiano(this.st);
    if (s && eOggetto(s.cfg)) this.compila(s.cfg, oggi);
  };

  /* le risposte del piano salvato nel modulo; una data d'esame gia' passata no (revisione
     S4: riaperto dopo l'esame, il modulo teneva scelta la data vecchia, NASCOSTA, e
     l'invio la riconfermava senza dire niente): il modulo la richiede */
  Home.prototype.compila = function (cfg, oggi) {
    var f = this.nodi.form, i;
    function scegli(nome, valore) {
      var r = f.querySelectorAll('input[name="' + nome + '"]'), trovato = false;
      for (var k = 0; k < r.length; k++) {
        r[k].checked = r[k].getAttribute('value') === valore;
        if (r[k].checked) trovato = true;
      }
      return trovato;
    }
    if (eGiorno(cfg.appello) && !(eGiorno(oggi) && cfg.appello <= oggi) && !scegli('appello', cfg.appello)) {
      scegli('appello', 'altra');
      var d = f.querySelector('input[name="data"]');
      if (d) d.value = cfg.appello;
    }
    var min = Math.round((Number(cfg.oreAlGiorno) || 0) * 60);
    if (min > 0 && !scegli('tempo', String(min))) {
      scegli('tempo', 'personalizza');
      var mi = f.querySelector('input[name="minuti"]');
      if (mi) mi.value = String(min);
    }
    var m = eArray(cfg.materie) ? cfg.materie : [];
    if (m.length === 1) scegli('materia', typeof m[0] === 'string' ? m[0] : m[0].nome);
    else if (m.length > 1) scegli('materia', 'tutte');
    for (i = 0; i < m.length; i++) {
      var sel = eOggetto(m[i]) ? f.querySelector('select[name="priorita-' + m[i].nome + '"]') : null;
      if (sel) sel.value = String(m[i].priorita > 1 ? 2 : 1);
    }
    if (eArray(cfg.giorni) && cfg.giorni.length === 7) {
      for (i = 0; i < 7; i++) {
        var c = f.querySelector('input[name="giorno-' + i + '"]');
        if (c) c.checked = cfg.giorni[i] !== false;
      }
    }
    this.mostraCampi();
  };

  Home.prototype.valore = function (nome) {
    var r = this.nodi.form.querySelectorAll('input[name="' + nome + '"]');
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].getAttribute('value');
    return '';
  };

  /* i campi che si aprono con «un'altra data» e con «personalizza» */
  Home.prototype.mostraCampi = function () {
    var f = this.nodi.form;
    if (!f) return;
    var altra = f.querySelector('[data-hs-campo="data"]');
    if (altra) altra.hidden = this.valore('appello') !== 'altra';
    var pers = this.valore('tempo') === 'personalizza';
    var mi = f.querySelector('[data-hs-campo="minuti"]');
    if (mi) mi.hidden = !pers;
    var extra = f.querySelector('[data-hs-campo="personalizza"]');
    if (extra && pers) extra.hidden = false;
  };

  Home.prototype.risposteModulo = function () {
    var f = this.nodi.form, D = this.D, r = { priorita: {}, giorni: [] }, i;
    r.appello = this.valore('appello');
    var d = f.querySelector('input[name="data"]');
    r.data = d ? d.value : '';
    r.tempo = this.valore('tempo');
    var mi = f.querySelector('input[name="minuti"]');
    r.minuti = mi ? mi.value : '';
    r.materia = this.valore('materia');
    for (i = 0; i < D.materie.length; i++) {
      var sel = f.querySelector('select[name="priorita-' + D.materie[i][0] + '"]');
      r.priorita[D.materie[i][0]] = sel ? sel.value : '1';
    }
    for (i = 0; i < 7; i++) {
      var c = f.querySelector('input[name="giorno-' + i + '"]');
      r.giorni.push(c ? !!c.checked : true);
    }
    return r;
  };

  /* LE TRE RISPOSTE -> il piano: pianifica (o riadatta il piano salvato con la
     cfg nuova: il passato resta), si salva, Oggi lo dice */
  Home.prototype.invia = function () {
    var T = this.D.testi, err = this.doc.getElementById('hs-err');
    if (!this.M || this.inAttesa()) return false;
    var oggi = this.oggi();
    var m = this.minuti(), c = cfgDalleRisposte(this.risposteModulo(), this.D, m.minimo, oggi);
    function errore(testo) {
      if (err) { err.textContent = testo; err.hidden = false; }
      return false;
    }
    if (c.errore) {
      return errore(c.errore === 'minimo' ? riempi(T.q_minimo, { minimo: m.minimo })
        : (c.errore === 'giorni' ? T.q_giorni_nessuno : (c.errore === 'data' ? T.q_data_passata : T.q_manca)));
    }
    if (err) { err.textContent = ''; err.hidden = true; }
    var stato = statoPerPiano(this.amb), salvato = leggiPiano(this.st), piano;
    try {
      piano = salvato && eOggetto(salvato.piano)
        ? this.M.riadatta(salvato.piano, stato, oggi, c.cfg, this.mole)
        : this.M.pianifica(c.cfg, this.mole, stato, oggi);
    } catch (e) { piano = null; }
    if (!piano) return false;
    /* IL MINIMO SI MISURA SUL PIANO che ne esce, non solo sul tempo (revisione S4): con
       l'esame vicino e poco tempo il piano puo' non metterci niente, e salvarlo voleva
       dire mostrare un «giorno libero» dopo l'altro. Una cfg che il modulo boccia
       (`cfg-non-valida`) invece si salva e si dice (stato «nonvalido»). */
    var codice = eOggetto(piano.avviso) ? piano.avviso.codice : null;
    if (codice !== 'cfg-non-valida' && !pianoConQualcosa(piano, oggi)) return errore(T.piano_vuoto);
    this.salva(c.cfg, piano);
    this.nodi.form.hidden = true;
    this.disegna();
    this.fuoco();
    return true;
  };

  /* ------------------------------------------------------------------ *
   * la lezione corrente e la sezione «La tua lezione»                   *
   * ------------------------------------------------------------------ */
  /* il selettore (lo script dello Studypack, in site.js) sceglie la lezione
     dall'indirizzo o dall'ultima letta; se la scelta fatta QUI (studio-lezione,
     anche da un altro dispositivo) e' piu' recente, la si rimette. Con i dati in
     attesa di conferma no: `studio-lezione` puo' essere di chi usava il browser
     prima (revisione S4). Un allineamento non e' una scelta dello studente:
     mentre dura, `ricorda` non scrive (`allineando`). */
  Home.prototype.allinea = function () {
    var D = this.D, sel = this.doc.getElementById('sp-lezione'), mat = this.doc.getElementById('sp-materia');
    if (this.inAttesa()) return;
    var c = lezioneCorrente(D, this.st), cerca = '';
    try { cerca = String(this.amb.location && this.amb.location.search || ''); } catch (e) { cerca = ''; }
    if (!sel || !mat || !c || c.fonte !== 'scelta' || /[?&]lezione=/.test(cerca)) return;
    var L = D.lezioni[c.s];
    if (!L || sel.value === c.s) return;
    this.allineando = true;
    try {
      mat.value = L.m;
      mat.dispatchEvent(nuovoEvento(this.doc, 'change'));
      sel.value = c.s;
      sel.dispatchEvent(nuovoEvento(this.doc, 'change'));
    } finally { this.allineando = false; }
  };

  /* la scelta nel selettore diventa la lezione corrente (sincronizzata) */
  Home.prototype.ricorda = function (s) {
    if (this.allineando || !proprio(this.D.lezioni, s) || this.inAttesa()) return;
    if (scriviLezione(this.st, { s: s, t: this.amb.adesso() })) this.spingi(CHIAVE_LEZIONE);
  };

  /* lo stato di ogni tappa della lezione mostrata, parte per parte, senza
     spunte: «Parte A: incerto · Parte B: da fare» */
  Home.prototype.statoTappe = function () {
    var D = this.D, T = D.testi, sel = this.doc.getElementById('sp-lezione');
    var s = sel && proprio(D.lezioni, sel.value) ? sel.value : null;
    var righe = this.doc.querySelectorAll('[data-hs-tappa]'), i, p;
    var come = this.doc.querySelectorAll('[data-hs-come]');
    if (!s || !this.stato || this.inAttesa() || (this.ultimoStato && this.ultimoStato.tipo === 'attesa')) {
      for (i = 0; i < righe.length; i++) righe[i].hidden = true;
      for (i = 0; i < come.length; i++) { come[i].textContent = ''; come[i].hidden = true; }
      return;
    }
    var L = D.lezioni[s], iniziata = false, testi = [];
    for (i = 0; i < come.length; i++) this.comeLezione(come[i], s, L);
    for (i = 0; i < righe.length; i++) {
      var tappa = righe[i].getAttribute('data-hs-tappa'), pezzi = [];
      for (p = 0; p < 2; p++) {
        var lettera = p ? 'B' : 'A';
        if (!proprio(L.a, lettera)) continue;
        var tp = this.stato.tappe[s + '-' + lettera], x = eOggetto(tp) ? tp[tappa] : null;
        var es = eOggetto(x) && typeof x.esito === 'string' ? x.esito : null;
        if (giornoDiTappa(x)) iniziata = true;
        var parola = !giornoDiTappa(x) ? T.stato_da_fare
          : (es === 'so' ? (tappa === 'fai' ? T.so_fai : T.so_capisci).toLowerCase()
            : (es === 'incerto' ? T.incerto.toLowerCase() : (es === 'no' ? T.stato_da_rifare : T.stato_fatto)));
        pezzi.push(riempi(T.stato_parte, { parte: lettera, stato: parola }));
      }
      testi.push(pezzi.join(' · '));
    }
    /* una lezione mai toccata non ha niente da dire: quattro righe di «da fare»
       sarebbero rumore, e lo stato si vede dal primo gesto */
    for (i = 0; i < righe.length; i++) {
      righe[i].textContent = testi[i];
      righe[i].hidden = !iniziata || !testi[i];
    }
  };

  function nuovoEvento(doc, tipo) {
    try { return new global.Event(tipo, { bubbles: true }); } catch (e) {
      try { var ev = doc.createEvent('Event'); ev.initEvent(tipo, true, true); return ev; } catch (e2) { return { type: tipo, bubbles: true }; }
    }
  }

  /* ------------------------------------------------------------------ *
   * il montaggio                                                        *
   * ------------------------------------------------------------------ */
  function datiValidi(D) {
    return eOggetto(D) && eArray(D.ordine) && eOggetto(D.lezioni) && eOggetto(D.testi);
  }
  /* un'isola nella pagina (la forma di prima della revisione S4: la si legge ancora, se
     c'e'), o null */
  function leggiIsola(doc) {
    var n = doc.getElementById('studio-home-dati');
    if (!n) return null;
    try {
      var D = JSON.parse(n.textContent || 'null');
      return datiValidi(D) ? D : null;
    } catch (e) { return null; }
  }

  /* I DATI DELLA HOME (revisione S4, il peso). Stanno in un file di `data/`, cifrato come
     gli altri da site_lock.py, e si leggono dallo sportello (studio_fetch.js,
     `StudioFetch.leggi`): nella pagina erano 22 KB, piu' i 6 KB della mappa di
     «Riprendi», e la pagina cifrata pesava 112 KB contro il tetto di 80. La pagina dice
     dove stanno (`data-hs-dati` sullo stato di Oggi) e porta le frasi che servono PRIMA
     che arrivino: l'attesa (`data-attesa`), l'errore (`data-errore`) e «Riprova»
     (`data-riprova`). Finche' non arrivano Oggi tiene il posto (aria-busy): la pagina
     senza script dice il primo giorno, e a chi ha un piano direbbe il falso. */
  function carica(doc, opz, fatto) {
    var n = doc.getElementById('hs-stato');
    var url = n ? n.getAttribute('data-hs-dati') : null;
    if (!n || !url) return false;
    var o = opz || {};
    var F = o.StudioFetch !== undefined ? o.StudioFetch : global.StudioFetch;
    function riga(testo) {
      var p = doc.createElement('p');
      p.setAttribute('class', 'hs-sotto');
      p.textContent = testo || '';
      return p;
    }
    function attesa() {
      n.textContent = '';
      n.setAttribute('data-stato', 'attesa');
      n.setAttribute('aria-busy', 'true');
      n.appendChild(riga(n.getAttribute('data-attesa')));
    }
    function errore() {
      n.textContent = '';
      n.setAttribute('data-stato', 'errore');
      n.removeAttribute('aria-busy');
      n.appendChild(riga(n.getAttribute('data-errore')));
      var cta = doc.createElement('div'), b = doc.createElement('button');
      cta.setAttribute('class', 'hero-cta hs-cta');
      b.setAttribute('type', 'button');
      b.setAttribute('class', 'btn btn-primary');
      b.textContent = n.getAttribute('data-riprova') || '';
      b.addEventListener('click', function () { prova(); });
      cta.appendChild(b);
      n.appendChild(cta);
    }
    function prova() {
      attesa();
      var p = null;
      try { p = F && typeof F.leggi === 'function' ? F.leggi(url) : null; } catch (e) { p = null; }
      if (!p || typeof p.then !== 'function') { errore(); return; }
      p.then(function (D) { if (datiValidi(D)) fatto(D); else errore(); }, function () { errore(); });
    }
    prova();
    return true;
  }

  function ambiente(opz) {
    var o = opz || {};
    return {
      storage: o.storage || global.localStorage,
      adesso: typeof o.adesso === 'function' ? o.adesso : function () { return new Date().getTime(); },
      Data: o.Data || Date,
      Sync: o.Sync !== undefined ? o.Sync : global.Sync,
      Masterplan: o.Masterplan !== undefined ? o.Masterplan : global.Masterplan,
      studioEvento: o.studioEvento !== undefined ? o.studioEvento : global.studioEvento,
      location: o.location !== undefined ? o.location : global.location,
      /* dov'e' il Worker della sincronizzazione (lo scrive site.js): c'e' solo nel
         completo con l'area account, ed e' il segno che una lettura parte */
      config: o.config !== undefined ? o.config : global.STUDIO_SYNC,
      setTimeout: typeof o.setTimeout === 'function' ? o.setTimeout
        : (typeof global.setTimeout === 'function' ? function (f, ms) { return global.setTimeout(f, ms); } : null)
    };
  }

  /* il montaggio: coi dati dati da fuori, con l'isola della pagina (se c'e'), o coi dati
     letti dallo sportello (la home del completo): allora rende null e monta quando
     arrivano */
  function monta(doc, opz) {
    var D = opz && datiValidi(opz.dati) ? opz.dati : leggiIsola(doc);
    if (D) return montaCon(doc, D, opz);
    carica(doc, opz, function (dati) { montaCon(doc, dati, opz); });
    return null;
  }

  function montaCon(doc, D, opz) {
    var h = new Home(doc, D, ambiente(opz));
    var f = h.nodi.form;
    if (f) {
      f.addEventListener('submit', function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); h.invia(); });
      f.addEventListener('change', function () { h.mostraCampi(); });
      var pers = f.querySelectorAll('[data-hs-personalizza]');
      for (var i = 0; i < pers.length; i++) {
        pers[i].addEventListener('click', function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          var extra = f.querySelector('[data-hs-campo="personalizza"]');
          if (extra) extra.hidden = !extra.hidden;
        });
      }
    }
    var apri = doc.querySelectorAll('[data-hs-apri]');
    for (var j = 0; j < apri.length; j++) {
      apri[j].addEventListener('click', function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); h.apriModulo(); });
    }
    if (h.nodi.cambia) h.nodi.cambia.addEventListener('click', function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      h.apriModulo();
    });
    /* PRIMA si allinea il selettore alla lezione corrente, POI si ascolta: un
       allineamento non e' una scelta dello studente e non riscrive studio-lezione */
    var sel = doc.getElementById('sp-lezione'), mat = doc.getElementById('sp-materia');
    h.allinea();
    function scelta() { if (sel) h.ricorda(sel.value); h.statoTappe(); }
    if (sel) sel.addEventListener('change', scelta);
    if (mat) mat.addEventListener('change', function () { h.statoTappe(); });
    /* il primo ingresso su questo browser: Oggi aspetta la prima lettura (vedi
       `primaLettura`), al piu' OGGI_ATTESA_MS */
    if (h.primaLettura()) {
      h.aspettaPrima = true;
      var fine = function () {
        if (!h.aspettaPrima) return;
        h.aspettaPrima = false;
        h.disegna();
        h.statoTappe();
      };
      try {
        var pr = h.amb.Sync && typeof h.amb.Sync.rileggi === 'function' ? h.amb.Sync.rileggi(false) : null;
        if (pr && typeof pr.then === 'function') pr.then(fine, fine);
      } catch (e) { h.aspettaPrima = false; }
      if (h.aspettaPrima && h.amb.setTimeout) h.amb.setTimeout(fine, OGGI_ATTESA_MS);
    }
    /* (dati in attesa di conferma: la lettura la chiede `disegna`, entrando nell'attesa) */
    h.disegna();
    h.statoTappe();
    /* la sincronizzazione ha scritto qualcosa (un altro dispositivo), o un'altra
       scheda ha cambiato le chiavi: si ridisegna. Anche quando un'altra scheda cambia
       il TOKEN o lo stato della sincronizzazione (un altro studente entra): la home entra
       nell'attesa, chiude il modulo e chiede la conferma, come scatole.js (revisione S4:
       la scheda restava sul piano di A, col modulo di A apribile) */
    var g = opz && opz.finestra ? opz.finestra : global;
    if (g && typeof g.addEventListener === 'function') {
      g.addEventListener('studio:stato', function () { h.disegna(); h.statoTappe(); });
      g.addEventListener('storage', function (ev) {
        var k = ev ? ev.key : null;
        if (k === null || k === CHIAVE_PIANO || k === CHIAVE_TAPPE || k === CHIAVE_LEZIONE ||
            k === CHIAVE_SYNC || k === tokenDi(h.amb)) { h.disegna(); h.statoTappe(); }
      });
    }
    return h;
  }

  /* la chiave del token (quella di studio_sync.js, se c'e') */
  function tokenDi(amb) {
    var S = amb.Sync;
    return S && S.CHIAVI && typeof S.CHIAVI.token === 'string' ? S.CHIAVI.token : CHIAVE_TOKEN_BASE;
  }

  var HomeStudio = {
    monta: monta,
    moleDa: moleDa,
    richiamaLocale: richiamaLocale,
    statoPerPiano: statoPerPiano,
    lezioneCorrente: lezioneCorrente,
    riserva: riserva,
    decidi: decidi,
    daSalvare: daSalvare,
    saltati: saltati,
    cfgDalleRisposte: cfgDalleRisposte,
    frasiAvvisi: frasiAvvisi,
    giornoLocale: giornoLocale,
    CHIAVI: [CHIAVE_PIANO, CHIAVE_TAPPE, CHIAVE_LEZIONE],
    VERSIONE: VERSIONE
  };
  global.HomeStudio = HomeStudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = HomeStudio;

  /* in pagina parte da solo: e' l'ultimo script della home (dopo studio_fetch.js,
     studio_sync.js e masterplan.js), quindi gli altri ci sono gia' */
  if (global.document && typeof global.document.getElementById === 'function') {
    var st0 = global.document.getElementById('hs-stato');
    if (global.document.getElementById('studio-home-dati') || (st0 && st0.getAttribute('data-hs-dati'))) {
      monta(global.document);
    }
  }
})(typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global : this);
