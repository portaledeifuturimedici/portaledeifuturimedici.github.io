# Uso del marchio

> **Generato da `logo.py --kit`.** Non modificare i file a mano: cambia la fonte
> (`logo.py` per la forma, `palette.py` per i colori, `BRAND` in `site_build.py`
> per il nome) e rigenera con `py -3.12 logo.py --kit`. I numeri qui sotto sono
> ricavati dalla geometria, non scelti a sentimento.

## Il segno

Un **anello aperto in basso** con **tre nodi** dentro. L'apertura è il punto:
è una soglia che si attraversa, non un cerchio chiuso e non un bollino. I tre
nodi sono le tre voci che accompagnano chi entra — e le tre materie d'esame.

Kit «Oculo» v1.0, scelto dal proprietario il 2026-08-02. **Sostituisce il
Cerbero a tre teste come segno del sito:** il Cerbero resta il cast dei
materiali, non è più il marchio. Se trovi il vecchio segno da qualche parte, è
un residuo da sostituire, non una variante ammessa.

## Cosa c'è nel kit

| File | Quando si usa |
| --- | --- |
| `marchio.svg` | il segno da solo, col suo riquadro. L'uso normale. |
| `marchio-senza-fondo.svg` | quando il fondo lo metti tu (e non è scuro). |
| `favicon.svg` | scheda del browser e usi minuti (ma leggi «Il limite», sotto). |
| `marchio-mono-chiaro.svg` | una tinta sola, su fondo scuro. |
| `marchio-mono-scuro.svg` | una tinta sola, su fondo chiaro. |
| `lockup-orizzontale.svg` | marchio + nome. **La forma da usare quasi sempre** fuori dal sito. |
| `lockup-orizzontale-chiaro.svg` | lo stesso, per fondi chiari. |
| `lockup-verticale.svg` | quando lo spazio è stretto e alto. |
| `lockup-mono-*.svg` | lockup a una tinta sola. |

Il portale rende **uguale a ogni dimensione**: non ha due versioni come il
vecchio marchio, e `favicon.svg` è lo stesso segno, non una resa alternativa.

## I colori, e dove stanno

| Parte | Colore | Da dove viene |
| --- | --- | --- |
| anello | `#D2E8FB` | l'inchiostro della palette con un soffio di ciano Pocho (`BRAND_FREDDO`) |
| nodo in alto, **al centro** | `#FFB23E` | oro di **Diego** |
| nodo in basso a sinistra | `#2BE0E0` | ciano di **Pocho** |
| nodo in basso a destra | `#C04BFF` | viola di **Ciro** |

**L'oro sta al centro.** È una decisione del proprietario, non un caso: se
sposti l'oro il segno cambia identità. I tre colori sono i più distinguibili
della palette (**45,6 dE00** in visione tipica, **23,5** in deuteranopia) e si
rigenerano da `palette.py` — il kit si rifà, non si ritocca a mano.

## Regole

**Dimensione minima:** **29 px** per il marchio da solo,
150 px di larghezza per il lockup. Sotto il primo, il vuoto fra il
nodo in alto e l'anello scende sotto 1,5 px e i due si impastano;
sotto il secondo il nome non si legge.

**Area di rispetto:** attorno al marchio lascia almeno il **9,4%**
della sua larghezza — è già dentro `marchio.svg`, ma se lo ritagli, ridalla.

**Non fare:** non chiudere l'anello (senza apertura non è più un passaggio);
non spostare l'apertura — sta **sempre in basso**, e ruotare il segno la sposta;
non muovere l'oro dal centro; non ricolorare i nodi uno per uno; non staccare i
nodi dall'anello; non stirare in modo non proporzionale; non aggiungere ombre o
contorni; non metterlo su un fondo che non stacca (serve almeno 3:1 con
l'anello).

## Il limite da conoscere

**Sotto i 20 px il nodo in alto TOCCA l'anello.** Il vuoto più stretto
del segno vale 6,7 unità su 128: a 32 px fa 1,67 px e regge, a 16 px
fa 0,84 px e le due forme si fondono. Quindi alle misure minute della scheda
browser il portale perde lo stacco interno. Non è un errore di chi lo usa: è la
forma, e sistemarlo vuol dire ritoccare il segno — decisione del proprietario,
oggi **aperta**.

**Nei lockup il nome è TESTO, non tracciati.** Rende con i caratteri di sistema,
quindi cambia leggermente da una macchina all'altra — ed è il motivo per cui il
riquadro ha un margine destro un po' abbondante: tarato stretto, altrove
taglierebbe.

Per la **stampa** e per i prodotti serve convertire il testo in tracciati, o
scegliere un carattere di marca e incorporarlo. È una decisione aperta: qui non
c'è un motore di font per farlo, e scegliere il carattere è una scelta di brand.

_Nome attuale: **Portale dei Futuri Medici** — si cambia da `BRAND` in `site_build.py`._
