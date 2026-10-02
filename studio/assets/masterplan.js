/* =====================================================================
   masterplan.js — IL PIANO DI STUDIO v2 (fetta S3v2 del lancio del 7/10)
   Vanilla JS, ZERO dipendenze, niente CDN, niente DOM. Compatibile ES5
   come gli altri motori (var/function, nessuna arrow, nessun template
   literal): gira identico nel browser e in node.

   COS'E'. Il quarto livello sopra scatole e flashcard: quando lo studente
   ha detto quando ha l'esame, quanto tempo ha e da quali materie parte,
   decide CHE COSA FARE OGGI. La specifica e' della lane pedagogy:
   `revisioni/masterplan_regole.md` v2 (i § citati accanto al codice sono
   i suoi) e `revisioni/masterplan_decisioni_v2.md` (R1-R8, C1-C4, L1-L14:
   le sigle accanto al codice sono le sue). Le frasi a schermo NON stanno
   qui: queste funzioni rendono DATI e CODICI, le parole le mette la home
   di /studio (fetta S4) dal modello di `revisioni/testi_studio.md` §4. In
   questa fetta il modulo non e' collegato al sito.

   SEI SCELTE ASPETTANO L'UTENTE (R1, R2, R4, R7, C1, C3): stanno in testa,
   §0, una costante con nome ciascuna (R2 ne ha due: i turni di solo ripasso
   e, dalla revisione, dove vanno i recuperi di una materia finita; C1 ha il
   suo minimo). Il valore di oggi e' la PROPOSTA; l'alternativa scritta
   accanto si accende cambiando il valore e ha un suo test.
   `Masterplan.SCELTE` dice quali valori sono accesi.

   PURO. Stesso ingresso, stessa uscita. Gli argomenti non si toccano.
   Niente orologio (in questo file non c'e' nessun `Date`: le date sono
   giorni di calendario contati a mano, quindi il cambio dell'ora legale
   del 25/10/2026 non sposta niente), niente Math.random, niente
   localStorage, niente rete. `oggi` arriva sempre da fuori, 'AAAA-MM-GG'.

   API — global.Masterplan (e module.exports in node)
     durata(parte, mole, ritmi)                -> {capisci, fai, richiama, nonCascarci}
     pianifica(cfg, mole, stato, oggi)         -> piano
     dose(piano, stato, oggi)                  -> [voce]
     riadatta(piano, stato, oggi[, cfg, mole]) -> piano nuovo
     daSalvare(piano)                          -> la forma da salvare sul server
     RITMI (congelato: le soglie), SCELTE (congelato: le sei scelte), VERSIONE

   SALVARE IL PIANO. Il piano intero non sta nel tetto del server
     (KV_VALORE_MAX di account/worker.js). Si salva `daSalvare(piano)`: il
     piano senza i giorni, tranne quelli da `generato` per GIORNI_SALVATI
     giorni; `riadatta` lo accetta com'e'. Se il piano salvato non ha la
     lista di oggi, cio' che e' gia' fatto oggi viene dallo stato (FATTO
     OGGI, approssimato e dichiarato accanto al codice). Il minimo che
     riadatta accetta senza mole e' questo: cfg, inizio e riservaDa da soli
     non bastano (manca la mole, a meno di passarla come quinto argomento).

   INGRESSI
     cfg   {appello:'AAAA-MM-GG', materie:[{nome, priorita}], oreAlGiorno,
            giorni:[lun, mar, mer, gio, ven, sab, dom] (bool), ripassoFinale}
           `nome` = l'id della materia del catalogo ('fisica', ...).
           `giorni` vuoto o tutto spento = tutti i giorni (§2, §6).
     mole  le parti del catalogo, un array — oppure {parti:[...]} oppure
           {lezioni:[...]} com'e' `data/index.json` — di
             {id:'s1f01-A'} oppure {slug:'s1f01', parte:'A'}, + {materia, ep}
           Ordine di catalogo = `ep` crescente e poi la parte (A prima di B);
           senza `ep`, l'ordine in cui arrivano. Le misure per parte possono
           stare nella stessa voce: `durata` non le usa ancora (§2).
     stato (forma decisa in S3, la produce studio_sync.js `perPiano`)
           {tappe:     {'<parte>': {capisci:T, fai:T, richiama:T, nonCascarci:T}},
            sbagliate: {'<parte>': {n, ultima, prima}},
            scatole:   {'<parte>': {box, ultimo}}}
           T = 'AAAA-MM-GG' (la tappa e' stata fatta quel giorno) oppure
               {fatto:'AAAA-MM-GG', esito:'so'|'incerto'|'no'} (l'ULTIMA volta)
           sbagliate: n = voci ancora da recuperare di quella parte (0 =
               niente), ultima = il giorno dell'ultima risposta sbagliata,
               prima (facoltativo, dalla revisione S3v2) = il giorno della
               risposta sbagliata piu' VECCHIA ancora aperta: R5 vale per
               errore (un errore nuovo oggi non rimanda a domani quelli
               vecchi, e non disfa la voce recuperata oggi). Senza `prima`
               vale `ultima`, come prima.
           scatole:   box = indice in RITMI.intervalli, ultimo = giorno
               dell'ultimo ripasso: il prossimo cade a ultimo + intervalli[box]
           Una parte che non e' nel catalogo si ignora (§1: gli argomenti
           liberi delle scatole restano al calendario delle scatole).
           Assente = chiave che manca oppure null. Un valore che C'E' ma non
           si sa leggere (una data con l'ora, un numero, `true`, un esito
           che non esiste) non diventa «assente» in silenzio: il piano lo
           dichiara in `scartati`. Le date sono il giorno LOCALE dello
           studente (Europe/Rome), 'AAAA-MM-GG': non toISOString().slice(0,
           10), che e' UTC e fra mezzanotte e l'una (le due d'estate) dice
           ancora ieri.
           L14 della specifica: `scatole` tiene il box per EPISODIO e il
           piano ragiona per PARTE; l'adattatore (`perPiano`) da' a ogni
           parte il box della sua lezione. Resta un ingresso da verificare
           quando S4 lo collega, non qualcosa che questo modulo risolve.

   USCITA
     piano {v:2, generato:oggi, inizio, cfg, mole, riservaDa, turno, mezza, giorni, avviso, scartati}
       giorni    {'AAAA-MM-GG': [voce]} per OGNI giorno da oggi al giorno
                 prima dell'esame; [] = quel giorno non c'e' niente
       voce      {tipo, materia, parte, tappa, minuti}
                 tipo = 'lezione-nuova' | 'ripasso' | 'sbagliate' | 'simulazione'
                 ('simulazione' non esce ancora: testi_studio §4)
       riservaDa il primo giorno della riserva di ripasso finale (R6): lo
                 fissa la nascita del piano o un cambio di cfg, `riadatta`
                 lo riusa. = appello quando la riserva e' zero. null se il
                 piano non ha giorni (cfg non valida, esame passato).
       turno     a rotazione, la materia di turno il giorno `generato` (null
                 negli altri modi o se quel giorno non si studia): `riadatta`
                 lo ritrova dopo il primo gesto, anche quando quel giorno ha
                 solo recuperi di una materia fuori rotazione.
       mezza     con l'alternativa di C1, la parte a meta' scelta alla nascita
                 (o all'ultimo cambio di cfg), che `riadatta` rispetta
                 finche' ha tappe da fare; null altrimenti.
       inizio, cfg, mole: cio' che serve a `riadatta(piano, stato, oggi)`
                 per ricalcolare senza che glieli si ripassi (L13): l'ancora
                 della rotazione, la cfg normalizzata, il catalogo usato in
                 ordine ([{id, slug, materia, ep}], che vale di nuovo come
                 `mole`).
       avviso    null (tutto entra) oppure UN oggetto, mai una frase (R3).
                 Se ne valgono piu' d'uno esce il primo di quest'elenco:
         {codice:'cfg-non-valida', campo}. Un esame oltre il tetto di C3:
            {codice:'cfg-non-valida', campo:'appello', motivo:'oltre-orizzonte',
             giorni, massimo} (una data che non esiste resta senza motivo).
            R8: sotto la tappa piu' lunga {codice:'cfg-non-valida',
             campo:'oreAlGiorno', motivo:'insufficiente', minuti, minimo}
         {codice:'esame-passato', appello}
         {codice:'non-entra', materia, lezioni_incluse, lezioni_totali,
          lezioni_a_meta, riserva_azzerata, riserva_stretta, ritardo:[...],
          materie:[{materia, lezioni_incluse, lezioni_totali, lezioni_a_meta}]}
          (+ parte_a_meta con l'alternativa di C1). Le lezioni non ancora
          iniziate sono lezioni_totali - lezioni_incluse - lezioni_a_meta.
          `ritardo` e' la lista di R4 qui sotto ([] se l'arretrato non fa
          slittare la partenza oltre la soglia): il non-entra passa davanti,
          ma il ritardo resta detto.
         {codice:'ritardo-partenza', materia, giorni, primo_giorno, materie:
          [{materia, giorni, primo_giorno, senza_arretrato}]}          (R4)
         {codice:'recuperato', era, materia, materie:[nome]}  (solo con
          l'alternativa di R1)
         {codice:'riserva-azzerata', giorni_totali, ripasso_finale}
         {codice:'riserva-stretta', giorni_riserva, ripasso_finale}   (C1)
         {codice:'esame-lontano', giorni, soglia}  (solo con l'alternativa
          di C3)
       scartati  [{campo, parte, voce}]: cio' che c'era e non si e' saputo
                 leggere, [] se niente.
                   campo 'tappe'|'sbagliate'|'scatole': parte = l'id (null =
                     il campo intero non e' un oggetto), voce = la tappa, 'n',
                     'ultima', 'prima', 'box' o 'ultimo' (null = la voce intera);
                   campo 'stato': lo stato non e' un oggetto (parte e voce null);
                   campo 'piano' (lo mette riadatta, parte null): voce =
                     'inizio'|'generato'|'giorni'|'riservaDa', null = il piano
                     non e' un oggetto.
                 Solo parti del catalogo, in ordine di catalogo. E' un canale
                 per chi integra (S2/S4), non una frase per lo studente.
                 `dose` non ha un canale suo: lo dice il piano, che
                 `riadatta` ricalcola a ogni cambio di stato (§2).

   PROVE: tests/test_masterplan.mjs (i dieci esempi del §7 coi numeri
   esatti, le sei scelte con la proposta E l'alternativa, i casi limite del
   §6, le proprieta' su configurazioni generate, le mutazioni del modulo),
   lanciato da tests/test_masterplan.py.
   ===================================================================== */

