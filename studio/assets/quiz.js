/* =====================================================================
   quiz.js — motore quiz per la versione FULL (/studio)
   SPEC_MOTORI.md §2C. Vanilla JS, ZERO dipendenze, niente CDN, niente
   document.write. Stile ES5 (var/function, nessuna arrow, nessun template
   literal) come flashcards.js: gira anche su browser mobili vecchiotti.

   MONTAGGIO
     esercitazione su UNA lezione
       <div id="quiz-app" data-mode="lezione"
            data-src="../data/quiz/s1f01-A.json"
            data-titolo="S1·E01 Fisica — parte A"></div>
     simulazione d'esame su TUTTO il programma
       <div id="quiz-app" data-mode="esame"
            data-index="../data/index.json"
            data-base="../data/quiz/"></div>
     <script src="../assets/quiz.js" defer></script>
   Senza rete (demo / test):
       <script type="application/json" id="banco"> {...} </script>
       <div id="quiz-app" data-mode="lezione" data-json="banco"></div>
   Via API:
       Quiz.monta(elemento, datiLezione);
       Quiz.monta(elemento, manifest, {modo:'esame', carica: function (voce) {
         return unaPromessaOppureIDatiGiaPronti;
       }});
   In modo LEZIONE i dati possono essere un banco RICOMPOSTO da più lezioni
   (è così che funziona l'hub `/studio/quiz/`): il motore non chiede che le
   domande vengano tutte dallo stesso file.

   LE DOMANDE ANCORA DA RECUPERARE (2026-07-30)
       Quiz.sbagliate()            -> {idDomanda: {n, t}}
       Quiz.dimenticaSbagliate()   -> svuota il registro (gesto dell'utente)
   Registro TRASVERSALE (una chiave sola, `quiz.v1.sbagliate`): una domanda
   sbagliata sulla pagina di un episodio compare fra le sbagliate dell'hub e
   viceversa. Una risposta giusta — o un «considera giusta» — la toglie.
   Attesa massima per ogni download (ms), utile per provare la rete lenta:
       <div id="quiz-app" ... data-timeout="2500"> · opzioni.timeout</div>

   FORMATO DATI (prodotto da study_data.py, SPEC §2A)
     lezione  {"slug","parte","materia","ud","lezione","domande":[...]}
       mcq    {"id","tipo":"mcq","tag":[],"diff","stem","opzioni":{"A":...},
               "corretta":"A","perche":{"giusta":...,"B":...}}
       cmp    {"id","tipo":"cmp","tag":[],"diff","stem","risposta",
               "varianti":[...],"errore":"..."}
     manifest {"generato","totali",
               "lezioni":[{"slug","parte","ep","materia","ud","lezione",
                           "n_mcq","n_cmp","n_carte"}]}

   TRE SCELTE NON OVVIE (motivate qui perché il codice da solo non le spiega)

   1. PESO IN RETE DELLA SIMULAZIONE. 15 MCQ + 16 completamento su 120
      lezioni: pescando gli MCQ e i completamenti da lezioni DIVERSE si
      scaricherebbero 31 file (~2 MB). Le quote girano invece sulla STESSA
      lista mescolata, così le prime 15 lezioni danno 1 MCQ + 1 completamento
      e la 16ª solo il completamento: 16 file, campionamento comunque
      uniforme su tutto il programma. Le lezioni già usate finiscono in coda
      alla mescolata successiva (`lezioniRecenti` in localStorage), così due
      simulazioni di fila NON coprono le stesse lezioni. Con
      `opzioni.riusaLezioni = false` si torna alla massima dispersione.

   2. ORDINE DELLE OPZIONI MCQ. Le banche hanno la chiave in ciclo rigido
      (`corretta: A B C D E A B C D E ...` in gran parte del corpus): a
      video, in ordine fisso, la risposta si indovina contando. Qui le
      opzioni vengono permutate a RENDER-TIME con un seme per-domanda; la
      lettera mostrata è solo un'etichetta di presentazione, l'identità
      resta la lettera originale (le `perche_<lettera>` si cercano SEMPRE
      con quella, mai con quella mostrata). Non si tocca il dato: è una
      scelta di resa di questo motore, non una modifica alla banca (che è
      SSOT authored). Si spegne con `data-mescola-opzioni="0"`.

   3. LA CORREZIONE DEL COMPLETAMENTO NON È MAI PERFETTA. Il confronto è a
      tre livelli (canonico → lasco → numerico) e sotto c'è una soglia di
      somiglianza che NON accetta ma segnala «quasi»: il pulsante
      «considera giusta» resta l'ultima parola dello studente, e le risposte
      autovalutate si contano a parte nel riepilogo (onestà del punteggio).

   4. LA RETE PUÒ TACERE, NON SOLO FALLIRE. Una fetch che non si risolve mai
      (tunnel, captive portal, mobile che si pianta) non entra in nessun
      ramo d'errore: senza un tetto, «Preparo la prova… 0 su 16» resta lì
      per sempre e l'unica via d'uscita è ricaricare la pagina. Qui ogni
      download ha una scadenza propria (TIMEOUT_FILE, `data-timeout`), la
      preparazione ne ha una complessiva (TIMEOUT_PROVA), il pannello ha un
      «Annulla», e se qualche lezione non arriva la prova parte lo stesso
      con quelle scaricate — DICENDOLO in chiaro sotto il titolo. Il tetto
      sta su `poi()`, non dentro `scaricaLezione()`, così vale anche per le
      pagine che passano il proprio `opzioni.carica`.

   5. LE SCORCIATOIE NON RUBANO IL COMANDO A CHI HA IL FUOCO. Invio,
      1..5 e le frecce vivono su `document`: prima di intercettarle si
      guarda CHE COSA ha il fuoco. Su un bottone Invio lo attiva (nostro o
      del sito), su un radio le frecce restano quelle native del gruppo —
      altrimenti da tastiera «Salta» diventa inattivabile e nella
      simulazione la freccia destra teletrasporta a un'altra domanda invece
      di scorrere le opzioni.

   NOTA SUL CSS
   La spec vuole il CSS dei motori in `assets/study.css`. Qui il foglio sta
   in `Quiz.CSS` (fonte unica) e viene iniettato UNA sola volta, solo se il
   foglio condiviso non è già in pagina — cioè se non esiste un elemento con
   `data-motori-css="study"`. Il marcatore del nostro <style> è invece
   `data-motori-css-quiz`: flashcards.js salta l'iniezione appena vede un
   QUALUNQUE `[data-motori-css]`, e con un nome diverso i due motori possono
   stare sulla stessa pagina senza spegnersi il foglio a vicenda.
   ===================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- *
   * 0. Costanti di dominio                                            *
   * ---------------------------------------------------------------- */

  var VERSIONE_STATO = 1;

  /* Formato REALE dell'esame (misurato sui tre esami ufficiali in
     materiali_ufficiali/esami_ufficiali/): 15 a scelta multipla con 5
     opzioni + 16 a completamento. */
  var FORMATO_ESAME = { mcq: 15, cmp: 16 };

  var LETTERE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  /* Sopra questa somiglianza (0..1) una risposta sbagliata viene segnalata
     come «quasi»: non è accettata, ma il pulsante «considera giusta» viene
     messo in evidenza. Tarata perché un refuso singolo su una parola di 8+
     lettere ci rientri e due parole diverse no. */
  var SOGLIA_QUASI = 0.84;

  /* Quante domande già viste si ricordano per lezione, per non ripescarle
     sempre (anello: le più vecchie escono). */
  var MAX_VISTI = 400;

  /* Fetch in parallelo durante la simulazione: 16 file tutti insieme sono
     un colpo secco sulla rete del telefono. */
  var MAX_PARALLELE = 4;

  /* Tetti d'attesa (ms). Per-file: oltre questo il download viene abortito
     e la lezione conta come caduta, ramo che il rattoppo delle quote sa
     già gestire. Complessivo: oltre questo si parte con quello che è
     arrivato (o si mostra l'errore con «Riprova»), qualunque cosa stiano
     facendo le fetch ancora in volo. Si abbassano con `data-timeout`. */
  var TIMEOUT_FILE = 12000;
  var TIMEOUT_PROVA = 30000;

  var MATERIE = { fisica: 1, chimica: 1, biologia: 1 };

  var SINONIMI_DIFF = {
    'base': 'base', 'facile': 'base', 'bassa': 'base', 'basso': 'base',
    'medio': 'medio', 'media': 'medio', 'intermedio': 'medio', 'intermedia': 'medio',
    'sfida': 'sfida', 'alta': 'sfida', 'alto': 'sfida', 'difficile': 'sfida'
  };

  var contatoreId = 0;

  /* ---------------------------------------------------------------- *
   * 1. Normalizzazione del testo (logica pura, testabile senza DOM)    *
   *    È il cuore della correzione automatica del completamento.       *
   * ---------------------------------------------------------------- */

  /* apici: 10⁻⁹ → 10^-9 ·  s² → s^2 */
  var APICI = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁻': '-', '⁺': '+', 'ⁿ': 'n'
  };
  /* pedici: H₂O → h2o */
  var PEDICI = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
  };

  /* Numeri scritti a parole: nelle banche convivono «7» e «sette» come
     varianti della stessa risposta, ma non sempre entrambe sono elencate. */
  var PAROLE_NUM = {
    'zero': 0, 'uno': 1, 'un': 1, 'una': 1, 'due': 2, 'tre': 3, 'quattro': 4,
    'cinque': 5, 'sei': 6, 'sette': 7, 'otto': 8, 'nove': 9, 'dieci': 10,
    'undici': 11, 'dodici': 12, 'tredici': 13, 'quattordici': 14, 'quindici': 15,
    'sedici': 16, 'diciassette': 17, 'diciotto': 18, 'diciannove': 19, 'venti': 20
  };

  /* Parentesi finali che sono una NOTA, non una risposta alternativa:
     «10⁻⁹ (numero adimensionale)» → «numero adimensionale» da solo non è
     una risposta accettabile, mentre «metro (m)» → «m» sì. */
  var PARENTESI_META = {
    'numero adimensionale': 1, 'adimensionale': 1, 'numero puro': 1,
    'non normalizzato': 1, 'senza unita': 1, 'senza unita di misura': 1,
    'circa': 1, 'approssimato': 1, 'valore approssimato': 1
  };

  var ARTICOLI = /^(?:il|lo|la|i|gli|le|un|uno|una|di|del|dello|della|dei|degli|delle|a|al|allo|alla)\s+/;
  var ARTICOLI_APOSTROFO = /^(?:l|un|d|dell|nell|all|sull|quell)'\s*/;

  function senzaAccenti(s) {
    if (s.normalize) {
      try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
      catch (e) { /* si passa alla mappa a mano */ }
    }
    return s
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n');
  }

  /* Una sequenza di apici diventa `^` + il suo contenuto: così 10⁻¹² fa
     UN solo `^` (10^-12) e non tre. */
  function mappaApici(s) {
    var fuori = '', dentro = false, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (APICI.hasOwnProperty(c)) {
        if (!dentro) { fuori += '^'; dentro = true; }
        fuori += APICI[c];
      } else {
        dentro = false;
        fuori += PEDICI.hasOwnProperty(c) ? PEDICI[c] : c;
      }
    }
    return fuori;
  }

  /* Forma CANONICA: quello che due scritture della stessa risposta hanno
     davvero in comune. Conserva spazi singoli e segni. */
  function canonica(v) {
    var s = String(v == null ? '' : v);
    s = s.replace(/[’‘ʼ´`]/g, "'");           /* apostrofi tipografici */
    s = s.replace(/[«»“”„″]/g, '"');     /* «virgolette» */
    s = s.replace(/[‐‑‒–—−]/g, '-');     /* trattini e meno unicode */
    s = mappaApici(s);
    s = s.toLowerCase();
    s = s.replace(/[µμ]/g, 'u');        /* µm / μm / um: stessa cosa */
    s = senzaAccenti(s);                          /* unità = unita = unita' */
    s = s.replace(/[×·⋅∙•∗]/g, '*');     /* × · ⋅ ∙ • ∗ */
    s = s.replace(/(\d)\s*x\s*(?=\d)/g, '$1*');   /* «3 x 10^9» solo fra cifre */
    s = s.replace(/(\d)\s*,\s*(?=\d)/g, '$1.');   /* separatore decimale */
    s = s.replace(/dieci\s+alla\s+meno\s+(\d+)/g, '10^-$1');
    s = s.replace(/dieci\s+alla\s+(\d+)/g, '10^$1');
    s = s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    s = s.replace(/^["\s]+/, '').replace(/["\s.,;:!?]+$/, '');
    return s;
  }

  /* Forma LASCA: si buttano via spazi, punteggiatura e trattini fra
     lettere. «Z eff» = «Zeff», «non-metalli» = «non metalli»,
     «l'elettronegatività» = «elettronegativita». Il segno meno davanti a
     un numero NON si perde (resta nel vocabolario ammesso). */
  function lasca(v) {
    var s = canonica(v);
    s = s.replace(ARTICOLI_APOSTROFO, '').replace(ARTICOLI, '');
    s = s.replace(/([a-z])-([a-z])/g, '$1$2');
    s = s.replace(/[^a-z0-9^+\-.]/g, '');
    return s;
  }

  /* Valore numerico di una risposta, con la sua coda di unità.
     Riconosce: 10^-9 · 1e-9 · 3*10^9 nPa · 1.2e4 · 12*10^3 · «sette». */
  function numero(v) {
    var s = canonica(v).replace(/\s+/g, '');
    if (!s) return null;
    if (PAROLE_NUM.hasOwnProperty(s)) return { v: PAROLE_NUM[s], u: '' };
    var m = /^([+-]?)10\^([+-]?\d+)(.*)$/.exec(s);
    if (m) {
      return { v: (m[1] === '-' ? -1 : 1) * Math.pow(10, parseInt(m[2], 10)), u: m[3] || '' };
    }
    m = /^([+-]?\d+(?:\.\d+)?)(?:\*?10\^([+-]?\d+)|e([+-]?\d+))?(.*)$/.exec(s);
    if (!m) return null;
    var val = parseFloat(m[1]);
    if (isNaN(val)) return null;
    if (m[2] != null) val *= Math.pow(10, parseInt(m[2], 10));
    else if (m[3] != null) val *= Math.pow(10, parseInt(m[3], 10));
    return { v: val, u: m[4] || '' };
  }

  function stessoNumero(a, b) {
    if (!a || !b) return false;
    if (lasca(a.u) !== lasca(b.u)) return false;        /* nPa ≠ µm ≠ niente */
    if (a.v === b.v) return true;
    var massimo = Math.max(Math.abs(a.v), Math.abs(b.v));
    return massimo > 0 && Math.abs(a.v - b.v) <= 1e-9 * massimo;
  }

  /* Distanza di Levenshtein, due righe. Il taglio a 80 caratteri tiene il
     costo costante: oltre, la somiglianza non serve più a niente. */
  function distanza(a, b) {
    a = a.slice(0, 80); b = b.slice(0, 80);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prec = [], corr = [], i, j;
    for (j = 0; j <= b.length; j++) prec[j] = j;
    for (i = 1; i <= a.length; i++) {
      corr[0] = i;
      for (j = 1; j <= b.length; j++) {
        corr[j] = Math.min(
          prec[j] + 1,
          corr[j - 1] + 1,
          prec[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      for (j = 0; j <= b.length; j++) prec[j] = corr[j];
    }
    return prec[b.length];
  }

  function somiglianza(a, b) {
    if (!a && !b) return 1;
    var lungo = Math.max(a.length, b.length);
    if (!lungo) return 0;
    return 1 - distanza(a, b) / lungo;
  }

  /* Spezza «metro (m)» in ["metro (m)", "metro", "m"], scartando le
     parentesi che sono una nota e non una risposta. */
  function formeDaTesto(testo) {
    var fuori = [], grezzo = String(testo == null ? '' : testo).replace(/^\s+|\s+$/g, '');
    if (!grezzo) return fuori;
    fuori.push(grezzo);
    var m = /^([\s\S]*?)\s*\(([^()]*)\)\s*$/.exec(grezzo);
    if (!m) return fuori;
    var nudo = m[1].replace(/^\s+|\s+$/g, '');
    var dentro = m[2].replace(/^\s+|\s+$/g, '');
    if (nudo) fuori.push(nudo);
    /* la parentesi può contenere più alternative separate da virgola */
    var pezzi = dentro.split(/\s*,\s*/), k, p;
    for (k = 0; k < pezzi.length; k++) {
      p = pezzi[k].replace(/^(?:cioè|ossia|ovvero)\s+/i, '').replace(/^\s+|\s+$/g, '');
      if (!p) continue;
      if (p.split(/\s+/).length > 4) continue;                 /* è una spiegazione, non una risposta */
      if (PARENTESI_META.hasOwnProperty(canonica(p))) continue;
      fuori.push(p);
    }
    return fuori;
  }

  /* Tutte le scritture accettate per una domanda di completamento. */
  function formeAccettate(d) {
    var grezze = [], fuori = [], visti = {}, i, k, f, c;
    grezze = grezze.concat(formeDaTesto(d.risposta));
    var varianti = d.varianti || [];
    for (i = 0; i < varianti.length; i++) grezze = grezze.concat(formeDaTesto(varianti[i]));
    for (k = 0; k < grezze.length; k++) {
      f = grezze[k];
      c = canonica(f);
      if (!c || visti[c]) continue;
      visti[c] = 1;
      fuori.push({ testo: f, c: c, l: lasca(f), n: numero(f) });
    }
    return fuori;
  }

  /* LA correzione. Ritorna sempre un oggetto, mai una eccezione.
       esito: 'giusta' | 'quasi' | 'sbagliata' | 'vuota'
       come : 'esatta' | 'lasca' | 'numerica'  (solo se giusta)
       simile: 0..1  (quanto la risposta somiglia alla più vicina) */
  function correggi(d, testo) {
    var uC = canonica(testo);
    if (!uC) return { esito: 'vuota', come: null, simile: 0, vicina: null };
    var forme = d._forme || (d._forme = formeAccettate(d));
    var uL = lasca(testo), uN = numero(testo), i;

    for (i = 0; i < forme.length; i++) if (forme[i].c === uC) {
      return { esito: 'giusta', come: 'esatta', simile: 1, vicina: forme[i].testo };
    }
    for (i = 0; i < forme.length; i++) if (uL && forme[i].l === uL) {
      return { esito: 'giusta', come: 'lasca', simile: 1, vicina: forme[i].testo };
    }
    if (uN) for (i = 0; i < forme.length; i++) if (stessoNumero(uN, forme[i].n)) {
      return { esito: 'giusta', come: 'numerica', simile: 1, vicina: forme[i].testo };
    }
    var meglio = 0, vicina = null, vicinaN = null, s;
    for (i = 0; i < forme.length; i++) {
      s = somiglianza(uL, forme[i].l);
      if (s > meglio) { meglio = s; vicina = forme[i].testo; vicinaN = forme[i].n; }
    }
    /* «quasi» esiste per i REFUSI, e un refuso è cosa da parole. Su un
       numero la somiglianza mente: «3 × 10⁹ Pa» dista un carattere da
       «3 × 10⁹ nPa» ma è un'altra grandezza, e «1,2 × 10⁵» da «1,2 × 10⁴»
       è un ordine di grandezza intero. Se entrambe le parti sono numeri e
       il confronto numerico è già fallito, la risposta è sbagliata e basta:
       suggerire «considera giusta» qui sarebbe un danno didattico. */
    var quasi = meglio >= SOGLIA_QUASI && !(uN && vicinaN);
    return {
      esito: quasi ? 'quasi' : 'sbagliata',
      come: null, simile: meglio, vicina: vicina
    };
  }

  /* ---------------------------------------------------------------- *
   * 2. Normalizzazione dei dati + estrazione delle domande             *
   * ---------------------------------------------------------------- */

  function esisteArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  function normalizzaDiff(d) {
    var s = String(d == null ? '' : d).toLowerCase().replace(/^\s+|\s+$/g, '');
    if (!s) return 'medio';
    return SINONIMI_DIFF[s] || s;
  }

  function tagsDi(q) {
    var grezzo = q.tag != null ? q.tag : q.tags, pezzi = [], fuori = [], i, t;
    if (esisteArray(grezzo)) pezzi = grezzo.slice();
    else if (grezzo != null) pezzi = String(grezzo).split(/[,;·|]/);
    for (i = 0; i < pezzi.length; i++) {
      t = String(pezzi[i]).replace(/^\s+|\s+$/g, '');
      if (t) fuori.push(t);
    }
    return fuori;
  }

  function normalizzaDomanda(q, i, meta) {
    var tipo = String(q.tipo || '').toLowerCase();
    if (tipo === 'completamento') tipo = 'cmp';
    if (tipo !== 'mcq' && tipo !== 'cmp') {
      /* difensivo: si deduce dal contenuto invece di buttare via la domanda */
      tipo = q.opzioni ? 'mcq' : (q.risposta != null ? 'cmp' : '');
    }
    var d = {
      id: String(q.id != null ? q.id : ((meta && meta.slug ? meta.slug : 'q') + '-' + i)),
      tipo: tipo,
      tag: tagsDi(q),
      diff: normalizzaDiff(q.diff != null ? q.diff : q.difficolta),
      stem: String(q.stem || q.domanda || ''),
      /* La PROVENIENZA della singola domanda vince su quella del banco.
         Con un banco di una lezione sola le due coincidono e non cambia
         niente; con un banco RICOMPOSTO da più lezioni (l'hub `/studio/quiz/`)
         solo la domanda sa da dove viene — e il riepilogo delle sbagliate la
         stampa («Domanda 3 · Chimica UD16, parte B»). Prendendola dal banco,
         in un banco misto direbbe la lezione sbagliata a ogni riga. */
      slug: String((q.slug || (meta && meta.slug) || '')),
      parte: String((q.parte || (meta && meta.parte) || '')),
      materia: String((q.materia || (meta && meta.materia) || '')).toLowerCase(),
      lezione: String((q.lezione || (meta && meta.lezione) || ''))
    };
    if (!d.stem) return null;

    if (tipo === 'mcq') {
      var opz = q.opzioni || q.options || {}, lettere = [], k;
      for (k in opz) if (opz.hasOwnProperty(k) && String(opz[k]).replace(/^\s+|\s+$/g, '')) lettere.push(k);
      lettere.sort();
      if (lettere.length < 2) return null;
      var corretta = String(q.corretta || '').toUpperCase().slice(0, 1);
      if (!corretta || !opz.hasOwnProperty(corretta)) return null;
      d.opzioni = opz;
      d.lettere = lettere;
      d.corretta = corretta;
      d.perche = q.perche || {};
      return d;
    }
    if (tipo === 'cmp') {
      if (q.risposta == null || !String(q.risposta).replace(/^\s+|\s+$/g, '')) return null;
      d.risposta = String(q.risposta);
      d.varianti = esisteArray(q.varianti) ? q.varianti
        : (q.varianti ? String(q.varianti).split(/\s*\|\s*/) : []);
      d.errore = String(q.errore || q.errore_tipico || '');
      return d;
    }
    return null;
  }

  function normalizzaBanco(dati) {
    var meta = {
      slug: dati && dati.slug ? String(dati.slug) : '',
      parte: dati && dati.parte ? String(dati.parte) : '',
      materia: dati && dati.materia ? String(dati.materia).toLowerCase() : '',
      ud: dati && dati.ud ? String(dati.ud) : '',
      lezione: dati && dati.lezione ? String(dati.lezione) : ''
    };
    var grezze = (dati && (dati.domande || dati.questions)) || [];
    var domande = [], i, d;
    for (i = 0; i < grezze.length; i++) {
      d = normalizzaDomanda(grezze[i], i, meta);
      if (d) domande.push(d);
    }
    meta.domande = domande;
    return meta;
  }

  function mescolaIn(arr, rnd) {
    var r = rnd || Math.random, i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function hash32(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  /* PRNG deterministico dato un seme: serve per permutare le opzioni in
     modo stabile dentro la stessa sessione (mulberry32). */
  function prng(seme) {
    var a = seme >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Istanza di domanda pronta da mostrare: porta con sé la permutazione
     delle opzioni. `ordine[i]` = lettera ORIGINALE mostrata in posizione i. */
  function istanza(d, opz) {
    opz = opz || {};
    var ist = { q: d, ordine: null, risposta: null, testo: '', esito: null, autoval: false };
    if (d.tipo === 'mcq') {
      ist.ordine = d.lettere.slice();
      if (opz.mescolaOpzioni !== false) {
        mescolaIn(ist.ordine, prng(hash32(d.id + '|' + (opz.seme || 0))));
      }
    }
    return ist;
  }

  /* Sceglie `quante` domande di un tipo da un banco, preferendo quelle mai
     viste e — per gli MCQ — quelle con 5 opzioni (il formato d'esame). */
  function estrai(domande, tipo, quante, opz) {
    opz = opz || {};
    var visti = opz.visti || {};
    var diff = opz.diff || null;                  /* {base:1,...} oppure null = tutte */
    var quanteDiff = 0, k;
    if (diff) for (k in diff) if (diff[k]) quanteDiff++;
    var nuove = [], riviste = [], i, d;
    for (i = 0; i < domande.length; i++) {
      d = domande[i];
      if (tipo && d.tipo !== tipo) continue;
      if (quanteDiff && !diff[d.diff]) continue;
      if (opz.tag && indiceIn(d.tag, opz.tag) < 0) continue;
      (visti[d.id] ? riviste : nuove).push(d);
    }
    mescolaIn(nuove, opz.rnd);
    mescolaIn(riviste, opz.rnd);
    if (opz.preferisci5 && tipo === 'mcq') {
      nuove.sort(function (a, b) { return (b.lettere.length >= 5 ? 1 : 0) - (a.lettere.length >= 5 ? 1 : 0); });
    }
    var pool = nuove.concat(riviste);
    return quante == null ? pool : pool.slice(0, quante);
  }

  function indiceIn(arr, v) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
    return -1;
  }

  /* ---------------------------------------------------------------- *
   * 2b. Quote della simulazione: EQUE su tutti gli episodi             *
   * ---------------------------------------------------------------- */

  function chiaveLezione(v) { return v.slug + '-' + (v.parte || ''); }

  /* lezioni  = manifest.lezioni
     opz      = {mcq, cmp, materia, rnd, recenti:[chiavi], riusaLezioni}
     ritorna  = {piano:[{voce,slug,parte,mcq,cmp}], mcq, cmp, lezioni:n}

     Il giro è round-robin su una lista MESCOLATA: con 120 lezioni e 15 MCQ
     ogni lezione prende 0 o 1 domanda (quota uguale, resto sparso a caso);
     con 3 lezioni e 15 MCQ ognuna ne prende 5. In entrambi i casi la
     differenza fra due lezioni non supera mai 1: è questa la «quota equa». */
  function quoteEsame(lezioni, opz) {
    opz = opz || {};
    var vuoleMcq = opz.mcq != null ? opz.mcq : FORMATO_ESAME.mcq;
    var vuoleCmp = opz.cmp != null ? opz.cmp : FORMATO_ESAME.cmp;
    var recenti = {}, i, v;
    for (i = 0; i < (opz.recenti || []).length; i++) recenti[opz.recenti[i]] = 1;

    var buone = [], gia = {};
    for (i = 0; i < (lezioni || []).length; i++) {
      v = lezioni[i];
      if (!v || !v.slug) continue;
      if (opz.materia && String(v.materia || '').toLowerCase() !== opz.materia) continue;
      if (!(v.n_mcq > 0) && !(v.n_cmp > 0)) continue;
      /* due righe con lo stesso slug+parte sono UN file solo: senza questo
         controllo il giro le conta due volte e quella lezione riceve il
         doppio della quota (manifest sporco = prova sbilanciata) */
      if (gia[chiaveLezione(v)]) continue;
      gia[chiaveLezione(v)] = 1;
      buone.push(v);
    }
    mescolaIn(buone, opz.rnd);
    /* le lezioni della simulazione precedente vanno in coda: due prove di
       fila non insistono sugli stessi episodi */
    var fresche = [], usate = [];
    for (i = 0; i < buone.length; i++) {
      (recenti[chiaveLezione(buone[i])] ? usate : fresche).push(buone[i]);
    }
    buone = fresche.concat(usate);

    var piano = [], indice = {};
    function slot(v) {
      var k = chiaveLezione(v);
      if (!indice[k]) {
        indice[k] = { voce: v, slug: v.slug, parte: v.parte || '', mcq: 0, cmp: 0 };
        piano.push(indice[k]);
      }
      return indice[k];
    }

    function distribuisci(quante, campo, capacita, partenza) {
      var dati = 0, giri = 0, i2 = partenza;
      if (!buone.length) return { dati: 0, fine: partenza };
      while (dati < quante && giri < quante + buone.length * 2) {
        var v2 = buone[i2 % buone.length];
        var s = slot(v2);
        if (s[campo] < (v2[capacita] || 0)) { s[campo]++; dati++; }
        i2++; giri++;
        if (giri % buone.length === 0 && dati === 0) break;   /* nessuno può darne: si esce */
      }
      return { dati: dati, fine: i2 };
    }

    var a = distribuisci(vuoleMcq, 'mcq', 'n_mcq', 0);
    /* riusaLezioni: i completamenti ripartono dalla TESTA della stessa lista,
       così ricadono sulle lezioni che stiamo già scaricando (scelta 1). */
    var b = distribuisci(vuoleCmp, 'cmp', 'n_cmp', opz.riusaLezioni === false ? a.fine : 0);

    var vivi = [];
    for (i = 0; i < piano.length; i++) if (piano[i].mcq || piano[i].cmp) vivi.push(piano[i]);
    return { piano: vivi, mcq: a.dati, cmp: b.dati, lezioni: vivi.length };
  }

  /* ---------------------------------------------------------------- *
   * 3. Persistenza (localStorage con rete di sicurezza)                *
   * ---------------------------------------------------------------- */

  var memoria = {};

  function leggi(chiave) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(chiave);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* modalità privata, quota piena, file://: si continua in RAM */ }
    return memoria[chiave] || null;
  }

  function scrivi(chiave, valore) {
    memoria[chiave] = valore;
    try {
      if (global.localStorage) global.localStorage.setItem(chiave, JSON.stringify(valore));
      return true;
    } catch (e) { return false; }
  }

  function cancella(chiave) {
    delete memoria[chiave];
    try { if (global.localStorage) global.localStorage.removeItem(chiave); } catch (e) { }
  }

  function statoVuoto() { return { v: VERSIONE_STATO, visti: [], recenti: [], storia: [] }; }

  /* ---- IL REGISTRO DELLE SBAGLIATE (2026-07-30) -------------------------
     COSA NON C'ERA. «Rifai solo gli sbagliati» esisteva già, ma viveva DENTRO
     il riepilogo della prova appena consegnata (`punteggio().sbagliate`): chiusa
     la pagina, spariva. Non c'era nessun elenco che sopravvivesse alla sessione,
     quindi «riprova solo quelle che sbagli» — la domanda che uno studente si fa
     ogni volta — non era rispondibile da nessuna superficie del sito.

     PERCHÉ UN CASSETTO A PARTE, e non dentro `this.stato`. Gli stati dei quiz
     sono per-lezione (`quiz.v1.s1f01-A`) e uno per la simulazione; una domanda
     sbagliata su una pagina-episodio sarebbe invisibile all'hub e viceversa.
     Gli id delle domande però sono GLOBALMENTE unici (misurato: 14.433 domande,
     14.433 id distinti, 0 duplicati), quindi un registro unico non ha ambiguità
     ed è l'unico modo perché le due superfici parlino della stessa cosa.

     REGOLA: una risposta sbagliata (o «quasi», che non conta come giusta) la
     mette in registro; una risposta giusta la toglie. Il registro non è uno
     storico — è la lista di cosa TI RESTA da recuperare, e deve svuotarsi
     quando recuperi. `n` conta quante volte quella domanda ti ha fregato, così
     l'hub può metterle in ordine di quanto pesano. */
  var CHIAVE_SBAGLIATE = 'quiz.v1.sbagliate';
  var MAX_SBAGLIATE = 800;

  function registroSbagliate() {
    var s = leggi(CHIAVE_SBAGLIATE);
    if (!s || typeof s !== 'object' || esisteArray(s) || s.v !== VERSIONE_STATO ||
      !s.q || typeof s.q !== 'object' || esisteArray(s.q)) {
      return { v: VERSIONE_STATO, q: {} };
    }
    return s;
  }

  /* esiti = [{id, esito}]. Ritorna il registro aggiornato (già scritto). */
  function segnaEsiti(esiti) {
    var reg = registroSbagliate(), i, e, v, cambiato = false;
    for (i = 0; i < esiti.length; i++) {
      e = esiti[i];
      if (!e || !e.id) continue;
      if (e.esito === 'giusta') {
        if (reg.q[e.id]) { delete reg.q[e.id]; cambiato = true; }
      } else if (e.esito === 'sbagliata' || e.esito === 'quasi') {
        v = reg.q[e.id];
        reg.q[e.id] = { n: (v && v.n > 0 ? v.n : 0) + 1, t: (new Date()).getTime() };
        cambiato = true;
      }
      /* 'vuota' non è un errore di merito: saltare una domanda in simulazione
         non dice che non la sai. Non entra e non esce. */
    }
    if (!cambiato) return reg;
    /* Tetto: il registro sta in localStorage insieme a tutto il resto e non può
       crescere senza fine. Si tengono le PIÙ RECENTI — una domanda sbagliata
       due anni fa e mai più rivista non è più il tuo problema di oggi. */
    var chiavi = [];
    for (var k in reg.q) if (reg.q.hasOwnProperty(k)) chiavi.push(k);
    if (chiavi.length > MAX_SBAGLIATE) {
      chiavi.sort(function (a, b) { return (reg.q[b].t || 0) - (reg.q[a].t || 0); });
      var tenute = {};
      for (i = 0; i < MAX_SBAGLIATE; i++) tenute[chiavi[i]] = reg.q[chiavi[i]];
      reg.q = tenute;
    }
    scrivi(CHIAVE_SBAGLIATE, reg);
    return reg;
  }

  function sbagliate() { return registroSbagliate().q; }

  function caricaStato(chiave) {
    var s = leggi(chiave);
    if (!s || s.v !== VERSIONE_STATO) return statoVuoto();
    if (!esisteArray(s.visti)) s.visti = [];
    if (!esisteArray(s.recenti)) s.recenti = [];
    if (!esisteArray(s.storia)) s.storia = [];
    return s;
  }

  function mappaDi(arr) {
    var m = {}, i;
    for (i = 0; i < arr.length; i++) m[arr[i]] = 1;
    return m;
  }

  function anello(arr, nuovi, massimo) {
    var fuori = arr.concat(nuovi);
    if (fuori.length > massimo) fuori = fuori.slice(fuori.length - massimo);
    return fuori;
  }

  /* ---------------------------------------------------------------- *
   * 4. Foglio di stile (fonte unica; vedi nota in testa al file)       *
   * ---------------------------------------------------------------- */

  var CSS = [
    /* --btn-oncolor = il colore del TESTO sopra una superficie d'accento.
       Il sito la emette davvero (site.css: #14102A in night, #FFFFFF in
       day) e i due valori coincidono con i fallback scritti qui sotto; ma
       il motore non ci si appoggia e basta: dichiara un valore PROPRIO sui
       propri contenitori, tema per tema, agganciandosi a
       :root[data-theme="day"] come fa già il sito, così regge anche dove
       `--btn-oncolor` non c'è (demo, pagine senza site.css) — e lascia
       vincere la variabile della palette dove c'è.
         night (default del sito) → #14102A su --fisica #FF6BB0 = 7,02:1 ·
           --chimica #7C93FF = 6,57:1 · --biologia #3ED9A0 = 10,23:1
         day                      → #FFFFFF su --fisica #C13E7A = 4,96:1 ·
           --chimica #3A4FA6 = 7,37:1 · --biologia #2E8B6B = 4,18:1 ← SOTTO
       Il bianco in night darebbe 1,80-2,81:1: per questo il fallback
       scritto dentro ogni var() è #14102A, il più sicuro dei due.
       Il verde-day è l'unico che non passa AA in NESSUNA delle due
       direzioni (bianco 4,18 · #14102A 4,31): non è un colore che si può
       «riempire» di testo. Solo lì, e solo in day, la superficie piena e
       l'accento-testo passano a --biologia-dark #1B5742 (8,44:1) — che è
       una variabile che palette.py emette già, non un colore inventato.
       Riguarda 60 lezioni su 120: mezzo corpus. */
    '.qz{--qz-oncolor:var(--btn-oncolor,#14102A);',
    '  --qz-accent:var(--accent,var(--fisica,#C13E7A));',
    /* --qz-pieno = superficie che porta testo sopra · --qz-testo-accento =
       accento usato COME testo. Ovunque coincidono con l'accento; sono
       due nomi diversi perché è lì che il contrasto va garantito, mentre
       bordi, barre e contorni di fuoco possono restare il colore vivo. */
    '  --qz-pieno:var(--qz-accent);--qz-testo-accento:var(--qz-accent);',
    '  --qz-ok:var(--sem-corretto,#2FA84F);--qz-ko:var(--sem-errore,#E24B3C);',
    '  --qz-warn:var(--sem-energia,#E8912A);',
    /* I colori semantici vivi bastano per bordi e riempimenti (serve 3:1),
       NON come colore di un testo su superficie chiara: in day stanno a
       2,5-4,0:1 su #FFFFFF. In night vanno benissimo (5,7-9,6:1 su
       --surface #221B45), quindi il testo segue il colore vivo e solo il
       tema chiaro riceve le varianti scure qui sotto. */
    '  --qz-ok-testo:var(--qz-ok);--qz-ko-testo:var(--qz-ko);--qz-warn-testo:var(--qz-warn);',
    '  color:var(--ink,#201B2E);font-family:inherit;max-width:var(--measure,66ch);margin-inline:auto}',
    ':root[data-theme="day"] .qz{--qz-oncolor:var(--btn-oncolor,#FFFFFF);',
    '  --qz-ok-testo:#1C7A3C;--qz-ko-testo:#BE2A19;--qz-warn-testo:#8A5200}',
    /* Fallback DAY che NON dipende da --accent.
       Senza `data-materia` — schermata d'avvio della simulazione, riepilogo
       di una prova mista, domanda di una materia che non è fra le tre —
       `--qz-accent` ricadrebbe su `--accent`, che nelle pagine episodio del
       sito è impostato su un antenato di TUTTO il contenuto
       (`<div class="wrap" style="--accent:var(--biologia)">`) e in day vale
       #2E8B6B: bianco sopra = 4,18:1, sotto AA. Qui l'accento torna alla
       variante scura del colore di difetto di `.qz` (fisica): #7E2350, che
       fa 9,37:1 col bianco e 8,77:1 sul fondo chiaro.
       Selettore SENZA `:root`, apposta: specificità (0,2,0), la stessa
       delle tre regole per-materia qui sotto — che, essendo più in basso,
       vincono quando la materia c'è. Scritto `:root[data-theme="day"] .qz`
       sarebbe (0,3,0) e le batterebbe tutte, tingendo di magenta anche
       biologia e chimica. */
    '[data-theme="day"] .qz{--qz-accent:var(--fisica-dark,#7E2350)}',
    '.qz[data-materia="chimica"]{--qz-accent:var(--chimica,#3A4FA6)}',
    '.qz[data-materia="biologia"]{--qz-accent:var(--biologia,#2E8B6B)}',
    '.qz[data-materia="fisica"]{--qz-accent:var(--fisica,#C13E7A)}',
    /* specificità (0,4,0): batte .qz[data-materia] senza toccare le altre */
    ':root[data-theme="day"] .qz[data-materia="biologia"]{',
    '  --qz-pieno:var(--biologia-dark,#1B5742);--qz-testo-accento:var(--biologia-dark,#1B5742)}',
    '.qz *{box-sizing:border-box}',
    '.qz [hidden]{display:none !important}',
    '.qz-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',

    /* --- testa --- */
    '.qz-head{margin-bottom:14px}',
    '.qz-titolo{font-size:1.15rem;line-height:1.3;font-weight:700;margin:0}',
    '.qz-sub{font-size:.82rem;color:var(--muted,#6B6480);margin:4px 0 0}',

    /* --- barra strumenti --- */
    '.qz-strumenti{display:flex;flex-direction:column;gap:10px;padding:12px;',
    '  background:var(--surface,#fff);border:1px solid var(--line,#E7DFD4);border-radius:12px}',
    '.qz-riga{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.qz-riga>.qz-etichetta{font-size:.75rem;font-weight:700;letter-spacing:.04em;',
    '  text-transform:uppercase;color:var(--muted,#6B6480);flex:0 0 100%}',
    '@media (min-width:560px){.qz-riga>.qz-etichetta{flex:0 0 auto;margin-right:2px}}',
    /* 44px è il bersaglio minimo (WCAG 2.5.5 / linee guida iOS-Android):
       vale per TUTTI i comandi, non solo per quelli grandi. */
    '.qz-chip{font:inherit;font-size:.85rem;font-weight:600;padding:10px 15px;border-radius:30px;',
    '  border:1px solid var(--line,#E7DFD4);background:var(--card,transparent);',
    '  color:var(--muted,#6B6480);cursor:pointer;min-height:44px}',
    '.qz-chip:hover{border-color:var(--muted,#6B6480);color:var(--ink,#201B2E)}',
    '.qz-chip[aria-pressed="true"]{background:var(--qz-pieno);border-color:var(--qz-pieno);',
    '  color:var(--qz-oncolor,#14102A)}',
    '.qz-campo{display:flex;flex-direction:column;gap:4px;flex:1 1 170px;font-size:.78rem;',
    '  font-weight:600;color:var(--muted,#6B6480)}',
    /* 16px secchi sui campi: sotto i 16px iOS ingrandisce la pagina al
       fuoco e non torna più indietro. La riga doppia è voluta — i browser
       che non conoscono max() tengono comunque i 16px. */
    '.qz-campo select{font:inherit;font-size:16px;font-weight:400;padding:9px 10px;min-height:44px;',
    '  border-radius:9px;border:1px solid var(--line,#E7DFD4);background:var(--bg,#fff);',
    '  color:var(--ink,#201B2E);width:100%}',
    '.qz-campo select{font-size:max(16px,1rem)}',
    '.qz-btn{font:inherit;font-size:.85rem;font-weight:600;padding:10px 15px;min-height:44px;',
    '  border-radius:10px;border:1px solid var(--line,#E7DFD4);background:var(--card,transparent);',
    '  color:var(--ink,#201B2E);cursor:pointer}',
    '.qz-btn:hover{border-color:var(--muted,#6B6480)}',
    '.qz-btn[disabled]{opacity:.5;cursor:not-allowed}',
    '.qz-btn-forte{background:var(--qz-pieno);border-color:var(--qz-pieno);color:var(--qz-oncolor,#14102A)}',
    '.qz-btn-pericolo[data-conferma="1"]{border-color:var(--qz-ko);color:var(--qz-ko-testo)}',

    /* --- avanzamento --- */
    '.qz-avanzamento{margin:16px 0 10px}',
    '.qz-barra{height:7px;border-radius:99px;background:var(--line,#E7DFD4);overflow:hidden}',
    '.qz-barra>i{display:block;height:100%;width:0;border-radius:99px;background:var(--qz-accent);',
    '  transition:width .25s ease}',
    '.qz-conta{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;',
    '  font-size:.78rem;color:var(--muted,#6B6480);margin-top:6px}',
    '.qz-tempo{font-variant-numeric:tabular-nums}',

    /* --- la domanda --- */
    '.qz-carta{padding:18px 16px;border-radius:var(--radius,16px);border:1px solid var(--line,#E7DFD4);',
    '  background:var(--surface,#fff);box-shadow:var(--shadow,0 10px 26px -18px rgba(0,0,0,.4))}',
    '.qz-carta:focus{outline:none}',
    '.qz-tipo{display:inline-block;font-size:.68rem;font-weight:700;letter-spacing:.09em;',
    '  text-transform:uppercase;color:var(--qz-testo-accento);margin-bottom:9px}',
    '.qz-tipo em{font-style:normal;color:var(--muted,#6B6480);font-weight:600}',
    '.qz-stem{font-size:1.02rem;line-height:1.6;margin:0 0 14px}',
    '.qz-vuoto{display:inline-block;min-width:5.5em;border-bottom:2px solid var(--qz-accent);',
    '  vertical-align:baseline;margin:0 2px}',
    '.qz-opzioni{display:flex;flex-direction:column;gap:9px;border:0;padding:0;margin:0}',
    '.qz-opzioni legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.qz-opz{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;min-height:48px;',
    '  border:1px solid var(--line,#E7DFD4);border-radius:12px;background:var(--bg,transparent);',
    '  cursor:pointer;line-height:1.5;font-size:.95rem}',
    '.qz-opz:hover{border-color:var(--qz-accent)}',
    '.qz-opz input{flex:0 0 auto;margin:.3em 0 0;width:18px;height:18px;accent-color:var(--qz-accent)}',
    '.qz-opz .qz-lettera{flex:0 0 auto;font-weight:700;color:var(--muted,#6B6480)}',
    '.qz-opz.is-scelta{border-color:var(--qz-accent);background:var(--card,rgba(127,127,127,.06))}',
    '.qz-opz.is-giusta{border-color:var(--qz-ok);box-shadow:inset 0 0 0 1px var(--qz-ok)}',
    '.qz-opz.is-sbagliata{border-color:var(--qz-ko);box-shadow:inset 0 0 0 1px var(--qz-ko)}',
    '.qz-opz.is-spenta{opacity:.72}',
    '.qz-risposta{display:flex;flex-direction:column;gap:6px}',
    '.qz-risposta input{font:inherit;font-size:16px;padding:12px 13px;min-height:50px;border-radius:11px;',
    '  border:1px solid var(--line,#E7DFD4);background:var(--bg,#fff);color:var(--ink,#201B2E);width:100%}',
    '.qz-risposta input{font-size:max(16px,1rem)}',
    '.qz-risposta input:focus{border-color:var(--qz-accent)}',
    '.qz-aiuto{font-size:.76rem;color:var(--muted,#6B6480)}',
    '.qz-azioni{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px;align-items:center}',
    '.qz-azioni .qz-spinta{margin-left:auto}',

    /* --- feedback --- */
    '.qz-feedback{margin-top:13px;padding:13px 14px;border-radius:12px;border:1px solid var(--line,#E7DFD4);',
    '  background:var(--card,rgba(127,127,127,.06));font-size:.9rem;line-height:1.6}',
    '.qz-feedback:focus{outline:none}',
    '.qz-feedback.e-giusta{border-color:var(--qz-ok)}',
    '.qz-feedback.e-sbagliata{border-color:var(--qz-ko)}',
    '.qz-feedback.e-quasi{border-color:var(--qz-warn)}',
    '.qz-verdetto{font-weight:700;margin-bottom:6px}',
    '.qz-verdetto.e-giusta{color:var(--qz-ok-testo)}',
    '.qz-verdetto.e-sbagliata{color:var(--qz-ko-testo)}',
    '.qz-verdetto.e-quasi{color:var(--qz-warn-testo)}',
    '.qz-feedback p{margin:0 0 7px}',
    '.qz-feedback p:last-child{margin-bottom:0}',
    '.qz-feedback b{font-weight:700}',
    '.qz-atteso{font-weight:700}',

    /* --- griglia delle domande (esame) --- */
    /* 31 bersagli in una griglia a capo: è il posto dove sbagliare mira
       costa di più (si salta a un'altra domanda), quindi 44px pieni e
       gap generoso, non 34px con 5 di spazio. */
    '.qz-griglia{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}',
    '.qz-griglia button{font:inherit;font-size:.8rem;font-weight:600;min-width:44px;min-height:44px;',
    '  border-radius:10px;border:1px solid var(--line,#E7DFD4);background:var(--bg,transparent);',
    '  color:var(--muted,#6B6480);cursor:pointer;padding:0}',
    '.qz-griglia button.is-data{border-color:var(--qz-accent);color:var(--ink,#201B2E)}',
    '.qz-griglia button[aria-current="true"]{background:var(--qz-pieno);border-color:var(--qz-pieno);',
    '  color:var(--qz-oncolor,#14102A)}',

    /* --- riepilogo --- */
    '.qz-pannello{padding:20px 18px;border-radius:var(--radius,16px);background:var(--surface,#fff);',
    '  border:1px solid var(--line,#E7DFD4)}',
    '.qz-pannello h3{font-size:1.05rem;margin:0 0 12px}',
    '.qz-pannello h4{font-size:.9rem;margin:18px 0 8px}',
    '.qz-pannello p{font-size:.9rem;color:var(--muted,#6B6480);margin:0 0 12px;line-height:1.6}',
    '.qz-cifre{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:10px;margin-bottom:16px}',
    '.qz-cifra{padding:10px;border-radius:10px;background:var(--card,rgba(127,127,127,.07));text-align:center}',
    '.qz-cifra b{display:block;font-size:1.5rem;line-height:1.1}',
    '.qz-cifra span{font-size:.72rem;color:var(--muted,#6B6480)}',
    '.qz-errori{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}',
    '.qz-errore{padding:12px 13px;border-radius:11px;border:1px solid var(--line,#E7DFD4);',
    '  border-left:3px solid var(--qz-ko);background:var(--bg,transparent);font-size:.87rem;line-height:1.55}',
    '.qz-errore .qz-dove{font-size:.72rem;color:var(--muted,#6B6480);margin-bottom:5px}',
    '.qz-errore p{margin:0 0 6px}',
    '.qz-errore p:last-child{margin-bottom:0}',
    '.qz-storia{font-size:.8rem;color:var(--muted,#6B6480);line-height:1.7;margin:0;padding-left:18px}',
    '.qz-azioni-fine{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}',

    /* --- comune --- */
    '.qz code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;',
    '  background:var(--card,rgba(127,127,127,.12));padding:1px 5px;border-radius:5px}',
    '.qz :focus-visible{outline:3px solid var(--qz-accent);outline-offset:3px;border-radius:6px}',
    '@media (prefers-reduced-motion: reduce){.qz-barra>i{transition:none !important}}'
  ].join('\n');

  /* Il foglio condiviso `assets/study.css` si dichiara con
     data-motori-css="study": se c'è, nessun motore inietta niente. */
  function iniettaCss(doc) {
    if (!doc || doc.getElementById('qz-css')) return;
    if (doc.querySelector) {
      var nodi = doc.querySelectorAll('[data-motori-css]'), i, v;
      for (i = 0; i < nodi.length; i++) {
        v = String(nodi[i].getAttribute('data-motori-css') || '').toLowerCase();
        if (v === 'study' || v.indexOf('quiz') >= 0) return;
      }
    }
    var st = doc.createElement('style');
    st.id = 'qz-css';
    st.setAttribute('data-motori-css-quiz', '1');
    st.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------------------------------------------------------------- *
   * 5. Aiuti DOM + markdown inline                                     *
   * ---------------------------------------------------------------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Markdown inline → HTML. L'HTML del sorgente è SEMPRE neutralizzato
     prima: il JSON è nostro, ma un motore che scrive innerHTML deve saper
     dimostrare da solo di non iniettare niente. */
  function inlineMd(s) {
    var codici = [];
    var t = escapeHtml(s);
    t = t.replace(/`([^`]+)`/g, function (_, dentro) {
      codici.push(dentro);
      return '\u0000' + (codici.length - 1) + '\u0000';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(«"'])\*([^*\n]+)\*(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/\n/g, '<br>');
    t = t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codici[+i] + '</code>'; });
    return t;
  }

  /* Nello stem del completamento il buco è scritto `____`: lo si rende
     visibile come tale invece di lasciarlo passare per un refuso. */
  function stemHtml(s) {
    return inlineMd(s).replace(/_{3,}/g, '<span class="qz-vuoto"></span>');
  }

  function el(doc, tag, attr, testo) {
    var n = doc.createElement(tag), k;
    if (attr) for (k in attr) if (attr.hasOwnProperty(k) && attr[k] != null) {
      if (k === 'class') n.className = attr[k];
      else n.setAttribute(k, attr[k]);
    }
    if (testo != null) n.appendChild(doc.createTextNode(testo));
    return n;
  }

  function html(doc, tag, attr, markdown) {
    var n = el(doc, tag, attr);
    n.innerHTML = inlineMd(markdown);
    return n;
  }

  function svuota(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* ---------------------------------------------------------------- *
   * 5b. Rete: nessuna attesa senza fine                                *
   * ---------------------------------------------------------------- */

  /* Quanto si aspetta un singolo file. `data-timeout`/`opzioni.timeout`
     servono soprattutto alle prove: in pagina il valore buono è il difetto. */
  function tempoDa(radice, opzioni) {
    var v = (opzioni && opzioni.timeout != null) ? opzioni.timeout
      : (radice && radice.getAttribute ? radice.getAttribute('data-timeout') : null);
    v = +v;
    return (v > 0) ? v : TIMEOUT_FILE;
  }

  /* Lo SPORTELLO dei dati (assets/studio_fetch.js): i JSON di /studio sono
     CIFRATI con la stessa chiave delle pagine, e solo lui sa riaprirli.
     Se non è caricato non si ripiega su `r.json()` — quello leggerebbe il
     blob cifrato come «formato illeggibile» e, peggio, riaprirebbe il buco
     il giorno in cui i dati tornassero in chiaro. Si dice e ci si ferma.
     L'attesa breve copre l'unico caso in cui potrebbe non esserci ancora:
     nella pagina-cancello gli script vengono RICREATI a mano dopo la
     decifratura, e lì l'ordine dipende dal browser. */
  var ATTESA_SPORTELLO = 5000, PASSO_SPORTELLO = 25;

  function sportello() {
    var s = global.StudioFetch;
    return (s && typeof s.daRisposta === 'function') ? s : null;
  }

  function conSportello(cb) {
    var s = sportello();
    if (s) { cb(s); return; }
    if (!global.setTimeout) { cb(null); return; }
    var scaduto = 0;
    (function riprova() {
      var t = sportello();
      if (t) { cb(t); return; }
      scaduto += PASSO_SPORTELLO;
      if (scaduto >= ATTESA_SPORTELLO) { cb(null); return; }
      global.setTimeout(riprova, PASSO_SPORTELLO);
    })();
  }

  /* Scarica JSON e RITORNA SEMPRE un esito, mai un rigetto:
       {ok:true, dati:...}
       {ok:false, motivo:'timeout'|'rete'|'http'|'formato'|'cifrato',
                  messaggio:'...'}   (`messaggio` solo per 'cifrato')
     Il timeout non è cosmetico: con AbortController la richiesta viene
     davvero interrotta, così una rete che tace non tiene occupata una delle
     quattro corsie parallele fino alla fine dei tempi. */
  function prendiJson(url, timeout) {
    if (!global.fetch || !global.Promise) return null;
    var ctrl = null;
    try { if (global.AbortController) ctrl = new global.AbortController(); }
    catch (e) { ctrl = null; }
    var opz = { credentials: 'same-origin' };
    if (ctrl) opz.signal = ctrl.signal;

    return new global.Promise(function (risolvi) {
      var chiuso = false, orologio = null;
      function chiudi(esito) {
        if (chiuso) return;
        chiuso = true;
        if (orologio) { global.clearTimeout(orologio); orologio = null; }
        risolvi(esito);
      }
      orologio = global.setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) { } }
        chiudi({ ok: false, motivo: 'timeout' });
      }, timeout > 0 ? timeout : TIMEOUT_FILE);

      var p;
      try { p = global.fetch(url, opz); }
      catch (e) { chiudi({ ok: false, motivo: 'rete' }); return; }
      if (!p || typeof p.then !== 'function') { chiudi({ ok: false, motivo: 'rete' }); return; }
      p.then(function (r) {
        if (!r || !r.ok) { chiudi({ ok: false, motivo: 'http' }); return; }
        conSportello(function (sf) {
          if (!sf) {
            chiudi({ ok: false, motivo: 'cifrato', messaggio:
              'Il modulo che apre i materiali (studio_fetch.js) non è stato ' +
              'caricato: ricarica la pagina.' });
            return;
          }
          var pj;
          try { pj = sf.daRisposta(r); }
          catch (e) { chiudi({ ok: false, motivo: 'formato' }); return; }
          if (!pj || typeof pj.then !== 'function') { chiudi({ ok: true, dati: pj }); return; }
          pj.then(
            function (d) { chiudi({ ok: true, dati: d }); },
            function (err) {
              /* i guasti di CIFRATURA non si travestono da «rete lenta»:
                 hanno un motivo loro e un messaggio che dice cosa fare */
              if (err && err.motivo && err.motivo !== 'formato') {
                chiudi({ ok: false, motivo: 'cifrato', messaggio: err.messaggio });
              } else {
                chiudi({ ok: false, motivo: 'formato' });
              }
            }
          );
        });
      }, function () { chiudi({ ok: false, motivo: 'rete' }); });
    });
  }

  function mmss(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function percento(a, b) { return b ? Math.round(a * 100 / b) : 0; }

  /* ---------------------------------------------------------------- *
   * 6. L'applicazione                                                  *
   * ---------------------------------------------------------------- */

  function App(radice, dati, opzioni) {
    var doc = radice.ownerDocument || global.document;
    var self = this;
    opzioni = opzioni || {};

    /* rimontare sullo stesso contenitore (cambio lezione, ritorno alla
       schermata d'avvio) non deve lasciare in giro il vecchio motore: il
       suo listener di tastiera continuerebbe a rispondere. */
    if (radice.__qzApp && radice.__qzApp.smonta) {
      try { radice.__qzApp.smonta(); } catch (e) { }
    }
    radice.__qzApp = this;

    this.doc = doc;
    this.radice = radice;
    this.opz = opzioni;
    this.uid = 'qz' + (++contatoreId);
    this.modo = (opzioni.modo || radice.getAttribute('data-mode') || 'lezione').toLowerCase();
    if (this.modo !== 'esame') this.modo = 'lezione';
    this.mescolaOpzioni = opzioni.mescolaOpzioni !== false &&
      radice.getAttribute('data-mescola-opzioni') !== '0';
    this.seme = Math.floor(Math.random() * 1e9);

    this.formato = {
      mcq: numeroAttr(radice, 'data-mcq', opzioni.mcq, FORMATO_ESAME.mcq),
      cmp: numeroAttr(radice, 'data-cmp', opzioni.cmp, FORMATO_ESAME.cmp)
    };

    this.banco = null;        /* modo lezione */
    this.manifest = null;     /* modo esame */
    this.materia = String(opzioni.materia || radice.getAttribute('data-materia') || '').toLowerCase();

    this.serie = [];          /* istanze della prova in corso */
    this.pos = 0;
    this.consegnato = false;
    this.t0 = 0;
    this.durata = 0;
    this.timer = null;
    /* un motore smontato non deve tornare in vita quando scadono i suoi
       orologi: rimonterebbe una prova dentro un DOM staccato e, peggio,
       riaccenderebbe il cronometro (setInterval) per sempre */
    this.vivo = true;
    this.orologioPrep = null;

    iniettaCss(doc);
    this.costruisci();
    /* quello che si sa già dal montaggio: `data-materia` sulla radice o
       `opzioni.materia`. In esame è anche il filtro di partenza. */
    this.applicaMateria(this.materia);

    if (this.modo === 'esame') {
      this.manifest = dati && dati.lezioni ? dati : { lezioni: (dati && dati.length) ? dati : [] };
      this.chiave = 'quiz.v1.esame';
      this.stato = caricaStato(this.chiave);
      this.titolo = opzioni.titolo || radice.getAttribute('data-titolo') || 'Simulazione d’esame';
      this.schermataAvvio();
    } else {
      this.banco = normalizzaBanco(dati);
      this.chiave = 'quiz.v1.' + (this.banco.slug || 'lezione') +
        (this.banco.parte ? '-' + this.banco.parte : '');
      this.stato = caricaStato(this.chiave);
      this.titolo = opzioni.titolo || radice.getAttribute('data-titolo') ||
        this.banco.lezione || 'Esercitazione';
      this.applicaMateria(this.banco.materia || this.materia);
      this.filtri = { diff: {}, tipo: '', quante: 20 };
      this.chips = [];
      if (!this.banco.domande.length) {
        this.pannelloErrore('Questa lezione non ha domande utilizzabili.');
        return;
      }
      this.strumentiLezione();      /* una volta sola, qui */
      this.nuovaSessione();
    }

    /* scorciatoie da tastiera: 1..5 sceglie l'opzione, Invio conferma.
       Non si intromette mai mentre si scrive in un campo di testo. */
    this.onTasto = function (ev) { self.tasto(ev); };
    doc.addEventListener('keydown', this.onTasto, false);
  }

  function numeroAttr(radice, nome, daOpz, difetto) {
    if (daOpz != null) return daOpz;
    var v = radice.getAttribute && radice.getAttribute(nome);
    if (v != null && v !== '' && !isNaN(+v)) return Math.max(0, Math.floor(+v));
    return difetto;
  }

  /* ---------------- impalcatura ---------------- */

  App.prototype.costruisci = function () {
    var doc = this.doc;
    svuota(this.radice);

    this.sezione = el(doc, 'section', { 'class': 'qz' });
    this.testa = el(doc, 'div', { 'class': 'qz-head' });
    this.hTitolo = el(doc, 'h2', { 'class': 'qz-titolo' });
    this.hSub = el(doc, 'p', { 'class': 'qz-sub' });
    this.testa.appendChild(this.hTitolo);
    this.testa.appendChild(this.hSub);

    this.strumenti = el(doc, 'div', { 'class': 'qz-strumenti' });
    this.avanzamento = el(doc, 'div', { 'class': 'qz-avanzamento', hidden: 'hidden' });
    this.barra = el(doc, 'div', { 'class': 'qz-barra' });
    this.barraDentro = el(doc, 'i');
    this.barra.appendChild(this.barraDentro);
    this.conta = el(doc, 'div', { 'class': 'qz-conta' });
    this.contaSx = el(doc, 'span');
    this.contaDx = el(doc, 'span', { 'class': 'qz-tempo' });
    this.conta.appendChild(this.contaSx);
    this.conta.appendChild(this.contaDx);
    this.avanzamento.appendChild(this.barra);
    this.avanzamento.appendChild(this.conta);

    this.palco = el(doc, 'div');
    this.annuncio = el(doc, 'div', { 'class': 'qz-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });

    this.sezione.appendChild(this.testa);
    this.sezione.appendChild(this.strumenti);
    this.sezione.appendChild(this.avanzamento);
    this.sezione.appendChild(this.palco);
    this.sezione.appendChild(this.annuncio);
    this.radice.appendChild(this.sezione);
  };

  /* La materia guida i colori (le regole `.qz[data-materia=...]`), quindi va
     SCRITTA sul contenitore ogni volta che il motore la conosce e TOLTA
     quando non la conosce: un attributo stantio vestirebbe la schermata
     d'avvio o il riepilogo di una prova mista col colore dell'ultima domanda
     vista. Senza attributo il tema chiaro usa il fallback scuro del CSS, che
     non dipende da `--accent` ereditato dalla pagina. */
  App.prototype.applicaMateria = function (m) {
    if (!this.sezione) return;
    m = String(m || '').toLowerCase();
    if (MATERIE[m]) this.sezione.setAttribute('data-materia', m);
    else this.sezione.removeAttribute('data-materia');
  };

  App.prototype.dillo = function (testo) {
    /* si svuota prima: due annunci uguali di fila non verrebbero letti */
    svuota(this.annuncio);
    this.annuncio.appendChild(this.doc.createTextNode(testo));
  };

  /* IL FUOCO NON SI PERDE MAI. Ogni schermata viene ricostruita da zero:
     l'elemento che aveva il fuoco sparisce e il fuoco cade sul <body>,
     cioè all'inizio del documento — da tastiera bisognerebbe ritabulare
     tutto il sito per tornare alla domanda. Quindi ogni cambio di
     schermata FINISCE mettendo il fuoco sul nuovo contenitore. Non lo si
     fa al montaggio (nessuno ha chiesto niente: rubare il fuoco a chi sta
     leggendo la pagina sarebbe peggio del male). */
  App.prototype.metteFuocoSu = function (nodo) {
    if (!nodo || !nodo.focus) return;
    try { nodo.focus(); } catch (e) { }
  };

  App.prototype.pannelloErrore = function (testo, azioni, fuoco) {
    var doc = this.doc, self = this, i;
    svuota(this.palco);
    var p = el(doc, 'div', { 'class': 'qz-pannello', role: 'alert', tabindex: '-1' });
    p.appendChild(el(doc, 'h3', {}, 'Quiz non disponibile'));
    p.appendChild(el(doc, 'p', {}, testo));
    if (azioni && azioni.length) {
      var riga = el(doc, 'div', { 'class': 'qz-azioni-fine' });
      for (i = 0; i < azioni.length; i++) {
        riga.appendChild(bottoneAzione(doc, azioni[i]));
      }
      p.appendChild(riga);
    }
    this.palco.appendChild(p);
    if (fuoco) this.metteFuocoSu(p);
    return p;
  };

  function bottoneAzione(doc, a) {
    var b = el(doc, 'button', {
      type: 'button', 'class': 'qz-btn' + (a.forte ? ' qz-btn-forte' : '')
    }, a.etichetta);
    b.addEventListener('click', function () { a.fai(); }, false);
    return b;
  }

  /* ---------------- modo LEZIONE: strumenti ---------------- */

  /* La barra si costruisce UNA volta sola: rifarla a ogni click di filtro
     distruggeva la chip appena premuta e con lei il fuoco (e l'utente si
     ritrovava in cima alla pagina). Lo stato delle chip si aggiorna in
     loco, come deve essere per un toggle. */
  App.prototype.strumentiLezione = function () {
    var doc = this.doc, self = this, i;
    svuota(this.strumenti);
    this.chips = [];

    var rDiff = el(doc, 'div', { 'class': 'qz-riga' });
    rDiff.appendChild(el(doc, 'span', { 'class': 'qz-etichetta' }, 'Difficoltà'));
    var presenti = {}, d;
    for (i = 0; i < this.banco.domande.length; i++) presenti[this.banco.domande[i].diff] = 1;
    var ordine = ['base', 'medio', 'sfida'], lista = [];
    for (i = 0; i < ordine.length; i++) if (presenti[ordine[i]]) lista.push(ordine[i]);
    for (d in presenti) if (presenti.hasOwnProperty(d) && indiceIn(lista, d) < 0) lista.push(d);
    for (i = 0; i < lista.length; i++) rDiff.appendChild(this.chip(lista[i], 'diff', lista[i]));

    var rTipo = el(doc, 'div', { 'class': 'qz-riga' });
    rTipo.appendChild(el(doc, 'span', { 'class': 'qz-etichetta' }, 'Tipo'));
    rTipo.appendChild(this.chip('scelta multipla', 'tipo', 'mcq'));
    rTipo.appendChild(this.chip('completamento', 'tipo', 'cmp'));

    var rAltro = el(doc, 'div', { 'class': 'qz-riga' });
    var campo = el(doc, 'label', { 'class': 'qz-campo' }, 'Quante domande');
    var sel = el(doc, 'select');
    var scelte = [10, 20, 40, 0];
    for (i = 0; i < scelte.length; i++) {
      var o = el(doc, 'option', { value: String(scelte[i]) },
        scelte[i] ? String(scelte[i]) : 'tutte');
      if (scelte[i] === this.filtri.quante) o.setAttribute('selected', 'selected');
      sel.appendChild(o);
    }
    sel.addEventListener('change', function () {
      self.filtri.quante = +sel.value;
      self.nuovaSessione();
    }, false);
    campo.appendChild(sel);
    rAltro.appendChild(campo);

    var bNuova = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-forte' }, 'Nuova serie');
    bNuova.addEventListener('click', function () { self.nuovaSessione(); }, false);
    rAltro.appendChild(bNuova);

    this.strumenti.appendChild(rDiff);
    this.strumenti.appendChild(rTipo);
    this.strumenti.appendChild(rAltro);
  };

  App.prototype.chip = function (etichetta, gruppo, valore) {
    var doc = this.doc, self = this;
    var attivo = gruppo === 'diff' ? !!this.filtri.diff[valore] : this.filtri.tipo === valore;
    var b = el(doc, 'button', {
      type: 'button', 'class': 'qz-chip', 'aria-pressed': attivo ? 'true' : 'false'
    }, etichetta);
    b.addEventListener('click', function () {
      if (gruppo === 'diff') self.filtri.diff[valore] = !self.filtri.diff[valore];
      else self.filtri.tipo = self.filtri.tipo === valore ? '' : valore;
      self.aggiornaChips();          /* niente ricostruzione: la chip resta a fuoco */
      self.nuovaSessione();
    }, false);
    this.chips.push({ b: b, gruppo: gruppo, valore: valore });
    return b;
  };

  App.prototype.aggiornaChips = function () {
    var c = this.chips || [], i, attivo;
    for (i = 0; i < c.length; i++) {
      attivo = c[i].gruppo === 'diff'
        ? !!this.filtri.diff[c[i].valore]
        : this.filtri.tipo === c[i].valore;
      c[i].b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
    }
  };

  /* ---------------- sessione ---------------- */

  App.prototype.nuovaSessione = function (soloQueste, fuoco) {
    var self = this, i;
    this.consegnato = false;
    this.pos = 0;

    if (soloQueste) {
      this.serie = [];
      for (i = 0; i < soloQueste.length; i++) {
        this.serie.push(istanza(soloQueste[i], {
          mescolaOpzioni: this.mescolaOpzioni, seme: this.seme + 1 + i
        }));
      }
    } else if (this.modo === 'lezione') {
      this.aggiornaChips();
      var scelte = estrai(this.banco.domande, this.filtri.tipo || null,
        this.filtri.quante || null, {
          visti: mappaDi(this.stato.visti),
          diff: this.filtri.diff,
          preferisci5: false
        });
      this.serie = [];
      for (i = 0; i < scelte.length; i++) {
        this.serie.push(istanza(scelte[i], {
          mescolaOpzioni: this.mescolaOpzioni, seme: this.seme + i
        }));
      }
    }

    if (!this.serie.length) {
      this.avanzamento.setAttribute('hidden', 'hidden');
      /* niente `fuoco`: il pannello è role=alert, viene già annunciato, e
         chi ha appena premuto una chip deve restare sulla chip */
      this.pannelloErrore('Nessuna domanda con questi filtri. Allarga la selezione.');
      return;
    }

    this.hTitolo.textContent = this.titolo;
    this.hSub.textContent = this.sottotitolo();
    this.avanzamento.removeAttribute('hidden');
    this.t0 = (new Date()).getTime();
    this.durata = 0;
    this.avviaTimer();
    this.mostra(fuoco ? 'carta' : null);
  };

  App.prototype.sottotitolo = function () {
    var n = this.serie.length, mcq = 0, i;
    for (i = 0; i < this.serie.length; i++) if (this.serie[i].q.tipo === 'mcq') mcq++;
    var pezzi = [];
    if (this.modo === 'esame') pezzi.push('formato d’esame');
    pezzi.push(n + (n === 1 ? ' domanda' : ' domande'));
    pezzi.push(mcq + ' a scelta multipla · ' + (n - mcq) + ' a completamento');
    if (this.modo === 'lezione' && this.banco && this.banco.ud) pezzi.push(this.banco.ud);
    return pezzi.join(' — ');
  };

  App.prototype.avviaTimer = function () {
    var self = this;
    this.fermaTimer();
    this.timer = global.setInterval(function () { self.aggiornaTempo(); }, 1000);
    this.aggiornaTempo();
  };

  App.prototype.fermaTimer = function () {
    if (this.timer) { global.clearInterval(this.timer); this.timer = null; }
  };

  App.prototype.aggiornaTempo = function () {
    if (!this.t0) return;
    this.durata = (new Date()).getTime() - this.t0;
    this.contaDx.textContent = mmss(this.durata);
  };

  /* ---------------- rendering della domanda ---------------- */

  /* `fuoco` = dove finisce il fuoco dopo aver ridisegnato:
     'carta' | 'campo' | 'feedback' | null (nessuno: montaggio o filtro). */
  App.prototype.mostra = function (fuoco) {
    var doc = this.doc, self = this, ist = this.serie[this.pos];
    if (!ist) return;
    var d = ist.q;
    svuota(this.palco);
    /* i riferimenti al DOM della domanda precedente non devono sopravvivere:
       `vai()` e `scegli()` ci ragionano sopra */
    this.campo = null;
    this.griglia = null;
    this.feedback = null;
    /* in esame ogni domanda porta la sua materia; se la domanda non ce l'ha
       (o non è fra le tre) si ricade sul filtro scelto, e se nemmeno quello
       c'è l'attributo se ne va: meglio il fallback neutro che il colore
       della domanda precedente */
    if (this.modo === 'esame') this.applicaMateria(d.materia || this.materia);

    /* avanzamento */
    var fatte = 0, i;
    for (i = 0; i < this.serie.length; i++) if (this.rispostaData(this.serie[i])) fatte++;
    this.barraDentro.style.width = percento(fatte, this.serie.length) + '%';
    this.contaSx.textContent = 'Domanda ' + (this.pos + 1) + ' di ' + this.serie.length +
      (this.modo === 'esame' ? ' · ' + fatte + ' completate' : '');

    var carta = el(doc, 'div', { 'class': 'qz-carta', tabindex: '-1' });
    this.carta = carta;

    var tipo = el(doc, 'span', { 'class': 'qz-tipo' });
    tipo.appendChild(doc.createTextNode(d.tipo === 'mcq' ? 'Scelta multipla' : 'Completamento'));
    if (this.modo === 'lezione') {
      var extra = el(doc, 'em', {}, '  ·  ' + d.diff + (d.tag.length ? '  ·  ' + d.tag[0] : ''));
      tipo.appendChild(extra);
    } else if (d.materia) {
      tipo.appendChild(el(doc, 'em', {}, '  ·  ' + d.materia));
    }
    carta.appendChild(tipo);

    var stem = el(doc, 'p', { 'class': 'qz-stem', id: this.uid + '-stem' });
    stem.innerHTML = stemHtml(d.stem);
    carta.appendChild(stem);

    if (d.tipo === 'mcq') carta.appendChild(this.rendiOpzioni(ist));
    else carta.appendChild(this.rendiCampo(ist));

    /* azioni */
    var azioni = el(doc, 'div', { 'class': 'qz-azioni' });
    if (this.modo === 'esame') {
      var bPrec = el(doc, 'button', { type: 'button', 'class': 'qz-btn' }, '← Indietro');
      bPrec.disabled = this.pos === 0;
      bPrec.addEventListener('click', function () { self.vai(self.pos - 1); }, false);
      azioni.appendChild(bPrec);

      var ultima = this.pos === this.serie.length - 1;
      var bAvanti = el(doc, 'button', {
        type: 'button', 'class': 'qz-btn' + (ultima ? '' : ' qz-btn-forte')
      }, ultima ? 'Vai alla consegna' : 'Avanti →');
      bAvanti.addEventListener('click', function () {
        if (ultima) self.chiediConsegna(bAvanti); else self.vai(self.pos + 1);
      }, false);
      azioni.appendChild(bAvanti);

      var bCons = el(doc, 'button', {
        type: 'button', 'class': 'qz-btn qz-btn-pericolo qz-spinta'
      }, 'Consegna');
      bCons.addEventListener('click', function () { self.chiediConsegna(bCons); }, false);
      azioni.appendChild(bCons);
    } else if (ist.esito) {
      var bProx = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-forte' },
        this.pos === this.serie.length - 1 ? 'Vedi il risultato' : 'Avanti →');
      bProx.addEventListener('click', function () {
        if (self.pos === self.serie.length - 1) self.consegna();
        else self.vai(self.pos + 1);
      }, false);
      azioni.appendChild(bProx);
    } else {
      var bRisp = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-forte' }, 'Rispondi');
      bRisp.addEventListener('click', function () { self.rispondi(); }, false);
      azioni.appendChild(bRisp);
      var bSalta = el(doc, 'button', { type: 'button', 'class': 'qz-btn' }, 'Salta');
      bSalta.addEventListener('click', function () {
        if (self.pos === self.serie.length - 1) self.consegna();
        else self.vai(self.pos + 1);
      }, false);
      azioni.appendChild(bSalta);
    }
    carta.appendChild(azioni);
    this.palco.appendChild(carta);

    if (this.modo === 'lezione' && ist.esito) this.rendiFeedback(ist, carta);
    if (this.modo === 'esame') {
      this.palco.appendChild(this.rendiGriglia());
      this.palco.appendChild(this.aiutoGriglia());
    }

    /* a voce, «____» va detto: letto com'è diventa una fila di trattini */
    this.dillo('Domanda ' + (this.pos + 1) + ' di ' + this.serie.length + '. ' +
      d.stem.replace(/_{3,}/g, ' spazio vuoto '));

    if (fuoco === 'feedback' && this.feedback) this.metteFuocoSu(this.feedback);
    else if (fuoco === 'campo' && this.campo) this.metteFuocoSu(this.campo);
    else if (fuoco) this.metteFuocoSu(this.carta);
  };

  App.prototype.rispostaData = function (ist) {
    if (ist.q.tipo === 'mcq') return ist.risposta != null;
    return !!(ist.testo && ist.testo.replace(/^\s+|\s+$/g, ''));
  };

  App.prototype.rendiOpzioni = function (ist) {
    var doc = this.doc, self = this, d = ist.q, i;
    var fs = el(doc, 'fieldset', { 'class': 'qz-opzioni' });
    fs.appendChild(el(doc, 'legend', {}, d.stem));
    var bloccato = this.modo === 'lezione' && !!ist.esito;

    for (i = 0; i < ist.ordine.length; i++) {
      var orig = ist.ordine[i];
      var lab = el(doc, 'label', { 'class': 'qz-opz' });
      var input = el(doc, 'input', {
        type: 'radio', name: this.uid + '-q' + this.pos, value: orig,
        /* il nome accessibile verrebbe già dall'etichetta che lo avvolge:
           lo si scrive comunque, perché il testo dell'opzione è markdown e
           qui va letto in chiaro (niente asterischi né apici a voce) */
        'aria-label': LETTERE[i] + '. ' + String(d.opzioni[orig]).replace(/[*`_]/g, '')
      });
      if (ist.risposta === orig) { input.checked = true; lab.className += ' is-scelta'; }
      if (bloccato) {
        input.disabled = true;
        lab.className += ' is-spenta';
        if (orig === d.corretta) lab.className += ' is-giusta';
        else if (ist.risposta === orig) lab.className += ' is-sbagliata';
      }
      /* eslint-disable no-loop-func */
      input.addEventListener('change', (function (lettera) {
        return function () { self.scegli(lettera); };
      })(orig), false);
      lab.appendChild(input);
      lab.appendChild(el(doc, 'span', { 'class': 'qz-lettera' }, LETTERE[i] + '.'));
      lab.appendChild(html(doc, 'span', {}, String(d.opzioni[orig])));
      fs.appendChild(lab);
    }
    return fs;
  };

  App.prototype.rendiCampo = function (ist) {
    var doc = this.doc, self = this;
    var box = el(doc, 'div', { 'class': 'qz-risposta' });
    var input = el(doc, 'input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: this.modo === 'esame' ? 'next' : 'done',
      'aria-labelledby': this.uid + '-stem',
      placeholder: 'scrivi la risposta'
    });
    input.value = ist.testo || '';
    if (this.modo === 'lezione' && ist.esito) input.disabled = true;
    input.addEventListener('input', function () {
      ist.testo = input.value;
      self.aggiornaGriglia();
    }, false);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.keyCode === 13) {
        ev.preventDefault();
        if (self.modo === 'esame') {
          if (self.pos < self.serie.length - 1) self.vai(self.pos + 1);
        } else if (!ist.esito) self.rispondi();
      }
    }, false);
    this.campo = input;
    box.appendChild(input);
    box.appendChild(el(doc, 'p', { 'class': 'qz-aiuto' },
      'Maiuscole, accenti e spazi non contano. Invio per confermare.'));
    return box;
  };

  App.prototype.rendiGriglia = function () {
    var doc = this.doc, self = this, i;
    var g = el(doc, 'nav', { 'class': 'qz-griglia', 'aria-label': 'Vai a una domanda' });
    for (i = 0; i < this.serie.length; i++) {
      var ist = this.serie[i], data = this.rispostaData(ist);
      var b = el(doc, 'button', {
        type: 'button',
        'class': data ? 'is-data' : '',
        'aria-current': i === this.pos ? 'true' : 'false',
        'aria-label': 'Domanda ' + (i + 1) + (data ? ', risposta data' : ', ancora vuota')
      }, String(i + 1));
      b.addEventListener('click', (function (k) {
        return function () { self.vai(k); };
      })(i), false);
      g.appendChild(b);
    }
    this.griglia = g;
    return g;
  };

  App.prototype.aiutoGriglia = function () {
    return el(this.doc, 'p', { 'class': 'qz-aiuto' },
      'Da tastiera: ← → cambiano domanda; dentro le opzioni le frecce ' +
      'scorrono le risposte, 1…5 le scelgono.');
  };

  App.prototype.aggiornaGriglia = function () {
    if (!this.griglia) return;
    var b = this.griglia.childNodes, i;
    for (i = 0; i < b.length && i < this.serie.length; i++) {
      var data = this.rispostaData(this.serie[i]);
      b[i].className = data ? 'is-data' : '';
      b[i].setAttribute('aria-current', i === this.pos ? 'true' : 'false');
      b[i].setAttribute('aria-label', 'Domanda ' + (i + 1) + (data ? ', risposta data' : ', ancora vuota'));
    }
  };

  App.prototype.scegli = function (lettera) {
    var ist = this.serie[this.pos];
    if (this.modo === 'lezione' && ist.esito) return;
    ist.risposta = lettera;
    var lab = this.carta ? this.carta.getElementsByTagName('label') : [], i;
    for (i = 0; i < lab.length; i++) {
      lab[i].className = 'qz-opz' + (ist.ordine[i] === lettera ? ' is-scelta' : '');
    }
    this.aggiornaGriglia();
  };

  App.prototype.vai = function (k) {
    if (k < 0 || k >= this.serie.length) return;
    this.pos = k;
    /* sul completamento il fuoco va nel campo (si scrive subito), sulla
       scelta multipla sulla carta (i radio si raggiungono con Tab e si
       scorrono con le frecce native) */
    this.mostra(this.serie[k].q.tipo === 'cmp' ? 'campo' : 'carta');
  };

  /* ---------------- risposta + feedback (modo lezione) ---------------- */

  App.prototype.rispondi = function () {
    var ist = this.serie[this.pos], d = ist.q;
    if (ist.esito) return;
    if (d.tipo === 'mcq') {
      if (ist.risposta == null) { this.dillo('Scegli una risposta.'); return; }
      ist.esito = ist.risposta === d.corretta ? 'giusta' : 'sbagliata';
      ist.dettaglio = null;
    } else {
      if (this.campo) ist.testo = this.campo.value;
      var esito = correggi(d, ist.testo);
      if (esito.esito === 'vuota') { this.dillo('Scrivi una risposta.'); return; }
      ist.dettaglio = esito;
      ist.esito = esito.esito === 'giusta' ? 'giusta' : (esito.esito === 'quasi' ? 'quasi' : 'sbagliata');
    }
    this.stato.visti = anello(this.stato.visti, [d.id], MAX_VISTI);
    scrivi(this.chiave, this.stato);
    segnaEsiti([{ id: d.id, esito: ist.esito }]);
    ist.registrata = true;
    this.mostra('feedback');
    /* `mostra()` annuncia la domanda: qui l'annuncio utile è il verdetto.
       Va DOPO, altrimenti lo sovrascrive. */
    this.dillo(ist.esito === 'giusta' ? 'Risposta giusta.'
      : (ist.esito === 'quasi' ? 'Quasi giusta, ma non conta: controlla la risposta attesa.'
        : 'Risposta sbagliata.'));
  };

  App.prototype.rendiFeedback = function (ist, dove) {
    var doc = this.doc, self = this, d = ist.q, giusta = ist.esito === 'giusta';
    var classe = giusta ? 'e-giusta' : (ist.esito === 'quasi' ? 'e-quasi' : 'e-sbagliata');
    var box = el(doc, 'div', { 'class': 'qz-feedback ' + classe, role: 'status', tabindex: '-1' });

    var verdetto = giusta ? (ist.autoval ? 'Contata come giusta' : 'Giusta')
      : (ist.esito === 'quasi' ? 'Quasi — ma non la conto giusta' : 'Sbagliata');
    box.appendChild(el(doc, 'p', { 'class': 'qz-verdetto ' + classe }, verdetto));

    if (d.tipo === 'mcq') {
      if (!giusta) {
        var suo = ist.risposta;
        if (suo && d.perche && d.perche[suo]) {
          box.appendChild(html(doc, 'p', {},
            '**La tua:** ' + String(d.perche[suo])));
        } else if (suo) {
          box.appendChild(html(doc, 'p', {},
            '**La tua:** ' + String(d.opzioni[suo]) + ' — non è la risposta corretta.'));
        }
      }
      if (d.perche && d.perche.giusta) {
        box.appendChild(html(doc, 'p', {}, '**Perché:** ' + String(d.perche.giusta)));
      } else {
        box.appendChild(html(doc, 'p', {}, '**Corretta:** ' + String(d.opzioni[d.corretta])));
      }
    } else {
      if (!giusta) {
        box.appendChild(html(doc, 'p', {}, '**Attesa:** ' + d.risposta));
        if (d.varianti && d.varianti.length) {
          box.appendChild(html(doc, 'p', {}, 'Accettate anche: ' + d.varianti.join(' · ')));
        }
        if (d.errore) box.appendChild(html(doc, 'p', {}, '**Errore tipico:** ' + d.errore));
      } else if (ist.dettaglio && ist.dettaglio.come && ist.dettaglio.come !== 'esatta') {
        box.appendChild(html(doc, 'p', {}, 'Riconosciuta come **' + d.risposta + '**.'));
      }
    }

    if (!giusta && d.tipo === 'cmp' && !ist.autoval) {
      var b = el(doc, 'button', {
        type: 'button',
        'class': 'qz-btn' + (ist.esito === 'quasi' ? ' qz-btn-forte' : '')
      }, 'Considera giusta');
      b.addEventListener('click', function () {
        ist.esito = 'giusta';
        ist.autoval = true;
        /* L'ultima parola è dello studente ANCHE per il registro delle
           sbagliate: se ha deciso che la sapeva, quella domanda deve uscire
           da «solo le sbagliate». Restarci sarebbe un elenco che non gli
           obbedisce e che non si svuota mai. */
        segnaEsiti([{ id: d.id, esito: 'giusta' }]);
        /* il bottone appena premuto viene distrutto dal ridisegno: il
           fuoco va sul riscontro nuovo, non sul <body> */
        self.mostra('feedback');
        self.dillo('Contata come giusta.');
      }, false);
      box.appendChild(b);
    }
    this.feedback = box;
    (dove || this.palco).appendChild(box);
    return box;
  };

  /* ---------------- consegna e riepilogo ---------------- */

  App.prototype.chiediConsegna = function (bottone) {
    var vuote = 0, i;
    for (i = 0; i < this.serie.length; i++) if (!this.rispostaData(this.serie[i])) vuote++;
    if (!vuote) { this.consegna(); return; }
    if (bottone && bottone.getAttribute('data-conferma') !== '1') {
      bottone.setAttribute('data-conferma', '1');
      bottone.textContent = 'Consegna con ' + vuote + ' vuote?';
      this.dillo('Ci sono ' + vuote + ' domande senza risposta. Premi di nuovo per consegnare.');
      return;
    }
    this.consegna();
  };

  App.prototype.consegna = function () {
    var i, ist, d;
    this.fermaTimer();
    this.aggiornaTempo();
    this.consegnato = true;

    for (i = 0; i < this.serie.length; i++) {
      ist = this.serie[i]; d = ist.q;
      if (ist.esito && this.modo === 'lezione') continue;
      if (d.tipo === 'mcq') {
        ist.esito = ist.risposta == null ? 'vuota'
          : (ist.risposta === d.corretta ? 'giusta' : 'sbagliata');
      } else {
        var e = correggi(d, ist.testo);
        ist.dettaglio = e;
        ist.esito = e.esito === 'giusta' ? 'giusta'
          : (e.esito === 'vuota' ? 'vuota' : (e.esito === 'quasi' ? 'quasi' : 'sbagliata'));
      }
    }

    /* memoria: domande viste + lezioni toccate (per non ripeterle subito) */
    var visti = [], lez = {}, k, esiti = [];
    for (i = 0; i < this.serie.length; i++) {
      visti.push(this.serie[i].q.id);
      /* `registrata` NON è pignoleria: in modo lezione ogni risposta è già
         passata da `rispondi()`, e ripassarla qui conterebbe DUE volte lo
         stesso errore nel campo `n` — cioè l'ordinamento «quali ti fregano di
         più» direbbe il doppio per le lezioni e il singolo per la simulazione. */
      if (!this.serie[i].registrata) {
        esiti.push({ id: this.serie[i].q.id, esito: this.serie[i].esito });
        this.serie[i].registrata = true;
      }
      if (this.serie[i].q.slug) lez[this.serie[i].q.slug + '-' + this.serie[i].q.parte] = 1;
    }
    /* Il registro delle sbagliate è trasversale alle lezioni e alle prove:
       si aggiorna qui, non dentro `this.stato`. */
    if (esiti.length) segnaEsiti(esiti);
    this.stato.visti = anello(this.stato.visti, visti, MAX_VISTI);
    if (this.modo === 'esame') {
      var recenti = [];
      for (k in lez) if (lez.hasOwnProperty(k)) recenti.push(k);
      this.stato.recenti = recenti;
    }
    var p = this.punteggio();
    this.stato.storia = anello(this.stato.storia, [{
      quando: (new Date()).getTime(), giuste: p.giuste, totale: p.totale,
      durata: this.durata, autoval: p.autoval, modo: this.modo
    }], 20);
    scrivi(this.chiave, this.stato);

    this.riepilogo();
  };

  App.prototype.punteggio = function () {
    var p = {
      totale: this.serie.length, giuste: 0, autoval: 0, vuote: 0,
      mcq: 0, mcqGiuste: 0, cmp: 0, cmpGiuste: 0, sbagliate: []
    }, i, ist;
    for (i = 0; i < this.serie.length; i++) {
      ist = this.serie[i];
      var mcq = ist.q.tipo === 'mcq';
      if (mcq) p.mcq++; else p.cmp++;
      if (ist.esito === 'giusta') {
        p.giuste++;
        if (mcq) p.mcqGiuste++; else p.cmpGiuste++;
        if (ist.autoval) p.autoval++;
      } else {
        if (ist.esito === 'vuota') p.vuote++;
        p.sbagliate.push({ i: i, ist: ist });
      }
    }
    return p;
  };

  App.prototype.riepilogo = function (annuncio) {
    var doc = this.doc, self = this, p = this.punteggio(), i;
    svuota(this.palco);
    this.avanzamento.setAttribute('hidden', 'hidden');
    this.barraDentro.style.width = '100%';
    /* il riepilogo di una simulazione è cross-materia: torna al filtro
       scelto (o a nessuna materia), non al colore dell'ultima domanda */
    if (this.modo === 'esame') this.applicaMateria(this.materia);

    var pan = el(doc, 'div', { 'class': 'qz-pannello', tabindex: '-1' });
    pan.appendChild(el(doc, 'h3', {},
      this.modo === 'esame' ? 'Simulazione consegnata' : 'Serie completata'));

    var cifre = el(doc, 'div', { 'class': 'qz-cifre' });
    cifre.appendChild(this.cifra(p.giuste + '/' + p.totale, 'risposte giuste'));
    cifre.appendChild(this.cifra(percento(p.giuste, p.totale) + '%', 'punteggio'));
    if (p.mcq) cifre.appendChild(this.cifra(p.mcqGiuste + '/' + p.mcq, 'scelta multipla'));
    if (p.cmp) cifre.appendChild(this.cifra(p.cmpGiuste + '/' + p.cmp, 'completamento'));
    cifre.appendChild(this.cifra(mmss(this.durata), 'tempo'));
    pan.appendChild(cifre);

    if (p.autoval) {
      pan.appendChild(el(doc, 'p', {}, p.autoval + (p.autoval === 1
        ? ' risposta è stata contata giusta da te, non dalla correzione automatica.'
        : ' risposte sono state contate giuste da te, non dalla correzione automatica.')));
    }
    if (p.vuote) pan.appendChild(el(doc, 'p', {}, p.vuote + ' lasciate in bianco.'));

    if (p.sbagliate.length) {
      pan.appendChild(el(doc, 'h4', {}, 'Da rivedere (' + p.sbagliate.length + ')'));
      var ul = el(doc, 'ul', { 'class': 'qz-errori' });
      for (i = 0; i < p.sbagliate.length; i++) {
        ul.appendChild(this.vociErrore(p.sbagliate[i].ist, p.sbagliate[i].i));
      }
      pan.appendChild(ul);
    } else {
      pan.appendChild(el(doc, 'p', {}, 'Nessun errore. Rifallo fra qualche giorno: la memoria si vede a distanza, non subito.'));
    }

    var azioni = el(doc, 'div', { 'class': 'qz-azioni-fine' });
    if (p.sbagliate.length) {
      var bRif = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-forte' },
        'Rifai solo gli sbagliati (' + p.sbagliate.length + ')');
      bRif.addEventListener('click', function () {
        var soli = [], k;
        for (k = 0; k < p.sbagliate.length; k++) soli.push(p.sbagliate[k].ist.q);
        self.seme = Math.floor(Math.random() * 1e9);
        self.nuovaSessione(soli, true);
      }, false);
      azioni.appendChild(bRif);
    }
    var bAncora = el(doc, 'button', { type: 'button', 'class': 'qz-btn' },
      this.modo === 'esame' ? 'Nuova simulazione' : 'Nuova serie');
    bAncora.addEventListener('click', function () {
      self.seme = Math.floor(Math.random() * 1e9);
      if (self.modo === 'esame') self.schermataAvvio(true);
      else self.nuovaSessione(null, true);
    }, false);
    azioni.appendChild(bAncora);

    var bPulisci = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-pericolo' },
      'Azzera i progressi');
    bPulisci.addEventListener('click', function () {
      if (bPulisci.getAttribute('data-conferma') !== '1') {
        bPulisci.setAttribute('data-conferma', '1');
        bPulisci.textContent = 'Sicuro? Premi di nuovo';
        return;
      }
      cancella(self.chiave);
      self.stato = statoVuoto();
      bPulisci.textContent = 'Progressi azzerati';
      bPulisci.disabled = true;
    }, false);
    azioni.appendChild(bPulisci);
    pan.appendChild(azioni);

    if (this.stato.storia.length > 1) {
      pan.appendChild(el(doc, 'h4', {}, 'Prove precedenti'));
      var ol = el(doc, 'ul', { 'class': 'qz-storia' });
      var storia = this.stato.storia.slice(0, this.stato.storia.length - 1);
      for (i = storia.length - 1; i >= 0 && i >= storia.length - 5; i--) {
        var s = storia[i];
        ol.appendChild(el(doc, 'li', {}, s.giuste + '/' + s.totale +
          ' (' + percento(s.giuste, s.totale) + '%) · ' + mmss(s.durata) +
          ' · ' + (new Date(s.quando)).toLocaleDateString()));
      }
      pan.appendChild(ol);
    }

    this.palco.appendChild(pan);
    this.dillo(annuncio || ('Prova finita: ' + p.giuste + ' su ' + p.totale + ', ' +
      percento(p.giuste, p.totale) + ' per cento, in ' + mmss(this.durata) + '.'));
    this.metteFuocoSu(pan);
  };

  App.prototype.cifra = function (grande, piccolo) {
    var doc = this.doc, c = el(doc, 'div', { 'class': 'qz-cifra' });
    c.appendChild(el(doc, 'b', {}, grande));
    c.appendChild(el(doc, 'span', {}, piccolo));
    return c;
  };

  App.prototype.vociErrore = function (ist, i) {
    var doc = this.doc, self = this, d = ist.q;
    var li = el(doc, 'li', { 'class': 'qz-errore' });
    var dove = 'Domanda ' + (i + 1) + (d.lezione ? ' · ' + d.lezione : '') +
      (d.tag.length ? ' · ' + d.tag.join(', ') : '');
    li.appendChild(el(doc, 'p', { 'class': 'qz-dove' }, dove));
    li.appendChild(html(doc, 'p', {}, d.stem.replace(/_{3,}/g, '____')));

    if (d.tipo === 'mcq') {
      if (ist.risposta != null) {
        li.appendChild(html(doc, 'p', {}, '**La tua:** ' + String(d.opzioni[ist.risposta])));
        if (d.perche && d.perche[ist.risposta]) {
          li.appendChild(html(doc, 'p', {}, String(d.perche[ist.risposta])));
        }
      } else {
        li.appendChild(el(doc, 'p', {}, 'Lasciata in bianco.'));
      }
      li.appendChild(html(doc, 'p', { 'class': 'qz-atteso' },
        '**Giusta:** ' + String(d.opzioni[d.corretta])));
      if (d.perche && d.perche.giusta) li.appendChild(html(doc, 'p', {}, String(d.perche.giusta)));
    } else {
      li.appendChild(el(doc, 'p', {}, ist.testo
        ? 'La tua: “' + ist.testo + '”' : 'Lasciata in bianco.'));
      li.appendChild(html(doc, 'p', { 'class': 'qz-atteso' }, '**Attesa:** ' + d.risposta));
      if (d.varianti && d.varianti.length) {
        li.appendChild(html(doc, 'p', {}, 'Accettate anche: ' + d.varianti.join(' · ')));
      }
      if (d.errore) li.appendChild(html(doc, 'p', {}, '**Errore tipico:** ' + d.errore));
      if (ist.esito !== 'vuota') {
        var b = el(doc, 'button', {
          type: 'button',
          'class': 'qz-btn' + (ist.esito === 'quasi' ? ' qz-btn-forte' : '')
        }, 'Considera giusta');
        b.addEventListener('click', function () {
          ist.esito = 'giusta';
          ist.autoval = true;
          segnaEsiti([{ id: ist.q.id, esito: 'giusta' }]);   /* vedi rendiFeedback */
          /* il riepilogo si ridisegna: il fuoco torna sul pannello (mai sul
             body) e l'annuncio dice che cosa è appena cambiato */
          self.riepilogo('Contata come giusta. Riepilogo aggiornato.');
        }, false);
        li.appendChild(b);
      }
    }
    return li;
  };

  /* ---------------- modo ESAME: avvio e caricamento ---------------- */

  App.prototype.schermataAvvio = function (fuoco) {
    var doc = this.doc, self = this, i;
    this.fermaTimer();
    svuota(this.strumenti);
    svuota(this.palco);
    this.avanzamento.setAttribute('hidden', 'hidden');
    this.hTitolo.textContent = this.titolo;
    /* si torna qui anche da una prova in corso: la materia dell'ultima
       domanda non deve restare addosso alla schermata d'avvio */
    this.applicaMateria(this.materia);

    var lezioni = (this.manifest && this.manifest.lezioni) || [];
    var perMateria = {}, tot = { mcq: 0, cmp: 0 };
    for (i = 0; i < lezioni.length; i++) {
      var m = String(lezioni[i].materia || '').toLowerCase();
      if (!perMateria[m]) perMateria[m] = { n: 0, mcq: 0, cmp: 0 };
      perMateria[m].n++;
      perMateria[m].mcq += lezioni[i].n_mcq || 0;
      perMateria[m].cmp += lezioni[i].n_cmp || 0;
      tot.mcq += lezioni[i].n_mcq || 0;
      tot.cmp += lezioni[i].n_cmp || 0;
    }
    this.hSub.textContent = lezioni.length + ' lezioni disponibili · ' +
      tot.mcq + ' a scelta multipla, ' + tot.cmp + ' a completamento';

    var pan = el(doc, 'div', { 'class': 'qz-pannello', tabindex: '-1' });
    pan.appendChild(el(doc, 'h3', {}, 'Simulazione d’esame'));
    pan.appendChild(el(doc, 'p', {}, 'Formato reale: ' + this.formato.mcq +
      ' domande a scelta multipla e ' + this.formato.cmp +
      ' a completamento, pescate in quota uguale da tutte le lezioni disponibili. ' +
      'Nessun aiuto durante la prova: la correzione arriva alla consegna.'));

    var riga = el(doc, 'div', { 'class': 'qz-riga' });
    var campo = el(doc, 'label', { 'class': 'qz-campo' }, 'Materia');
    var sel = el(doc, 'select');
    sel.appendChild(el(doc, 'option', { value: '' }, 'tutte le materie'));
    var ordine = ['fisica', 'chimica', 'biologia'], m2;
    for (i = 0; i < ordine.length; i++) {
      m2 = ordine[i];
      if (!perMateria[m2]) continue;
      var o = el(doc, 'option', { value: m2 },
        m2 + ' (' + perMateria[m2].n + ' lezioni)');
      if (this.materia === m2) o.setAttribute('selected', 'selected');
      sel.appendChild(o);
    }
    sel.addEventListener('change', function () {
      self.materia = sel.value;
      self.applicaMateria(self.materia);      /* «tutte le materie» = nessuna */
    }, false);
    campo.appendChild(sel);
    riga.appendChild(campo);

    var b = el(doc, 'button', { type: 'button', 'class': 'qz-btn qz-btn-forte' },
      'Inizia la simulazione');
    b.addEventListener('click', function () { self.preparaEsame(); }, false);
    riga.appendChild(b);
    pan.appendChild(riga);

    if (this.stato.storia.length) {
      pan.appendChild(el(doc, 'h4', {}, 'Le tue prove'));
      var ul = el(doc, 'ul', { 'class': 'qz-storia' });
      for (i = this.stato.storia.length - 1; i >= 0 && i >= this.stato.storia.length - 5; i--) {
        var s = this.stato.storia[i];
        ul.appendChild(el(doc, 'li', {}, s.giuste + '/' + s.totale + ' (' +
          percento(s.giuste, s.totale) + '%) · ' + mmss(s.durata) + ' · ' +
          (new Date(s.quando)).toLocaleDateString()));
      }
      pan.appendChild(ul);
    }
    this.palco.appendChild(pan);
    if (fuoco) this.metteFuocoSu(pan);
  };

  App.prototype.preparaEsame = function () {
    var doc = this.doc, self = this;
    /* azzerati a ogni tentativo: dopo un «Riprova» andato bene non deve
       restare in giro il messaggio del tentativo precedente */
    this.koCifratura = 0;
    this.messaggioCifratura = null;
    var lezioni = (this.manifest && this.manifest.lezioni) || [];
    var q = quoteEsame(lezioni, {
      mcq: this.formato.mcq, cmp: this.formato.cmp,
      materia: this.materia, recenti: this.stato.recenti,
      riusaLezioni: this.opz.riusaLezioni !== false
    });
    if (!q.piano.length) {
      /* anche qui una via d'uscita: con un filtro materia sbagliato si
         restava su un pannello d'errore senza un solo pulsante */
      this.pannelloErrore('Non ci sono lezioni con domande per questa selezione.',
        [{ etichetta: 'Torna indietro', forte: true, fai: function () { self.schermataAvvio(true); } }],
        true);
      return;
    }

    var caricati = [], fatti = 0, falliti = 0, prossimo = 0, chiuso = false;
    var orologio = null;
    var carica = this.opz.carica || function (voce) { return self.scaricaLezione(voce); };

    svuota(this.palco);
    var pan = el(doc, 'div', { 'class': 'qz-pannello', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
    pan.appendChild(el(doc, 'h3', {}, 'Preparo la prova…'));
    var p = el(doc, 'p', {}, 'Scarico le domande da ' + q.piano.length + ' lezioni: 0 su ' + q.piano.length + '.');
    pan.appendChild(p);
    /* Una via d'uscita c'è SEMPRE: se la rete è lenta o non risponde,
       aspettare non deve essere l'unica cosa che si può fare. */
    var azioni = el(doc, 'div', { 'class': 'qz-azioni-fine' });
    var bAnnulla = el(doc, 'button', { type: 'button', 'class': 'qz-btn' }, 'Annulla');
    bAnnulla.addEventListener('click', function () {
      if (chiuso) return;
      chiuso = true; ferma();
      self.schermataAvvio(true);
    }, false);
    azioni.appendChild(bAnnulla);
    pan.appendChild(azioni);
    this.palco.appendChild(pan);
    this.metteFuocoSu(pan);

    function ferma() {
      if (orologio) { global.clearTimeout(orologio); orologio = null; }
      self.orologioPrep = null;
    }

    /* Un solo punto d'uscita: o si parte con quello che è arrivato, o si
       dice che non è arrivato niente — e in entrambi i casi l'utente ha un
       pulsante sotto le dita. */
    function concludi(scaduto) {
      if (chiuso) return;
      chiuso = true; ferma();
      if (!self.vivo) return;             /* smontato mentre scaricava */
      if (!caricati.length) {
        self.pannelloErrore(self.koCifratura
          ? (self.messaggioCifratura ||
             'Non riesco ad aprire le domande: ricarica la pagina e reinserisci la password.')
          : (scaduto
            ? 'La rete non ha risposto in tempo: non sono riuscito a scaricare le domande.'
            : 'Non sono riuscito a scaricare le domande. Controlla la connessione e riprova.'),
          [{ etichetta: 'Riprova', forte: true, fai: function () { self.preparaEsame(); } },
           { etichetta: 'Torna indietro', fai: function () { self.schermataAvvio(true); } }],
          true);
        return;
      }
      self.componiEsame(caricati, q.piano.length - caricati.length, scaduto);
    }

    function passo(indice) {
      var slot = q.piano[indice], esito;
      try { esito = carica(slot.voce, slot); }
      catch (err) { esito = null; }
      poi(esito, function (dati) {
        if (dati) caricati.push({ slot: slot, banco: normalizzaBanco(dati) });
        else falliti++;
        fine();
      }, function () { falliti++; fine(); }, self.tempoMax());
    }

    function fine() {
      if (chiuso) return;
      if (!self.vivo) { chiuso = true; ferma(); return; }
      fatti++;
      p.textContent = 'Scarico le domande da ' + q.piano.length + ' lezioni: ' +
        fatti + ' su ' + q.piano.length + (falliti ? ' (' + falliti + ' non arrivate)' : '') + '.';
      if (fatti >= q.piano.length) { concludi(false); return; }
      if (prossimo < q.piano.length) passo(prossimo++);
    }

    /* tetto complessivo: anche se ogni singola attesa fosse ancora dentro
       il suo tempo, la somma non può crescere all'infinito */
    orologio = global.setTimeout(function () { orologio = null; concludi(true); }, this.tempoTotale());
    this.orologioPrep = orologio;

    var i;
    for (i = 0; i < MAX_PARALLELE && prossimo < q.piano.length; i++) passo(prossimo++);
  };

  /* Accetta indifferentemente una promessa o dei dati già pronti: così la
     demo può iniettare i banchi senza rete e senza Promise.
     Il caso sincrono viene comunque RIMANDATO di un giro: se rientrasse
     dentro il ciclo che lo ha lanciato, la pila dei download si
     srotolerebbe da sola e la prova verrebbe composta due volte.
     `scadenza` (ms) è il tetto d'attesa: una promessa che non si risolve
     MAI cade in `ko` come una che fallisce. Il tetto sta qui e non dentro
     `scaricaLezione()` apposta — così vale anche per un `opzioni.carica`
     scritto dalla pagina, che è codice che questo motore non controlla. */
  function poi(valore, ok, ko, scadenza) {
    if (valore && typeof valore.then === 'function') {
      var chiuso = false, orologio = null;
      function unaVolta(f) {
        return function (v) {
          if (chiuso) return;
          chiuso = true;
          if (orologio) { global.clearTimeout(orologio); orologio = null; }
          f(v);
        };
      }
      var vok = unaVolta(ok), vko = unaVolta(function () { (ko || ok)(null); });
      if (scadenza > 0 && global.setTimeout) {
        orologio = global.setTimeout(function () { orologio = null; vko(null); }, scadenza);
      }
      valore.then(function (v) { vok(v); }, function () { vko(null); });
      return;
    }
    global.setTimeout(function () { ok(valore || null); }, 0);
  }

  App.prototype.scaricaLezione = function (voce) {
    var base = this.baseQuiz();
    var url = base + voce.slug + '-' + (voce.parte || 'A') + '.json';
    var p = prendiJson(url, this.tempoMax());
    var self = this;
    if (!p) return null;
    return p.then(function (e) {
      /* Se il file è arrivato ma NON si è potuto decifrare, la simulazione
         non deve poi raccontare che «la rete non ha risposto»: qui se ne
         tiene traccia, e `concludi()` la usa per dire la cosa vera. */
      if (e && !e.ok && e.motivo === 'cifrato') {
        self.koCifratura = (self.koCifratura || 0) + 1;
        if (e.messaggio) self.messaggioCifratura = e.messaggio;
      }
      return e && e.ok ? e.dati : null;
    });
  };

  /* attesa per un singolo file · attesa per l'intera preparazione */
  App.prototype.tempoMax = function () { return tempoDa(this.radice, this.opz); };
  App.prototype.tempoTotale = function () {
    var t = this.tempoMax();
    return Math.max(t + 3000, Math.min(TIMEOUT_PROVA, t * 3));
  };

  App.prototype.baseQuiz = function () {
    if (this.opz.base) return this.opz.base;
    var attr = this.radice.getAttribute('data-base');
    if (attr) return attr.replace(/\/?$/, '/');
    var idx = this.radice.getAttribute('data-index') || '';
    if (idx) return idx.replace(/[^/]*$/, '') + 'quiz/';
    return 'data/quiz/';
  };

  App.prototype.componiEsame = function (caricati, falliti, scaduto) {
    var domande = [], i, j, presi, avanzo = [], self2 = this;
    var visti = mappaDi(this.stato.visti);

    for (i = 0; i < caricati.length; i++) {
      var slot = caricati[i].slot, banco = caricati[i].banco;
      if (slot.mcq) {
        presi = estrai(banco.domande, 'mcq', slot.mcq, { visti: visti, preferisci5: true });
        for (j = 0; j < presi.length; j++) domande.push(presi[j]);
      }
      if (slot.cmp) {
        presi = estrai(banco.domande, 'cmp', slot.cmp, { visti: visti });
        for (j = 0; j < presi.length; j++) domande.push(presi[j]);
      }
      /* riserva: se una lezione non ha risposto, si pesca da queste */
      avanzo.push(banco);
    }

    /* rattoppo delle quote se qualche file è caduto */
    var mancaMcq = this.formato.mcq - conta(domande, 'mcq');
    var mancaCmp = this.formato.cmp - conta(domande, 'cmp');
    if (mancaMcq > 0 || mancaCmp > 0) {
      var presiId = {};
      for (i = 0; i < domande.length; i++) presiId[domande[i].id] = 1;
      for (i = 0; i < avanzo.length && (mancaMcq > 0 || mancaCmp > 0); i++) {
        if (mancaMcq > 0) {
          presi = estrai(avanzo[i].domande, 'mcq', mancaMcq, { visti: presiId, preferisci5: true });
          for (j = 0; j < presi.length && mancaMcq > 0; j++) {
            if (presiId[presi[j].id]) continue;
            presiId[presi[j].id] = 1; domande.push(presi[j]); mancaMcq--;
          }
        }
        if (mancaCmp > 0) {
          presi = estrai(avanzo[i].domande, 'cmp', mancaCmp, { visti: presiId });
          for (j = 0; j < presi.length && mancaCmp > 0; j++) {
            if (presiId[presi[j].id]) continue;
            presiId[presi[j].id] = 1; domande.push(presi[j]); mancaCmp--;
          }
        }
      }
    }

    /* ordine d'esame: prima il blocco a scelta multipla, poi i completamenti
       (è la forma dei tre esami ufficiali), mescolati dentro il blocco */
    var mcq = [], cmp = [];
    for (i = 0; i < domande.length; i++) (domande[i].tipo === 'mcq' ? mcq : cmp).push(domande[i]);
    mescolaIn(mcq); mescolaIn(cmp);
    var serie = mcq.concat(cmp);

    if (!serie.length) {
      this.pannelloErrore('Le lezioni scaricate non contengono domande utilizzabili.',
        [{ etichetta: 'Riprova', forte: true, fai: function () { self2.preparaEsame(); } },
         { etichetta: 'Torna indietro', fai: function () { self2.schermataAvvio(true); } }],
        true);
      return;
    }

    this.serie = [];
    for (i = 0; i < serie.length; i++) {
      this.serie.push(istanza(serie[i], {
        mescolaOpzioni: this.mescolaOpzioni, seme: this.seme + i
      }));
    }
    this.pos = 0;
    this.consegnato = false;

    svuota(this.strumenti);
    var doc = this.doc;
    var nota = el(doc, 'div', { 'class': 'qz-riga' });
    var testo = mcq.length + ' a scelta multipla + ' + cmp.length + ' a completamento';
    /* la degradazione si DICE: una prova più corta senza spiegazione
       sembra un errore del motore, non una rete che non ce l'ha fatta */
    if (falliti > 0) {
      testo += ' · ' + falliti + (falliti === 1 ? ' lezione non è arrivata' : ' lezioni non sono arrivate') +
        (scaduto ? ' in tempo' : '') + ': prova costruita con quelle scaricate';
    }
    if (mcq.length < this.formato.mcq || cmp.length < this.formato.cmp) {
      testo += ' — prova ridotta rispetto al formato pieno (' +
        this.formato.mcq + '+' + this.formato.cmp + ')';
    }
    nota.appendChild(el(doc, 'span', { 'class': 'qz-aiuto' }, testo));
    this.strumenti.appendChild(nota);

    this.hSub.textContent = this.sottotitolo();
    this.avanzamento.removeAttribute('hidden');
    this.t0 = (new Date()).getTime();
    this.durata = 0;
    this.avviaTimer();
    /* la prova comincia con il fuoco sulla domanda 1: senza, si ripartiva
       dal <body> e per arrivarci bisognava ritabulare tutta la pagina */
    this.mostra('carta');
    if (falliti > 0) this.dillo('Prova pronta: ' + serie.length + ' domande. ' +
      falliti + (falliti === 1 ? ' lezione non è arrivata.' : ' lezioni non sono arrivate.'));
  };

  function conta(domande, tipo) {
    var n = 0, i;
    for (i = 0; i < domande.length; i++) if (domande[i].tipo === tipo) n++;
    return n;
  }

  /* ---------------- tastiera ---------------- */

  /* Controlli che «consumano» i tasti: finché il fuoco è lì, una
     scorciatoia globale non deve intromettersi — e soprattutto non deve
     chiamare preventDefault(), che toglierebbe davvero il comportamento
     nativo del controllo. */
  function tag(n) { return n && n.tagName ? String(n.tagName).toUpperCase() : ''; }

  function siScrive(n) {
    var t = tag(n);
    if (t === 'TEXTAREA' || t === 'SELECT') return true;
    if (t === 'INPUT') {
      var tipo = String(n.type || 'text').toLowerCase();
      /* tutto ciò che non è un interruttore o un bottone è un campo dove
         si digita: text, search, number, email, tel, url, password… */
      return !(tipo === 'radio' || tipo === 'checkbox' || tipo === 'button' ||
        tipo === 'submit' || tipo === 'reset' || tipo === 'file' || tipo === 'range');
    }
    return n ? n.isContentEditable === true : false;
  }

  /* Invio su questi li ATTIVA: è il browser a farlo, non noi. */
  function siAttivaConInvio(n) {
    var t = tag(n);
    if (t === 'BUTTON' || t === 'SUMMARY') return true;
    if (t === 'A') return !!(n.getAttribute && n.getAttribute('href') != null);
    if (t === 'INPUT') {
      var tipo = String(n.type || '').toLowerCase();
      return tipo === 'button' || tipo === 'submit' || tipo === 'reset';
    }
    return false;
  }

  /* Le frecce dentro un gruppo di radio sono la navigazione NATIVA fra le
     opzioni: rubarle significa lasciare senza modo di scorrerle. */
  function eInterruttore(n) {
    if (tag(n) !== 'INPUT') return false;
    var tipo = String(n.type || '').toLowerCase();
    return tipo === 'radio' || tipo === 'checkbox';
  }

  App.prototype.tasto = function (ev) {
    if (!this.serie.length || this.consegnato) return;
    var attivo = this.doc.activeElement;
    var dentroIlNostro = this.radice.contains ? this.radice.contains(attivo) : false;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (siScrive(attivo)) return;             /* mentre si scrive, i tasti sono testo */
    if (!dentroIlNostro && this.doc.body !== attivo) return;

    var ist = this.serie[this.pos];
    if (!ist) return;
    var key = ev.key || '';

    if (ist.q.tipo === 'mcq' && /^[1-9]$/.test(key)) {
      var k = +key - 1;
      if (k < ist.ordine.length && !(this.modo === 'lezione' && ist.esito)) {
        this.scegli(ist.ordine[k]);
        var radio = this.carta ? this.carta.getElementsByTagName('input') : [];
        if (radio[k]) radio[k].checked = true;
        ev.preventDefault();
      }
      return;
    }
    if (key === 'Enter') {
      /* fuoco su un bottone (Salta, Considera giusta, Nuova serie, una
         chip…): Invio deve premere QUEL bottone. Prima il preventDefault
         globale sopprimeva l'attivazione e al suo posto rispondeva alla
         domanda — su «Salta» l'esatto contrario di quel che si chiedeva. */
      if (siAttivaConInvio(attivo)) return;
      if (this.modo === 'lezione') {
        if (ist.esito) {
          if (this.pos === this.serie.length - 1) this.consegna();
          else this.vai(this.pos + 1);
        } else this.rispondi();
        ev.preventDefault();
      }
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      if (this.modo !== 'esame') return;
      if (eInterruttore(attivo)) return;      /* frecce = giro fra le opzioni */
      if (key === 'ArrowRight' && this.pos < this.serie.length - 1) {
        this.vai(this.pos + 1); ev.preventDefault();
      } else if (key === 'ArrowLeft' && this.pos > 0) {
        this.vai(this.pos - 1); ev.preventDefault();
      }
    }
  };

  App.prototype.smonta = function () {
    this.vivo = false;
    this.fermaTimer();
    if (this.orologioPrep) { global.clearTimeout(this.orologioPrep); this.orologioPrep = null; }
    if (this.onTasto) this.doc.removeEventListener('keydown', this.onTasto, false);
    this.serie = [];
    if (this.radice.__qzApp === this) this.radice.__qzApp = null;
    svuota(this.radice);
  };

  /* ---------------------------------------------------------------- *
   * 7. API pubblica + avvio automatico                                 *
   * ---------------------------------------------------------------- */

  function erroreIn(radice, testo, azioni) {
    var doc = radice.ownerDocument || global.document;
    iniettaCss(doc);
    svuota(radice);
    var s = el(doc, 'section', { 'class': 'qz' });
    var p = el(doc, 'div', { 'class': 'qz-pannello', role: 'alert', tabindex: '-1' });
    p.appendChild(el(doc, 'h3', {}, 'Quiz non disponibile'));
    p.appendChild(el(doc, 'p', {}, testo));
    if (azioni && azioni.length) {
      var riga = el(doc, 'div', { 'class': 'qz-azioni-fine' }), i;
      for (i = 0; i < azioni.length; i++) riga.appendChild(bottoneAzione(doc, azioni[i]));
      p.appendChild(riga);
    }
    s.appendChild(p);
    radice.appendChild(s);
    return p;
  }

  function monta(radice, dati, opzioni) {
    if (typeof radice === 'string') radice = global.document.getElementById(radice);
    if (!radice) return null;
    opzioni = opzioni || {};
    if (dati) return new App(radice, dati, opzioni);

    var doc = radice.ownerDocument || global.document;
    var modo = (opzioni.modo || radice.getAttribute('data-mode') || 'lezione').toLowerCase();

    /* 1) dati già in pagina (demo, o pagina generata a build-time) */
    var idJson = radice.getAttribute('data-json');
    if (idJson) {
      var nodo = doc.getElementById(idJson);
      if (!nodo) { erroreIn(radice, 'Dati non trovati (data-json="' + idJson + '").'); return null; }
      try { return new App(radice, JSON.parse(nodo.textContent || nodo.innerText || '{}'), opzioni); }
      catch (e) { erroreIn(radice, 'I dati del quiz non sono leggibili.'); return null; }
    }

    /* 2) dati da file */
    var src = modo === 'esame'
      ? (radice.getAttribute('data-index') || radice.getAttribute('data-src'))
      : (radice.getAttribute('data-src') || radice.getAttribute('data-index'));
    if (!src) { erroreIn(radice, 'Manca l\'attributo data-src (lezione) o data-index (esame).'); return null; }
    opzioni.sorgente = src;

    if (!global.fetch || !global.Promise) {
      erroreIn(radice, 'Il browser non supporta il caricamento dei dati.');
      return null;
    }

    /* Anche il primo download ha una scadenza e un pulsante: «Ricarica la
       pagina» non è una via d'uscita, è un ordine dato all'utente. */
    var attesa = el(doc, 'div', { 'class': 'qz' });
    function tenta(primo) {
      if (!primo) {
        svuota(radice);
        var pan = el(doc, 'div', { 'class': 'qz-pannello', role: 'status', tabindex: '-1' });
        pan.appendChild(el(doc, 'h3', {}, 'Carico le domande…'));
        svuota(attesa);
        attesa.appendChild(pan);
        radice.appendChild(attesa);
        if (pan.focus) { try { pan.focus(); } catch (e) { } }
      }
      prendiJson(src, tempoDa(radice, opzioni)).then(function (e) {
        if (e && e.ok) { new App(radice, e.dati, opzioni); return; }
        var motivo = e ? e.motivo : 'rete';
        /* 'cifrato' = i dati sono arrivati ma la sessione non li apre. Non è
           un problema di rete e NON deve leggersi come tale: il gesto giusto
           è ricaricare e reinserire la password, non «controlla la
           connessione». Il messaggio arriva dallo sportello, che sa quale dei
           casi è (chiave assente / build nuova / password sbagliata). */
        var pan2 = erroreIn(radice, motivo === 'cifrato'
          ? (e.messaggio || 'Non riesco ad aprire le domande: ricarica la pagina e reinserisci la password.')
          : (motivo === 'timeout'
            ? 'La rete non ha risposto in tempo: le domande non sono arrivate.'
            : (motivo === 'formato'
              ? 'Le domande sono arrivate ma non sono leggibili.'
              : 'Non sono riuscito a caricare le domande. Controlla la connessione.')),
          [{ etichetta: 'Riprova', forte: true, fai: function () { tenta(false); } }]);
        if (!primo && pan2 && pan2.focus) { try { pan2.focus(); } catch (e2) { } }
      });
    }
    tenta(true);
    return null;
  }

  function avvia() {
    var doc = global.document;
    if (!doc) return;
    var nodi = doc.querySelectorAll('#quiz-app,[data-quiz]'), i;
    for (i = 0; i < nodi.length; i++) {
      if (!nodi[i].getAttribute('data-qz-montato')) {
        nodi[i].setAttribute('data-qz-montato', '1');
        monta(nodi[i]);
      }
    }
  }

  var Quiz = {
    monta: monta,
    avvia: avvia,
    /* Il registro trasversale delle domande ancora da recuperare:
       {id: {n, t}}. Lo legge l'hub per il modo «solo le sbagliate».
       `dimenticaSbagliate()` è il gesto esplicito dell'utente, mai automatico. */
    sbagliate: sbagliate,
    dimenticaSbagliate: function () { cancella(CHIAVE_SBAGLIATE); },
    CSS: CSS,
    FORMATO_ESAME: FORMATO_ESAME,
    /* superficie PURA, senza DOM: è quella che si testa in Node e che
       study_data.py deve poter rileggere per restare allineato */
    _logica: {
      canonica: canonica,
      lasca: lasca,
      numero: numero,
      stessoNumero: stessoNumero,
      somiglianza: somiglianza,
      distanza: distanza,
      formeDaTesto: formeDaTesto,
      formeAccettate: formeAccettate,
      correggi: correggi,
      quoteEsame: quoteEsame,
      estrai: estrai,
      istanza: istanza,
      normalizzaDomanda: normalizzaDomanda,
      normalizzaBanco: normalizzaBanco,
      normalizzaDiff: normalizzaDiff,
      mescolaIn: mescolaIn,
      inlineMd: inlineMd,
      stemHtml: stemHtml,
      mmss: mmss,
      poi: poi,
      tempoDa: tempoDa,
      siScrive: siScrive,
      siAttivaConInvio: siAttivaConInvio,
      eInterruttore: eInterruttore,
      SOGLIA_QUASI: SOGLIA_QUASI,
      TIMEOUT_FILE: TIMEOUT_FILE,
      TIMEOUT_PROVA: TIMEOUT_PROVA
    }
  };

  global.Quiz = Quiz;
  if (typeof module !== 'undefined' && module.exports) module.exports = Quiz;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', avvia, false);
    } else {
      avvia();
    }
  }

/* In pagina è `window`. Fuori (Node, per le prove headless) `this` in un
   modulo CommonJS è `module.exports`, cioè un oggetto SENZA setTimeout né
   Promise: i tetti d'attesa non sarebbero verificabili — e un domani, se
   qualcuno chiamasse il motore da lì, si romperebbero in silenzio. */
})(typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global : this);
