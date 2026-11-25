/* =====================================================================
   studio_fetch.js — lo SPORTELLO UNICO dei dati di /studio.

   PERCHE' ESISTE (il buco che chiude, misurato il 2026-07-29)
   `site_lock.py` cifrava solo gli `.html`. I ~241 JSON sotto `/studio/data/`
   uscivano IN CHIARO: `curl .../studio/data/quiz/s1c11-A.json` rispondeva 200
   con dentro `"corretta"` e le spiegazioni per esteso — cioe' le 14.433
   domande e le 2.269 carte del pacchetto a pagamento, scaricabili da chiunque
   (gli slug sono pubblici nel catalogo gratuito; robots.txt non e' un
   controllo d'accesso). Ora anche i dati sono cifrati, e questo file e'
   l'unico punto in cui tornano leggibili.

   COME (nessun secondo segreto, e dal 2026-09-19 nessuna password)
   Stessa chiave delle pagine: la CHIAVE DI BUILD, che la pagina-cancello
   riceve dall'account (il Worker la consegna solo a chi ha il diritto) e
   lascia in `sessionStorage['studio-key']` come `{salt, k}` (k = chiave grezza
   in base64). Qui la si riprende, si importa in WebCrypto e si decifra ogni
   file con AES-GCM. Un solo sblocco copre pagine e dati.

   LA CHIAVE SUL DISPOSITIVO (dal 2026-10-07, decisione dell'utente: «chiave sul
   dispositivo, non estraibile, legata all'account, che scade dopo 30 giorni e si
   cancella quando esci»). Senza rete il cancello puo' aprire lo Studypack SALVATO
   con la chiave che sta nel database del browser (site_lock.CHIAVE_DISPOSITIVO_JS):
   una CryptoKey non estraibile, di cui nessuno puo' leggere i byte, quindi non
   finisce in sessionStorage. Il cancello la lascia nella finestra, in
   `window[CHIAVE_DISPOSITIVO]` come `{salt, chiave}`, prima che la pagina parta:
   qui la si usa DOPO quella della sessione, e solo per la sua pubblicazione (il
   salt). Il nome e' `site_lock.GLOBALE_CHIAVE` (un test li tiene uguali).

   FORMATO DEL FILE CIFRATO (testo, non JSON: vedi site_lock.py)
       VCS1.<salt_b64>.<iv_b64>.<ciphertext_b64>
   Il prefisso serve a due cose: distinguere a colpo sicuro il cifrato dal
   chiaro (la build FULL non cifrata serve gli stessi file in JSON, e in
   locale si lavora su quella), e garantire che il file NON sia JSON valido —
   cosi' «si e' dimenticato di cifrare» non puo' passare per «e' cifrato».

   REGOLA DI CONDOTTA: SI ROMPE RUMOROSAMENTE
   Se la chiave manca, e' di un'altra build, o la decifratura fallisce, qui si
   RIGETTA con un errore che porta con se' `motivo` e `messaggio` in italiano,
   e si scrive in console. Mai un oggetto vuoto, mai `null`, mai un mazzo di
   zero carte: un vuoto silenzioso qui sarebbe indistinguibile da «nessuna
   carta per questo filtro», ed e' esattamente il tipo di guasto che questo
   progetto continua a pagare.

   API
     StudioFetch.cifrato(testo)        -> true se e' un blob VCS1
     StudioFetch.decifra(testo)        -> Promise<oggetto>  (chiaro o cifrato)
     StudioFetch.daRisposta(risposta)  -> Promise<oggetto>  (da un Response)
     StudioFetch.leggi(url, opzioni)   -> Promise<oggetto>  (fetch + decifra)
     StudioFetch.dimenticaChiave()     -> svuota la cache della chiave
   ===================================================================== */
