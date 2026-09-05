/* =====================================================================
   flashcards.js — motore flashcard per la versione FULL (/studio)
   SPEC_MOTORI.md §2B. Vanilla JS, ZERO dipendenze, niente CDN,
   niente document.write. Compatibile ES5 (var/function, nessuna arrow,
   nessun template literal): gira sui browser mobili anche vecchiotti.

   MONTAGGIO
     <div id="flashcard-app"
          data-src="../data/flashcards/s1f01-A.json"
          data-titolo="S1·E01 Fisica — parte A"></div>
     <script src="../assets/flashcards.js" defer></script>
   Oppure, senza rete (demo / test):
     <script type="application/json" id="mazzo"> { ...stesso JSON... } </script>
     <div id="flashcard-app" data-json="mazzo" data-titolo="..."></div>
   Oppure via API:  Flashcards.monta(elemento, datiGiaPronti, opzioni);

   UN SOLO CASSETTO DI PROGRESSI (data-chiave, 2026-07-30)
     <div ... data-chiave="studio">        · opzioni.chiave = 'studio'
   Con `data-chiave` i progressi finiscono tutti nello STESSO cassetto di
   localStorage e gli id delle carte diventano globali (`<slug>-<parte>#<id>`:
   vedi `idGlobale`). Serve a chi ricompone il mazzo — l'hub `/studio/
   flashcards/` cambia mazzo a ogni filtro — e ai progressi vecchi ci pensa
   `travasaLegacy`, che li rilegge dai cassetti per-lezione a ogni montaggio.
   Senza l'attributo NON cambia niente: chiave per-mazzo e id grezzi, come prima.

   AVVIO SULLE CARTE PEGGIORI
     Flashcards.monta(el, dati, {avvio: 'bestie', chiave: 'studio'});
     Flashcards.bestie(dati, {chiave: 'studio'})   -> l'elenco, senza montare

   RIPETIZIONE DILAZIONATA (SPEC §2B + §4)
   Leitner a 5 scatole, con la frequenza di richiamo di OGNI carta legata
   al suo tasso d'errore storico. Due canali distinti, perché uno solo non
   basta (vedi il blocco «RICHIAMI PROPORZIONALI» qui sotto):
     · DENTRO la sessione — quante volte la carta ritorna oggi: da 1 a 4
       rientri secondo il tasso. È il canale delle carte peggiori, quelle
       che vivono in scatola 1-2, dove l'intervallo non può dire niente
       (con una sessione al giorno «più spesso di ogni giorno» non è
       esprimibile in giorni).
     · FRA le sessioni — l'intervallo delle scatole 3-5, accorciato fino a
       tre volte dal fattore phi. È il canale delle carte che stanno
       imparando a riposare.
   Lo stato su disco NON cambia forma ({b, d, ok, ko}): tasso e mostrate
   sono derivati a ogni lettura, quindi i progressi salvati dalla versione
   precedente si aprono senza conversioni.

   FORMATO DATI (prodotto da study_data.py, SPEC §2A)
     {"slug","parte","materia","lezione",
      "carte":[{"id","tag","diff","f","r"}, ...]}
   Il markdown inline nei testi resta nel JSON e lo rende QUESTO file
   (grassetto, corsivo, `codice`); l'HTML viene sempre neutralizzato prima.

   NOTA SUL CSS
   La spec vuole il CSS dei motori in `assets/study.css`. Qui il foglio è
   tenuto in `Flashcards.CSS` (fonte unica) e iniettato UNA sola volta,
   ma SOLO se `study.css` non è già in pagina: basta che il foglio esterno
   contenga il marcatore `[data-motori-css]` su <link>/<style>, oppure che
   esista un elemento con id `fc-css`, e l'iniezione si disattiva da sola.
   Così la demo funziona da sola e in produzione non si duplica nulla.
   ===================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- *
   * 0. Costanti di dominio                                            *
   * ---------------------------------------------------------------- */

  var VERSIONE_STATO = 1;
  var GIORNO = 24 * 60 * 60 * 1000;

  /* Leitner a 5 scatole. Indice = scatola (1..5), valore = giorni di
     riposo prima che la carta torni a essere dovuta.
     Scatola 1 = 0 giorni: la carta sbagliata è dovuta SUBITO, e rientra
     anche dentro la sessione corrente (vedi `posizioneRientro`). */
  var INTERVALLI = [0, 0, 1, 3, 7, 16];
  var SCATOLA_MAX = 5;

  /* ---- RICHIAMI PROPORZIONALI AL TASSO D'ERRORE (SPEC §4) ----------

     Leitner puro tratta allo stesso modo una carta sbagliata UNA volta e
     una sbagliata sette volte su dieci, se in quel momento stanno nella
     stessa scatola. La richiesta è che la frequenza di richiamo sia
     PROPORZIONALE al tasso d'errore della carta. Servono DUE canali,
     perché nessuno dei due copre l'altro.

     ---- CANALE 1: quante volte la carta torna DENTRO la sessione -------
     Con una sessione di studio al giorno, l'intervallo non sa dire
     «più spesso di ogni giorno»: sotto il giorno non si scende (vedi
     GIORNI_MIN) e la scatola 1 vale già «subito». Le carte peggiori
     vivono esattamente lì — chi sbaglia sempre resta in scatola 1 per
     costruzione — quindi un motore che modulasse SOLO l'intervallo non
     toccherebbe nessuna delle carte per cui la funzione esiste.
     Il canale che resta è QUANTE VOLTE la carta rientra in coda oggi:

       rientri = RIENTRI_BASE + round(RIENTRI_EXTRA * tasso)   → da 1 a 4

     cioè da 2 a 5 presentazioni nella stessa sessione. Il rientro è
     sempre IN FONDO alla coda (mai davanti: vedi `posizioneRientro`),
     quindi il tetto non è un dettaglio di comodo ma la garanzia che la
     sessione FINISCA: al più `N * (1 + RIENTRI_CAP)` = 5N giudizi per una
     sessione di N carte distinte, qualunque cosa risponda lo studente.

     ---- CANALE 2: ogni quanti giorni torna, FRA una sessione e l'altra --
     Dove un intervallo c'è davvero (scatole 3-5: 3, 7, 16 giorni) viene
     accorciato in proporzione al tasso d'errore STORICO:

       tasso  = ko / mostrate            (con smorzamento, vedi sotto)
       phi    = 1 / (1 + K * tasso)      K = 2
       giorni = INTERVALLI[scatola] * phi, mai sotto 1 giorno

     Con K = 2 una carta sbagliata sempre (tasso 1) torna 3 volte più
     spesso di una mai sbagliata NELLA STESSA SCATOLA; a metà strada
     (tasso 0,5) l'intervallo si dimezza.
     Scatole 1 e 2 (0 e 1 giorno) NON passano di qui e il codice lo dice
     esplicitamente: 0 * phi = 0 e 1 * phi risalirebbe comunque a 1 per il
     minimo di un giorno. Fingere di modularle sarebbe una promessa vuota;
     lì lavora il canale 1.

     SMORZAMENTO SUI PRIMI TENTATIVI. Una singola distrazione non deve
     marchiare una carta per sempre: finché i tentativi sono pochi il
     tasso viene tirato verso 0,5 (il «non so ancora») con un prior
     bayesiano (ko+1)/(mostrate+2). Il peso del prior però non si spegne
     di colpo a `SOGLIA_PRIOR` — svanisce linearmente. La versione a
     gradino (prior sotto i 3 tentativi, tasso grezzo da 3 in su) fa
     saltare l'intervallo del 50% al terzo tentativo: una carta a 0 errori
     su 2 passa da phi 0,67 a phi 1,00 fra una risposta e la successiva,
     cioè da 2 a 3 giorni in scatola 3 senza che sia successo niente.
     Con il peso che sfuma, a `mostrate >= SOGLIA_PRIOR` la formula È
     esattamente `ko/mostrate` e prima ci arriva senza scalini. */
  var K_RICHIAMO = 2;      // quanto il tasso d'errore accorcia l'intervallo
  var SOGLIA_PRIOR = 3;    // oltre questi tentativi il prior pesa zero
  var PRIOR_KO = 1;        // «una sbagliata» di prior...
  var PRIOR_TOT = 2;       // ...su «due tentativi» → 0,5 quando non si sa nulla
  var GIORNI_MIN = 1;      // tetto di sicurezza: mai un ritorno sotto il giorno
  var RIENTRI_BASE = 1;    // rientri di chi non sbaglia mai (tasso 0)
  var RIENTRI_EXTRA = 3;   // ...più questi, in proporzione al tasso → max 4
  /* Tetto ASSOLUTO, quello da cui si calcola la lunghezza massima di una
     sessione. Non è una costante indipendente: è il valore massimo che
     `rientriMaxDi` può restituire, e va tenuto tale. */
  var RIENTRI_CAP = RIENTRI_BASE + RIENTRI_EXTRA;

  /* Fasce di tasso d'errore. Servono a «Mescola»: mescolare deve dare un
     ordine imprevedibile, non cancellare la priorità — le bestie nere
     restano nella prima fascia anche quando l'ordine dentro la fascia è
     casuale. Soglie scelte sui valori che il tasso assume davvero: 0,5 è
     il prior della carta mai vista (fascia di mezzo, sopra a quelle che
     sai e sotto a quelle che sbagli davvero). */
  var FASCE_TASSO = [0.6, 0.3];

  /* Il vocabolario della difficoltà nei file reali NON è quello della
     spec: misurato su tutti i flashcards_A|B.md del repo
     (120 file, 2269 carte, 2026-07-28)
        media 1116 · sfida 719 · base 359 · medio 70 · alta 5
     Senza normalizzazione il filtro «medio» nasconderebbe il 49% del
     materiale. Qui i sinonimi collassano nei tre secchi canonici; un
     valore sconosciuto NON viene buttato via, diventa un secchio suo. */
  var SINONIMI_DIFF = {
    'base': 'base', 'facile': 'base', 'bassa': 'base',
    'medio': 'medio', 'media': 'medio', 'intermedio': 'medio', 'intermedia': 'medio',
    'sfida': 'sfida', 'alta': 'sfida', 'alto': 'sfida', 'difficile': 'sfida'
  };
  var ORDINE_DIFF = ['base', 'medio', 'sfida'];
  var ETICHETTA_DIFF = { 'base': 'base', 'medio': 'medio', 'sfida': 'sfida' };

  /* materia → [colore pieno, variante scura]. I due valori sono solo il
     fallback di `var(--fisica)` / `var(--fisica-dark)`: servono quando il
     motore gira fuori dal sito (demo, pagina isolata). Sono i colori del
     sito, non colori inventati. */
  var MATERIE = {
    'fisica': ['#FF6BB0', '#7E2350'],
    'chimica': ['#7C93FF', '#20296B'],
    'biologia': ['#3ED9A0', '#1B5742']
  };

  var contatoreId = 0;

  /* ---------------------------------------------------------------- *
   * 1. Utilità pure (testate senza DOM — vedi Flashcards._logica)      *
   * ---------------------------------------------------------------- */

  function esisteArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  function normalizzaDiff(d) {
    var s = String(d == null ? '' : d).toLowerCase().trim();
    if (!s) return 'medio';
    return SINONIMI_DIFF[s] || s;
  }

  /* I tag reali arrivano come stringa e possono essere composti:
       "Z vs massa — l'asse · contrasto"  →  ["Z vs massa — l'asse", "contrasto"]
     Accetta anche un array già spezzato (difensivo sul generatore). */
  function tagsDi(carta) {
    var grezzo = carta.tag != null ? carta.tag : carta.tags;
    var pezzi = [];
    if (esisteArray(grezzo)) pezzi = grezzo.slice();
    else if (grezzo != null) pezzi = String(grezzo).split(/[·|;]/);
    var fuori = [];
    for (var i = 0; i < pezzi.length; i++) {
      var t = String(pezzi[i]).trim();
      if (t) fuori.push(t);
    }
    return fuori;
  }

  /* La LEZIONE di provenienza di una carta, in forma `slug-parte`.
     Nei mazzi per-lezione la sanno solo le testate del mazzo; nel mazzo
     AGGREGATO di una materia (study_data.py `_mazzo-<materia>.json`) ogni
     carta porta il proprio `k`, perché il mazzo ne mescola 60. */
  function lezioneDi(c, mazzo) {
    if (c && c.k) return String(c.k);
    var s = (mazzo && mazzo.slug) ? String(mazzo.slug) : '';
    if (!s) return '';
    return s + (mazzo.parte ? '-' + String(mazzo.parte) : '');
  }

  /* L'IDENTITÀ GLOBALE DI UNA CARTA — e perché serve.
     Gli id delle carte sono unici DENTRO il loro file e basta: sul corpus
     reale ci sono 2.269 carte e 51 id distinti (`A01` compare 60 volte).
     Finché ogni mazzo aveva il suo cassetto di progressi (`flashcards.v1.
     <slug>-<parte>`) la cosa non si vedeva. L'hub però studia carte di 60
     lezioni insieme e in UN cassetto solo: lì `A01` senza qualificazione
     sarebbe sessanta carte diverse che si sovrascrivono i progressi a
     vicenda — cioè un ripasso spaziato che misura la carta sbagliata.
     Il formato è definito QUI e in nessun altro posto: study_data.py emette
     l'id grezzo e il `k`, e la composizione avviene una volta sola. */
  function idGlobale(c, mazzo) {
    var k = lezioneDi(c, mazzo);
    return k ? (k + '#' + String(c.id)) : String(c.id);
  }

  /* Normalizza una carta comunque il generatore la chiami.
     `mazzo` e `globali` servono solo all'identità: vedi `idGlobale`. */
  function normalizzaCarta(c, i, mazzo, globali) {
    var grezzo = String(c.id != null ? c.id : ('c' + (i + 1)));
    return {
      id: globali ? idGlobale({ id: grezzo, k: c.k }, mazzo) : grezzo,
      idGrezzo: grezzo,
      k: lezioneDi(c, mazzo),
      f: String(c.f != null ? c.f : (c.fronte != null ? c.fronte : '')),
      r: String(c.r != null ? c.r : (c.retro != null ? c.retro : '')),
      diff: normalizzaDiff(c.diff != null ? c.diff : c.difficolta),
      diffGrezza: String(c.diff != null ? c.diff : (c.difficolta || '')),
      tags: tagsDi(c),
      idx: i
    };
  }

  function normalizzaMazzo(dati, globali) {
    var grezze = dati && (dati.carte || dati.cards) || [];
    var testa = {
      slug: dati && dati.slug ? String(dati.slug) : '',
      parte: dati && dati.parte ? String(dati.parte) : '',
      materia: dati && dati.materia ? String(dati.materia).toLowerCase() : '',
      lezione: dati && dati.lezione ? String(dati.lezione) : ''
    };
    var carte = [];
    for (var i = 0; i < grezze.length; i++) {
      var c = normalizzaCarta(grezze[i], i, testa, globali);
      if (c.f && c.r) carte.push(c);   // una carta senza fronte o retro non è una carta
    }
    testa.carte = carte;
    return testa;
  }

  /* Dove rimettere in coda una carta «da ripassare» — oppure -1 se non va
     rimessa affatto. Tre garanzie, e servono tutte e tre:

     1. IN FONDO, non «fra tre carte». Rimettendola a `pos+4` le copie si
        autoalimentano: con 4 carte sbagliate di fila le loro copie
        occupano stabilmente le 4 posizioni successive e la coda non
        avanza mai oltre. Misurato sul mazzo vero di 25 carte (s1f01-A):
        4.000 giudizi, 4 carte distinte mostrate, 21 mai viste, coda
        cresciuta a 4.025. Accodando in fondo la starvation è impossibile
        PER COSTRUZIONE: prima di rivedere una carta bocciata passano
        tutte le altre ancora in attesa, senza eccezioni e senza taratura.
     2. Tetto per-carta (`max`, da `rientriMaxDi`): la sessione deve poter
        FINIRE, anche per chi sbaglia tutto. Dopo il tetto la carta esce
        dalla coda di oggi — resta in scatola 1 e torna nella prossima
        sessione, che è esattamente ciò che deve fare il ripasso
        dilazionato. Il tetto ora è PER CARTA (1..4 secondo il tasso), ma
        resta un tetto: `RIENTRI_CAP` lo limita comunque a 4, quindi la
        sessione non può superare `N * (1 + RIENTRI_CAP)` giudizi.
     3. Mai due copie della stessa carta in attesa insieme: anche se i
        primi due punti già lo escludono, un doppione renderebbe bugiardi
        sia il contatore sia la barra. */
  function posizioneRientro(coda, pos, id, rientri, max) {
    if ((rientri[id] || 0) >= (max == null ? RIENTRI_CAP : max)) return -1;
    for (var i = pos + 1; i < coda.length; i++) if (coda[i].id === id) return -1;
    return coda.length;
  }

  /* Quante volte la carta può rientrare OGGI, secondo il suo tasso.
     `1 + round(3 * tasso)`: 1 a tasso 0, 2 sopra 1/6, 3 sopra 1/2, 4 sopra
     5/6. È il canale 1 dei richiami proporzionali (vedi il blocco in
     testa): l'unico che sa dire «più spesso» a una carta già dovuta ogni
     giorno. Il valore non supera mai `RIENTRI_CAP`, ed è da lì che si
     calcola la lunghezza massima della sessione. */
  function rientriMaxDi(tasso) {
    var t = tasso > 0 ? (tasso < 1 ? tasso : 1) : 0;
    return RIENTRI_BASE + Math.round(RIENTRI_EXTRA * t);
  }

  /* Presentazioni massime di una carta in una sessione: la prima più i
     rientri. Serve al testo a schermo, che non deve promettere numeri che
     il motore non fa. */
  function presentazioniMax(tasso) { return 1 + rientriMaxDi(tasso); }

  function fasciaTasso(t) {
    for (var i = 0; i < FASCE_TASSO.length; i++) if (t >= FASCE_TASSO[i]) return i;
    return FASCE_TASSO.length;
  }

  /* Leitner: dove finisce la carta dopo il giudizio. */
  function prossimaScatola(scatola, esito) {
    var b = scatola > 0 ? scatola : 1;
    if (esito === 'ok') return Math.min(SCATOLA_MAX, b + 1);
    return 1;                                   // sbagliata → torna in fondo alla fila
  }

  /* Tasso d'errore storico di una carta, smorzato sui primi tentativi.
     `peso` va da 1 (nessun tentativo: tasso = 0,5, cioè «non si sa») a 0
     (da SOGLIA_PRIOR tentativi in su: tasso = ko/mostrate, grezzo). */
  function tassoErrore(ok, ko) {
    var o = ok > 0 ? ok : 0;
    var k = ko > 0 ? ko : 0;
    var mostrate = o + k;
    var peso = mostrate >= SOGLIA_PRIOR ? 0 : (SOGLIA_PRIOR - mostrate) / SOGLIA_PRIOR;
    return (k + peso * PRIOR_KO) / (mostrate + peso * PRIOR_TOT);
  }

  /* Fattore di richiamo: 1 se non sbagli mai, 1/(1+K) se sbagli sempre. */
  function phiDi(tasso) {
    var t = tasso > 0 ? (tasso < 1 ? tasso : 1) : 0;
    return 1 / (1 + K_RICHIAMO * t);
  }

  /* Giorni di riposo EFFETTIVI: intervallo della scatola, accorciato dal
     tasso d'errore. Il campo d'azione di phi è dichiarato in una riga
     sola, e apposta: `base <= GIORNI_MIN` esce SUBITO, senza fingere di
     modulare niente.
     - scatola 1 = 0 giorni: non è un intervallo, è «dovuta subito».
       Moltiplicarla per phi darebbe 0 comunque; imporle il minimo di un
       giorno la spedirebbe a domani e spegnerebbe il ritorno dentro la
       sessione, che per le carte peggiori è l'unico canale che resta.
     - scatola 2 = 1 giorno: già al minimo. `1 * phi` risalirebbe a 1 per
       il tetto di sicurezza, cioè phi lì è un no-op — scriverlo come
       calcolo farebbe credere il contrario a chi legge (ed è successo).
     - scatole 3-5 (3, 7, 16 giorni): QUI phi morde davvero, fino a un
       terzo dell'intervallo. Sotto il giorno non si scende mai: phi
       accorcia, non trasforma il ripasso dilazionato in un ciclo continuo.
     Le carte con tasso alto vivono in scatola 1-2: per loro il richiamo
     proporzionale passa da `rientriMaxDi`, non da qui. */
  function giorniEffettivi(scatola, tasso) {
    var b = Math.max(1, Math.min(SCATOLA_MAX, scatola));
    var base = INTERVALLI[b];
    if (base <= GIORNI_MIN) return base;
    var g = base * phiDi(tasso);
    return g < GIORNI_MIN ? GIORNI_MIN : g;
  }

  /* La scatola ha un intervallo abbastanza lungo perché phi possa
     accorciarlo? Il testo a schermo deve saperlo distinguere. */
  function modulabile(scatola) {
    var b = Math.max(1, Math.min(SCATOLA_MAX, scatola));
    return INTERVALLI[b] > GIORNI_MIN;
  }

  /* `tasso` omesso = 0 = phi 1: la firma vecchia (scatola, adesso) continua
     a dare esattamente gli intervalli di prima. */
  function scadenzaDi(scatola, adesso, tasso) {
    return adesso + giorniEffettivi(scatola, tasso == null ? 0 : tasso) * GIORNO;
  }

  /* Lo stato SALVATO resta quello di sempre — {b, d, ok, ko} — e `mostrate`
     e `tasso` sono DERIVATI qui a ogni lettura. Nessun campo nuovo su disco:
     uno stato scritto dalla versione precedente si apre e funziona, e uno
     scritto da questa versione resta leggibile dalla precedente. */
  function statoCarta(stato, id) {
    var carte = stato && stato.carte;
    var s = (carte && typeof carte === 'object') ? carte[id] : null;
    if (!s || typeof s !== 'object') {
      return { b: 1, d: 0, ok: 0, ko: 0, mostrate: 0, tasso: tassoErrore(0, 0), nuova: true };
    }
    var ok = s.ok > 0 ? s.ok : 0;
    var ko = s.ko > 0 ? s.ko : 0;
    return {
      b: s.b || 1, d: s.d || 0, ok: ok, ko: ko,
      mostrate: ok + ko, tasso: tassoErrore(ok, ko), nuova: false
    };
  }

  /* «Le tue bestie nere»: le carte che sbagli più spesso, in ordine di
     tasso. Solo carte davvero sbagliate almeno `minKo` volte — una carta
     mai vista ha tasso 0,5 di prior e non è una bestia nera, è una
     sconosciuta. */
  function bestieNere(carte, stato, quante, minKo) {
    var soglia = minKo == null ? 1 : minKo;
    var lista = [], i;
    for (i = 0; i < carte.length; i++) {
      var s = statoCarta(stato, carte[i].id);
      if (s.nuova || s.ko < soglia) continue;
      lista.push({
        carta: carte[i], id: carte[i].id, b: s.b, ok: s.ok, ko: s.ko,
        mostrate: s.mostrate, tasso: s.tasso
      });
    }
    lista.sort(function (a, b) {
      if (a.tasso !== b.tasso) return b.tasso - a.tasso;
      if (a.ko !== b.ko) return b.ko - a.ko;
      return a.carta.idx - b.carta.idx;
    });
    if (quante > 0 && lista.length > quante) lista = lista.slice(0, quante);
    return lista;
  }

  /* L'indicatore discreto che lo studente legge sulla carta. */
  function testoAndamento(s) {
    if (s.nuova || !s.mostrate) return 'mai vista';
    if (!s.ko) return 'mai sbagliata su ' + s.mostrate + (s.mostrate === 1 ? ' tentativo' : ' tentativi');
    return 'sbagliata ' + s.ko + (s.ko === 1 ? ' volta su ' : ' volte su ') + s.mostrate;
  }

  function giorniTesto(g) {
    var r = Math.round(g * 10) / 10;
    var s = r === Math.round(r) ? String(Math.round(r)) : String(r).replace('.', ',');
    return s + (r === 1 ? ' giorno' : ' giorni');
  }

  /* Nelle liste il fronte va mostrato come TESTO: niente innerHTML per una
     riga di riepilogo, e i marcatori markdown grezzi (asterischi, trattini
     bassi, apici inversi) sono rumore. La classe di caratteri è costruita
     con String.fromCharCode(96) invece che scritta a mano apposta: gli
     unici apici inversi LETTERALI del sorgente devono restare i tre della
     regex dei code-span, altrimenti il controllo «nessun template literal»
     perde il suo unico appiglio per distinguerli. */
  var MARCATORI_MD = new RegExp('[*_' + String.fromCharCode(96) + ']', 'g');

  function soloTesto(s) {
    return String(s).replace(MARCATORI_MD, '').replace(/\s+/g, ' ').trim();
  }

  function taglia(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* Costruisce la coda di studio a partire da filtri + stato salvato.
     Ritorna { coda, riposo, prossima } dove `riposo` sono le carte che
     hanno superato il filtro ma non sono ancora dovute. */
  function costruisciCoda(carte, stato, opz, adesso) {
    opz = opz || {};
    var diffAttive = opz.diff || {};          // {} = tutte
    var quanteDiff = 0, k;
    for (k in diffAttive) if (diffAttive[k]) quanteDiff++;
    var tag = (opz.tag || '').trim();
    var cerca = (opz.cerca || '').toLowerCase().trim();
    var soloScadute = opz.soloScadute !== false;
    var soloQuesti = opz.soloQuesti || null;  // array di id (rivedi gli sbagliati)

    var dovute = [], riposo = [], prossima = null;
    for (var i = 0; i < carte.length; i++) {
      var c = carte[i];
      if (soloQuesti && indiceIn(soloQuesti, c.id) < 0) continue;
      if (quanteDiff && !diffAttive[c.diff]) continue;
      if (tag && indiceIn(c.tags, tag) < 0) continue;
      if (cerca && (c.f + ' ' + c.r + ' ' + c.tags.join(' ')).toLowerCase().indexOf(cerca) < 0) continue;

      var s = statoCarta(stato, c.id);
      var voce = { carta: c, b: s.b, d: s.d, t: s.tasso, nuova: s.nuova };
      if (!soloScadute || s.d <= adesso) dovute.push(voce);
      else {
        riposo.push(voce);
        if (prossima === null || s.d < prossima) prossima = s.d;
      }
    }

    if (opz.mescola) {
      /* «Mescola» chiede un ordine imprevedibile, NON la rinuncia alla
         priorità: prima le carte vengono permutate davvero, poi rimesse in
         fila per FASCIA di tasso. Dentro la fascia l'ordine resta quello
         casuale appena estratto, fra le fasce no — le bestie nere restano
         in testa anche mescolando. (Prima l'ordinamento per tasso stava
         solo nel ramo `else`: premere Mescola spegneva la priorità di
         SPEC §4 senza che niente lo segnalasse.)
         Non si usa `sort` per la fascia: in ES5 non è garantito stabile e
         rimescolerebbe l'ordine appena estratto. I secchi conservano
         l'ordine di inserimento per costruzione. */
      mescolaIn(dovute, opz.rnd);
      dovute = perFasce(dovute);
    } else {
      /* PRIORITÀ IN SESSIONE (SPEC §4): a parità di scadenza escono prima
         le carte con il tasso d'errore più alto — le bestie nere in testa,
         poi la scadenza più vecchia, poi la scatola più bassa, poi le mai
         viste, poi l'ordine del mazzo.
         Una carta mai vista vale 0,5 di prior: sta sopra a quelle che sai
         (tasso basso) e sotto a quelle che sbagli davvero. È l'ordine
         giusto: prima i nemici noti, poi gli sconosciuti, poi il ripasso.
         ATTENZIONE — questo riordino agisce sulla SELEZIONE del giro e
         basta. Il re-inserimento durante la sessione NON passa di qui:
         resta `posizioneRientro`, che accoda IN FONDO col tetto per-carta.
         Riordinare la coda a ogni giudizio rimetterebbe la carta col tasso
         più alto sempre in testa — cioè esattamente lo stallo appena
         chiuso, con un altro nome. */
      dovute.sort(function (a, b) {
        if (a.t !== b.t) return b.t - a.t;
        if (a.d !== b.d) return a.d - b.d;
        if (a.b !== b.b) return a.b - b.b;
        if (a.nuova !== b.nuova) return a.nuova ? 1 : -1;
        return a.carta.idx - b.carta.idx;
      });
    }

    var coda = [];
    for (var j = 0; j < dovute.length; j++) coda.push(dovute[j].carta);
    return { coda: coda, riposo: riposo.length, prossima: prossima };
  }

  function indiceIn(arr, v) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
    return -1;
  }

  /* Riordina le voci per fascia di tasso conservando l'ordine dentro la
     fascia. Usato solo dal ramo «Mescola». */
  function perFasce(voci) {
    var secchi = [], i, j;
    for (i = 0; i <= FASCE_TASSO.length; i++) secchi.push([]);
    for (i = 0; i < voci.length; i++) secchi[fasciaTasso(voci[i].t)].push(voci[i]);
    var fuori = [];
    for (i = 0; i < secchi.length; i++) for (j = 0; j < secchi[i].length; j++) fuori.push(secchi[i][j]);
    return fuori;
  }

  function mescolaIn(arr, rnd) {
    var r = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* Markdown inline → HTML. L'HTML del sorgente viene SEMPRE neutralizzato
     prima: il JSON è nostro, ma un motore che scrive innerHTML deve saper
     dimostrare da solo di non iniettare niente. */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inlineMd(s) {
    var codici = [];
    var t = escapeHtml(s);
    /* I `codici` escono di scena per primi, così un ** dentro il codice non
       diventa grassetto. Il segnaposto è U+0000, carattere che nei testi non
       compare mai: con un segnaposto fatto di cifre, un retro come
       «1 N = kg·m/s²» verrebbe scambiato per un segnaposto e mangiato. */
    t = t.replace(/`([^`]+)`/g, function (_, dentro) {
      codici.push(dentro);
      return '\u0000' + (codici.length - 1) + '\u0000';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(«"'])\*([^*\n]+)\*(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/(^|[\s(«"'])_([^_\n]+)_(?=$|[\s.,;:!?)»"'])/g, '$1<em>$2</em>');
    t = t.replace(/\n/g, '<br>');
    t = t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codici[+i] + '</code>'; });
    return t;
  }

  function mmss(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function quandoTesto(ts, adesso) {
    var d = Math.ceil((ts - adesso) / GIORNO);
    if (d <= 0) return 'oggi';
    if (d === 1) return 'domani';
    return 'fra ' + d + ' giorni';
  }

  /* ---------------------------------------------------------------- *
   * 2. Persistenza (localStorage con rete di sicurezza)                *
   * localStorage può lanciare: modalità privata, quota piena, file://  *
   * su certi browser. Il motore non deve MAI morire per questo: se     *
   * fallisce, si studia lo stesso, solo senza memoria fra sessioni.    *
   * ---------------------------------------------------------------- */

  var memoria = {};   // fallback in RAM

  function leggi(chiave) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(chiave);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* silenzio: si continua in RAM */ }
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

  var PREFISSO_CHIAVE = 'flashcards.v1.';

  function chiaveMazzo(mazzo, sorgente, esplicita) {
    /* CASSETTO ESPLICITO (`data-chiave` / `opzioni.chiave`). Serve agli hub,
       dove il mazzo si RICOMPONE a ogni cambio di filtro: senza, la chiave
       verrebbe dal mazzo del momento e i progressi si spezzerebbero in un
       cassetto per filtro — «biologia» e «s2b31» conterebbero due volte la
       stessa carta e nessuna delle due saprebbe dell'altra. */
    if (esplicita) return PREFISSO_CHIAVE + String(esplicita);
    if (mazzo.slug) return PREFISSO_CHIAVE + mazzo.slug + (mazzo.parte ? '-' + mazzo.parte : '');
    var s = String(sorgente || 'mazzo').replace(/^.*\//, '').replace(/\.json$/, '');
    return PREFISSO_CHIAVE + s;
  }

  function statoVuoto() { return { v: VERSIONE_STATO, carte: {}, storia: [] }; }

  /* Sotto la chiave del mazzo può esserci QUALUNQUE cosa: un valore
     corrotto, un residuo di un'altra applicazione sullo stesso dominio,
     una versione futura. Controllare solo `v` e la presenza di `carte`
     non basta — va controllata la FORMA, campo per campo:
     `carte` stringa faceva esplodere il PRIMO giudizio
     («Cannot create property 'A01' on string») e `storia` non-array
     faceva esplodere il riepilogo («storia.push is not a function»).
     Qualunque campo fuori forma viene riportato al valore vuoto: si
     perde il progresso corrotto, mai la sessione di studio. */
  function normalizzaStato(s) {
    if (!s || typeof s !== 'object' || esisteArray(s) || s.v !== VERSIONE_STATO) return statoVuoto();
    if (!s.carte || typeof s.carte !== 'object' || esisteArray(s.carte)) s.carte = {};
    if (!esisteArray(s.storia)) s.storia = [];
    return s;
  }

  function caricaStato(chiave) { return normalizzaStato(leggi(chiave)); }

  /* --- IL PONTE COI PROGRESSI VECCHI -------------------------------------
     Fino al 2026-07-30 ogni mazzo teneva i suoi progressi in un cassetto suo
     (`flashcards.v1.s2b31-A`) con gli id GREZZI (`A01`). Il cassetto condiviso
     usa gli id globali (`s2b31-A#A01`). Senza questo travaso, il giorno in cui
     l'hub entra in linea chi ha già ripassato per settimane riparte da zero: i
     dati ci sono ancora, ma sotto un nome che nessuno cerca più.

     REGOLA DEL TRAVASO: vince il record PIÙ AVANZATO (più tentativi). Si rilegge
     a ogni montaggio, non una volta sola — così i progressi fatti sulla pagina
     dell'episodio (che continua ad avere il suo cassetto) continuano a
     confluire. È monotono: non toglie mai niente, quindi ripeterlo è innocuo.
     Il verso opposto (hub -> pagina episodio) NON esiste, ed è una scelta:
     riscrivere i cassetti vecchi da qui vorrebbe dire che un motore ne governa
     altri, e il primo difetto lo pagherebbero i progressi di tutti. */
  function tentativi(v) {
    return (v && ((v.ok > 0 ? v.ok : 0) + (v.ko > 0 ? v.ko : 0))) || 0;
  }

  function travasaLegacy(stato, carte) {
    var lezioni = {}, i, k;
    for (i = 0; i < carte.length; i++) if (carte[i].k) lezioni[carte[i].k] = 1;
    var presi = 0;
    for (k in lezioni) {
      if (!lezioni.hasOwnProperty(k)) continue;
      var vecchio = normalizzaStato(leggi(PREFISSO_CHIAVE + k));
      for (var id in vecchio.carte) {
        if (!vecchio.carte.hasOwnProperty(id)) continue;
        var nuovo = k + '#' + id;
        if (tentativi(vecchio.carte[id]) > tentativi(stato.carte[nuovo])) {
          stato.carte[nuovo] = vecchio.carte[id];
          presi++;
        }
      }
    }
    return presi;
  }

  /* ---------------------------------------------------------------- *
   * 3. Foglio di stile (fonte unica; vedi nota in testa al file)       *
   * ---------------------------------------------------------------- */

  /* I COLORI PASSANO TUTTI DA QUI.
     `--btn-oncolor` — il colore del testo sopra un pieno d'accento — NON
     esiste nel sito: era definita solo nelle demo, quindi il motore
     sembrava a posto in demo e in produzione ricadeva su #fff, che sul
     tema night (il default) dà 1,7-2,8:1 sui comandi principali.
     Qui la variabile viene onorata se c'è, ma il valore vero lo mette il
     motore sui PROPRI contenitori, tema per tema:
       night → #14102A (7,0:1 su fisica · 6,6 su chimica · 10,2 su biologia)
       day   → #FFFFFF (9,4 · 13,2 · 8,4 sui pieni, vedi --fc-pieno)
     Il fallback inline di ogni `var()` resta il più sicuro dei due.
     Tre accenti distinti perché lo stesso colore non può servire a tutto:
       --fc-accent  bordi e contorni (bastano 3:1)
       --fc-accent-t accento usato come TESTO (servono 4,5:1)
       --fc-pieno   sfondo dei controlli pieni, sotto --fc-oncolor
     Nel tema day i tre colori materia puri non reggono come testo su
     bianco (biologia #2E8B6B = 4,18:1): lì si passa alle varianti `-dark`
     che il sito già emette (8,4-13,2:1). Stessa storia per i semantici:
     #2FA84F = 3,07:1 e #E8912A = 2,47:1 su bianco, quindi in day si usa
     `--sem-*-dark` con un fallback scuro nostro finché palette.py non le
     emette (le emettesse un giorno, il suo valore vince: è il primo
     termine del var()).

     `--fc-materia-scura` — la variante scura, usata SOLO nel tema day.
     Qui c'era `var(--accent-dark, ...)`: variabile che nel foglio del sito
     NON esiste (zero occorrenze, misurate sul repo), quindi il var()
     ricadeva sempre sul secondo termine e un mazzo senza materia usciva
     MAGENTA (fisica)
     dentro una pagina di biologia — mentre in night, dove si usa
     `--accent`, lo stesso mazzo prendeva il verde giusto. Riferimento
     morto rimosso: quando la materia si sa, il valore lo scrive il motore
     inline (vedi `costruisciUI`, che legge anche `data-materia` sulla
     radice); quando NON si sa, il difetto è un NEUTRO — meglio nessuna
     codifica cromatica che una sbagliata. */
  var CSS = [
    '.fc{--fc-materia:var(--accent,var(--fisica,#C13E7A));',
    '  --fc-materia-scura:var(--ink,#201B2E);',
    '  --fc-accent:var(--fc-materia);',
    '  --fc-accent-t:var(--fc-materia);',
    '  --fc-pieno:var(--fc-materia);',
    '  --fc-oncolor:var(--btn-oncolor,#14102A);',
    '  --fc-ok:var(--sem-corretto,#78E060);--fc-ko:var(--sem-energia,#FF9E3D);',
    '  --fc-err:var(--sem-errore,#FF6B5C);',
    '  color:var(--ink,#201B2E);font-family:inherit;max-width:var(--measure,66ch);margin-inline:auto}',
    ':root[data-theme="day"] .fc{--fc-oncolor:var(--btn-oncolor,#FFFFFF);',
    '  --fc-accent-t:var(--fc-materia-scura);--fc-pieno:var(--fc-materia-scura);',
    '  --fc-ok:var(--sem-corretto-dark,#1E7A38);--fc-ko:var(--sem-energia-dark,#8A5300);',
    '  --fc-err:var(--sem-errore-dark,#B3261E)}',
    '.fc *{box-sizing:border-box}',
    '.fc [hidden]{display:none !important}',
    '.fc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.fc-head{margin-bottom:14px}',
    '.fc-titolo{font-size:1.15rem;line-height:1.3;font-weight:700;margin:0}',
    '.fc-sub{font-size:.82rem;color:var(--muted,#6B6480);margin:4px 0 0}',

    /* --- attrezzi richiudibili: sul telefono la carta deve restare in alto --- */
    '.fc-attrezzi{border:1px solid var(--line,#E7DFD4);border-radius:12px;',
    '  background:var(--surface,#fff);overflow:hidden}',
    '.fc-attrezzi>summary{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:center;',
    '  padding:11px 14px;min-height:44px;cursor:pointer;font-size:.85rem;font-weight:700;',
    '  list-style:none;-webkit-tap-highlight-color:transparent}',
    '.fc-attrezzi>summary::-webkit-details-marker{display:none}',
    '.fc-attrezzi>summary::after{content:"+";margin-left:auto;font-weight:700;',
    '  color:var(--muted,#6B6480);font-size:1.05rem;line-height:1}',
    '.fc-attrezzi[open]>summary::after{content:"–"}',
    '.fc-somm-s{font-weight:400;font-size:.78rem;color:var(--muted,#6B6480)}',

    /* --- barra strumenti: in colonna sul telefono, in riga da 560px --- */
    '.fc-strumenti{display:flex;flex-direction:column;gap:10px;padding:12px;',
    '  background:transparent;border:0;border-top:1px solid var(--line,#E7DFD4);border-radius:0}',
    '.fc-riga{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.fc-riga>.fc-etichetta{font-size:.75rem;font-weight:700;letter-spacing:.04em;',
    '  text-transform:uppercase;color:var(--muted,#6B6480);flex:0 0 100%}',
    '@media (min-width:560px){.fc-riga>.fc-etichetta{flex:0 0 auto;margin-right:2px}}',
    /* 44px è il minimo tattile (WCAG 2.5.5 / linee guida iOS e Android):
       chip, bottoni e campi erano a 38-40 e su 375px si sbaglia bersaglio. */
    '.fc-chip{font:inherit;font-size:.85rem;font-weight:600;padding:9px 14px;border-radius:30px;',
    '  border:1px solid var(--line,#E7DFD4);background:var(--card,transparent);',
    '  color:var(--muted,#6B6480);cursor:pointer;min-height:44px}',
    '.fc-chip:hover{border-color:var(--muted,#6B6480);color:var(--ink,#201B2E)}',
    '.fc-chip[aria-pressed="true"]{background:var(--fc-pieno);border-color:var(--fc-pieno);',
    '  color:var(--fc-oncolor,#14102A)}',
    '.fc-campo{display:flex;flex-direction:column;gap:4px;flex:1 1 190px;font-size:.78rem;',
    '  font-weight:600;color:var(--muted,#6B6480)}',
    /* 16px NETTI sui campi: sotto i 16px iOS ingrandisce la pagina al fuoco
       e non torna più indietro. `.9rem` erano 14,4px (il sito non ridefinisce
       html{font-size}). Non si risolve con user-scalable=no: quello toglie
       lo zoom all'utente, che è un danno peggiore. */
    '.fc-campo select,.fc-campo input{font:inherit;font-size:16px;font-weight:400;padding:9px 10px;',
    '  min-height:44px;border-radius:9px;border:1px solid var(--line,#E7DFD4);',
    '  background:var(--bg,#fff);color:var(--ink,#201B2E);width:100%}',
    '.fc-btn{font:inherit;font-size:.85rem;font-weight:600;padding:10px 14px;min-height:44px;',
    '  border-radius:10px;border:1px solid var(--line,#E7DFD4);background:var(--card,transparent);',
    '  color:var(--ink,#201B2E);cursor:pointer}',
    '.fc-btn:hover{border-color:var(--muted,#6B6480)}',
    '.fc-btn[disabled]{opacity:.5;cursor:not-allowed}',
    '.fc-btn-forte{background:var(--fc-pieno);border-color:var(--fc-pieno);color:var(--fc-oncolor,#14102A)}',
    '.fc-btn-pericolo[data-conferma="1"]{border-color:var(--fc-err);color:var(--fc-err)}',

    /* --- avanzamento --- */
    '.fc-avanzamento{margin:16px 0 10px}',
    '.fc-barra{height:7px;border-radius:99px;background:var(--line,#E7DFD4);overflow:hidden}',
    '.fc-barra>i{display:block;height:100%;width:0;border-radius:99px;background:var(--fc-pieno);',
    '  transition:width .25s ease}',
    '.fc-conta{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;',
    '  font-size:.78rem;color:var(--muted,#6B6480);margin-top:6px}',
    /* Il riepilogo (sapute / da ripassare / tempo) è il pezzo di valore della
       sessione e prima si poteva raggiungere SOLO svuotando la coda: chi si
       fermava a metà non lo vedeva mai. Ora si chiude quando si vuole. */
    '.fc-chiudi{display:flex;justify-content:flex-end;margin-top:8px}',
    '.fc-chiudi .fc-btn{font-size:.78rem;padding:8px 12px}',

    /* --- la carta --- */
    '.fc-viewport{perspective:1200px}',
    '.fc-carta{display:block;width:100%;text-align:left;font:inherit;cursor:pointer;',
    '  padding:22px 18px;min-height:190px;border-radius:var(--radius,16px);',
    '  border:1px solid var(--line,#E7DFD4);background:var(--surface,#fff);color:var(--ink,#201B2E);',
    '  box-shadow:var(--shadow,0 10px 26px -18px rgba(0,0,0,.4));',
    '  transform:rotateY(0deg);transition:transform .13s ease-in,border-color .2s ease}',
    '.fc-carta:hover{border-color:var(--fc-accent)}',
    '.fc-carta.is-girando{transform:rotateY(90deg)}',
    '.fc-carta .fc-faccia-tit{display:block;font-size:.7rem;font-weight:700;letter-spacing:.09em;',
    '  text-transform:uppercase;color:var(--fc-accent-t);margin-bottom:10px}',
    '.fc-carta .fc-testo{display:block;font-size:1.03rem;line-height:1.55;white-space:normal}',
    '.fc-carta.is-retro .fc-testo{font-size:.98rem}',
    '.fc-carta .fc-meta{display:block;margin-top:14px;font-size:.72rem;color:var(--muted,#6B6480)}',
    '.fc-carta code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;',
    '  background:var(--card,rgba(127,127,127,.12));padding:1px 5px;border-radius:5px}',
    '.fc-hint{font-size:.76rem;color:var(--muted,#6B6480);margin:8px 2px 0;text-align:center}',
    '.fc-hint kbd{font:inherit;font-size:.9em;border:1px solid var(--line,#E7DFD4);border-bottom-width:2px;',
    '  border-radius:5px;padding:0 5px;background:var(--card,transparent)}',

    /* --- giudizio --- */
    '.fc-giudizio{display:grid;grid-template-columns:1fr;gap:9px;margin-top:14px}',
    '@media (min-width:480px){.fc-giudizio{grid-template-columns:1fr 1fr}}',
    '.fc-voto{font:inherit;font-size:.95rem;font-weight:700;padding:14px 12px;min-height:52px;',
    '  border-radius:12px;cursor:pointer;border:1px solid var(--line,#E7DFD4);',
    '  background:var(--surface,#fff);color:var(--ink,#201B2E);',
    '  display:flex;align-items:center;justify-content:center;gap:9px}',
    '.fc-voto[data-esito="ok"]{border-color:var(--fc-ok);color:var(--fc-ok)}',
    '.fc-voto[data-esito="ok"]:hover{background:var(--fc-ok);color:var(--fc-oncolor,#14102A)}',
    '.fc-voto[data-esito="ko"]{border-color:var(--fc-ko);color:var(--fc-ko)}',
    '.fc-voto[data-esito="ko"]:hover{background:var(--fc-ko);color:var(--fc-oncolor,#14102A)}',
    '.fc-voto kbd{font:inherit;font-size:.75rem;font-weight:600;border:1px solid currentColor;',
    '  border-radius:5px;padding:0 5px;opacity:.75}',

    /* --- riepilogo / stati vuoti --- */
    '.fc-pannello{padding:20px 18px;border-radius:var(--radius,16px);background:var(--surface,#fff);',
    '  border:1px solid var(--line,#E7DFD4)}',
    '.fc-pannello h3{font-size:1.05rem;margin:0 0 12px}',
    '.fc-pannello p{font-size:.9rem;color:var(--muted,#6B6480);margin:0 0 12px;line-height:1.6}',
    '.fc-cifre{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:10px;margin-bottom:16px}',
    '.fc-cifra{padding:10px;border-radius:10px;background:var(--card,rgba(127,127,127,.07));text-align:center}',
    '.fc-cifra b{display:block;font-size:1.5rem;line-height:1.1}',
    '.fc-cifra span{font-size:.72rem;color:var(--muted,#6B6480)}',
    '.fc-scatole{display:flex;gap:6px;align-items:flex-end;height:56px;margin:6px 0 16px}',
    '.fc-scatole div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;',
    '  font-size:.66rem;color:var(--muted,#6B6480);text-align:center;gap:3px}',
    '.fc-scatole i{display:block;background:var(--fc-pieno);border-radius:4px 4px 0 0;min-height:3px;opacity:.85}',
    /* --- le tue bestie nere --- */
    '.fc-sez{font-size:.95rem;margin:18px 0 8px}',
    '.fc-bestie{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.fc-bestie li{padding:9px 12px;border-radius:10px;border-left:3px solid var(--fc-accent);',
    '  background:var(--card,rgba(127,127,127,.07))}',
    '.fc-bestie b{display:block;font-size:.72rem;font-weight:700;letter-spacing:.03em;',
    '  color:var(--fc-accent-t)}',
    '.fc-bestie span{display:block;font-size:.86rem;line-height:1.45;color:var(--ink,#201B2E)}',
    '.fc-bestie em{display:block;font-style:normal;font-size:.72rem;margin-top:3px;',
    '  color:var(--muted,#6B6480)}',
    '.fc-azioni{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:6px}',
    '.fc :focus-visible{outline:3px solid var(--fc-accent);outline-offset:3px;border-radius:6px}',
    '@media (prefers-reduced-motion: reduce){',
    '  .fc-carta,.fc-barra>i{transition:none !important}',
    '  .fc-carta.is-girando{transform:none}}'
  ].join('\n');

  function iniettaCss(doc) {
    if (!doc || doc.getElementById('fc-css')) return;
    if (doc.querySelector && doc.querySelector('[data-motori-css]')) return;  // c'è già study.css
    var st = doc.createElement('style');
    st.id = 'fc-css';
    st.setAttribute('data-motori-css', 'flashcards');
    st.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------------------------------------------------------------- *
   * 4. Piccoli aiuti DOM                                              *
   * ---------------------------------------------------------------- */

  function el(doc, tag, attr, testo) {
    var n = doc.createElement(tag);
    if (attr) for (var k in attr) if (attr.hasOwnProperty(k) && attr[k] != null) {
      if (k === 'class') n.className = attr[k];
      else n.setAttribute(k, attr[k]);
    }
    if (testo != null) n.appendChild(doc.createTextNode(testo));
    return n;
  }

  function svuota(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function ridotto() {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- *
   * 5. L'applicazione                                                 *
   * ---------------------------------------------------------------- */

  var mounts = [];   // per l'instradamento dei tasti quando il fuoco è sul body

  function App(radice, dati, opzioni) {
    var doc = radice.ownerDocument || global.document;
    var self = this;
    opzioni = opzioni || {};

    this.doc = doc;
    this.radice = radice;
    this.uid = 'fc' + (++contatoreId);
    /* Un cassetto esplicito porta con sé gli id GLOBALI: sono la stessa
       decisione vista da due lati (vedi `idGlobale` e `chiaveMazzo`). Un solo
       interruttore, così non possono finire disallineati. */
    this.chiaveEsplicita = opzioni.chiave ||
      radice.getAttribute('data-chiave') || '';
    this.mazzo = normalizzaMazzo(dati, !!this.chiaveEsplicita);
    /* La materia serve al COLORE, e il mazzo può non dichiararla: in quel
       caso la sa la pagina, che è già tinta della materia giusta. Si
       accetta quindi anche `opzioni.materia` e `data-materia` sulla
       radice — senza questo ripiego un mazzo senza campo `materia` finiva
       col colore di difetto. */
    this.materia = this.mazzo.materia ||
      String(opzioni.materia || radice.getAttribute('data-materia') || '').toLowerCase();
    this.titolo = opzioni.titolo || radice.getAttribute('data-titolo') ||
      (this.mazzo.lezione || 'Flashcards');
    this.chiave = chiaveMazzo(this.mazzo, opzioni.sorgente, this.chiaveEsplicita);
    this.stato = caricaStato(this.chiave);
    if (this.chiaveEsplicita && travasaLegacy(this.stato, this.mazzo.carte)) {
      scrivi(this.chiave, this.stato);
    }

    this.filtri = { diff: {}, tag: '', cerca: '', mescola: false };
    this.coda = [];
    this.pos = 0;
    this.retro = false;
    this.girando = false;
    this.fatte = {};        // id → 'ok' | 'ko'  (esito CORRENTE nella sessione)
    this.rientri = {};      // id → quante volte è già tornata in coda oggi
    this.viste = {};        // id → 1  (carte DISTINTE incontrate)
    this.nViste = 0;
    this.risposte = 0;
    this.t0 = 0;
    this.soloQuesti = null;
    /* «Ripassa comunque tutto» è una MODALITÀ, non un colpo singolo: una
       volta che l'utente ha detto che vuole macinare tutto il mazzo, deve
       sopravvivere al cambio di filtro. Si spegne solo azzerando. */
    this.ignoraScadenze = false;

    /* AVVIO «BESTIE NERE» — la funzione c'era e non l'aveva mai vista nessuno.
       `bestieNere()` esiste da sempre, ma si raggiungeva SOLO dal riepilogo di
       fine sessione: per vedere le proprie carte peggiori bisognava prima
       finirne una. Con `opzioni.avvio = 'bestie'` (l'hub la offre come modo di
       studio) la sessione PARTE da lì. Le scadenze si ignorano di proposito:
       chi chiede le proprie bestie nere le vuole adesso, non fra tre giorni. */
    if (opzioni.avvio === 'bestie') {
      var peggiori = bestieNere(this.mazzo.carte, this.stato,
        opzioni.quanteBestie == null ? 0 : opzioni.quanteBestie, 1);
      if (peggiori.length) {
        this.soloQuesti = [];
        for (var ib = 0; ib < peggiori.length; ib++) this.soloQuesti.push(peggiori[ib].id);
        this.ignoraScadenze = true;
      }
      this.avvioBestie = true;
      this.bestieTrovate = peggiori.length;
    }

    iniettaCss(doc);
    this.costruisciUI();
    this.nuovaSessione();

    /* Tastiera: il motore ascolta il documento ma agisce solo se il fuoco
       è dentro di lui, oppure se nessuno ha il fuoco (subito dopo il
       caricamento) e questo è il primo mazzo della pagina. */
    this.onKey = function (e) { self.tasto(e); };
    doc.addEventListener('keydown', this.onKey, false);
    mounts.push(this);
  }

  /* Il tasto è per NOI? Dipende dal tasto, non solo dal mazzo.
     Spazio è lo scorrimento di pagina universale: intercettarlo quando
     nessuno ha il fuoco significa toglierlo a chi ha solo aperto la
     pagina /studio e non ha fatto niente per entrare nel widget (e la
     carta girata potrebbe essere fuori schermo). Quindi Spazio e Invio
     valgono SOLO col fuoco dentro il motore — la carta è un <button>
     vero, ci si arriva con Tab, e l'invito a schermo lo dice.
     I giudizi (1/2, ← →) restano raggiungibili anche col fuoco caduto sul
     body, ma solo dopo che l'utente ha davvero cominciato a usare QUESTO
     mazzo: alcuni browser non danno il fuoco al bottone cliccato. */
  App.prototype.pertinente = function (k) {
    var att = this.doc.activeElement;
    if (att && this.radice.contains(att)) return true;
    if (att && att !== this.doc.body && att !== this.doc.documentElement) return false;
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') return false;
    return !!this.usato && mounts[0] === this;
  };

  App.prototype.tasto = function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target || {};
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || t.isContentEditable) return;
    if (!this.cartaCorrente()) return;

    /* e.key con rete di sicurezza su keyCode: sui browser vecchi (e su
       certe tastiere mobili) `key` non c'è. 97/98 sono l'1 e il 2 del
       tastierino numerico. */
    var k = e.key;
    if (!k) k = ({ 32: ' ', 13: 'Enter', 49: '1', 50: '2', 97: '1', 98: '2',
      37: 'ArrowLeft', 39: 'ArrowRight' })[e.keyCode];
    if (!k) return;
    if (k !== ' ' && k !== 'Spacebar' && k !== 'Enter' && k !== '1' && k !== '2' &&
      k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    if (!this.pertinente(k)) return;
    this.daTastiera = true;   // d'ora in poi il fuoco va tenuto sulla carta

    if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
      /* Se il fuoco è su un bottone diverso dalla carta, lascio fare a lui. */
      if (this.doc.activeElement && this.doc.activeElement !== this.nodi.carta &&
        this.radice.contains(this.doc.activeElement)) return;
      e.preventDefault();
      this.gira();
      return;
    }
    if (!this.retro) return;                       // si giudica solo a carta girata
    if (k === '1' || k === 'ArrowRight') { e.preventDefault(); this.giudica('ok'); }
    else if (k === '2' || k === 'ArrowLeft') { e.preventDefault(); this.giudica('ko'); }
  };

  /* ---------------- costruzione dell'interfaccia ---------------- */

  App.prototype.costruisciUI = function () {
    var doc = this.doc, self = this, n = {};
    svuota(this.radice);

    var sez = el(doc, 'section', { 'class': 'fc', 'aria-label': 'Flashcards: ' + this.titolo });
    /* L'accento segue la MATERIA. Si impostano due variabili, non una: il
       colore pieno e la sua variante scura, che nel tema day serve come
       testo su bianco (biologia #2E8B6B è 4,18:1, sotto la soglia). Quale
       delle due usare lo decide il CSS, tema per tema. */
    if (MATERIE[this.materia]) {
      var m = this.materia;
      sez.setAttribute('data-materia', m);
      sez.style.setProperty('--fc-materia', 'var(--' + m + ',' + MATERIE[m][0] + ')');
      sez.style.setProperty('--fc-materia-scura', 'var(--' + m + '-dark,' + MATERIE[m][1] + ')');
    }

    /* testata */
    var head = el(doc, 'header', { 'class': 'fc-head' });
    head.appendChild(el(doc, 'h2', { 'class': 'fc-titolo' }, this.titolo));
    var pezzi = [];
    if (this.materia) pezzi.push(this.materia);
    if (this.mazzo.parte) pezzi.push('parte ' + this.mazzo.parte);
    pezzi.push(this.mazzo.carte.length + ' carte');
    head.appendChild(el(doc, 'p', { 'class': 'fc-sub' }, pezzi.join(' · ')));
    sez.appendChild(head);

    /* strumenti */
    var str = el(doc, 'div', { 'class': 'fc-strumenti', role: 'group', 'aria-label': 'Filtri e strumenti del mazzo' });

    var rigaD = el(doc, 'div', { 'class': 'fc-riga' });
    rigaD.appendChild(el(doc, 'span', { 'class': 'fc-etichetta', id: this.uid + '-ld' }, 'Difficoltà'));
    n.chips = [];
    var diffs = this.difficoltaPresenti();
    for (var i = 0; i < diffs.length; i++) {
      (function (d) {
        var b = el(doc, 'button', {
          type: 'button', 'class': 'fc-chip', 'aria-pressed': 'false', 'data-diff': d.k
        }, (ETICHETTA_DIFF[d.k] || d.k) + ' (' + d.n + ')');
        b.addEventListener('click', function () {
          self.filtri.diff[d.k] = !self.filtri.diff[d.k];
          b.setAttribute('aria-pressed', self.filtri.diff[d.k] ? 'true' : 'false');
          self.nuovaSessione();
        });
        n.chips.push(b);
        rigaD.appendChild(b);
      })(diffs[i]);
    }
    str.appendChild(rigaD);

    var rigaF = el(doc, 'div', { 'class': 'fc-riga' });

    /* Nota misurata: i tag sono quasi UNO PER CARTA (23 tag distinti su 25
       carte in s1f01-A). Una fila di chip sarebbe un indice, non un filtro:
       quindi <select> nativo (compatto, accessibile, ottimo su mobile) e
       accanto una ricerca testuale, che su tag così granulari è ciò che
       serve davvero. */
    var wrapT = el(doc, 'label', { 'class': 'fc-campo' });
    wrapT.appendChild(doc.createTextNode('Argomento'));
    n.selTag = el(doc, 'select', {});
    n.selTag.appendChild(el(doc, 'option', { value: '' }, 'tutti gli argomenti'));
    var tg = this.tagPresenti();
    for (var j = 0; j < tg.length; j++) {
      n.selTag.appendChild(el(doc, 'option', { value: tg[j].k }, tg[j].k + ' (' + tg[j].n + ')'));
    }
    n.selTag.addEventListener('change', function () {
      self.filtri.tag = n.selTag.value; self.nuovaSessione();
    });
    wrapT.appendChild(n.selTag);
    rigaF.appendChild(wrapT);

    var wrapC = el(doc, 'label', { 'class': 'fc-campo' });
    wrapC.appendChild(doc.createTextNode('Cerca nel mazzo'));
    n.cerca = el(doc, 'input', { type: 'search', placeholder: 'parola nel fronte o nel retro' });
    n.cerca.addEventListener('input', function () {
      if (self.timerCerca) clearTimeout(self.timerCerca);
      self.timerCerca = setTimeout(function () { self.filtri.cerca = n.cerca.value; self.nuovaSessione(); }, 220);
    });
    wrapC.appendChild(n.cerca);
    rigaF.appendChild(wrapC);
    str.appendChild(rigaF);

    var rigaB = el(doc, 'div', { 'class': 'fc-riga' });
    n.mescola = el(doc, 'button', { type: 'button', 'class': 'fc-btn', 'aria-pressed': 'false' }, 'Mescola');
    n.mescola.addEventListener('click', function () {
      self.filtri.mescola = !self.filtri.mescola;
      n.mescola.setAttribute('aria-pressed', self.filtri.mescola ? 'true' : 'false');
      self.nuovaSessione();
    });
    rigaB.appendChild(n.mescola);

    n.ricomincia = el(doc, 'button', { type: 'button', 'class': 'fc-btn' }, 'Ricomincia');
    n.ricomincia.addEventListener('click', function () { self.soloQuesti = null; self.nuovaSessione(); });
    rigaB.appendChild(n.ricomincia);

    n.azzera = el(doc, 'button', { type: 'button', 'class': 'fc-btn fc-btn-pericolo' }, 'Azzera progressi');
    n.azzera.addEventListener('click', function () { self.azzera(); });
    rigaB.appendChild(n.azzera);
    str.appendChild(rigaB);

    /* La barra strumenti, tutta aperta, occupa ~340px: sul telefono
       spingeva la CARTA sotto la piega (misurato: 458px dall'inizio
       dell'app su 375×812). La carta è lo strumento, i filtri sono
       l'accessorio: quindi <details> chiuso di default, aperto da solo
       sugli schermi larghi. <details>/<summary> è nativo — tastiera e
       lettori di schermo funzionano senza una riga di ARIA. */
    var det = el(doc, 'details', { 'class': 'fc-attrezzi' });
    var som = el(doc, 'summary', { 'class': 'fc-somm' });
    som.appendChild(el(doc, 'span', {}, 'Filtri e strumenti'));
    n.sommStato = el(doc, 'span', { 'class': 'fc-somm-s' }, '');
    som.appendChild(n.sommStato);
    det.appendChild(som);
    det.appendChild(str);
    try {
      if (global.matchMedia && global.matchMedia('(min-width: 900px)').matches) det.open = true;
    } catch (e) { det.open = true; }
    sez.appendChild(det);

    /* avanzamento */
    var av = el(doc, 'div', { 'class': 'fc-avanzamento' });
    n.barra = el(doc, 'div', {
      'class': 'fc-barra', role: 'progressbar', 'aria-label': 'Avanzamento della sessione',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0'
    });
    n.barraRiemp = el(doc, 'i', {});
    n.barra.appendChild(n.barraRiemp);
    av.appendChild(n.barra);
    n.conta = el(doc, 'p', { 'class': 'fc-conta' });
    n.contaSx = el(doc, 'span', {}, '');
    n.contaDx = el(doc, 'span', {}, '');
    n.conta.appendChild(n.contaSx);
    n.conta.appendChild(n.contaDx);
    av.appendChild(n.conta);
    sez.appendChild(av);

    /* zona carta: UNA sola regione live, così il lettore di schermo
       annuncia il cambio carta e il giro senza sovrapposizioni. */
    n.zona = el(doc, 'div', { 'class': 'fc-viewport', 'aria-live': 'polite', 'aria-atomic': 'false' });
    sez.appendChild(n.zona);

    n.hint = el(doc, 'p', { 'class': 'fc-hint', id: this.uid + '-hint' });
    sez.appendChild(n.hint);

    n.giudizio = el(doc, 'div', { 'class': 'fc-giudizio', hidden: 'hidden' });
    n.votoOk = el(doc, 'button', { type: 'button', 'class': 'fc-voto', 'data-esito': 'ok' }, 'La sapevo ');
    n.votoOk.appendChild(el(doc, 'kbd', {}, '1'));
    n.votoKo = el(doc, 'button', { type: 'button', 'class': 'fc-voto', 'data-esito': 'ko' }, 'Da ripassare ');
    n.votoKo.appendChild(el(doc, 'kbd', {}, '2'));
    n.votoOk.addEventListener('click', function () { self.giudica('ok'); });
    n.votoKo.addEventListener('click', function () { self.giudica('ko'); });
    n.giudizio.appendChild(n.votoOk);
    n.giudizio.appendChild(n.votoKo);
    sez.appendChild(n.giudizio);

    /* Uscita sempre disponibile verso il riepilogo. Prima l'unico modo di
       vederlo era svuotare la coda: chi si fermava a metà (o chi sbagliava
       molto) non lo raggiungeva mai, e «Ricomincia» azzerava la sessione
       senza mostrare niente.
       Sta SOTTO i voti, non sopra la carta: è un'azione secondaria e sul
       telefono ogni riga messa più in alto spinge la carta fuori dalla
       piega (misurato: 220px contro 168px dall'inizio dell'app). */
    n.chiudi = el(doc, 'div', { 'class': 'fc-chiudi', hidden: 'hidden' });
    n.termina = el(doc, 'button', { type: 'button', 'class': 'fc-btn' },
      'Termina e vedi il riepilogo');
    n.termina.addEventListener('click', function () { self.termina(); });
    n.chiudi.appendChild(n.termina);
    sez.appendChild(n.chiudi);

    this.nodi = n;
    this.sezione = sez;
    this.radice.appendChild(sez);
  };

  App.prototype.difficoltaPresenti = function () {
    var conta = {}, c = this.mazzo.carte, i;
    for (i = 0; i < c.length; i++) conta[c[i].diff] = (conta[c[i].diff] || 0) + 1;
    var fuori = [], visti = {};
    for (i = 0; i < ORDINE_DIFF.length; i++) {
      var k = ORDINE_DIFF[i];
      if (conta[k]) { fuori.push({ k: k, n: conta[k] }); visti[k] = 1; }
    }
    for (var k2 in conta) if (conta.hasOwnProperty(k2) && !visti[k2]) fuori.push({ k: k2, n: conta[k2] });
    return fuori;
  };

  App.prototype.tagPresenti = function () {
    var conta = {}, c = this.mazzo.carte, i, j;
    for (i = 0; i < c.length; i++) for (j = 0; j < c[i].tags.length; j++) {
      conta[c[i].tags[j]] = (conta[c[i].tags[j]] || 0) + 1;
    }
    var fuori = [];
    for (var k in conta) if (conta.hasOwnProperty(k)) fuori.push({ k: k, n: conta[k] });
    fuori.sort(function (a, b) { return b.n - a.n || (a.k < b.k ? -1 : 1); });
    return fuori;
  };

  /* ---------------- sessione ---------------- */

  App.prototype.nuovaSessione = function (opz) {
    opz = opz || {};
    var adesso = Date.now();
    var r = costruisciCoda(this.mazzo.carte, this.stato, {
      diff: this.filtri.diff,
      tag: this.filtri.tag,
      cerca: this.filtri.cerca,
      mescola: this.filtri.mescola,
      soloScadute: !this.ignoraScadenze,
      soloQuesti: this.soloQuesti
    }, adesso);

    this.coda = r.coda;
    this.riposo = r.riposo;
    this.prossima = r.prossima;
    this.pos = 0;
    this.retro = false;
    this.fatte = {};
    this.rientri = {};
    this.viste = {};
    this.nViste = 0;
    this.risposte = 0;
    this.t0 = 0;
    /* Quante carte DISTINTE ha questa sessione. È il denominatore onesto:
       `coda.length` cresce a ogni rientro e trasformava il contatore in
       «Carta 3001 di 3025». */
    this.totaleSessione = this.coda.length;
    this.aggiornaSommario();
    this.disegna();
    if (opz.fuoco && this.nodi.carta) this.nodi.carta.focus();
  };

  /* Con i filtri chiusi, il riassunto dice cosa è attivo senza aprirli. */
  App.prototype.aggiornaSommario = function () {
    if (!this.nodi || !this.nodi.sommStato) return;
    var pezzi = [], k;
    var d = [];
    for (k in this.filtri.diff) if (this.filtri.diff[k]) d.push(ETICHETTA_DIFF[k] || k);
    if (d.length) pezzi.push(d.join(' + '));
    if (this.filtri.tag) pezzi.push('«' + this.filtri.tag + '»');
    if (this.filtri.cerca) pezzi.push('cerca: ' + this.filtri.cerca);
    if (this.filtri.mescola) pezzi.push('mescolate');
    this.nodi.sommStato.firstChild.nodeValue = pezzi.length
      ? pezzi.join(' · ')
      : 'tutto il mazzo';
  };

  App.prototype.cartaCorrente = function () {
    return this.pos < this.coda.length ? this.coda[this.pos] : null;
  };

  App.prototype.disegna = function () {
    var doc = this.doc, n = this.nodi;
    var carta = this.cartaCorrente();
    svuota(n.zona);

    if (!carta) { this.disegnaFine(); return; }

    if (!this.viste[carta.id]) { this.viste[carta.id] = 1; this.nViste++; }
    n.giudizio.hidden = !this.retro;
    n.chiudi.hidden = false;
    n.hint.hidden = false;
    svuota(n.hint);
    if (this.retro) {
      n.hint.appendChild(doc.createTextNode('Quanto la sapevi? '));
      n.hint.appendChild(el(doc, 'kbd', {}, '1'));
      n.hint.appendChild(doc.createTextNode(' la sapevo · '));
      n.hint.appendChild(el(doc, 'kbd', {}, '2'));
      n.hint.appendChild(doc.createTextNode(' da ripassare (o ← →)'));
    } else {
      /* L'invito dice ESPLICITAMENTE che Spazio vuole il fuoco sulla carta:
         il motore non intercetta più la Barra spaziatrice quando nessuno ha
         il fuoco (era lo scorrimento della pagina, rubato senza che
         l'utente avesse fatto niente per entrare nel widget). */
      n.hint.appendChild(doc.createTextNode('Rispondi a mente, poi gira: clic sulla carta — oppure '));
      n.hint.appendChild(el(doc, 'kbd', {}, 'Tab'));
      n.hint.appendChild(doc.createTextNode(' fino alla carta e '));
      n.hint.appendChild(el(doc, 'kbd', {}, 'Spazio'));
      n.hint.appendChild(doc.createTextNode(' o '));
      n.hint.appendChild(el(doc, 'kbd', {}, 'Invio'));
    }

    var b = el(doc, 'button', {
      type: 'button',
      'class': 'fc-carta' + (this.retro ? ' is-retro' : ''),
      'aria-describedby': this.uid + '-hint',
      'aria-expanded': this.retro ? 'true' : 'false'
    });
    var self = this;
    b.addEventListener('click', function () { self.gira(); });

    /* la posizione sta DENTRO la regione live: così l'annuncio è
       «Carta 3 di 25 · fronte · <testo>» in un colpo solo.
       Il numeratore conta le carte DISTINTE incontrate e il denominatore
       è la sessione: un rientro non fa avanzare il numero (sarebbe una
       bugia) ma si annuncia come «ripasso». */
    b.appendChild(el(doc, 'span', { 'class': 'fc-faccia-tit' },
      'Carta ' + this.nViste + ' di ' + this.totaleSessione +
      (this.fatte[carta.id] ? ' · ripasso' : '') + ' · ' + (this.retro ? 'retro' : 'fronte')));
    var testo = el(doc, 'span', { 'class': 'fc-testo' });
    testo.innerHTML = inlineMd(this.retro ? carta.r : carta.f);
    b.appendChild(testo);

    var s = statoCarta(this.stato, carta.id);
    var meta = [];
    if (carta.tags.length) meta.push(carta.tags.join(' · '));
    meta.push('difficoltà ' + (ETICHETTA_DIFF[carta.diff] || carta.diff));
    /* Indicatore discreto dell'andamento personale (SPEC §4): «sbagliata 3
       volte su 5». Sta nella riga di servizio della carta, insieme alla
       scatola: sapere quali sono le proprie carte-nemico è già metà del
       ripasso, ma non deve gridare sopra la domanda. */
    if (s.nuova) meta.push('mai vista');
    else {
      meta.push('scatola ' + s.b + '/5');
      meta.push(testoAndamento(s));
    }
    b.appendChild(el(doc, 'span', { 'class': 'fc-meta' }, meta.join('  ·  ')));

    n.zona.appendChild(b);
    n.carta = b;
    this.aggiornaBarra();
  };

  App.prototype.aggiornaBarra = function () {
    var n = this.nodi, i, k;
    /* Completate = carte giudicate che NON sono più in attesa nella coda.
       Una «da ripassare» rientra in coda: è stata giudicata, ma non è
       chiusa. Senza questo scorporo la barra correrebbe avanti e poi
       resterebbe ferma; così invece non torna mai indietro e non mente. */
    var pendenti = {};
    for (i = this.pos; i < this.coda.length; i++) pendenti[this.coda[i].id] = 1;
    var fatte = 0;
    for (k in this.fatte) if (this.fatte.hasOwnProperty(k) && !pendenti[k]) fatte++;
    var tot = this.totaleSessione;
    var perc = tot ? Math.round(Math.min(1, fatte / tot) * 100) : 0;
    n.barraRiemp.style.width = perc + '%';
    n.barra.setAttribute('aria-valuenow', String(perc));
    n.barra.setAttribute('aria-valuetext',
      tot ? (fatte + (fatte === 1 ? ' carta su ' : ' carte su ') + tot) : 'nessuna carta in coda');
    /* Lo spazio in coda alla prima metà non si vede (il flex lo mangia) ma
       separa le due frasi per chi legge la riga con la sintesi vocale. */
    /* Denominatore = carte DISTINTE della sessione, mai `coda.length`:
       quello cresce a ogni rientro e diceva «Carta 3001 di 3025». */
    n.contaSx.firstChild.nodeValue = tot
      ? 'Carta ' + Math.min(this.nViste, tot) + ' di ' + tot + ' '
      : 'Nessuna carta in coda ';
    var dx = tot ? (fatte + '/' + tot + ' completate') : '';
    if (this.riposo) dx += (dx ? ' · ' : '') + this.riposo + ' in riposo';
    n.contaDx.firstChild.nodeValue = dx;
  };

  App.prototype.gira = function () {
    if (!this.cartaCorrente() || this.girando) return;
    if (!this.t0) this.t0 = Date.now();
    this.usato = true;          // l'utente è entrato nel widget di sua volontà
    var self = this;
    var dentro = this.fuocoDentro();
    /* Niente mezzo giro se l'utente ha chiesto meno movimento: si cambia
       faccia e basta (prefers-reduced-motion, letto anche da CSS). */
    if (ridotto()) { this.retro = !this.retro; this.disegna(); this.rifocalizza(dentro); return; }
    this.girando = true;
    if (this.nodi.carta) this.nodi.carta.className = 'fc-carta is-girando' + (this.retro ? ' is-retro' : '');
    this.timerGiro = setTimeout(function () {
      self.retro = !self.retro;
      self.girando = false;
      self.disegna();
      self.rifocalizza(dentro);
    }, 130);
  };

  /* Il fuoco era dentro l'app PRIMA che ricostruissi il DOM? Va guardato
     prima, non dopo: rimuovendo il bottone che aveva il fuoco, l'active
     element ricade sul <body> e il «dopo» direbbe sempre di no. */
  App.prototype.fuocoDentro = function () {
    var att = this.doc.activeElement;
    return !!(att && this.radice.contains(att));
  };

  App.prototype.rifocalizza = function (eraDentro) {
    /* Si rimette il fuoco sulla carta solo se l'utente stava già giocando
       qui dentro (o ha appena usato la tastiera): mai rubare il fuoco a
       chi ha solo la pagina aperta — farebbe saltare lo scorrimento. */
    if (!this.nodi.carta) return;
    if (!eraDentro && !this.daTastiera) return;
    try { this.nodi.carta.focus(); } catch (e) { }
  };

  App.prototype.giudica = function (esito) {
    var carta = this.cartaCorrente();
    if (!carta || !this.retro) return;
    this.usato = true;
    var dentro = this.fuocoDentro();
    var adesso = Date.now();
    if (!this.t0) this.t0 = adesso;

    var s = statoCarta(this.stato, carta.id);
    var nuovaB = prossimaScatola(s.b, esito);
    /* Il tasso va ricalcolato DOPO aver contato questo giudizio: la carta
       che stai sbagliando adesso deve tornare prima già da adesso, non dal
       giro successivo. */
    var nuovoOk = s.ok + (esito === 'ok' ? 1 : 0);
    var nuovoKo = s.ko + (esito === 'ko' ? 1 : 0);
    var nuovoTasso = tassoErrore(nuovoOk, nuovoKo);
    this.stato.carte[carta.id] = {
      b: nuovaB,
      d: scadenzaDi(nuovaB, adesso, nuovoTasso),
      ok: nuovoOk,
      ko: nuovoKo
    };
    this.stato.agg = adesso;
    scrivi(this.chiave, this.stato);

    this.fatte[carta.id] = esito;
    this.risposte++;

    if (esito === 'ko') {
      /* Rientra nella stessa sessione, ma IN FONDO e non più di
         `rientriMaxDi(tasso)` volte: vedi `posizioneRientro` per il perché
         del fondo, e il blocco in testa per il perché del numero.
         Il tetto si legge sul tasso APPENA aggiornato — la carta che stai
         sbagliando adesso deve poter tornare di più già oggi, non dalla
         sessione prossima — e resta comunque ≤ RIENTRI_CAP, quindi la
         sessione non può allungarsi oltre N * (1 + RIENTRI_CAP). */
      var dove = posizioneRientro(this.coda, this.pos, carta.id, this.rientri,
        rientriMaxDi(nuovoTasso));
      if (dove >= 0) {
        this.rientri[carta.id] = (this.rientri[carta.id] || 0) + 1;
        this.coda.splice(dove, 0, carta);
      }
    }

    this.pos++;
    this.retro = false;
    this.nodi.giudizio.hidden = true;
    this.disegna();
    this.rifocalizza(dentro);
  };

  /* Chiude la sessione qui e ora e porta al riepilogo: le carte rimaste in
     coda restano dove sono (stato salvato a ogni giudizio), quindi
     riprenderle domani non perde niente. */
  App.prototype.termina = function () {
    if (!this.cartaCorrente()) return;
    var dentro = this.fuocoDentro();
    this.pos = this.coda.length;
    this.retro = false;
    this.girando = false;
    this.disegna();
    this.daTastiera = dentro || this.daTastiera;
  };

  /* «Le tue bestie nere» (SPEC §4): le carte con il tasso d'errore più
     alto di TUTTO il mazzo — non solo di questa sessione — con il pulsante
     che ne fa subito un mazzo mirato. Ritorna true se ha scritto qualcosa. */
  App.prototype.aggiungiBestie = function (contenitore, quante) {
    var doc = this.doc, self = this;
    var lista = bestieNere(this.mazzo.carte, this.stato, quante == null ? 5 : quante, 1);
    if (!lista.length) return false;

    contenitore.appendChild(el(doc, 'h4', { 'class': 'fc-sez' }, 'Le tue bestie nere'));
    /* IL TESTO DEVE DIRE QUELLO CHE IL MOTORE FA, carta per carta.
       Prima qui c'era una riga sola — «l'intervallo di ripasso si accorcia
       in proporzione al tasso d'errore» — messa sopra un elenco in cui le
       carte peggiori stanno in scatola 1 e l'intervallo non si accorcia di
       niente (non c'è intervallo da accorciare). Lo studente leggeva una
       promessa proprio accanto alle carte su cui non valeva. Ora il
       cappello nomina i due canali e ogni riga dice QUALE dei due la
       riguarda: `modulabile()` decide, non una frase generica. */
    contenitore.appendChild(el(doc, 'p', {},
      'Le carte che sbagli più spesso tornano più spesso, in due modi: dentro la sessione ' +
      'ritornano più volte (fino a ' + presentazioniMax(1) + ' contro ' + presentazioniMax(0) +
      ' di una carta che sai), e quando arrivano alle scatole lunghe l\'attesa in giorni si ' +
      'accorcia fino a un terzo. Sotto, per ciascuna, quello che le succede davvero.'));

    var ul = el(doc, 'ul', { 'class': 'fc-bestie' });
    var ids = [], i;
    for (i = 0; i < lista.length; i++) {
      var v = lista[i];
      ids.push(v.id);
      var li = el(doc, 'li', {});
      li.appendChild(el(doc, 'b', {}, testoAndamento(v)));
      li.appendChild(el(doc, 'span', {}, taglia(soloTesto(v.carta.f), 96)));
      var base = INTERVALLI[Math.max(1, Math.min(SCATOLA_MAX, v.b))];
      var eff = giorniEffettivi(v.b, v.tasso);
      /* Il confronto «X invece di Y» è il punto: rende visibile che il
         richiamo è stato anticipato, e di quanto. Ma vale SOLO dove un
         intervallo c'è (scatole 3-5); nelle scatole basse — dove stanno
         quasi tutte le bestie nere — il richiamo è il rientro in sessione,
         e si dice quello. */
      if (modulabile(v.b) && eff < base - 0.05) {
        li.appendChild(el(doc, 'em', {},
          'richiamo anticipato: torna fra ' + giorniTesto(eff) + ' invece di ' + giorniTesto(base)));
      } else {
        li.appendChild(el(doc, 'em', {},
          'in ogni sessione torna fino a ' + presentazioniMax(v.tasso) + ' volte'));
      }
      ul.appendChild(li);
    }
    contenitore.appendChild(ul);

    var az = el(doc, 'div', { 'class': 'fc-azioni' });
    var b = el(doc, 'button', { type: 'button', 'class': 'fc-btn fc-btn-forte' },
      'Fanne un mazzo mirato (' + ids.length + (ids.length === 1 ? ' carta)' : ' carte)'));
    b.addEventListener('click', function () {
      self.soloQuesti = ids;
      self.ignoraScadenze = true;      // il mazzo mirato si studia ORA, scadenze o no
      self.nuovaSessione({ fuoco: true });
    });
    az.appendChild(b);
    contenitore.appendChild(az);
    return true;
  };

  App.prototype.disegnaFine = function () {
    var doc = this.doc, n = this.nodi, self = this;
    n.giudizio.hidden = true;
    n.hint.hidden = true;
    n.chiudi.hidden = true;
    svuota(n.zona);

    var sapute = 0, daRipassare = 0, sbagliate = [], k;
    for (k in this.fatte) if (this.fatte.hasOwnProperty(k)) {
      if (this.fatte[k] === 'ok') sapute++;
      else { daRipassare++; sbagliate.push(k); }
    }

    var p = el(doc, 'div', { 'class': 'fc-pannello', tabindex: '-1' });

    if (!this.totaleSessione && this.avvioBestie && !this.bestieTrovate) {
      /* «Bestie nere» a mazzo vuoto NON è «nessuna carta con questi filtri»:
         le carte ci sono, è il tuo storico a non avere ancora errori. Dirlo
         con l'altro messaggio manderebbe l'utente ad allargare filtri che non
         c'entrano niente — il vuoto muto che questo progetto continua a pagare,
         in versione «vuoto spiegato male». */
      p.appendChild(el(doc, 'h3', {}, 'Nessuna bestia nera, per ora'));
      p.appendChild(el(doc, 'p', {},
        'Qui finiscono le carte che hai sbagliato almeno una volta: sono ' +
        (this.mazzo.carte.length === 1 ? '1 carta' : this.mazzo.carte.length + ' carte') +
        ' in questa selezione, ma nessuna ha ancora un errore a suo carico. ' +
        'Studia un giro normale e torna qui: l\'elenco si riempie da solo.'));
      var azB = el(doc, 'div', { 'class': 'fc-azioni' });
      var tutte = el(doc, 'button', { type: 'button', 'class': 'fc-btn fc-btn-forte' },
        'Studia tutta la selezione');
      tutte.addEventListener('click', function () {
        self.avvioBestie = false;
        self.soloQuesti = null;
        self.ignoraScadenze = true;
        self.nuovaSessione({ fuoco: true });
      });
      azB.appendChild(tutte);
      p.appendChild(azB);
      n.zona.appendChild(p);
      this.aggiornaBarra();
      return;
    }

    if (!this.totaleSessione) {
      /* niente in coda: o i filtri sono troppo stretti, o hai già ripassato tutto */
      p.appendChild(el(doc, 'h3', {}, this.riposo ? 'Per oggi hai finito' : 'Nessuna carta con questi filtri'));
      var msg = this.riposo
        ? this.riposo + ' carte sono in riposo: il ripasso funziona se lo lasci respirare. Prossimo giro ' +
        (this.prossima ? quandoTesto(this.prossima, Date.now()) : 'a breve') + '.'
        : 'Allarga i filtri (difficoltà, argomento, ricerca) per rimettere carte in coda.';
      p.appendChild(el(doc, 'p', {}, msg));
      var az0 = el(doc, 'div', { 'class': 'fc-azioni' });
      if (this.riposo) {
        var forza = el(doc, 'button', { type: 'button', 'class': 'fc-btn fc-btn-forte' }, 'Ripassa comunque tutto');
        forza.addEventListener('click', function () {
          self.ignoraScadenze = true; self.nuovaSessione({ fuoco: true });
        });
        az0.appendChild(forza);
      }
      if (this.filtri.tag || this.filtri.cerca) {
        var pulisci = el(doc, 'button', { type: 'button', 'class': 'fc-btn' }, 'Togli i filtri');
        pulisci.addEventListener('click', function () {
          self.filtri.tag = ''; self.filtri.cerca = ''; self.filtri.diff = {};
          n.selTag.value = ''; n.cerca.value = '';
          for (var i = 0; i < n.chips.length; i++) n.chips[i].setAttribute('aria-pressed', 'false');
          self.nuovaSessione({ fuoco: true });
        });
        az0.appendChild(pulisci);
      }
      p.appendChild(az0);
      /* Anche qui: «per oggi hai finito» è il momento in cui il mazzo
         mirato serve di più. */
      this.aggiungiBestie(p, 5);
      n.zona.appendChild(p);
      this.aggiornaBarra();
      return;
    }

    var durata = this.t0 ? Date.now() - this.t0 : 0;
    /* Una sessione chiusa senza rispondere a niente non è una sessione:
       nello storico farebbe solo rumore. */
    if (this.risposte) {
      this.stato.storia.push({ t: Date.now(), sapute: sapute, ripasso: daRipassare, durata: durata });
      if (this.stato.storia.length > 20) this.stato.storia = this.stato.storia.slice(-20);
      scrivi(this.chiave, this.stato);
    }

    p.appendChild(el(doc, 'h3', {}, 'Sessione finita'));
    var cifre = el(doc, 'div', { 'class': 'fc-cifre' });
    cifre.appendChild(cifra(doc, String(sapute), 'sapute'));
    cifre.appendChild(cifra(doc, String(daRipassare), 'da ripassare'));
    cifre.appendChild(cifra(doc, String(this.risposte), 'risposte date'));
    cifre.appendChild(cifra(doc, mmss(durata), 'tempo'));
    p.appendChild(cifre);

    /* distribuzione nelle 5 scatole, su TUTTO il mazzo */
    var dist = [0, 0, 0, 0, 0], maiViste = 0, i;
    for (i = 0; i < this.mazzo.carte.length; i++) {
      var st = statoCarta(this.stato, this.mazzo.carte[i].id);
      if (st.nuova) maiViste++; else dist[st.b - 1]++;
    }
    var max = 1;
    for (i = 0; i < 5; i++) if (dist[i] > max) max = dist[i];
    var barre = el(doc, 'div', { 'class': 'fc-scatole', role: 'img',
      'aria-label': 'Distribuzione nelle scatole: ' + dist.join(', ') + '; mai viste: ' + maiViste });
    for (i = 0; i < 5; i++) {
      var col = el(doc, 'div', {});
      var barra = el(doc, 'i', {});
      barra.style.height = Math.round(6 + (dist[i] / max) * 34) + 'px';
      col.appendChild(el(doc, 'span', {}, String(dist[i])));
      col.appendChild(barra);
      col.appendChild(el(doc, 'span', {}, 'sc.' + (i + 1)));
      barre.appendChild(col);
    }
    p.appendChild(barre);
    p.appendChild(el(doc, 'p', {}, 'Scatola 1 = da rivedere subito, scatola 5 = la sai davvero (ritorna fra ' +
      INTERVALLI[5] + ' giorni). Mai viste: ' + maiViste + '.'));

    /* Se la sessione è stata chiusa a metà, dirlo: il progresso è salvato
       carta per carta, quindi riprendere non perde niente. */
    var restanti = this.totaleSessione - (sapute + daRipassare);
    if (restanti > 0) {
      p.appendChild(el(doc, 'p', {}, 'Hai chiuso in anticipo: ' + restanti +
        (restanti === 1 ? ' carta è rimasta' : ' carte sono rimaste') +
        ' in coda per questa sessione. Il progresso è salvato: «Ricomincia il mazzo» le rimette in fila.'));
    }

    this.aggiungiBestie(p, 5);

    var az = el(doc, 'div', { 'class': 'fc-azioni' });
    if (sbagliate.length) {
      var rifai = el(doc, 'button', { type: 'button', 'class': 'fc-btn fc-btn-forte' },
        'Rivedi le ' + sbagliate.length + ' da ripassare');
      rifai.addEventListener('click', function () {
        self.soloQuesti = sbagliate; self.ignoraScadenze = true;
        self.nuovaSessione({ fuoco: true });
      });
      az.appendChild(rifai);
    }
    var ancora = el(doc, 'button', { type: 'button', 'class': 'fc-btn' }, 'Ricomincia il mazzo');
    ancora.addEventListener('click', function () {
      self.soloQuesti = null; self.ignoraScadenze = true;
      self.nuovaSessione({ fuoco: true });
    });
    az.appendChild(ancora);
    p.appendChild(az);

    n.zona.appendChild(p);
    this.aggiornaBarra();
    try { p.focus(); } catch (e) { }
  };

  function cifra(doc, valore, etichetta) {
    var d = el(doc, 'div', { 'class': 'fc-cifra' });
    d.appendChild(el(doc, 'b', {}, valore));
    d.appendChild(el(doc, 'span', {}, etichetta));
    return d;
  }

  /* azzeramento in due tempi: niente modale di sistema, ma nemmeno un
     click solo su un'azione distruttiva */
  App.prototype.azzera = function () {
    var b = this.nodi.azzera, self = this;
    if (b.getAttribute('data-conferma') !== '1') {
      b.setAttribute('data-conferma', '1');
      b.firstChild.nodeValue = 'Confermi? Azzera davvero';
      this.timerAzzera = setTimeout(function () {
        b.removeAttribute('data-conferma');
        b.firstChild.nodeValue = 'Azzera progressi';
      }, 6000);
      return;
    }
    if (this.timerAzzera) clearTimeout(this.timerAzzera);
    b.removeAttribute('data-conferma');
    b.firstChild.nodeValue = 'Azzera progressi';
    cancella(this.chiave);
    this.stato = statoVuoto();
    this.soloQuesti = null;
    this.nuovaSessione({ fuoco: true });
  };

  App.prototype.distruggi = function () {
    this.doc.removeEventListener('keydown', this.onKey, false);
    /* I timer vanno spenti insieme al motore: un giro o una ricerca in
       volo tornerebbero a disegnare dentro un DOM che non esiste più. */
    if (this.timerGiro) clearTimeout(this.timerGiro);
    if (this.timerCerca) clearTimeout(this.timerCerca);
    if (this.timerAzzera) clearTimeout(this.timerAzzera);
    var i = indiceIn(mounts, this);
    if (i >= 0) mounts.splice(i, 1);
    svuota(this.radice);
  };

  /* ---------------------------------------------------------------- *
   * 6. API pubblica + avvio automatico                                *
   * ---------------------------------------------------------------- */

  /* Lo SPORTELLO dei dati (assets/studio_fetch.js). L'attesa breve copre
     l'unico caso in cui potrebbe non esserci ancora: nella pagina-cancello di
     site_lock.py gli script vengono RICREATI a mano dopo la decifratura, e lì
     l'ordine d'esecuzione dipende dal browser. Scaduta l'attesa non si ripiega
     su `r.json()`: si dice che manca. */
  var ATTESA_SPORTELLO = 5000, PASSO_SPORTELLO = 25;

  function sportello() {
    var s = global.StudioFetch;
    return (s && typeof s.leggi === 'function') ? s : null;
  }

  function conSportello(cb) {
    var s = sportello();
    if (s) { cb(s); return; }
    if (!global.setTimeout) { cb(null); return; }
    var atteso = 0;
    (function riprova() {
      var t = sportello();
      if (t) { cb(t); return; }
      atteso += PASSO_SPORTELLO;
      if (atteso >= ATTESA_SPORTELLO) { cb(null); return; }
      global.setTimeout(riprova, PASSO_SPORTELLO);
    })();
  }

  function erroreIn(radice, testo) {
    var doc = radice.ownerDocument || global.document;
    iniettaCss(doc);
    svuota(radice);
    var s = el(doc, 'section', { 'class': 'fc' });
    var p = el(doc, 'div', { 'class': 'fc-pannello', role: 'alert' });
    p.appendChild(el(doc, 'h3', {}, 'Flashcards non disponibili'));
    p.appendChild(el(doc, 'p', {}, testo));
    s.appendChild(p);
    radice.appendChild(s);
  }

  function monta(radice, dati, opzioni) {
    if (typeof radice === 'string') radice = global.document.getElementById(radice);
    if (!radice) return null;
    opzioni = opzioni || {};

    if (dati) return new App(radice, dati, opzioni);

    /* 1) JSON già in pagina (demo, o pagina generata a build-time) */
    var idJson = radice.getAttribute('data-json');
    if (idJson) {
      var nodo = (radice.ownerDocument || global.document).getElementById(idJson);
      if (!nodo) { erroreIn(radice, 'Dati non trovati (data-json="' + idJson + '").'); return null; }
      try { return new App(radice, JSON.parse(nodo.textContent || nodo.innerText || '{}'), opzioni); }
      catch (e) { erroreIn(radice, 'I dati del mazzo non sono leggibili.'); return null; }
    }

    /* 2) JSON da file */
    var src = radice.getAttribute('data-src');
    if (!src) { erroreIn(radice, 'Manca l\'attributo data-src o data-json.'); return null; }
    opzioni.sorgente = src;

    if (!global.fetch) { erroreIn(radice, 'Il browser non supporta il caricamento dei dati.'); return null; }
    /* Una rete che FALLISCE la gestisce il .catch. Una rete che TACE (rete
       mobile che si pianta, captive portal) non la gestisce nessuno: senza
       timeout il contenitore resta vuoto per sempre, senza nemmeno un
       messaggio. Il timer chiude la partita e dice cosa fare. */
    var chiuso = false;
    var scadenza = setTimeout(function () {
      chiuso = true;
      erroreIn(radice, 'Il mazzo ci sta mettendo troppo a caricare. Controlla la connessione e ricarica la pagina.');
    }, 15000);
    /* Il mazzo NON si legge più con `r.json()`: sotto /studio i dati sono
       cifrati con la stessa chiave delle pagine, e l'unico che sa riaprirli è
       lo sportello (assets/studio_fetch.js). Se manca si DICE — un mazzo
       vuoto qui sarebbe identico a «nessuna carta per questo filtro». */
    conSportello(function (sf) {
      if (chiuso) return;
      if (!sf) {
        clearTimeout(scadenza);
        erroreIn(radice, 'Il modulo che apre i materiali (studio_fetch.js) non è ' +
          'stato caricato: ricarica la pagina.');
        return;
      }
      sf.leggi(src, { credentials: 'same-origin' })
        .then(function (d) {
          if (chiuso) return;
          clearTimeout(scadenza);
          new App(radice, d, opzioni);
        })
        .catch(function (err) {
          if (chiuso) return;
          clearTimeout(scadenza);
          /* `messaggio` arriva dallo sportello e dice QUALE guasto è (sessione
             non sbloccata, build ripubblicata, password sbagliata): è quello
             che il lettore deve leggere, non un generico «ricarica». */
          erroreIn(radice, (err && err.messaggio) ? err.messaggio
            : 'Non sono riuscito a caricare il mazzo. Ricarica la pagina.');
        });
    });
    return null;
  }

  function avvia() {
    var doc = global.document;
    if (!doc) return;
    var nodi = doc.querySelectorAll('#flashcard-app,[data-flashcards]');
    for (var i = 0; i < nodi.length; i++) {
      if (!nodi[i].getAttribute('data-fc-montato')) {
        nodi[i].setAttribute('data-fc-montato', '1');
        monta(nodi[i]);
      }
    }
  }

  /* Le bestie nere SENZA montare niente: l'hub deve poter dire «ne hai 23»
     accanto al pulsante, e disattivarlo quando sono zero, prima ancora che il
     motore esista. Stesse regole del motore (stessa chiave, stessi id globali):
     una seconda implementazione qui direbbe un numero e il motore un altro. */
  function bestie(dati, opzioni) {
    opzioni = opzioni || {};
    var esplicita = opzioni.chiave || '';
    var mazzo = normalizzaMazzo(dati, !!esplicita);
    var stato = caricaStato(chiaveMazzo(mazzo, opzioni.sorgente, esplicita));
    if (esplicita) travasaLegacy(stato, mazzo.carte);
    return bestieNere(mazzo.carte, stato, opzioni.quante || 0, 1);
  }

  var Flashcards = {
    monta: monta,
    avvia: avvia,
    bestie: bestie,
    CSS: CSS,
    /* superficie pura, senza DOM: serve ai test e a study_data.py per
       tenere allineate le regole di normalizzazione */
    _logica: {
      normalizzaDiff: normalizzaDiff,
      tagsDi: tagsDi,
      normalizzaCarta: normalizzaCarta,
      normalizzaMazzo: normalizzaMazzo,
      idGlobale: idGlobale,
      lezioneDi: lezioneDi,
      chiaveMazzo: chiaveMazzo,
      travasaLegacy: travasaLegacy,
      prossimaScatola: prossimaScatola,
      scadenzaDi: scadenzaDi,
      costruisciCoda: costruisciCoda,
      posizioneRientro: posizioneRientro,
      statoCarta: statoCarta,
      normalizzaStato: normalizzaStato,
      inlineMd: inlineMd,
      mescolaIn: mescolaIn,
      mmss: mmss,
      /* richiami proporzionali al tasso d'errore (SPEC §4) */
      tassoErrore: tassoErrore,
      phiDi: phiDi,
      giorniEffettivi: giorniEffettivi,
      modulabile: modulabile,
      rientriMaxDi: rientriMaxDi,
      presentazioniMax: presentazioniMax,
      fasciaTasso: fasciaTasso,
      perFasce: perFasce,
      bestieNere: bestieNere,
      testoAndamento: testoAndamento,
      soloTesto: soloTesto,
      INTERVALLI: INTERVALLI,
      SCATOLA_MAX: SCATOLA_MAX,
      RIENTRI_BASE: RIENTRI_BASE,
      RIENTRI_EXTRA: RIENTRI_EXTRA,
      RIENTRI_CAP: RIENTRI_CAP,
      FASCE_TASSO: FASCE_TASSO,
      K_RICHIAMO: K_RICHIAMO,
      SOGLIA_PRIOR: SOGLIA_PRIOR,
      GIORNI_MIN: GIORNI_MIN,
      GIORNO: GIORNO
    }
  };

  global.Flashcards = Flashcards;
  if (typeof module !== 'undefined' && module.exports) module.exports = Flashcards;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', avvia, false);
    } else {
      avvia();
    }
  }

})(typeof window !== 'undefined' ? window : this);