(function (global) {
  'use strict';

  /* ================================================================== *
   * 0. LE SEI SCELTE DI PRODOTTO CHE ASPETTANO L'UTENTE                  *
   *    (masterplan_decisioni_v2.md, voci «▶ decide l'utente»). Il valore *
   *    di oggi e' la PROPOSTA di pedagogy; l'ALTERNATIVA scritta accanto *
   *    si accende cambiando il valore, mai il codice sotto. Un valore    *
   *    che non e' ne' l'una ne' l'altra ferma il modulo al caricamento.  *
   * ================================================================== */

  /* R1 — l'avviso quando lo studente recupera da solo, a cfg invariata.
     'si-spegne' (proposta): `riadatta` ricalcola l'avviso a OGNI chiamata;
       se il residuo torna a entrare, l'avviso sparisce da solo.
     'recuperato' (alternativa): l'avviso resta finche' la cfg non cambia,
       ma diventa {codice:'recuperato', era:<l'avviso di prima>} invece di
       sparire in silenzio.
     Vale per i due avvisi che lo studente puo' spegnere recuperando:
     'non-entra' e 'ritardo-partenza' (R4). Esempio 10.
     LA SCELTA SI PORTA DIETRO UNA FRASE (revisione S3v2): testi_studio.md §4
     dice che, recuperato, compare «Sei tornato in pari su {materia}». Un
     codice e una materia da cui accenderla ci sono solo con l'alternativa
     ('recuperato'); con la proposta l'avviso diventa null. All'utente vanno
     insieme: o la frase si toglie, o si accende l'alternativa, o S4 la
     ricava confrontando l'avviso di prima col nuovo (non e' in questo
     modulo). */
  var R1_AVVISO_DOPO_IL_RECUPERO = 'si-spegne';

  /* R2 — a rotazione, quanti turni di SOLO RIPASSO tiene ancora una
     materia che ha finito il nuovo, prima di uscire dalla rotazione.
     0 (proposta): esce subito; il suo turno va alle materie ancora attive.
     un intero > 0 (alternativa, «un tetto massimo di giorni consecutivi di
       solo ripasso»): tiene quei turni, poi esce. Il numero lo sceglie chi
       sceglie l'alternativa; il test la prova con 2. I turni gia' passati
       li conta `riadatta` dai giorni salvati del piano: un ricalcolo non
       ne regala altri. Esempio 8.
     R2_RECUPERI_DOPO_LA_FINE — che cosa succede ai recuperi DOVUTI (sbagliate,
     «no», «incerto», un ripasso delle scatole) di una materia uscita dalla
     rotazione, che il loro giorno non ce l'ha piu'. Una sotto-scelta di R2,
     da portare all'utente INSIEME a R2 (revisione S3v2: la specifica non lo
     dice, e una materia finita ha quasi sempre parti nelle scatole).
     'turno' (proposta della lane, la lettura gia' nel codice): la materia
       con un recupero dovuto riprende il suo turno per quel giorno.
     'in-testa' (alternativa, la forma che la revisione chiama coerente con
       R2): i recuperi della materia FINITA entrano in testa al giorno di chi
       e' di turno, dentro lo stesso tempo, senza prendersi il turno.
     MISURA (lo studente segue il piano giorno per giorno, Chimica finita
     con le 10 parti nelle scatole, Fisica 4 lezioni): 30' in due materie,
     Fisica chiude al giorno 38 con 'turno' e 39 con 'in-testa'; 45' in tre,
     30 e 32. Senza ripassi dovuti chiuderebbe al 24: i ripassi il loro
     tempo lo prendono comunque, e 15' in testa a un giorno corto lasciano
     minuti dove Fai (20') non entra. */
  var R2_TURNI_DI_SOLO_RIPASSO = 0;
  var R2_RECUPERI_DOPO_LA_FINE = 'turno';

  /* R4 — l'avviso «ritardo di partenza»: quanti GIORNI DI STUDIO puo'
     slittare il primo giorno di materiale nuovo di una materia per colpa
     dell'arretrato di `sbagliate`, prima che il piano lo dica anche se
     tutto entra comunque.
     3 (proposta della lane: la specifica dice «una soglia dichiarata» e
       non dice quale; «forte arretrato» = piu' di tre giorni di studio).
     null (alternativa): nessun avviso, limite noto dichiarato.
     Il ritardo si misura contro lo stesso piano SENZA le sbagliate (stessa
     riserva, stesso tutto): e' la sola lettura che isola la causa. */
  var R4_SOGLIA_RITARDO = 3;

  /* R7 — i minuti che avanzano quando un recupero non lascia entrare
     intera la parte del giorno (prima soglia, §4.2).
     'tappe' (proposta): le tappe di quella parte, in ordine, finche'
       entrano (Capisci, poi le altre); la parte si chiude il giorno dopo,
       prima di tutto il resto. Se non entra nemmeno la prima tappa, quei
       minuti vanno al ripasso di riempimento.
     'ripasso' (alternativa): sempre ripasso di riempimento; la parte
       scorre intera al giorno dopo.
     Letture (vanno confermate): (a) vale per OGNI voce di recupero o di
     ripasso dovuta quel giorno, anche il ripasso delle scatole: la regola
     nomina quelli da errore (sbagliate, «no», «incerto»), ma dopo che lo
     studente ha fatto la voce il piano non sa piu' da dove veniva (una
     Richiama rifatta e' uguale nei due casi), e con la lettura stretta il
     resto della dose di oggi SPARIREBBE al primo ricalcolo; (b) vale solo
     per la PRIMA parte del giorno: se la parte entra intera, cio' che
     avanza dopo resta vuoto (L6) — e' quello che rende 75' la variante
     «incerto» del giorno 11 dell'esempio 6, e non 90. */
  var R7_MINUTI_DOPO_UN_RECUPERO = 'tappe';

  /* C1 — se con la riserva piena non entra NESSUNA parte intera nel
     piano (tutte le materie insieme), pur essendoci giorni di studio.
     'stringi' (proposta): la riserva scende di un giorno alla volta, mai
       sotto C1_RISERVA_MINIMA, finche' entra una parte intera; se non
       basta nemmeno il minimo il piano si arrende, la riserva torna
       quella scelta e l'avviso lo dice. Solo alla nascita del piano o a
       un cambio di cfg (R6). Esempio 7.
     'mezza-parte' (alternativa): la riserva resta, ed entra UNA parte a
       meta' (la prima da fare della materia che viene prima).
     C1_RISERVA_MINIMA: «un minimo dichiarato, mai a zero»; la specifica
     non dice il numero, lo script degli esempi usa 1. */
  var C1_SE_NON_ENTRA_NIENTE = 'stringi';
  var C1_RISERVA_MINIMA = 1;

  /* C3 — il tetto all'orizzonte fra oggi e l'esame.
     'tetto' (proposta): oltre ORIZZONTE_MAX giorni la cfg e' rifiutata
       (cfg-non-valida «appello»).
     'avviso' (alternativa): nessun tetto di prodotto; oltre
       ORIZZONTE_AVVISO giorni il piano si fa e porta un avviso
       informativo. Resta solo la guardia TECNICA ORIZZONTE_TECNICO: senza,
       un anno scritto male (2207 per 2027) fa un piano di 65.834 giorni,
       2 secondi e 36 MB, e con 9999 il piano non si serializza piu'. */
  var C3_ORIZZONTE = 'tetto';

  /* ================================================================== *
   * 0-bis. LE SOGLIE. Tutte qui, con nome: se cambia un numero si       *
   *        cambia QUI, mai sotto.                                       *
   * ================================================================== */

  /* §3 il ritmo: i minuti di ogni tappa (fissi, uguali per ogni parte). */
  var MINUTI_CAPISCI = 15;
  var MINUTI_FAI = 20;
  var MINUTI_RICHIAMA = 15;
  var MINUTI_NON_CASCARCI = 10;

  /* §3: una voce `ripasso` e' lo stesso gesto di Richiama (recupero a
     memoria, non rilettura), quindi dura come Richiama; anche una tappa
     riproposta per «no» o «incerto» (C2). */
  var MINUTI_RIPASSO = 15;
  /* §5: una voce `sbagliate` e' una Richiama da 15 minuti. */
  var MINUTI_SBAGLIATE = 15;

  /* §1/§5 «so»: gli intervalli del percorso LUNGO delle scatole. La fonte
     unica e' `SCATOLE_PERCORSI` in site_build.py; il modulo non ha
     dipendenze e ne porta una COPIA, legata alla fonte da un canary in
     tests/test_masterplan.mjs (se la fonte cambia, il test va rosso). */
  var INTERVALLI_SCATOLE = [1, 3, 7, 15, 30, 60];

  /* §5: dopo quanti giorni si ripropone una tappa. */
  var RINVIO_NO = 1;
  var RINVIO_INCERTO = 3;
  /* Sono il PRIMO giorno possibile, non il giorno vero: la tappa torna il
     primo giorno utile DELLA MATERIA da li' (a rotazione il suo turno, con i
     giorni della settimana il prossimo giorno di studio). Il giorno vero e'
     quello in cui la voce sta in `giorni` del piano. Le frasi «te la
     riproponiamo domani» e «fra tre giorni» di testi_studio.md §4 non sono
     vere in generale: la scelta del testo e' dell'utente (revisione S3v2), e
     finche' non c'e' S4 non deve dire «domani». */

  /* §2: i valori di cfg quando mancano. */
  var RIPASSO_FINALE_BASE = 7;
  var PRIORITA_BASE = 1;
  /* Guardia d'ingresso, non pedagogica: la rotazione pesata gira su un
     ciclo lungo quanto la somma delle priorita' (l'interfaccia chiede
     «normale o doppia», cioe' 1 o 2). */
  var PRIORITA_MAX = 9;
  /* C3: i tre orizzonti. 731 = due anni di calendario da oggi anche con un
     29 febbraio in mezzo (proposta); 365 = «es. un anno» della specifica
     (alternativa); 3653 = dieci anni, la guardia tecnica dell'alternativa. */
  var ORIZZONTE_MAX = 731;
  var ORIZZONTE_AVVISO = 365;
  var ORIZZONTE_TECNICO = 3653;

  /* §2: l'ordine delle tappe dentro una parte (mai fuori ordine). */
  var TAPPE = ['capisci', 'fai', 'richiama', 'nonCascarci'];

  /* LA FORMA DA SALVARE (`daSalvare`): quanti giorni del piano, dal giorno in
     cui e' nato, si tengono. `riadatta` sa che cosa e' gia' fatto oggi dalla
     lista di oggi del piano salvato; oltre questi giorni lo ricava dallo stato
     (FATTO OGGI). Una settimana: chi apre /studio almeno una volta a
     settimana ha sempre la lista esatta. */
  var GIORNI_SALVATI = 7;

  /* §3, derivate dalle righe sopra e mai scritte a mano. PARTE_MIN = una
     parte intera (60). TAPPA_MIN = la tappa piu' LUNGA, Fai (20): sotto
     questa quota una parte a tappe resterebbe ferma a meta' per sempre, e
     sotto questo tempo al giorno la cfg non e' valida (R8). */
  var PARTE_MIN = MINUTI_CAPISCI + MINUTI_FAI + MINUTI_RICHIAMA + MINUTI_NON_CASCARCI;
  var TAPPA_MIN = Math.max(MINUTI_CAPISCI, MINUTI_FAI, MINUTI_RICHIAMA, MINUTI_NON_CASCARCI);

  /* ------------------------------------------------------------------ *
   * LE LETTURE. La v2 conferma le letture della v1 (decisioni L1-L12)   *
   * e ne chiude due (L9 superata da R1, L13 = il piano porta cfg e      *
   * mole). Restano dell'autore, e vanno confermate:                    *
   *                                                                    *
   * ANCORA la rotazione (§4.2 terza soglia) e' ancorata a piano.inizio, *
   *    che riadatta conserva: il turno di un giorno = la sequenza pesata *
   *    delle materie ATTIVE quel giorno (R2), letta al numero di giorni *
   *    di studio da `inizio`. Ripartendo da oggi a ogni ricalcolo       *
   *    toccherebbe sempre alla stessa materia.                          *
   * TUTTE quando nessuna materia e' attiva (hanno finito tutte, o si e' *
   *    nella riserva) la rotazione torna su tutte: il ripasso si fa a   *
   *    turno anche li'.                                                 *
   * MASSIMO (§4.3) «il maggior numero di parti intere»: a rotazione una *
   *    materia che esce libera turni, quindi dopo aver tolto cio' che   *
   *    non si chiude si prova a RIMETTERE una parte alla volta, prima    *
   *    la materia con piu' priorita' (a pari, l'ordine di cfg: L10).     *
   * RITARDO (R4) i giorni si contano in giorni di STUDIO (quelli di      *
   *    `giorni`), non di calendario.                                    *
   * GIORNI (§7, esempi 7 e 10) «2 lezioni mancanti» dell'esempio 7 =    *
   *    le lezioni NON INIZIATE (0 intere su 3, 1 a meta', 2 da fare); e  *
   *    «al giorno 7» dell'esempio 10 = oggi + 7, perche' i conti dicono *
   *    «14 giorni alla scadenza» su 21.                                 *
   * OGGI (L8) resta a registro, e toglie il suo tempo a oggi, solo cio' *
   *    che e' stato fatto OGGI: una lezione fatta in anticipo un altro  *
   *    giorno quel tempo l'ha gia' preso (senza, l'esempio 10 non ha il  *
   *    suo giorno di margine). La giornata di oggi non cambia mentre lo  *
   *    studente la fa: a rotazione il turno di oggi resta della materia *
   *    su cui ha gia' lavorato oggi.                                    *
   * UNA VOCE (§2, §5) Richiama rifatta e ripasso nelle scatole sono lo   *
   *    stesso gesto (come per `dose`): un ripasso dovuto fatto nell'uno  *
   *    o nell'altro modo non si rimette una seconda volta.              *
   * ------------------------------------------------------------------ */

  var VERSIONE = 2;
  var TIPI = { 'lezione-nuova': true, ripasso: true, sbagliate: true, simulazione: true };
  var ESITI = { so: true, incerto: true, no: true };

  /* Gli avvisi che lo studente spegne recuperando (R1) e quelli solo
     informativi (non coprono un 'recuperato'). */
  var DA_RECUPERARE = { 'non-entra': true, 'ritardo-partenza': true, recuperato: true };
  var INFORMATIVI = { 'riserva-azzerata': true, 'riserva-stretta': true, 'esame-lontano': true };

  function scelteValide() {
    function no(nome, ammessi) {
      throw new Error('Masterplan: ' + nome + ' vale solo ' + ammessi);
    }
    if (R1_AVVISO_DOPO_IL_RECUPERO !== 'si-spegne' && R1_AVVISO_DOPO_IL_RECUPERO !== 'recuperato') {
      no('R1_AVVISO_DOPO_IL_RECUPERO', "'si-spegne' o 'recuperato'");
    }
    if (!(R2_TURNI_DI_SOLO_RIPASSO >= 0 && Math.floor(R2_TURNI_DI_SOLO_RIPASSO) === R2_TURNI_DI_SOLO_RIPASSO)) {
      no('R2_TURNI_DI_SOLO_RIPASSO', 'un intero >= 0');
    }
    if (R2_RECUPERI_DOPO_LA_FINE !== 'turno' && R2_RECUPERI_DOPO_LA_FINE !== 'in-testa') {
      no('R2_RECUPERI_DOPO_LA_FINE', "'turno' o 'in-testa'");
    }
    if (R4_SOGLIA_RITARDO !== null && !(R4_SOGLIA_RITARDO >= 0 && Math.floor(R4_SOGLIA_RITARDO) === R4_SOGLIA_RITARDO)) {
      no('R4_SOGLIA_RITARDO', 'un intero >= 0 o null');
    }
    if (R7_MINUTI_DOPO_UN_RECUPERO !== 'tappe' && R7_MINUTI_DOPO_UN_RECUPERO !== 'ripasso') {
      no('R7_MINUTI_DOPO_UN_RECUPERO', "'tappe' o 'ripasso'");
    }
    if (C1_SE_NON_ENTRA_NIENTE !== 'stringi' && C1_SE_NON_ENTRA_NIENTE !== 'mezza-parte') {
      no('C1_SE_NON_ENTRA_NIENTE', "'stringi' o 'mezza-parte'");
    }
    if (!(C1_RISERVA_MINIMA >= 1 && Math.floor(C1_RISERVA_MINIMA) === C1_RISERVA_MINIMA)) {
      no('C1_RISERVA_MINIMA', 'un intero >= 1 (mai a zero)');
    }
    if (C3_ORIZZONTE !== 'tetto' && C3_ORIZZONTE !== 'avviso') no('C3_ORIZZONTE', "'tetto' o 'avviso'");
  }
  scelteValide();

  /* ================================================================== *
   * 1. DATE: giorni di calendario contati a mano (algoritmo di Howard   *
   *    Hinnant, «days from civil»). 0 = 1970-01-01. Nessun Date.        *
   * ================================================================== */

  var RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  var GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function bisestile(a) { return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0; }
  function giorniDelMese(a, m) { return m === 2 && bisestile(a) ? 29 : GIORNI_MESE[m - 1]; }

  function daCivile(a, m, g) {
    a -= m <= 2 ? 1 : 0;
    var era = Math.floor(a / 400);
    var yoe = a - era * 400;
    var doy = Math.floor((153 * ((m + 9) % 12) + 2) / 5) + g - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  /* numero del giorno -> 'AAAA-MM-GG' */
  function dataDa(z) {
    z += 719468;
    var era = Math.floor(z / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) -
                          Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var g = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    var a = yoe + era * 400 + (m <= 2 ? 1 : 0);
    return pad(a, 4) + '-' + pad(m, 2) + '-' + pad(g, 2);
  }

  /* 'AAAA-MM-GG' -> numero del giorno, null se non e' una data vera */
  function giornoDa(s) {
    if (typeof s !== 'string') return null;
    var p = RE_DATA.exec(s);
    if (!p) return null;
    var a = Number(p[1]), m = Number(p[2]), g = Number(p[3]);
    if (m < 1 || m > 12 || g < 1 || g > giorniDelMese(a, m)) return null;
    return daCivile(a, m, g);
  }

  /* 0 = lunedi' ... 6 = domenica (come DOW in scatole.js); 1970-01-01 e' giovedi' */
  function giornoSett(z) { return ((z % 7) + 7 + 3) % 7; }

  function giornoObbligatorio(s, nome) {
    var z = giornoDa(s);
    if (z === null) throw new TypeError('Masterplan: ' + nome + " dev'essere una data AAAA-MM-GG valida");
    return z;
  }

  /* ================================================================== *
   * 2. INGRESSI: si leggono, si copiano, non si toccano                  *
   * ================================================================== */

  function eArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function eOggetto(x) { return !!x && typeof x === 'object' && !eArray(x); }
  function proprio(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function nomeMateria(x) { return typeof x === 'string' ? x.replace(/^\s+|\s+$/g, '').toLowerCase() : ''; }

  /* copia profonda di un valore JSON (per restituire, mai per condividere) */
  function clona(x) {
    if (eArray(x)) {
      var a = [];
      for (var i = 0; i < x.length; i++) a.push(clona(x[i]));
      return a;
    }
    if (eOggetto(x)) {
      var o = {};
      for (var k in x) if (proprio(x, k)) o[k] = clona(x[k]);
      return o;
    }
    return x;
  }

  function normCfg(c, oggiN) {
    var out = { errore: null, dettaglio: null, appelloN: null, budget: 0, materie: [], giorni: [],
                ripassoFinale: RIPASSO_FINALE_BASE, pubblica: null };
    var ok = eOggetto(c);
    var src = ok ? c : {};
    if (!ok) out.errore = 'cfg';

    out.appelloN = giornoDa(src.appello);
    if (out.appelloN === null && !out.errore) out.errore = 'appello';
    /* C3: un esame oltre l'orizzonte e' una data scritta male, non un piano da
       contare. Il motivo, come R8: chi scrive la frase distingue una data
       troppo lontana (i giorni e il massimo) da una data che non esiste */
    var tetto = C3_ORIZZONTE === 'tetto' ? ORIZZONTE_MAX : ORIZZONTE_TECNICO;
    if (out.appelloN !== null && out.appelloN - oggiN > tetto && !out.errore) {
      out.errore = 'appello';
      out.dettaglio = { motivo: 'oltre-orizzonte', giorni: out.appelloN - oggiN, massimo: tetto };
    }

    var ore = typeof src.oreAlGiorno === 'number' ? src.oreAlGiorno : NaN;
    out.budget = ore > 0 && isFinite(ore) ? Math.round(ore * 60) : 0;
    if (out.budget < 1 && !out.errore) out.errore = 'oreAlGiorno';
    /* R8: sotto la tappa piu' lunga non entra nemmeno un passo, con nessuna
       divisione: la cfg non e' valida, e l'errore e' suo (non un piano vuoto) */
    if (out.budget >= 1 && out.budget < TAPPA_MIN && !out.errore) {
      out.errore = 'oreAlGiorno';
      out.dettaglio = { motivo: 'insufficiente', minuti: out.budget, minimo: TAPPA_MIN };
    }

    var visti = {}, lista = eArray(src.materie) ? src.materie : [];
    for (var i = 0; i < lista.length; i++) {
      var v = lista[i];
      var nome = nomeMateria(typeof v === 'string' ? v : (eOggetto(v) ? v.nome : null));
      if (!nome || visti[nome]) continue;
      visti[nome] = true;
      var p = eOggetto(v) ? Math.floor(Number(v.priorita)) : PRIORITA_BASE;
      if (!(p >= 1)) p = PRIORITA_BASE;
      if (p > PRIORITA_MAX) p = PRIORITA_MAX;
      out.materie.push({ nome: nome, priorita: p });
    }
    if (!out.materie.length && !out.errore) out.errore = 'materie';

    /* §2/§6: nessun giorno selezionato (o campo guasto) = tutti i giorni */
    var g = [], almeno = false;
    for (i = 0; i < 7; i++) {
      var on = eArray(src.giorni) && src.giorni.length === 7 && (src.giorni[i] === true || src.giorni[i] === 1);
      g.push(on);
      if (on) almeno = true;
    }
    if (!almeno) for (i = 0; i < 7; i++) g[i] = true;
    out.giorni = g;

    /* solo un numero vero: `null` non vale 0 (sarebbe «niente riserva»), e un
       infinito non entrerebbe nel JSON del piano */
    var r = typeof src.ripassoFinale === 'number' && isFinite(src.ripassoFinale) ? Math.floor(src.ripassoFinale) : NaN;
    out.ripassoFinale = r >= 0 ? r : RIPASSO_FINALE_BASE;

    out.pubblica = {
      appello: out.appelloN === null ? null : dataDa(out.appelloN),
      materie: clona(out.materie),
      oreAlGiorno: out.budget ? ore : null,
      giorni: g.slice(),
      ripassoFinale: out.ripassoFinale
    };
    return out;
  }

  /* 's1f01-A' -> 's1f01' (la lezione di una parte) */
  function lezioneDa(id) {
    var k = id.lastIndexOf('-');
    return k > 0 ? id.slice(0, k) : id;
  }

  function normMole(mole) {
    var lista = eArray(mole) ? mole
      : (eOggetto(mole) && eArray(mole.parti) ? mole.parti
        : (eOggetto(mole) && eArray(mole.lezioni) ? mole.lezioni : []));
    var visti = {}, tmp = [];
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      if (!eOggetto(p)) continue;
      var id = typeof p.id === 'string' && p.id ? p.id
        : (typeof p.slug === 'string' && p.slug && typeof p.parte === 'string' && p.parte ? p.slug + '-' + p.parte : '');
      var materia = nomeMateria(p.materia);
      if (!id || !materia || visti[id]) continue;
      visti[id] = true;
      /* la lezione e' lo `slug` (in data/index.json `lezione` e' il TITOLO) */
      var lezione = typeof p.slug === 'string' && p.slug ? p.slug : lezioneDa(id);
      var ep = typeof p.ep === 'number' && isFinite(p.ep) ? p.ep : null;
      var lettera = typeof p.parte === 'string' ? p.parte : id.slice(id.lastIndexOf('-') + 1);
      tmp.push({ id: id, materia: materia, lezione: lezione, ep: ep, lettera: lettera, arrivo: i });
    }
    /* ordine di catalogo: episodio, poi la parte; senza `ep` l'ordine d'arrivo */
    tmp.sort(function (a, b) {
      var ea = a.ep === null ? Infinity : a.ep, eb = b.ep === null ? Infinity : b.ep;
      if (ea !== eb) return ea < eb ? -1 : 1;
      if (a.ep !== null && a.lettera !== b.lettera) return a.lettera < b.lettera ? -1 : 1;
      return a.arrivo - b.arrivo;
    });
    var out = [];
    for (i = 0; i < tmp.length; i++) {
      out.push({ id: tmp[i].id, materia: tmp[i].materia, lezione: tmp[i].lezione, ep: tmp[i].ep, idx: i });
    }
    return out;
  }

  /* assente = la chiave manca oppure e' null: vuol dire «niente» */
  function presente(x) { return x !== undefined && x !== null; }

  /* una tappa dello stato -> {fatto, esito, intera}; null se la data non si
     legge. intera = false se c'e' un esito che non esiste (la tappa resta
     fatta, ma l'esito si perde: va dichiarato) */
  function normTappa(x) {
    var f = null, es = null, intera = true;
    if (typeof x === 'string') f = giornoDa(x);
    else if (eOggetto(x)) {
      f = giornoDa(x.fatto);
      if (presente(x.esito)) {
        if (typeof x.esito === 'string' && ESITI[x.esito] === true) es = x.esito;
        else intera = false;
      }
    }
    return f === null ? null : { fatto: f, esito: es, intera: intera };
  }

  /* Lo stato fuso dal server. Un valore che c'e' e non si sa leggere NON
     diventa «assente» in silenzio (una tappa fatta che torna da fare, una
     sbagliata recuperata oggi invece che domani): va in `scartati`, che il
     piano riporta. */
  function normStato(s) {
    var out = { tappe: {}, sbagliate: {}, scatole: {}, scartati: [] };
    function scarta(campo, parte, voce) { out.scartati.push({ campo: campo, parte: parte, voce: voce }); }
    if (!presente(s)) return out;
    if (!eOggetto(s)) { scarta('stato', null, null); return out; }
    var k, v, i;
    if (presente(s.tappe) && !eOggetto(s.tappe)) scarta('tappe', null, null);
    else if (eOggetto(s.tappe)) {
      for (k in s.tappe) {
        if (!proprio(s.tappe, k) || !presente(s.tappe[k])) continue;
        if (!eOggetto(s.tappe[k])) { scarta('tappe', k, null); continue; }
        var t = {}, qualcuna = false;
        for (i = 0; i < TAPPE.length; i++) {
          var x = s.tappe[k][TAPPE[i]];
          if (!presente(x)) continue;
          var n = normTappa(x);
          if (!n || !n.intera) scarta('tappe', k, TAPPE[i]);
          if (n) { t[TAPPE[i]] = { fatto: n.fatto, esito: n.esito }; qualcuna = true; }
        }
        if (qualcuna) out.tappe[k] = t;
      }
    }
    if (presente(s.sbagliate) && !eOggetto(s.sbagliate)) scarta('sbagliate', null, null);
    else if (eOggetto(s.sbagliate)) {
      for (k in s.sbagliate) {
        if (!proprio(s.sbagliate, k) || !presente(s.sbagliate[k])) continue;
        v = s.sbagliate[k];
        if (!eOggetto(v)) { scarta('sbagliate', k, null); continue; }
        var quante = Math.floor(Number(v.n));
        if (!(quante >= 0)) { scarta('sbagliate', k, 'n'); continue; }
        if (quante === 0) continue; /* niente da recuperare */
        var ultima = giornoDa(v.ultima);
        /* senza un giorno leggibile il recupero parte da oggi (R5), e lo si dice */
        if (ultima === null && presente(v.ultima)) scarta('sbagliate', k, 'ultima');
        /* `prima` (facoltativo) = il giorno dell'errore piu' VECCHIO ancora aperto.
           Assente = lo stato di prima: vale `ultima`, come prima. Uno che c'e' e
           non si legge si dichiara, e vale come assente */
        var prima = presente(v.prima) ? giornoDa(v.prima) : null;
        if (prima === null && presente(v.prima)) scarta('sbagliate', k, 'prima');
        if (prima !== null && ultima !== null && prima > ultima) prima = ultima;
        out.sbagliate[k] = { n: quante, ultima: ultima, prima: prima };
      }
    }
    if (presente(s.scatole) && !eOggetto(s.scatole)) scarta('scatole', null, null);
    else if (eOggetto(s.scatole)) {
      for (k in s.scatole) {
        if (!proprio(s.scatole, k) || !presente(s.scatole[k])) continue;
        v = s.scatole[k];
        if (!eOggetto(v)) { scarta('scatole', k, null); continue; }
        if (!presente(v.ultimo)) continue; /* mai ripassata: nessun ripasso da mettere */
        var ultimo = giornoDa(v.ultimo);
        if (ultimo === null) { scarta('scatole', k, 'ultimo'); continue; }
        var box = presente(v.box) ? Math.floor(Number(v.box)) : 0;
        if (!(box >= 0 && box <= INTERVALLI_SCATOLE.length - 1)) {
          scarta('scatole', k, 'box');
          box = box > INTERVALLI_SCATOLE.length - 1 ? INTERVALLI_SCATOLE.length - 1 : 0;
        }
        out.scatole[k] = { box: box, ultimo: ultimo };
      }
    }
    return out;
  }

  /* Gli scartati dello stato che riguardano il piano: i campi interi e le
     parti del catalogo (un argomento fuori catalogo e' delle scatole, §1).
     In ordine di catalogo, poi di campo e di voce: non dipende dall'ordine
     delle chiavi. */
  var ORDINE_CAMPI = { stato: 0, tappe: 1, sbagliate: 2, scatole: 3 };
  var ORDINE_VOCI = { capisci: 0, fai: 1, richiama: 2, nonCascarci: 3, n: 4, ultima: 5, prima: 6, box: 7, ultimo: 8 };
  function scartatiDelCatalogo(lista, cat) {
    var pos = {}, out = [], i;
    for (i = 0; i < cat.length; i++) pos[cat[i].id] = cat[i].idx;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].parte === null || proprio(pos, lista[i].parte)) out.push(lista[i]);
    }
    function rango(x, tab) { return x === null ? -1 : tab[x]; }
    out.sort(function (a, b) {
      var pa = a.parte === null ? -1 : pos[a.parte], pb = b.parte === null ? -1 : pos[b.parte];
      if (pa !== pb) return pa - pb;
      if (a.campo !== b.campo) return ORDINE_CAMPI[a.campo] - ORDINE_CAMPI[b.campo];
      return rango(a.voce, ORDINE_VOCI) - rango(b.voce, ORDINE_VOCI);
    });
    return out;
  }

  /* ================================================================== *
   * 3. LE QUATTRO FUNZIONI                                               *
   * ================================================================== */

  /* §2 durata: fissa e uguale per ogni parte (§3). `parte` e `mole` sono
     gia' nella firma perche' l'«efficienza misurata» (DOPO) li usera'. */
  function durata(parte, mole, ritmi) {
    var base = { capisci: MINUTI_CAPISCI, fai: MINUTI_FAI, richiama: MINUTI_RICHIAMA,
                 nonCascarci: MINUTI_NON_CASCARCI };
    var t = eOggetto(ritmi) && eOggetto(ritmi.tappe) ? ritmi.tappe : null;
    var out = {};
    for (var i = 0; i < TAPPE.length; i++) {
      var v = t ? Math.floor(Number(t[TAPPE[i]])) : NaN;
      out[TAPPE[i]] = v > 0 ? v : base[TAPPE[i]];
    }
    return out;
  }

  function voce(tipo, materia, parte, tappa, minuti) {
    return { tipo: tipo, materia: materia, parte: parte, tappa: tappa, minuti: minuti };
  }

  function voceValida(v) {
    return eOggetto(v) && typeof v.tipo === 'string' && TIPI[v.tipo] === true &&
      typeof v.parte === 'string' && typeof v.tappa === 'string';
  }

  /* §2 dose: una voce e' «gia' fatta» se lo stato lo dice. Una lezione
     nuova: la sua tappa e' stata fatta (quando che sia). Un ripasso: la
     tappa e' stata rifatta quel giorno o dopo (per Richiama vale anche il
     ripasso delle scatole). Una voce sbagliate del giorno d: la parte non ha
     piu' voci da recuperare o, se lo stato dice `prima`, non ne ha piu' di
     PRIMA di d (la voce di d recupera gli errori di prima di d, R5: un
     errore nuovo oggi non la disfa). */
  function fatta(v, st, giornoN) {
    var p = v.parte, t = v.tappa, tp = st.tappe[p];
    if (v.tipo === 'lezione-nuova') return !!(tp && tp[t]);
    if (v.tipo === 'ripasso') {
      if (tp && tp[t] && tp[t].fatto >= giornoN) return true;
      return t === 'richiama' && !!st.scatole[p] && st.scatole[p].ultimo >= giornoN;
    }
    if (v.tipo === 'sbagliate') {
      var sb = st.sbagliate[p];
      return !sb || (sb.prima !== null && sb.prima >= giornoN);
    }
    return false;
  }

  /* L8: una voce di oggi resta a registro, e toglie il suo tempo a oggi,
     solo se e' stata fatta OGGI. Una lezione nuova fatta in anticipo, un
     altro giorno, quel tempo l'ha preso quel giorno (esempio 10: chi ha
     fatto 14 parti in 7 giorni ha 7 giorni utili, non 6). Un ripasso
     «fatto» e' gia' di oggi per costruzione; una sbagliata recuperata non
     porta il giorno, e si tiene. */
  function fattaOggi(v, st, giornoN) {
    if (!fatta(v, st, giornoN)) return false;
    if (v.tipo === 'lezione-nuova') return st.tappe[v.parte][v.tappa].fatto === giornoN;
    return true;
  }

  /* §4.2 le tre soglie. Rende il modo e la quota di ogni materia. */
  function scegliModo(budget, materie) {
    var n = materie.length, somma = 0, i, quote = {};
    for (i = 0; i < n; i++) somma += materie[i].priorita;
    if (budget >= PARTE_MIN * n) {
      /* prima soglia: ogni materia avanza di (almeno) una parte intera. L3:
         il tempo che avanza oltre parte_min x n va «per priorita', sempre in
         parti intere»: a BLOCCHI di una parte, nell'ordine del turno pesato
         (a pari, l'ordine di cfg; priorita' doppia = il doppio dei blocchi
         su un giro intero). Lettura dell'autore: lo script degli esempi di
         pedagogy da' i blocchi a giro nell'ordine di priorita'; le due
         letture coincidono con uno o due blocchi e a priorita' pari. Cio'
         che resta sotto una parte si divide come prima, per priorita': non
         fa una parte in piu', ma lascia posto ai recuperi (esempio 6). */
      var avanzo = budget - PARTE_MIN * n;
      var blocchi = Math.floor(avanzo / PARTE_MIN), resto = avanzo - blocchi * PARTE_MIN;
      for (i = 0; i < n; i++) {
        quote[materie[i].nome] = PARTE_MIN + Math.floor(resto * materie[i].priorita / somma);
      }
      var giro = sequenzaRotazione(materie);
      for (i = 0; i < blocchi; i++) quote[giro[i % giro.length]] += PARTE_MIN;
      return { modo: 'intera', quote: quote };
    }
    var minima = Infinity;
    for (i = 0; i < n; i++) {
      quote[materie[i].nome] = Math.floor(budget * materie[i].priorita / somma);
      if (quote[materie[i].nome] < minima) minima = quote[materie[i].nome];
    }
    /* seconda soglia: tappe divise, quote per priorita' (L2); n fisso, la
       quota di chi finisce resta sua (L1: vale SOLO qui).
       APERTO (revisione S3v2, decisione di pedagogy e dell'utente): col
       catalogo vero (Fisica 20 parti, Chimica 40, Biologia 60) e le priorita'
       pari, «da tutte insieme» non entra con nessuno dei due appelli veri
       (due ore e l'11/01: Biologia 22 lezioni su 30, mentre il tempo prima
       della riserva basterebbe; con priorita' 1:2:3 entra). E' un effetto di
       L1 e delle priorita' predefinite, non del tempo */
    if (minima >= TAPPA_MIN) return { modo: 'tappe', quote: quote };
    /* terza soglia: non si divide, un giorno intero a testa, a turno pesato */
    return { modo: 'rotazione', quote: null };
  }

  /* §4.2 «priorita' doppia = il doppio dei giorni»: turno pesato liscio,
     un ciclo lungo quanto la somma delle priorita'; pareggio = ordine di
     cfg (L10). */
  function sequenzaRotazione(materie) {
    var tot = 0, cur = [], seq = [], i, k;
    for (i = 0; i < materie.length; i++) { tot += materie[i].priorita; cur.push(0); }
    for (k = 0; k < tot; k++) {
      var meglio = -1;
      for (i = 0; i < materie.length; i++) {
        cur[i] += materie[i].priorita;
        if (meglio < 0 || cur[i] > cur[meglio]) meglio = i;
      }
      cur[meglio] -= tot;
      seq.push(materie[meglio].nome);
    }
    return seq;
  }

  /* quanti giorni di studio ci sono fra `da` (incluso) e `a` (escluso);
     negativo se `a` viene prima */
  function giorniDiStudio(da, a, giorni) {
    var n = 0, d;
    if (a >= da) { for (d = da; d < a; d++) if (giorni[giornoSett(d)]) n++; }
    else { for (d = a; d < da; d++) if (giorni[giornoSett(d)]) n--; }
    return n;
  }

  /* §5: le voci di recupero di una materia, ordinate: prima le sbagliate
     (passano sempre avanti), poi le tappe da riproporre e i ripassi
     maturati, per data. Ogni voce `ripasso` vale MINUTI_RIPASSO anche
     quando richiama Fai o Non cascarci (§3, C2), non la durata della
     tappa. */
  function recuperiDi(ctx, nome) {
    var st = ctx.st, out = [], visti = {};
    function aggiungi(r) {
      var k = r.tipo + '|' + r.parte + '|' + r.tappa;
      if (visti[k] !== undefined) {
        if (r.dal < out[visti[k]].dal) out[visti[k]] = r;
        return;
      }
      visti[k] = out.length;
      out.push(r);
    }
    var parti = ctx.perMateria[nome];
    for (var i = 0; i < parti.length; i++) {
      var p = parti[i], id = p.id;
      var sb = st.sbagliate[id];
      if (sb) {
        /* R5: mai lo stesso giorno dell'errore, da oggi se l'errore e' vecchio.
           Per ERRORE: conta il piu' vecchio ancora aperto (`prima`), se lo
           stato lo dice; se no l'ultimo, come prima */
        var errore = sb.prima !== null ? sb.prima : sb.ultima;
        aggiungi({ tipo: 'sbagliate', parte: id, tappa: 'richiama', minuti: MINUTI_SBAGLIATE, classe: 0, idx: p.idx, ti: 2,
                   dal: Math.max(ctx.oggiN, errore === null ? ctx.oggiN : errore + 1) });
      }
      var tp = st.tappe[id], sc = st.scatole[id];
      for (var j = 0; tp && j < TAPPE.length; j++) {
        var t = tp[TAPPE[j]];
        if (!t || (t.esito !== 'no' && t.esito !== 'incerto')) continue;
        var rinvio = t.esito === 'no' ? RINVIO_NO : RINVIO_INCERTO;
        /* una Richiama da riproporre, ripassata nelle scatole alla scadenza o
           dopo, e' gia' stata riproposta (lo stesso gesto, registrato li') */
        if (TAPPE[j] === 'richiama' && sc && sc.ultimo >= t.fatto + rinvio) continue;
        aggiungi({ tipo: 'ripasso', parte: id, tappa: TAPPE[j], minuti: MINUTI_RIPASSO, classe: 1, idx: p.idx, ti: j,
                   dal: Math.max(ctx.oggiN, t.fatto + rinvio) });
      }
      if (sc) {
        /* L7: solo il prossimo ripasso del calendario lungo. Se Richiama e'
           stata rifatta alla scadenza o dopo, quel ripasso c'e' gia' stato:
           per la dose (§2) i due modi di registrarlo sono lo stesso gesto, e
           rimetterlo farebbe una voce doppia che si mangia il tempo di oggi */
        var scade = sc.ultimo + INTERVALLI_SCATOLE[sc.box];
        if (!(tp && tp.richiama && tp.richiama.fatto >= scade)) {
          aggiungi({ tipo: 'ripasso', parte: id, tappa: 'richiama', minuti: MINUTI_RIPASSO, classe: 1, idx: p.idx, ti: 2,
                     dal: Math.max(ctx.oggiN, scade) });
        }
      }
    }
    out.sort(function (a, b) {
      if (a.classe !== b.classe) return a.classe - b.classe;
      if (a.dal !== b.dal) return a.dal - b.dal;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.ti - b.ti;
    });
    for (i = 0; i < out.length; i++) out[i].messo = false;
    return out;
  }

  function maxFatto(tp) {
    var m = -Infinity;
    for (var i = 0; i < TAPPE.length; i++) if (tp[TAPPE[i]] && tp[TAPPE[i]].fatto > m) m = tp[TAPPE[i]].fatto;
    return m;
  }

  /* un recupero di questa materia e' dovuto oggi e non e' ancora messo */
  function dovuto(S, d) {
    for (var i = 0; i < S.recuperi.length; i++) if (!S.recuperi[i].messo && S.recuperi[i].dal <= d) return true;
    return false;
  }

  /* §5: le voci di recupero dovute passano davanti al nuovo della materia */
  function piazzaRecuperi(g, S, nome, d, q) {
    for (var i = 0; i < S.recuperi.length; i++) {
      var r = S.recuperi[i];
      if (r.messo || r.dal > d || r.minuti > q) continue;
      g.voci.push(voce(r.tipo, nome, r.parte, r.tappa, r.minuti));
      q -= r.minuti;
      r.messo = true;
      g.oggi[r.parte] = true;
      S.recupero = d;
      if (r.tipo === 'ripasso') {
        /* un ripasso tocca la parte QUALUNQUE tappa richiami: e' cio' che lo
           stato dira' dopo il gesto (l'ultimo tocco e' la tappa piu' recente,
           `maxFatto`). Contare solo Richiama faceva cambiare l'ordine del
           riempimento dei giorni dopo appena lo studente rifaceva la tappa */
        g.ripassata[r.parte] = true;
        g.tocco[r.parte] = g.d;
      }
    }
    return q;
  }

  /* una parte si chiude oggi */
  function chiudi(g, S, el) {
    g.fatta[el.id] = g.d;
    g.tocco[el.id] = g.d;
    g.oggi[el.id] = true;
    g.iniziate[el.id] = true;
    g.chiuse.n++;
    S.pos++;
    S.tpos = 0;
  }

  /* R7: la parte del giorno non entra intera perche' un recupero ha preso
     il suo tempo. */
  function dopoUnRecupero(ctx, g, S, nome, q) {
    var el = S.coda[S.pos];
    if (R7_MINUTI_DOPO_UN_RECUPERO === 'tappe' && ctx.dur[el.id][el.residue[S.tpos]] <= q) {
      /* le sue tappe, in ordine, finche' entrano: la parte intera non
         entrava, quindi qui non si chiude; si chiude domani */
      while (S.tpos < el.residue.length) {
        var t = el.residue[S.tpos], m = ctx.dur[el.id][t];
        if (m > q) break;
        g.voci.push(voce('lezione-nuova', nome, el.id, t, m));
        q -= m;
        g.oggi[el.id] = true;
        g.iniziate[el.id] = true;
        S.tpos++;
      }
      return q;
    }
    /* La parte e' gia' stata APERTA OGGI (una sua tappa nuova fatta oggi e in
       piano): le tappe che entravano c'erano gia', e cio' che avanza restava
       vuoto anche nel piano di partenza. Senza questa riga, fatta Capisci, la
       prima tappa rimasta (Fai, 20') non entra piu' e il ricalcolo aggiungeva
       un ripasso che la mattina non c'era: la giornata cresceva dopo l'ultima
       voce (revisione S3v2). */
    if (R7_MINUTI_DOPO_UN_RECUPERO === 'tappe' && g.d === ctx.oggiN && S.apertaOggi === el.id) return q;
    /* l'alternativa, o la proposta quando non entra nemmeno la prima tappa */
    return riempi(ctx, g, nome, q);
  }

  /* §4.2 il nuovo, nell'ordine di catalogo e di tappa. A parte intera una
     parte non si spezza fra due giorni, salvo R7 (e una parte spezzata si
     chiude per prima il giorno dopo); a tappe si', una tappa per volta. */
  function piazzaNuovo(ctx, g, S, nome, q) {
    var el, j, m, t;
    if (ctx.modo.modo === 'intera') {
      /* la prima parte del giorno: oggi, se lo studente ne ha gia' chiusa
         una, la prima e' gia' stata (e cio' che avanza resta vuoto, L6) */
      var primo = !(g.d === ctx.oggiN && S.chiusaOggi);
      while (S.pos < S.coda.length) {
        el = S.coda[S.pos];
        for (m = 0, j = S.tpos; j < el.residue.length; j++) m += ctx.dur[el.id][el.residue[j]];
        if (m > q) {
          if (primo && S.recupero === g.d) q = dopoUnRecupero(ctx, g, S, nome, q);
          break;
        }
        for (j = S.tpos; j < el.residue.length; j++) {
          g.voci.push(voce('lezione-nuova', nome, el.id, el.residue[j], ctx.dur[el.id][el.residue[j]]));
        }
        q -= m;
        chiudi(g, S, el);
        primo = false;
      }
      return q;
    }
    while (S.pos < S.coda.length) {
      el = S.coda[S.pos];
      t = el.residue[S.tpos];
      m = ctx.dur[el.id][t];
      if (m > q) break;
      g.voci.push(voce('lezione-nuova', nome, el.id, t, m));
      q -= m;
      g.oggi[el.id] = true;
      g.iniziate[el.id] = true;
      if (++S.tpos >= el.residue.length) chiudi(g, S, el);
    }
    return q;
  }

  /* §4.4/§6 (L6): il ripasso che riempie. Solo parti gia' chiuse prima di
     oggi, la meno toccata di recente per prima, mai due volte nel giorno;
     a pari tocco una parte MAI ripassata passa avanti (C4), poi l'ordine
     di catalogo. */
  function riempi(ctx, g, nome, q) {
    if (q < MINUTI_RIPASSO) return q;
    var parti = ctx.perMateria[nome], cand = [], i;
    for (i = 0; i < parti.length; i++) {
      var id = parti[i].id;
      if (g.fatta[id] !== undefined && g.fatta[id] < g.d && !g.oggi[id]) cand.push(parti[i]);
    }
    cand.sort(function (a, b) {
      var ta = g.tocco[a.id], tb = g.tocco[b.id];
      if (ta !== tb) return ta < tb ? -1 : 1;
      var ra = g.ripassata[a.id] ? 1 : 0, rb = g.ripassata[b.id] ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    });
    for (i = 0; i < cand.length && q >= MINUTI_RIPASSO; i++) {
      g.voci.push(voce('ripasso', nome, cand[i].id, 'richiama', MINUTI_RIPASSO));
      q -= MINUTI_RIPASSO;
      g.tocco[cand[i].id] = g.d;
      g.oggi[cand[i].id] = true;
      g.ripassata[cand[i].id] = true;
    }
    return q;
  }

  /* R2: una materia e' nella rotazione del giorno se ha ancora nuovo da
     mettere, o (alternativa di R2) turni di solo ripasso, o un recupero
     dovuto (con 'turno'; con 'in-testa' solo se e' FERMA: ha parti che non
     entrano, §4.3).
     FINITA / FERMA (con 'in-testa'; lettura dell'autore, misurata): cede i
     suoi recuperi in testa al giorno di chi e' di turno solo la materia
     FINITA, ogni parte chiusa. Quella ferma perche' il resto non entra li fa
     nel suo turno: se ne sta fuori dipende dalle esclusioni, e un recupero
     che cambiasse giorno con loro faceva ridecidere il piano dopo un gesto
     che lo seguiva (seme 165 del giro delle proprieta'). */
  function inRotazione(S, d, utile) {
    if (utile && S.pos < S.coda.length) return true;
    if (S.ripassoTurni < R2_TURNI_DI_SOLO_RIPASSO) return true;
    if (!dovuto(S, d)) return false;
    return R2_RECUPERI_DOPO_LA_FINE === 'turno' || S.ferma;
  }

  /* §4.2 terza soglia + R2: di chi e' il turno del giorno. Attive = quelle
     in rotazione; nessuna attiva: tutte (TUTTE). Il turno = la sequenza
     pesata delle attive, letta al numero di giorni di studio da `inizio`
     (ANCORA). */
  function diTurno(ctx, perM, d, utile, k) {
    var attive = [], chiave = '', i;
    for (i = 0; i < ctx.materie.length; i++) {
      var m = ctx.materie[i];
      if (inRotazione(perM[m.nome], d, utile)) { attive.push(m); chiave += '|' + m.nome; }
    }
    if (!attive.length) { attive = ctx.materie; chiave = '*'; }
    if (!proprio(ctx.sequenze, chiave)) ctx.sequenze[chiave] = sequenzaRotazione(attive);
    var seq = ctx.sequenze[chiave];
    return seq[((k % seq.length) + seq.length) % seq.length];
  }

  /* Il giorno per giorno, da oggi al giorno prima dell'esame. `esclusi`
     sono le parti che non entrano (§4.3): non si iniziano nemmeno. */
  function simula(ctx, esclusi) {
    var giorni = {}, fattaIl = {}, tocco = {}, ripassata = {}, iniziate = {}, chiuse = { n: 0 }, perM = {}, i, j;
    for (i = 0; i < ctx.materie.length; i++) {
      var nome = ctx.materie[i].nome, parti = ctx.perMateria[nome], coda = [], ferma = false;
      for (j = 0; j < parti.length; j++) {
        var id = parti[j].id, tp = ctx.st.tappe[id] || {}, residue = [];
        for (var k = 0; k < TAPPE.length; k++) if (!tp[TAPPE[k]]) residue.push(TAPPE[k]);
        var ultimoTocco = maxFatto(tp);
        if (ctx.st.scatole[id]) {
          if (ctx.st.scatole[id].ultimo > ultimoTocco) ultimoTocco = ctx.st.scatole[id].ultimo;
          /* C4: nelle scatole con un ultimo ripasso = ripassata almeno una volta */
          ripassata[id] = true;
        }
        tocco[id] = ultimoTocco;
        if (!residue.length) fattaIl[id] = maxFatto(tp);
        else if (!esclusi[id]) coda.push({ id: id, residue: residue });
        else ferma = true;
      }
      perM[nome] = { coda: coda, pos: 0, tpos: 0, recuperi: recuperiDi(ctx, nome), recupero: null, ferma: ferma,
                     chiusaOggi: false, apertaOggi: null, ripassoTurni: coda.length ? 0 : (ctx.turniRipasso[nome] || 0) };
    }

    var k0 = ctx.kOggi, turnoLibero = null, turnoUsato = null;
    for (var d = ctx.oggiN; d < ctx.appelloN; d++) {
      var g = { d: d, voci: [], oggi: {}, fatta: fattaIl, tocco: tocco, ripassata: ripassata,
                iniziate: iniziate, chiuse: chiuse };
      giorni[dataDa(d)] = g.voci;
      if (d === ctx.oggiN) {
        for (i = 0; i < ctx.tenute.length; i++) {
          var tv = ctx.tenute[i];
          g.voci.push(clona(tv));
          g.oggi[tv.parte] = true;
          if (!proprio(perM, tv.materia)) continue;
          /* R7: un recupero gia' fatto oggi vale come uno messo oggi, una
             parte di oggi gia' chiusa e' la prima parte del giorno, e una parte
             cominciata oggi e non chiusa e' quella che R7 ha aperto */
          if (tv.tipo === 'sbagliate' || tv.tipo === 'ripasso') perM[tv.materia].recupero = d;
          if (tv.tipo === 'lezione-nuova' && fattaIl[tv.parte] !== undefined) perM[tv.materia].chiusaOggi = true;
          if (tv.tipo === 'lezione-nuova' && fattaIl[tv.parte] === undefined) perM[tv.materia].apertaOggi = tv.parte;
        }
      }
      if (!ctx.giorni[giornoSett(d)]) continue;
      var utile = d <= ctx.ultimoUtileN, diOggi;
      if (ctx.modo.modo === 'rotazione') {
        /* il turno di OGGI puo' essere fissato da fuori (`turnoOggi`): la
           materia su cui lo studente ha gia' lavorato oggi (finire le voci non
           passa la giornata a un'altra), o il punto fermo di `calcola`. Quello
           libero (la sequenza delle attive di questa simulazione) si rende
           comunque: e' cio' che `calcola` confronta */
        var libero = diTurno(ctx, perM, d, utile, k0);
        var nm0 = d === ctx.oggiN && ctx.turnoOggi !== null ? ctx.turnoOggi : libero;
        if (d === ctx.oggiN) { turnoLibero = libero; turnoUsato = nm0; }
        if (!(utile && perM[nm0].pos < perM[nm0].coda.length)) perM[nm0].ripassoTurni++;
        k0++;
        /* il tempo del giorno e' uno solo: oggi ne toglie tutto cio' che e'
           gia' fatto, di qualunque materia */
        var qr = ctx.budget, mf;
        if (d === ctx.oggiN) for (mf in ctx.fattiOggi) if (proprio(ctx.fattiOggi, mf)) qr -= ctx.fattiOggi[mf];
        qr = Math.max(0, qr);
        /* R2_RECUPERI_DOPO_LA_FINE 'in-testa': i recuperi dovuti delle materie
           FUORI dalla rotazione (finite) entrano in testa al giorno di chi e'
           di turno, dentro lo stesso tempo. Con tutte fuori (TUTTE) ognuna ha
           i suoi giorni e aspetta il suo */
        if (R2_RECUPERI_DOPO_LA_FINE === 'in-testa') {
          var fuori = [], qualcunaDentro = false;
          for (i = 0; i < ctx.materie.length; i++) {
            if (inRotazione(perM[ctx.materie[i].nome], d, utile)) qualcunaDentro = true;
            else if (ctx.materie[i].nome !== nm0) fuori.push(ctx.materie[i].nome);
          }
          for (i = 0; qualcunaDentro && i < fuori.length; i++) qr = piazzaRecuperi(g, perM[fuori[i]], fuori[i], d, qr);
        }
        var S0 = perM[nm0];
        qr = piazzaRecuperi(g, S0, nm0, d, qr);
        if (utile) qr = piazzaNuovo(ctx, g, S0, nm0, qr);
        if (!utile || ctx.misto || S0.pos >= S0.coda.length) qr = riempi(ctx, g, nm0, qr);
        continue;
      } else {
        diOggi = [];
        for (i = 0; i < ctx.materie.length; i++) {
          diOggi.push({ nome: ctx.materie[i].nome, quota: ctx.modo.quote[ctx.materie[i].nome] });
        }
      }
      for (i = 0; i < diOggi.length; i++) {
        var nm = diOggi[i].nome, S = perM[nm], q = diOggi[i].quota;
        if (d === ctx.oggiN) q = Math.max(0, q - (ctx.fattiOggi[nm] || 0));
        q = piazzaRecuperi(g, S, nm, d, q);
        if (utile) q = piazzaNuovo(ctx, g, S, nm, q);
        if (!utile || ctx.misto || S.pos >= S.coda.length) q = riempi(ctx, g, nm, q);
      }
    }
    return { giorni: giorni, fatta: fattaIl, nuove: chiuse.n, iniziate: iniziate, turnoLibero: turnoLibero, turnoUsato: turnoUsato };
  }

  /* ogni parte non esclusa (e non la mezza di C1) si chiude */
  function tuttiChiusi(ctx, r, esclusi) {
    for (var i = 0; i < ctx.materie.length; i++) {
      var sue = ctx.perMateria[ctx.materie[i].nome];
      for (var j = 0; j < sue.length; j++) {
        var id = sue[j].id;
        if (!esclusi[id] && id !== ctx.mezza && r.fatta[id] === undefined) return false;
      }
    }
    return true;
  }

  /* le materie dalla piu' importante: priorita', poi l'ordine di cfg (L10) */
  function perImportanza(ctx) {
    var ord = [];
    for (var i = 0; i < ctx.materie.length; i++) ord.push({ m: ctx.materie[i], i: i });
    ord.sort(function (a, b) { return b.m.priorita - a.m.priorita || a.i - b.i; });
    var out = [];
    for (i = 0; i < ord.length; i++) out.push(ord[i].m);
    return out;
  }

  /* §4.3 MASSIMO, a rotazione: una parte alla volta si prova a rimettere */
  function reincludi(ctx, esclusi, r) {
    var ordine = perImportanza(ctx);
    for (;;) {
      var preso = false;
      for (var i = 0; i < ordine.length && !preso; i++) {
        var sue = ctx.perMateria[ordine[i].nome], p = null;
        for (var j = 0; j < sue.length; j++) if (esclusi[sue[j].id]) { p = sue[j].id; break; }
        if (p === null) continue;
        delete esclusi[p];
        var prova = simula(ctx, esclusi);
        if (tuttiChiusi(ctx, prova, esclusi)) { r = prova; preso = true; }
        else esclusi[p] = true;
      }
      if (!preso) return r;
    }
  }

  /* ROTAZIONE, il turno di oggi come PUNTO FERMO. Le parti che non entrano
     (§4.3) si decidono simulando; a rotazione la sequenza dei turni dipende
     da chi e' attivo (R2) e chi e' attivo dalle esclusioni, quindi nelle
     simulazioni di prova il turno di OGGI poteva essere un altro da quello
     del piano finale. Fatta la prima voce il turno di oggi resta inchiodato
     (`turnoFisso`, da riadatta) e il giro dava un altro piano (revisione
     S3v2: la giornata da 25' a 40' e un avviso coi numeri cambiati). Qui il
     turno di oggi si fissa PRIMA del giro delle esclusioni e si ripete
     finche' quello libero, con le esclusioni che ne escono, resta lo stesso
     (al piu' un giro per materia; se gira in tondo vale l'ultimo fissato).
     Il piano che esce ha sempre il turno di oggi fissato: e' lo stesso che
     riadatta ritrova dopo il primo gesto. */
  function calcola(ctx) {
    if (ctx.modo.modo !== 'rotazione' || ctx.turnoFisso !== null) {
      ctx.turnoOggi = ctx.turnoFisso;
      return calcolaEsclusi(ctx);
    }
    var visti = {}, fisso = null, r = null;
    for (var giro = 0; giro <= ctx.materie.length; giro++) {
      ctx.turnoOggi = fisso;
      r = calcolaEsclusi(ctx);
      var libero = r.turnoLibero;
      if (libero === null || libero === fisso || proprio(visti, libero)) break;
      visti[libero] = true;
      fisso = libero;
    }
    ctx.turnoOggi = null;
    return r;
  }

  /* §4.3 mai una parte a meta': cio' che non si chiude prima della
     riserva non si comincia nemmeno, e si rifa' il conto senza */
  function calcolaEsclusi(ctx) {
    var esclusi = {}, r = simula(ctx, esclusi);
    for (var giro = 0; giro <= ctx.nCatalogo; giro++) {
      var nuovi = 0;
      for (var i = 0; i < ctx.materie.length; i++) {
        var sue = ctx.perMateria[ctx.materie[i].nome];
        for (var j = 0; j < sue.length; j++) {
          var id = sue[j].id;
          if (r.fatta[id] === undefined && !esclusi[id] && id !== ctx.mezza) { esclusi[id] = true; nuovi++; }
        }
      }
      if (!nuovi) break;
      r = simula(ctx, esclusi);
    }
    if (ctx.modo.modo === 'rotazione') r = reincludi(ctx, esclusi, r);
    return r;
  }

  /* §4.1: la riserva sono gli ultimi `riserva` giorni di CALENDARIO prima
     dell'esame (L5); tutti i giorni misti solo quando e' AZZERATA (§6) */
  function fissaRiserva(ctx, riserva) {
    ctx.riserva = riserva;
    ctx.ultimoUtileN = ctx.appelloN - 1 - riserva;
    ctx.misto = riserva === 0 && ctx.ripassoFinale > 0;
  }
  function conRiserva(ctx, riserva) {
    fissaRiserva(ctx, riserva);
    return calcola(ctx);
  }

  /* C1 (alternativa): la prima parte da fare della materia che viene prima */
  function primaDaFare(ctx) {
    var ordine = perImportanza(ctx);
    for (var i = 0; i < ordine.length; i++) {
      var sue = ctx.perMateria[ordine[i].nome];
      for (var j = 0; j < sue.length; j++) {
        var tp = ctx.st.tappe[sue[j].id] || {};
        for (var k = 0; k < TAPPE.length; k++) if (!tp[TAPPE[k]]) return sue[j].id;
      }
    }
    return null;
  }

  /* il primo giorno con materiale nuovo di una materia, o null */
  function primoNuovo(giorni, nome) {
    var chiavi = [], k, i, j;
    for (k in giorni) if (proprio(giorni, k)) chiavi.push(k);
    chiavi.sort();
    for (i = 0; i < chiavi.length; i++) {
      var lista = giorni[chiavi[i]];
      for (j = 0; j < lista.length; j++) {
        if (lista[j].tipo === 'lezione-nuova' && lista[j].materia === nome) return chiavi[i];
      }
    }
    return null;
  }

  /* R4: di quanti giorni di studio l'arretrato di sbagliate fa slittare il
     primo giorno di nuovo di ogni materia, contro lo stesso piano senza */
  function calcolaRitardo(ctx, r) {
    var qualcuna = false, i, j;
    for (i = 0; i < ctx.materie.length && !qualcuna; i++) {
      var sue = ctx.perMateria[ctx.materie[i].nome];
      for (j = 0; j < sue.length; j++) if (ctx.st.sbagliate[sue[j].id]) { qualcuna = true; break; }
    }
    if (!qualcuna) return [];
    var senzaCtx = {};
    for (var k in ctx) if (proprio(ctx, k)) senzaCtx[k] = ctx[k];
    senzaCtx.st = { tappe: ctx.st.tappe, sbagliate: {}, scatole: ctx.st.scatole, scartati: [] };
    senzaCtx.sequenze = {};
    /* senza l'arretrato vuol dire anche senza le sbagliate gia' recuperate
       OGGI: tenerle fra le voci fatte toglieva il loro tempo al piano di
       confronto, e il ritardo cambiava mentre lo studente faceva la dose */
    senzaCtx.tenute = [];
    senzaCtx.fattiOggi = {};
    for (var t = 0; t < ctx.tenute.length; t++) {
      var tv = ctx.tenute[t];
      if (tv.tipo === 'sbagliate') continue;
      senzaCtx.tenute.push(tv);
      senzaCtx.fattiOggi[tv.materia] = (senzaCtx.fattiOggi[tv.materia] || 0) + (Number(tv.minuti) || 0);
    }
    /* a rotazione il confronto si fa con lo STESSO turno di oggi del piano
       vero: e' quello che lo studente ha davanti, e un turno scelto a parte
       (dal punto fermo del piano di confronto) cambiava dopo il primo gesto */
    senzaCtx.turnoFisso = r.turnoUsato;
    var senza = calcola(senzaCtx), out = [];
    for (i = 0; i < ctx.materie.length; i++) {
      var nome = ctx.materie[i].nome;
      var con = primoNuovo(r.giorni, nome), sz = primoNuovo(senza.giorni, nome);
      if (con === null || sz === null) continue;
      var gg = giorniDiStudio(giornoDa(sz), giornoDa(con), ctx.giorni);
      if (gg > R4_SOGLIA_RITARDO) out.push({ materia: nome, giorni: gg, primo_giorno: con, senza_arretrato: sz });
    }
    return out;
  }

  /* L'avviso: uno solo, il primo che vale (intestazione). §4.3 si conta
     in LEZIONI intere, mai in parti (L11). */
  function calcolaAvviso(ctx, r, riserva, ripassoFinale, ritardo) {
    var righe = [], i, j, totali = ctx.appelloN - ctx.oggiN;
    for (i = 0; i < ctx.materie.length; i++) {
      var nome = ctx.materie[i].nome, parti = ctx.perMateria[nome], lez = {}, ordine = [];
      for (j = 0; j < parti.length; j++) {
        var chiaveLezione = parti[j].lezione;
        if (!lez[chiaveLezione]) { lez[chiaveLezione] = { tutte: 0, dentro: 0, mezza: false }; ordine.push(chiaveLezione); }
        lez[chiaveLezione].tutte++;
        if (r.fatta[parti[j].id] !== undefined) lez[chiaveLezione].dentro++;
        else if (parti[j].id === ctx.mezza) lez[chiaveLezione].mezza = true;
      }
      var incluse = 0, aMeta = 0, fuori = false;
      for (j = 0; j < ordine.length; j++) {
        var l = lez[ordine[j]];
        if (l.dentro === l.tutte) incluse++;
        else { fuori = true; if (l.dentro > 0 || l.mezza) aMeta++; }
      }
      if (fuori) {
        righe.push({ materia: nome, lezioni_incluse: incluse, lezioni_totali: ordine.length, lezioni_a_meta: aMeta });
      }
    }
    var azzerata = riserva === 0 && ripassoFinale > 0;
    var stretta = riserva > 0 && riserva < ripassoFinale;
    if (righe.length) {
      /* R4 dentro il non-entra: esce un avviso solo e questo passa davanti,
         ma quando e' l'arretrato a far saltare il piano il ritardo deve
         restare detto (stessa lista di 'ritardo-partenza'; [] se non c'e') */
      var a = { codice: 'non-entra', materia: righe[0].materia, lezioni_incluse: righe[0].lezioni_incluse,
                lezioni_totali: righe[0].lezioni_totali, lezioni_a_meta: righe[0].lezioni_a_meta,
                riserva_azzerata: azzerata, riserva_stretta: stretta, ritardo: ritardo, materie: righe };
      if (ctx.mezza !== null) a.parte_a_meta = ctx.mezza;
      return a;
    }
    if (ritardo.length) {
      return { codice: 'ritardo-partenza', materia: ritardo[0].materia, giorni: ritardo[0].giorni,
               primo_giorno: ritardo[0].primo_giorno, materie: ritardo };
    }
    if (azzerata) return { codice: 'riserva-azzerata', giorni_totali: totali, ripasso_finale: ripassoFinale };
    if (stretta) return { codice: 'riserva-stretta', giorni_riserva: riserva, ripasso_finale: ripassoFinale };
    if (C3_ORIZZONTE === 'avviso' && totali > ORIZZONTE_AVVISO) {
      return { codice: 'esame-lontano', giorni: totali, soglia: ORIZZONTE_AVVISO };
    }
    return null;
  }

  function avvisoCfg(cfg) {
    var a = { codice: 'cfg-non-valida', campo: cfg.errore };
    if (cfg.dettaglio) for (var k in cfg.dettaglio) if (proprio(cfg.dettaglio, k)) a[k] = cfg.dettaglio[k];
    return a;
  }

  function pianificaInterno(cfgIn, moleIn, statoIn, oggiN, opz) {
    var cfg = normCfg(cfgIn, oggiN), cat = normMole(moleIn), st = normStato(statoIn), i, j;
    var mole = [];
    for (i = 0; i < cat.length; i++) {
      mole.push({ id: cat[i].id, slug: cat[i].lezione, materia: cat[i].materia, ep: cat[i].ep });
    }
    var piano = { v: VERSIONE, generato: dataDa(oggiN), inizio: dataDa(opz.inizioN), cfg: cfg.pubblica,
                  mole: mole, riservaDa: null, turno: null, mezza: null, giorni: {}, avviso: null,
                  scartati: scartatiDelCatalogo(st.scartati, cat) };
    if (cfg.errore) { piano.avviso = avvisoCfg(cfg); return piano; }
    if (!cat.length) { piano.avviso = { codice: 'cfg-non-valida', campo: 'mole' }; return piano; }
    /* §5: l'esame e' passato, niente altri giorni */
    if (cfg.appelloN < oggiN) {
      piano.avviso = { codice: 'esame-passato', appello: dataDa(cfg.appelloN) };
      return piano;
    }

    var perMateria = {}, materie = [];
    for (i = 0; i < cfg.materie.length; i++) perMateria[cfg.materie[i].nome] = [];
    for (i = 0; i < cat.length; i++) if (perMateria[cat[i].materia]) perMateria[cat[i].materia].push(cat[i]);
    /* le materie attive sono quelle scelte che hanno parti nel catalogo */
    for (i = 0; i < cfg.materie.length; i++) {
      if (perMateria[cfg.materie[i].nome].length) materie.push(cfg.materie[i]);
    }
    if (!materie.length) { piano.avviso = { codice: 'cfg-non-valida', campo: 'materie' }; return piano; }

    var ctx = {
      st: st, materie: materie, perMateria: perMateria, dur: {}, nCatalogo: cat.length,
      budget: cfg.budget, modo: scegliModo(cfg.budget, materie), giorni: cfg.giorni,
      oggiN: oggiN, appelloN: cfg.appelloN, ripassoFinale: cfg.ripassoFinale,
      riserva: 0, ultimoUtileN: 0, misto: false, mezza: null,
      kOggi: giorniDiStudio(opz.inizioN, oggiN, cfg.giorni),
      tenute: opz.tenute || [], fattiOggi: {}, turniRipasso: opz.turniRipasso || {}, sequenze: {},
      turnoFisso: null, turnoOggi: null
    };
    for (i = 0; i < cat.length; i++) ctx.dur[cat[i].id] = durata(cat[i].id, moleIn, null);
    var turnoOggi = opz.turnoOggi;
    if (opz.fattoDalloStato) {
      /* FATTO OGGI (revisione S3v2): il piano salvato non ha la lista di oggi
         (salvato ridotto, o piu' di GIORNI_SALVATI giorni fa), quindi cio' che
         e' gia' fatto oggi si ricava dallo STATO: una tappa fatta oggi e' una
         voce nuova, una scatola ripassata oggi un ripasso di Richiama.
         Approssimato, e dichiarato: una tappa RIFATTA oggi (un ripasso) non si
         distingue da una fatta la prima volta e conta come nuova; una
         sbagliata recuperata oggi dallo stato non si vede (la chiave sparisce)
         e il suo tempo non si toglie. Il turno di oggi, a rotazione, e' della
         materia dell'ultima tappa nuova fatta oggi. */
      ctx.tenute = [];
      for (i = 0; i < materie.length; i++) {
        sue = perMateria[materie[i].nome];
        for (j = 0; j < sue.length; j++) {
          var idS = sue[j].id, tpS = st.tappe[idS] || {}, scS = st.scatole[idS];
          if (scS && scS.ultimo === oggiN) ctx.tenute.push(voce('ripasso', materie[i].nome, idS, 'richiama', MINUTI_RIPASSO));
          for (k = 0; k < TAPPE.length; k++) {
            if (!tpS[TAPPE[k]] || tpS[TAPPE[k]].fatto !== oggiN) continue;
            ctx.tenute.push(voce('lezione-nuova', materie[i].nome, idS, TAPPE[k], ctx.dur[idS][TAPPE[k]]));
            turnoOggi = materie[i].nome;
          }
        }
      }
      if (turnoOggi === null && ctx.tenute.length) turnoOggi = ctx.tenute[ctx.tenute.length - 1].materia;
    }
    for (i = 0; i < ctx.tenute.length; i++) {
      var tv = ctx.tenute[i];
      ctx.fattiOggi[tv.materia] = (ctx.fattiOggi[tv.materia] || 0) + (Number(tv.minuti) || 0);
    }
    /* ROTAZIONE (lettura OGGI): se lo studente ha gia' lavorato oggi, il
       turno di oggi resta di chi l'aveva (`opz.turnoOggi`, da riadatta), se e'
       ancora fra le scelte */
    for (j = 0; ctx.tenute.length && ctx.turnoFisso === null && j < materie.length; j++) {
      if (materie[j].nome === turnoOggi) ctx.turnoFisso = turnoOggi;
    }
    var restano = 0;
    for (i = 0; i < materie.length; i++) {
      var sue = perMateria[materie[i].nome];
      for (j = 0; j < sue.length; j++) {
        var tp = st.tappe[sue[j].id] || {};
        for (var k = 0; k < TAPPE.length; k++) if (!tp[TAPPE[k]]) { restano++; break; }
      }
    }

    var totali = cfg.appelloN - oggiN, riserva, r;
    if (presente(opz.riservaDaN)) {
      /* R6: la riserva fissata alla nascita (o all'ultimo cambio di cfg)
         si riusa COSI' COM'E': ne' la regola 1 ne' C1 da oggi. Con
         l'alternativa di C1 si riusa anche la parte a meta' scelta allora,
         finche' ha tappe da fare (revisione S3v2: senza, al primo ricalcolo
         la parte spariva e il piano restava vuoto) */
      riserva = cfg.appelloN - opz.riservaDaN;
      if (C1_SE_NON_ENTRA_NIENTE === 'mezza-parte' && typeof opz.mezza === 'string') {
        for (i = 0; i < materie.length && ctx.mezza === null; i++) {
          sue = perMateria[materie[i].nome];
          for (j = 0; j < sue.length; j++) {
            if (sue[j].id !== opz.mezza) continue;
            tp = st.tappe[opz.mezza] || {};
            for (k = 0; k < TAPPE.length; k++) if (!tp[TAPPE[k]]) { ctx.mezza = opz.mezza; break; }
          }
        }
      }
      r = conRiserva(ctx, riserva);
    } else {
      /* §4.1 regola 1: se i giorni sono gia' pochi la riserva si azzera */
      var azzerata = cfg.ripassoFinale > 0 && totali <= cfg.ripassoFinale;
      riserva = azzerata ? 0 : cfg.ripassoFinale;
      r = conRiserva(ctx, riserva);
      if (r.nuove === 0 && restano > 0 && riserva > 0) {
        if (C1_SE_NON_ENTRA_NIENTE === 'stringi') {
          /* C1: la riserva si stringe un giorno alla volta, mai sotto il minimo */
          for (var rr = riserva - 1; rr >= C1_RISERVA_MINIMA; rr--) {
            var prova = conRiserva(ctx, rr);
            if (prova.nuove > 0) { r = prova; riserva = rr; break; }
          }
          fissaRiserva(ctx, riserva);
        } else {
          /* C1 (alternativa): la riserva resta, entra UNA parte a meta' */
          ctx.mezza = primaDaFare(ctx);
          var conMezza = conRiserva(ctx, riserva);
          if (ctx.mezza !== null && conMezza.iniziate[ctx.mezza]) r = conMezza;
          else ctx.mezza = null;
        }
      }
    }
    piano.riservaDa = dataDa(cfg.appelloN - riserva);
    piano.turno = r.turnoUsato;
    piano.mezza = ctx.mezza;
    piano.giorni = r.giorni;
    var ritardo = R4_SOGLIA_RITARDO === null ? [] : calcolaRitardo(ctx, r);
    piano.avviso = calcolaAvviso(ctx, r, riserva, cfg.ripassoFinale, ritardo);
    return piano;
  }

  /* §2 pianifica */
  function pianifica(cfg, mole, stato, oggi) {
    var oggiN = giornoObbligatorio(oggi, 'oggi');
    return pianificaInterno(cfg, mole, stato, oggiN, { inizioN: oggiN, tenute: [], riservaDaN: null, turniRipasso: {} });
  }

  function vociDel(piano, chiave) {
    if (!eOggetto(piano) || !eOggetto(piano.giorni) || !proprio(piano.giorni, chiave)) return [];
    return eArray(piano.giorni[chiave]) ? piano.giorni[chiave] : [];
  }

  /* §2 dose: il giorno di oggi com'e' nel piano, meno cio' che e' gia'
     fatto. Non ricalcola e non anticipa niente dal giorno dopo. Una voce
     che non e' una voce (null, senza tipo) si salta: non fa esplodere la
     home. Cio' che lo stato porta e non si legge lo dichiara il piano
     (`scartati`), non la dose. */
  function dose(piano, stato, oggi) {
    var oggiN = giornoObbligatorio(oggi, 'oggi');
    var st = normStato(stato);
    var lista = vociDel(piano, dataDa(oggiN));
    var fuori = [];
    for (var i = 0; i < lista.length; i++) {
      if (voceValida(lista[i]) && !fatta(lista[i], st, oggiN)) fuori.push(clona(lista[i]));
    }
    return fuori;
  }

  /* R2 (alternativa): quanti turni di solo ripasso ha gia' avuto ogni
     materia, dai giorni passati del piano (un giorno di una materia sola
     e' un suo turno; uno con lezione nuova rimette il conto a zero) */
  function ripassoDallaStoria(vecchio, oggiS) {
    var out = {}, chiavi = [], k, i, j;
    if (!vecchio || !eOggetto(vecchio.giorni)) return out;
    for (k in vecchio.giorni) {
      if (proprio(vecchio.giorni, k) && giornoDa(k) !== null && k < oggiS) chiavi.push(k);
    }
    chiavi.sort();
    for (i = 0; i < chiavi.length; i++) {
      var lista = eArray(vecchio.giorni[chiavi[i]]) ? vecchio.giorni[chiavi[i]] : [];
      var chi = null, solo = true, nuovo = false;
      for (j = 0; j < lista.length; j++) {
        if (!voceValida(lista[j])) continue;
        var m = nomeMateria(lista[j].materia);
        if (chi === null) chi = m;
        else if (chi !== m) solo = false;
        if (lista[j].tipo === 'lezione-nuova') nuovo = true;
      }
      if (chi === null || !solo) continue;
      out[chi] = nuovo ? 0 : (out[chi] || 0) + 1;
    }
    return out;
  }

  /* R1 (alternativa): l'avviso di prima, detto come recuperato */
  function avvisoRecuperato(a) {
    var era = a.codice === 'recuperato' ? a.era : a.codice;
    var materie = [];
    if (eArray(a.materie)) {
      for (var i = 0; i < a.materie.length; i++) {
        var x = a.materie[i];
        var n = typeof x === 'string' ? x : (eOggetto(x) ? x.materia : null);
        if (typeof n === 'string' && n) materie.push(n);
      }
    }
    return { codice: 'recuperato', era: typeof era === 'string' ? era : null,
             materia: typeof a.materia === 'string' ? a.materia : (materie.length ? materie[0] : null),
             materie: materie };
  }

  /* §2 riadatta: il passato non si tocca, il resto si ricalcola da oggi
     sul materiale non ancora fatto (§5 dentro pianifica). `cfg` e `mole`
     facoltativi: se mancano valgono quelli salvati nel piano (L13); una
     cfg nuova DIVERSA da quella del piano e' il caso (c) del §2. */
  function riadatta(piano, stato, oggi, cfgNuova, moleNuova) {
    var oggiN = giornoObbligatorio(oggi, 'oggi');
    var oggiS = dataDa(oggiN);
    var vecchio = eOggetto(piano) ? piano : null;
    var cfg = cfgNuova !== undefined && cfgNuova !== null ? cfgNuova : (vecchio ? vecchio.cfg : null);
    var moleSua = vecchio ? (presente(vecchio.mole) ? vecchio.mole : vecchio.parti) : null;
    var mole = moleNuova !== undefined && moleNuova !== null ? moleNuova : moleSua;
    var st = normStato(stato), i;
    /* cio' che del piano salvato c'e' e non si sa leggere: si dichiara */
    var delPiano = [];
    function scartaDelPiano(voce) { delPiano.push({ campo: 'piano', parte: null, voce: voce }); }
    if (presente(piano) && !vecchio) scartaDelPiano(null);

    /* L8: di oggi resta cio' che e' gia' fatto, oggi */
    var tenute = [], lista = vecchio ? vociDel(vecchio, oggiS) : [];
    for (i = 0; i < lista.length; i++) {
      if (voceValida(lista[i]) && fattaOggi(lista[i], st, oggiN)) tenute.push(clona(lista[i]));
    }
    /* ROTAZIONE: di chi era il turno di oggi nel piano salvato. Se il piano e'
       di oggi lo dice lui (`turno`). Se e' di un giorno prima, e' la materia
       dell'ULTIMA voce del giorno: con 'in-testa' i recuperi delle materie
       finite stanno in testa, quelli di chi e' di turno dopo. Con la proposta
       ('turno') le voci di un giorno sono tutte di una materia e le due
       letture coincidono; con 'in-testa' differiscono solo in un giorno fatto
       SOLO di recuperi ospiti, dove il tempo e' gia' tutto loro (lo prova il
       test dell'alternativa). */
    var turnoOggi = null;
    if (vecchio && vecchio.generato === oggiS && typeof vecchio.turno === 'string') turnoOggi = nomeMateria(vecchio.turno);
    for (i = lista.length - 1; i >= 0 && turnoOggi === null; i--) {
      if (voceValida(lista[i]) && typeof lista[i].materia === 'string') turnoOggi = nomeMateria(lista[i].materia);
    }
    /* ANCORA: la rotazione resta ancorata al primo giorno del piano.
       Un'ancora che c'e' e non si legge non ricade in silenzio su un'altra
       data. */
    var inizioN = vecchio ? giornoDa(vecchio.inizio) : null;
    var generatoN = vecchio ? giornoDa(vecchio.generato) : null;
    if (vecchio && inizioN === null && presente(vecchio.inizio)) scartaDelPiano('inizio');
    if (vecchio && generatoN === null && presente(vecchio.generato)) scartaDelPiano('generato');
    if (inizioN === null) inizioN = generatoN;
    if (inizioN === null) inizioN = oggiN;

    /* R6: la riserva fissata alla nascita si riusa com'e', salvo un cambio
       di cfg. Una data che c'e' e non torna con la cfg si dichiara, e la
       riserva si rifissa. */
    var nc = normCfg(cfg, oggiN);
    var stessaCfg = !!vecchio && JSON.stringify(nc.pubblica) === JSON.stringify(vecchio.cfg);
    var riservaDaN = null;
    if (stessaCfg && presente(vecchio.riservaDa)) {
      var rd = giornoDa(vecchio.riservaDa);
      if (rd !== null && nc.appelloN !== null && rd <= nc.appelloN && rd >= nc.appelloN - nc.ripassoFinale) riservaDaN = rd;
      else scartaDelPiano('riservaDa');
    }

    /* FATTO OGGI: senza la lista di oggi nel piano salvato (una forma salvata
       ridotta, o di troppi giorni fa) cio' che e' gia' fatto oggi viene dallo
       stato (in pianificaInterno) */
    var fattoDalloStato = !!vecchio && !(eOggetto(vecchio.giorni) && proprio(vecchio.giorni, oggiS));

    var nuovo = pianificaInterno(cfg, mole, stato, oggiN, {
      inizioN: inizioN, tenute: tenute, riservaDaN: riservaDaN, turnoOggi: turnoOggi, fattoDalloStato: fattoDalloStato,
      mezza: riservaDaN !== null && typeof vecchio.mezza === 'string' ? vecchio.mezza : null,
      turniRipasso: R2_TURNI_DI_SOLO_RIPASSO > 0 ? ripassoDallaStoria(vecchio, oggiS) : {}
    });

    /* il passato resta com'era, parola per parola */
    var giorni = {};
    if (vecchio && presente(vecchio.giorni) && !eOggetto(vecchio.giorni)) scartaDelPiano('giorni');
    if (vecchio && eOggetto(vecchio.giorni)) {
      var chiavi = [], illeggibili = false;
      for (var k in vecchio.giorni) {
        if (!proprio(vecchio.giorni, k)) continue;
        if (giornoDa(k) === null) illeggibili = true;
        else if (k < oggiS) chiavi.push(k);
      }
      if (illeggibili) scartaDelPiano('giorni');
      chiavi.sort();
      for (i = 0; i < chiavi.length; i++) giorni[chiavi[i]] = clona(vecchio.giorni[chiavi[i]]);
    }
    for (var kn in nuovo.giorni) if (proprio(nuovo.giorni, kn)) giorni[kn] = nuovo.giorni[kn];
    nuovo.giorni = giorni;
    nuovo.scartati = delPiano.concat(nuovo.scartati);

    /* R1: l'avviso e' gia' quello ricalcolato da oggi (proposta). Con
       l'alternativa, un avviso che lo studente ha spento recuperando resta
       detto come 'recuperato' finche' la cfg non cambia. */
    if (R1_AVVISO_DOPO_IL_RECUPERO === 'recuperato' && stessaCfg && eOggetto(vecchio.avviso) &&
        DA_RECUPERARE[vecchio.avviso.codice] === true &&
        (nuovo.avviso === null || INFORMATIVI[nuovo.avviso.codice] === true)) {
      nuovo.avviso = avvisoRecuperato(vecchio.avviso);
    }
    return nuovo;
  }

  /* LA FORMA DA SALVARE (revisione S3v2). Il piano intero ha una voce per
     ogni giorno fino all'esame e non sta nel tetto del server (KV_VALORE_MAX
     in account/worker.js): con tre materie, due ore e l'appello di gennaio
     pesa gia' quasi quanto il tetto, e con l'orizzonte massimo di C3 lo
     supera di molte volte. Si salva questo: tutto il piano tranne i giorni,
     e dei giorni solo quelli da `generato` per GIORNI_SALVATI giorni (la
     lista di oggi e' cio' che dice a riadatta che cosa e' gia' fatto). Oltre
     quei giorni riadatta lo ricava dallo stato (FATTO OGGI). La mole resta:
     riadatta la rilegge da qui (L13) se non gliene si passa una nuova.
     Limite dichiarato: con l'alternativa di R2 i turni di solo ripasso gia'
     avuti si contano solo sui giorni salvati. */
  function daSalvare(piano) {
    if (!eOggetto(piano)) return null;
    var out = {}, k;
    for (k in piano) if (proprio(piano, k) && k !== 'giorni') out[k] = clona(piano[k]);
    out.giorni = {};
    var g0 = giornoDa(piano.generato);
    if (g0 !== null && eOggetto(piano.giorni)) {
      for (var d = g0; d < g0 + GIORNI_SALVATI; d++) {
        var ks = dataDa(d);
        if (proprio(piano.giorni, ks)) out.giorni[ks] = clona(piano.giorni[ks]);
      }
    }
    return out;
  }

  function congela(x) {
    if (x && typeof x === 'object') {
      for (var k in x) if (proprio(x, k)) congela(x[k]);
      Object.freeze(x);
    }
    return x;
  }

  var RITMI = congela({
    tappe: { capisci: MINUTI_CAPISCI, fai: MINUTI_FAI, richiama: MINUTI_RICHIAMA, nonCascarci: MINUTI_NON_CASCARCI },
    ordine: TAPPE.slice(),
    parteMin: PARTE_MIN,
    tappaMin: TAPPA_MIN,
    ripasso: MINUTI_RIPASSO,
    sbagliate: MINUTI_SBAGLIATE,
    intervalli: INTERVALLI_SCATOLE.slice(),
    rinvioNo: RINVIO_NO,
    rinvioIncerto: RINVIO_INCERTO,
    ripassoFinale: RIPASSO_FINALE_BASE,
    priorita: PRIORITA_BASE,
    orizzonteMax: ORIZZONTE_MAX,
    orizzonteAvviso: ORIZZONTE_AVVISO,
    orizzonteTecnico: ORIZZONTE_TECNICO
  });

  /* le sei scelte accese in questo file (§0): per chi integra (S4) e per
     il presidio che dira' se sono quelle approvate dall'utente */
  var SCELTE = congela({
    R1: R1_AVVISO_DOPO_IL_RECUPERO,
    R2: R2_TURNI_DI_SOLO_RIPASSO,
    R2Recuperi: R2_RECUPERI_DOPO_LA_FINE,
    R4: R4_SOGLIA_RITARDO,
    R7: R7_MINUTI_DOPO_UN_RECUPERO,
    C1: C1_SE_NON_ENTRA_NIENTE,
    C1RiservaMinima: C1_RISERVA_MINIMA,
    C3: C3_ORIZZONTE
  });

  var Masterplan = {
    durata: durata,
    pianifica: pianifica,
    dose: dose,
    riadatta: riadatta,
    daSalvare: daSalvare,
    RITMI: RITMI,
    SCELTE: SCELTE,
    VERSIONE: VERSIONE
  };

  global.Masterplan = Masterplan;
  if (typeof module !== 'undefined' && module.exports) module.exports = Masterplan;

/* In pagina e' `window`. In node (require) `this` di un modulo CommonJS e'
   module.exports: si passa globalThis, come fa quiz.js. */
})(typeof window !== 'undefined' ? window
  : typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global : this);