(function (global) {
  'use strict';

  var PREFISSO = 'VCS1.';
  var VOCE_SESSIONE = 'studio-key';
  /* dove il cancello lascia la chiave del dispositivo con cui ha aperto la pagina */
  var CHIAVE_DISPOSITIVO = 'studioChiaveDispositivo';
  /* dove l'area account tiene il token: la chiave del dispositivo vale solo per chi e' entrato
     (revisione di sicurezza del 09/10, rilievo 6: una pagina gia' aperta continuava a
     decifrare dopo l'uscita da un'altra scheda) */
  var VOCE_TOKEN = 'appunti-tok';

  /* La chiave importata si tiene in cache: la simulazione d'esame scarica
     fino a 31 file di fila, e re-importarla ogni volta sarebbe lavoro
     inutile. La cache e' legata al salt, cosi' una build nuova la invalida. */
  var cache = null;   /* {salt: '...', promessa: Promise<CryptoKey>, dispositivo: bool} */

  function entrato() {
    try { return !!global.localStorage.getItem(VOCE_TOKEN); } catch (e) { return false; }
  }
  /* L'USCITA DA UN'ALTRA SCHEDA (stessa origine: l'evento `storage`): la chiave in memoria,
     quella del dispositivo lasciata dal cancello e quella della sessione di questa scheda se
     ne vanno, come se ne vanno nella scheda da cui sei uscito (account.js, setTok). */
  try {
    global.addEventListener('storage', function (ev) {
      if (!ev || ev.key !== VOCE_TOKEN || ev.newValue) return;
      cache = null;
      try { global[CHIAVE_DISPOSITIVO] = null; } catch (e) { }
      try { global.sessionStorage.removeItem(VOCE_SESSIONE); } catch (e) { }
    });
  } catch (e) { }

  function guasto(motivo, messaggio) {
    var e = new Error(messaggio);
    e.motivo = motivo;
    e.messaggio = messaggio;
    try {
      if (global.console && global.console.error) {
        global.console.error('[studio] dati non leggibili (' + motivo + '): ' + messaggio);
      }
    } catch (x) { }
    return e;
  }

  function rifiuta(motivo, messaggio) {
    return global.Promise.reject(guasto(motivo, messaggio));
  }

  function b2a(b64) {
    var s = global.atob(b64), a = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  function subtle() {
    return (global.crypto && global.crypto.subtle) ? global.crypto.subtle : null;
  }

  function cifrato(testo) {
    return typeof testo === 'string' && testo.slice(0, PREFISSO.length) === PREFISSO;
  }

  /* La chiave di QUESTA build. Rigetta — non ritorna null — perche' ogni
     ragione del rifiuto ha un messaggio suo: «non hai sbloccato» e «hai
     sbloccato un'altra build» chiedono due gesti diversi al lettore. */
  function chiaveDi(salt) {
    if (cache && cache.salt === salt && (!cache.dispositivo || entrato())) return cache.promessa;
    if (cache && cache.dispositivo) cache = null;
    var sub = subtle();
    if (!sub) {
      return rifiuta('nosupporto',
        'Questo browser non sa decifrare i materiali (serve una connessione ' +
        'sicura https e un browser recente).');
    }
    var voce = null;
    try {
      voce = JSON.parse(global.sessionStorage.getItem(VOCE_SESSIONE) || 'null');
    } catch (e) { voce = null; }
    /* la chiave della sessione viene PRIMA; se manca, o e' di un'altra pubblicazione, la
       chiave del dispositivo con cui il cancello ha aperto QUESTA pubblicazione */
    if (!voce || !voce.k || voce.salt !== salt) {
      var dalDispositivo = null;
      try { dalDispositivo = global[CHIAVE_DISPOSITIVO] || null; } catch (e) { dalDispositivo = null; }
      if (dalDispositivo && dalDispositivo.salt === salt && dalDispositivo.chiave &&
          typeof dalDispositivo.chiave === 'object' && entrato()) {
        var pronta = global.Promise.resolve(dalDispositivo.chiave);
        cache = { salt: salt, promessa: pronta, dispositivo: true };
        return pronta;
      }
    }
    if (!voce || !voce.k) {
      return rifiuta('chiave-assente',
        'Questa sessione non e\' sbloccata: ricarica la pagina, si riapre ' +
        'col tuo account.');
    }
    if (voce.salt !== salt) {
      return rifiuta('chiave-altra-build',
        'I materiali sono stati ripubblicati: ricarica la pagina, si riapre ' +
        'col tuo account.');
    }
    var grezza;
    try { grezza = b2a(voce.k); }
    catch (e) {
      return rifiuta('chiave-rotta',
        'La chiave salvata in questa sessione e\' illeggibile: ricarica la ' +
        'pagina, si riapre col tuo account.');
    }
    var p = sub.importKey('raw', grezza, 'AES-GCM', false, ['decrypt']);
    cache = { salt: salt, promessa: p };
    return p;
  }

  function dimenticaChiave() { cache = null; }

  /* Il cuore: testo -> oggetto. Accetta anche il CHIARO, perche' la build FULL
     non cifrata (quella su cui si lavora in locale) serve gli stessi identici
     URL in JSON semplice; il prefisso dice senza ambiguita' quale dei due e'. */
  function decifra(testo) {
    if (!global.Promise) {
      return { then: function () { throw guasto('nosupporto', 'Browser troppo vecchio.'); } };
    }
    if (typeof testo !== 'string') {
      return rifiuta('formato', 'I dati sono arrivati in una forma inattesa.');
    }
    if (!cifrato(testo)) {
      /* chiaro: deve comunque essere JSON valido, altrimenti e' un guasto */
      try { return global.Promise.resolve(JSON.parse(testo)); }
      catch (e) {
        return rifiuta('formato', 'I dati sono arrivati ma non sono leggibili.');
      }
    }
    var pezzi = testo.split('.');
    if (pezzi.length !== 4) {
      return rifiuta('formato', 'Il file cifrato non ha la forma attesa.');
    }
    var salt = pezzi[1], iv, dati;
    try { iv = b2a(pezzi[2]); dati = b2a(pezzi[3]); }
    catch (e) { return rifiuta('formato', 'Il file cifrato e\' danneggiato.'); }

    return chiaveDi(salt).then(function (k) {
      return subtle().decrypt({ name: 'AES-GCM', iv: iv }, k, dati).then(
        function (buf) {
          var chiaro;
          try { chiaro = new global.TextDecoder().decode(buf); }
          catch (e) { throw guasto('formato', 'Il decifrato non e\' testo valido.'); }
          try { return JSON.parse(chiaro); }
          catch (e) { throw guasto('formato', 'Il decifrato non e\' un JSON valido.'); }
        },
        function () {
          /* AES-GCM e' autenticato: qui o la chiave e' di un'altra build, o il
             file e' stato manomesso. In nessuno dei due casi si va avanti. */
          dimenticaChiave();
          throw guasto('decifratura',
            'Non riesco a decifrare i materiali con la chiave di questa ' +
            'sessione: ricarica la pagina, si riapre col tuo account.');
        }
      );
    });
  }

  function daRisposta(risposta) {
    if (!risposta || typeof risposta.text !== 'function') {
      return rifiuta('formato', 'Risposta di rete non utilizzabile.');
    }
    return risposta.text().then(decifra, function () {
      throw guasto('rete', 'La risposta si e\' interrotta mentre la leggevo.');
    });
  }

  function leggi(url, opzioni) {
    if (!global.fetch || !global.Promise) {
      return rifiuta('nosupporto', 'Questo browser non sa scaricare i materiali.');
    }
    var opz = opzioni || { credentials: 'same-origin' };
    return global.fetch(url, opz).then(function (r) {
      if (!r || !r.ok) {
        throw guasto('http', 'I materiali non sono arrivati (errore ' +
          ((r && r.status) || '?') + ').');
      }
      return daRisposta(r);
    }, function () {
      throw guasto('rete', 'Non sono riuscito a contattare il server.');
    });
  }

  var StudioFetch = {
    PREFISSO: PREFISSO,
    VOCE_SESSIONE: VOCE_SESSIONE,
    CHIAVE_DISPOSITIVO: CHIAVE_DISPOSITIVO,
    cifrato: cifrato,
    decifra: decifra,
    daRisposta: daRisposta,
    leggi: leggi,
    dimenticaChiave: dimenticaChiave
  };

  global.StudioFetch = StudioFetch;
  if (typeof module !== 'undefined' && module.exports) module.exports = StudioFetch;

})(typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global : this);
